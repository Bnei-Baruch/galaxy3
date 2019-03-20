import React, {Component} from 'react';
import {Janus} from "../../lib/janus";
import {Grid, Label, Message, Segment, Table, Icon, Popup, Button, Input, Dropdown} from "semantic-ui-react";
import {sendProtocolMessage} from "../../shared/protocol";
import './ShidurApp.css';


class ShidurToran extends Component {

    state = {
        feeds: [],
        qfeeds: [],
        name: "",
        disabled_groups: [],
        group: null,
        pri: null,
        pr1: [],
        pre: null,
        program: null,
        pre_feed: null,
        full_feed: null,
        protocol: null,
        pgm_state: [],
        quistions_queue: [],
        muted: true,
        zoom: false,
        fullscr: false,
        round: 0,
        sdiout: false,
        sndman: false,
        sorted_feeds: [],
    };

    componentDidMount() {
    };

    componentWillUnmount() {
    };

    resetQueue = () => {
        console.log("-- Reset Queue --");
        this.setState({feeds_queue: 0});
        setTimeout(() => {
            this.col1.switchFour();
            this.col2.switchFour();
            this.col3.switchFour();
        }, 1000);
    };

    fixProgram = (index) => {
        let {feeds,pr1} = this.state;
        let i = this.state.pri || index;
        let feed = feeds[i];
        pr1[i] = null;
        if(i < 4) {
            this.col1.switchNext(i,feed,"fix");
        } else if(i < 8) {
            this.col2.switchNext(i,feed,"fix");
        } else if(i < 12) {
            this.col3.switchNext(i,feed,"fix");
        }
    };

    reloadPage = () => {
        this.col1.sdiAction("restart");
    };

    newSwitchFeed = (id, program, i) => {
        let pre = null;
        this.props.janus.attach(
            {
                plugin: "janus.plugin.videoroom",
                opaqueId: "switchfeed_user",
                success: (pluginHandle) => {
                    pre = pluginHandle;
                    pre.simulcastStarted = false;
                    Janus.log("Plugin attached! (" + pre.getPlugin() + ", id=" + pre.getId() + ")");
                    Janus.log("  -- This is a subscriber");
                    let listen = { "request": "join", "room": 1234, "ptype": "subscriber", streams: [{feed: id, mid: "1"}] };
                    pre.send({"message": listen});
                    this.setState({pre});
                },
                error: (error) => {
                    Janus.error("  -- Error attaching plugin...", error);
                },
                onmessage: (msg, jsep) => {
                    Janus.debug(" ::: Got a message (subscriber) :::");
                    Janus.debug(msg);
                    let event = msg["videoroom"];
                    Janus.debug("Event: " + event);
                    if(msg["error"] !== undefined && msg["error"] !== null) {
                        Janus.debug(":: Error msg: " + msg["error"]);
                    } else if(event !== undefined && event !== null) {
                        if(event === "attached") {
                            // Subscriber created and attached
                            Janus.log("Successfully attached to feed " + pre);
                        } else {
                            // What has just happened?
                        }
                    }
                    if(msg["streams"]) {
                        // Update map of subscriptions by mid
                        Janus.log(" :: Streams updated! : ",msg["streams"]);
                        // let {mids} = this.state;
                        // for(let i in msg["streams"]) {
                        //     let mindex = msg["streams"][i]["mid"];
                        //     //let feed_id = msg["streams"][i]["feed_id"];
                        //     mids[mindex] = msg["streams"][i];
                        // }
                        // this.setState({mids});
                    }
                    if(jsep !== undefined && jsep !== null) {
                        Janus.debug("Handling SDP as well...");
                        Janus.debug(jsep);
                        // Answer and attach
                        pre.createAnswer(
                            {
                                jsep: jsep,
                                media: { audio: false, videoSend: false },	// We want recvonly audio/video
                                success: (jsep) => {
                                    Janus.debug("Got SDP!");
                                    Janus.debug(jsep);
                                    let body = { "request": "start", "room": 1234 };
                                    pre.send({"message": body, "jsep": jsep});
                                },
                                error: (error) => {
                                    Janus.error("WebRTC error:", error);
                                }
                            });
                    }
                },
                webrtcState: (on) => {
                    Janus.log("Janus says this WebRTC PeerConnection (feed #" + pre + ") is " + (on ? "up" : "down") + " now");
                },
                onlocalstream: (stream) => {
                    // The subscriber stream is recvonly, we don't expect anything here
                },
                onremotetrack: (track,mid,on) => {
                    Janus.debug(" - Remote track "+mid+" is: "+on,track);
                    if(!on) {
                        console.log(" :: Going to stop track :: " + track + ":", mid);
                        //FIXME: Remove callback for audio track does not come
                        track.stop();
                        //FIXME: does we really need to stop all track for feed id?
                        return;
                    }
                    if(track.kind !== "video" || !on || !track.muted)
                        return;
                    let stream = new MediaStream();
                    stream.addTrack(track.clone());
                    Janus.debug("Remote feed #" + pre);
                    let switchvideo = this.refs.prevewVideo;
                    Janus.log(" Attach remote stream on video: "+i);
                    Janus.attachMediaStream(switchvideo, stream);
                },
                oncleanup: () => {
                    Janus.log(" ::: Got a cleanup notification (remote feed "+id+" : "+i+") :::");
                    console.log(" :: Cleanup handle! - " + id + " - index: " + i);
                }
            });
    };

    switchPreview = (id, display) => {
        if(!this.state.pre) {
            this.newSwitchFeed(id,false);
        } else {
            let streams = [{feed: id, mid: "1", sub_mid: "0"}];
            let switchfeed = {"request": "switch", streams};
            this.state.pre.send ({"message": switchfeed,
                success: () => {
                    Janus.log(" :: Preview Switch Feed to: ", display);
                }
            })
        }
    };

    sortGroups = () => {
        let sorted_feeds = this.props.feeds.slice();
        sorted_feeds.sort((a, b) => {
            if (a.display.display > b.display.display) return 1;
            if (a.display.display < b.display.display) return -1;
            return 0;
        });
        this.setState({sorted_feeds});
    };

    selectGroup = (pre_feed) => {
        this.props.setProps({pre_feed});
        Janus.log(pre_feed);
        this.switchPreview(pre_feed.id, pre_feed.display);
        // We can show in preview feed stream object
        // if(this.state.feedStreams[pre_feed.id]) {
        //     let {stream} = this.state.feedStreams[pre_feed.id];
        //     let video = this.refs.prevewVideo;
        //     Janus.log(" Attach mid to preview: "+pre_feed.id);
        //     Janus.attachMediaStream(video, stream);
        // } else {
        //     this.switchPreview(pre_feed.id, pre_feed.display);
        // }
    };

    disableGroup = (e, pre_feed) => {
        if(e) e.preventDefault();
        let {disabled_groups} = this.state;
        Janus.log(" :: Put to disabled: ", pre_feed);
        let chk = disabled_groups.find(g => g.id === pre_feed.id);
        if(chk)
            return;
        this.sdiAction("disable", true, null, pre_feed);
        disabled_groups.push(pre_feed);
        this.props.removeFeed(pre_feed.id);
        this.hidePreview();
        this.props.setProps({disabled_groups});
    };

    hidePreview = () => {
        //this.state.pre.detach();
        this.setState({pre: null});
        this.props.setProps({pre_feed: null});
    };

    checkPreview = (id) => {
        let {pre_feed} = this.props;
        if(pre_feed && pre_feed.id === id) {
            this.hidePreview()
        }
    };

    restoreGroup = (e, data, i) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            let {disabled_groups,feeds,users} = this.props;
            for(let i = 0; i < disabled_groups.length; i++) {
                if(disabled_groups[i].display.id === data.display.id) {
                    //TODO: check if we got question while feed was disable
                    disabled_groups.splice(i, 1);
                    feeds.push(data);
                    let user = data.display;
                    user.rfid = data.id;
                    users[user.id] = user;
                    this.props.setProps({disabled_groups,feeds,users});
                    this.sdiAction("restore", true, i, data);
                }
            }
        }
    };

    sdiAction = (action, status, i, feed) => {
        //FIXME: Must be removed in production mode
        return;
        const { protocol, user, index } = this.props;
        let col = null;
        if(index === 0) {
            col = 1;
        } else if(index === 4) {
            col = 2;
        } else if(index === 8) {
            col = 3;
        }
        let msg = { type: "sdi-"+action, status, room: 1234, col, i, feed};
        sendProtocolMessage(protocol, user, msg );
    };

    render() {

        const {user,users,feeds,pre_feed,feeds_queue,disabled_groups,round,qfeeds,pri,sdiout,sndman} = this.props;

        const width = "100%";
        const height = "100%";
        const autoPlay = true;
        const controls = false;
        const muted = true;
        const q = (<Icon color='red' name='question circle' />);

        let group_options = this.state.sorted_feeds.map((feed,i) => {
            const display = feed.display.display;
            return ({ key: i, value: feed, text: display })
        });

        let queue_options = qfeeds.map((feed,i) => {
            if(feed) {
                const {display} = feed.display;
                return ({ key: i, value: feed, text: display, icon: 'help'});
            }
        });

        let preview = (<div className={pre_feed ? "" : "hidden"}>
                <div className="fullscrvideo_title"><span>{pre_feed ? pre_feed.display.display : ""}</span></div>
                <div className={
                    //TODO: Fix this ugly shit!
                    pre_feed ? users[pre_feed.display.id] ? users[pre_feed.display.id].question ? 'qst_fullscreentitle' : 'hidden' : 'hidden' : 'hidden'
                }>?</div>
                <video
                    onContextMenu={(e) => this.zoominGroup(e, null, "pre")}
                    ref = {"prevewVideo"}
                    id = "prevewVideo"
                    width = "400"
                    height = "220"
                    autoPlay = {autoPlay}
                    controls = {controls}
                    muted = {muted}
                    playsInline = {true} />
                <Button className='close_button'
                        size='mini'
                        color='red'
                        icon='close'
                        onClick={() => this.disableGroup(null, pre_feed)} />
                <Button className='hide_button'
                        size='mini'
                        color='orange'
                        icon='window minimize'
                        onClick={() => this.hidePreview()} />
            </div>
        );

        let disabled_list = disabled_groups.map((data,i) => {
            const {id, display} = data;
            return (
                <Table.Row key={id} warning
                           onClick={() => this.selectGroup(data, i)}
                           onContextMenu={(e) => this.restoreGroup(e, data, i)} >
                    <Table.Cell width={5}>{display.display}</Table.Cell>
                    <Table.Cell width={1}>{id}</Table.Cell>
                </Table.Row>
            )
        });

        let groups_list = feeds.map((feed,i) => {
            const {id, display} = feed;
            return (
                <Table.Row className={pre_feed && id === pre_feed.id ? 'active' : 'no'}
                           key={i} onClick={() => this.selectGroup(feed)}
                           onContextMenu={(e) => this.disableGroup(e, feed, i)} >
                    <Table.Cell width={5}>{display.display}</Table.Cell>
                    <Table.Cell width={1}>{0}</Table.Cell>
                    <Table.Cell width={1}>{0}</Table.Cell>
                </Table.Row>
            )
        });

        return (
            <Grid.Row>
                <Grid.Column>
                    <Segment className="preview_conteiner">
                        <Segment className="group_segment" color='green'>

                        </Segment>
                    </Segment>
                    <Message attached className='info-panel' color='grey'>
                        <Popup on='click'
                               trigger={<Label attached='top left' color='grey'>
                                   Next: {feeds[feeds_queue] ? feeds[feeds_queue].display.display : ""}
                               </Label>}
                               flowing
                               position='bottom center'
                               hoverable>
                            <Input type='text' placeholder='' action value={pri}
                                   onChange={(v,{value}) => this.setState({pri: value})}>
                                <input />
                                <Button positive onClick={this.fixProgram}>Fix</Button>
                            </Input>
                        </Popup>
                        <Label color='brown'>
                            <Icon size='big' name='address card' />
                            <b className='queue_counter'>{feeds.length - feeds_queue}</b>
                            <Icon name='delete' onClick={this.resetQueue} />
                        </Label>
                        <Label attached='top right' color='blue' >
                            Round: {round}
                        </Label>
                    </Message>
                    <Button.Group attached='bottom' >
                        <Button
                            color={sndman ? "green" : "red"}
                            disabled={!sndman}
                            onClick={() => this.col1.sdiAction("restart", false, 1, {sndman: true})}>
                            SndMan</Button>
                        <Button
                            color={sdiout ? "green" : "red"}
                            disabled={!sdiout}
                            onClick={() => this.col1.sdiAction("restart", false, 1, {sdiout: true})}>
                            SdiOut</Button>
                    </Button.Group>
                </Grid.Column>
                <Grid.Column>
                    <Segment textAlign='center' >
                        <Label attached='top right' color={feeds.length > 12 ? 'green' : 'grey'}>
                            Online: {feeds.length}
                        </Label>
                        <Dropdown className='select_group'
                                  placeholder='Search..'
                                  fluid
                                  search
                                  selection
                                  options={group_options}
                                  onClick={this.sortGroups}
                                  onChange={(e,{value}) => this.selectGroup(value)} />
                    </Segment>
                    <Segment textAlign='center' className="group_list" raised >
                        <Table selectable compact='very' basic structured className="admin_table" unstackable>
                            <Table.Body>
                                {groups_list}
                            </Table.Body>
                        </Table>
                    </Segment>
                    <Segment textAlign='center' >
                        <Label attached='top right' color={qfeeds.length > 0 ? 'red' : 'grey'}>
                            Questions: {qfeeds.length}
                        </Label>
                        <Dropdown className='select_group' error={qfeeds.length > 0}
                                  placeholder='Questions'
                                  fluid
                                  selection
                                  options={queue_options}
                                  onChange={(e,{value}) => this.selectGroup(value)} />
                    </Segment>
                </Grid.Column>
                <Grid.Column>
                    <Segment className="preview_conteiner">
                        <Segment className="group_segment" color='green'>
                            {preview}
                        </Segment>
                    </Segment>
                    <Segment textAlign='center' className="disabled_groups">
                        <Table selectable compact='very' basic structured className="admin_table" unstackable>
                            <Table.Body>
                                {disabled_list}
                            </Table.Body>
                        </Table>
                    </Segment>
                </Grid.Column>
            </Grid.Row>
        );
    }
}

export default ShidurToran;
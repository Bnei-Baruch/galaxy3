import React, {Component} from 'react';
import {Janus} from "../../lib/janus";
import {Grid, Label, Message, Segment, Table, Icon, Button, Dropdown, Dimmer} from "semantic-ui-react";
import {sendProtocolMessage} from "../../shared/protocol";
import './ShidurToran.scss';


class ShidurToran extends Component {

    state = {
        feeds: [],
        qfeeds: [],
        name: "",
        disabled_groups: [],
        group: null,
        mids: [],
        feeds_queue: 0,
        pr1: [],
        previewFeed: null,
        preview: null,
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

    componentDidUpdate() {
        this.scrollToBottom();
        if(this.props.feeds_queue !== this.state.feeds_queue) {
            Janus.log(" --::: DidUpdate: ",this.props.feeds_queue, this.state.feeds_queue);
            this.setState({feeds_queue: this.props.feeds_queue});
            setTimeout(() => {
                this.selectNext();
            }, 500);
        }
    }

    newPreviewFeed = (id, preview, i) => {
        this.props.janus.attach(
            {
                plugin: "janus.plugin.videoroom",
                opaqueId: "switchfeed_user",
                success: (pluginHandle) => {
                    let previewFeed = pluginHandle;
                    Janus.log("Plugin attached! (" + previewFeed.getPlugin() + ", id=" + previewFeed.getId() + ")");
                    Janus.log("  -- This is a subscriber");
                    let streams = [{feed: id, mid: "1"},{feed: id, mid: "1"}];
                    let subscribe = { "request": "join", "room": 1234, "ptype": "subscriber", streams };
                    previewFeed.send({"message": subscribe});
                    this.setState({previewFeed});
                },
                error: (error) => {
                    Janus.error("  -- Error attaching plugin...", error);
                },
                iceState: (state) => {
                    Janus.log("ICE state (remote feed) changed to " + state);
                },
                webrtcState: (on) => {
                    Janus.log("Janus says this WebRTC PeerConnection (remote feed) is " + (on ? "up" : "down") + " now");
                },
                slowLink: (uplink, nacks) => {
                    Janus.warn("Janus reports problems " + (uplink ? "sending" : "receiving") +
                        " packets on this PeerConnection (remote feed, " + nacks + " NACKs/s " + (uplink ? "received" : "sent") + ")");
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
                            Janus.log("Successfully attached to feed in room " + msg["room"]);
                        } else {
                            // What has just happened?
                        }
                    }
                    if(msg["streams"]) {
                        // Update map of subscriptions by mid
                        Janus.log(" :: Streams updated! : ",msg["streams"]);
                        let {mids} = this.state;
                        for(let i in msg["streams"]) {
                            let mindex = msg["streams"][i]["mid"];
                            //let feed_id = msg["streams"][i]["feed_id"];
                            mids[mindex] = msg["streams"][i];
                        }
                        this.setState({mids});
                    }
                    if(jsep !== undefined && jsep !== null) {
                        Janus.debug("Handling SDP as well...");
                        Janus.debug(jsep);
                        let {previewFeed} = this.state;
                        // Answer and attach
                        previewFeed.createAnswer(
                            {
                                jsep: jsep,
                                media: { audio: false, videoSend: false },	// We want recvonly audio/video
                                success: (jsep) => {
                                    Janus.debug("Got SDP!");
                                    Janus.debug(jsep);
                                    let body = { "request": "start", "room": 1234 };
                                    previewFeed.send({"message": body, "jsep": jsep});
                                },
                                error: (error) => {
                                    Janus.error("WebRTC error:", error);
                                }
                            });
                    }
                },
                onlocalstream: (stream) => {
                    // The subscriber stream is recvonly, we don't expect anything here
                },
                onremotetrack: (track,mid,on) => {
                    Janus.log(" - Remote track "+mid+" is: "+on,track);
                    if(!on) {
                        console.log(" :: Going to stop track :: " + track + ":", mid);
                        //FIXME: Remove callback for audio track does not come
                        track.stop();
                        //FIXME: does we really need to stop all track for feed id?
                        return;
                    }
                    if(track.kind !== "video" || !on)
                        return;
                    let stream = new MediaStream();
                    stream.addTrack(track.clone());
                    let switchvideo = mid === "0" ? this.refs.prevewVideo : this.refs.nextVideo;
                    Janus.log(" Attach remote stream on video: "+i);
                    Janus.attachMediaStream(switchvideo, stream);
                },
                oncleanup: () => {
                    Janus.log(" ::: Got a cleanup notification (preview feed) :::");
                }
            });
    };

    switchPreview = (id, preview) => {
        const {previewFeed} = this.state;
        if(previewFeed && previewFeed.send) {
            let streams = [{feed: id, mid: "1", sub_mid: (preview ? "0" : "1")}];
            let switchfeed = {"request": "switch", streams};
            previewFeed.send ({"message": switchfeed,
                success: () => {
                    Janus.log(" :: Preview Switch Feed to: ", id);
                }
            })
        } else {
            this.newPreviewFeed(id, preview);
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
        Janus.log(" :: Select feed to preview: ", pre_feed);
        this.switchPreview(pre_feed.id, true);
    };

    selectNext = () => {
        const {feeds,feeds_queue} = this.props;
        let next_feed = feeds[feeds_queue];
        if(next_feed) {
            Janus.log(" :: Select next feed: ", next_feed);
            this.setState({next_feed});
            this.switchPreview(next_feed.id, false);
        }
    };

    disableGroup = (e, pre_feed) => {
        //this.setDelay();
        if(e) e.preventDefault();
        let {disable_button,feeds} = this.props;
        let {disabled_groups} = this.state;
        if(feeds.length < 14 || disable_button)
            return;
        Janus.log(" :: Put to disabled: ", pre_feed);
        let chk = disabled_groups.find(g => g.id === pre_feed.id);
        if(chk)
            return;
        disabled_groups.push(pre_feed);
        this.props.removeFeed(pre_feed.id, true);
        this.props.setProps({disabled_groups});
        this.selectNext();
    };

    restoreGroup = (e, data, i) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            let {disabled_groups,feeds,users} = this.props;
            for(let i = 0; i < disabled_groups.length; i++) {
                if(disabled_groups[i].display.id === data.display.id) {
                    if(disabled_groups[i].display.question) {
                        let {quistions_queue,qfeeds} = this.props;
                        let qq = {rfid: disabled_groups[i].id, user: disabled_groups[i].display};
                        let qs = {id: disabled_groups[i].id, display: disabled_groups[i].display};
                        qfeeds.push(qs);
                        quistions_queue.push(qq);
                        this.props.setProps({quistions_queue, qfeeds});
                    }
                    disabled_groups.splice(i, 1);
                    feeds.push(data);
                    let user = data.display;
                    user.rfid = data.id;
                    users[user.id] = user;
                    this.props.setProps({disabled_groups,feeds,users});
                }
            }
        }
    };

    sdiAction = (action, status, i, feed) => {
        const { protocol, user, index } = this.props;
        let col = index === 0 ? 1 : index === 4 ? 2 : index === 8 ? 3 : null;
        let msg = { type: "sdi-"+action, status, room: 1234, col, i, feed};
        sendProtocolMessage(protocol, user, msg );
    };

    scrollToBottom = () => {
        this.refs.end.scrollIntoView({ behavior: 'smooth' })
    };

    zoomIn = (pre) => {
        let {zoom} = this.state;
        this.setState({zoom: !zoom},() => {
            let video = pre ? this.refs.prevewVideo : this.refs.nextVideo;
            let zoom_video = this.refs.zoomVideo;
            zoom_video.srcObject = video.captureStream();
        });
    };

    zoomOut = () => this.setState({ zoom: false });

    setDelay = () => {
        this.props.setProps({disable_button: true, next_button: true});
        setTimeout(() => {
            this.props.setProps({disable_button: false, next_button: false});
        }, 2000);
    };

    questionStatus = () => {
        let {mids,qfeeds,quistions_queue} = this.props;
        for(let i = 0; i < quistions_queue.length; i++) {
            let qp_count = mids.filter(qp => qp.active && qp.feed_id === quistions_queue[i].rfid).length;
            let qf_chk = qfeeds.find(qf => qf.id === quistions_queue[i].rfid);
            if(qp_count > 0 && qf_chk) {
                for (let q = 0; q < qfeeds.length; q++) {
                    if (qfeeds[q] && qfeeds[q].id === quistions_queue[i].rfid) {
                        Janus.log(" - Remove QFEED: ", qfeeds[q]);
                        qfeeds.splice(q, 1);
                        this.props.setProps({qfeeds});
                        break
                    }
                }
            } else if(qp_count === 0 && !qf_chk) {
                qfeeds.push({id: quistions_queue[i].rfid, display: quistions_queue[i].user});
                this.props.setProps({qfeeds});
            }
        }
    };

    setPreset = () => {
        Janus.log(" :: Set preset ::");
        let {users,mids} = this.props;
        let index = 0;
        let preset = [
            // Moscow - aceea810-34c9-4909-8619-ff3050afab23
            // Piter - 2d2562e2-5b21-4d80-8147-8246f51e1f6e
            // New York - 4d1bd4e4-5bba-4bee-a224-1136d812f2d8
            // Kiev - 84beb035-cb7e-4a1d-b4f4-662b4bbdd55a
            {"sub_mid":"0","user_id":"aceea810-34c9-4909-8619-ff3050afab23"},
            {"sub_mid":"3","user_id":"2d2562e2-5b21-4d80-8147-8246f51e1f6e"},
            {"sub_mid":"6","user_id":"4d1bd4e4-5bba-4bee-a224-1136d812f2d8"},
            {"sub_mid":"9","user_id":"84beb035-cb7e-4a1d-b4f4-662b4bbdd55a"},
        ];
        let streams = [];

        for(let i=index; i<index+4; i++) {
            let sub_mid = preset[i].sub_mid;
            let user_id = preset[i].user_id;
            let mid = mids[sub_mid];
            if(mid && mid.active && users[user_id]) {
                // TODO: check if user online
                let feed = users[user_id].rfid;
                streams.push({feed, mid: "1", sub_mid});
            }

        }

        Janus.log(" :: Going to switch four: ", streams);
        let switch_four = {request: "switch", streams};
        this.props.remoteFeed.send ({"message": switch_four,
            success: () => {
                Janus.debug(" -- Switch success: ");
                // Add to qfeeds if removed from program with question status
                setTimeout(() => {
                    this.questionStatus();
                }, 1000);
            }
        });

        // Send sdi action
        this.sdiAction("switch_req" , true, null, streams);
    };

    render() {

        const {users,feeds,pre_feed,feeds_queue,disabled_groups,round,qfeeds,sdiout,sndman,log_list,disable_button} = this.props;
        const {next_feed,zoom} = this.state;

        const autoPlay = true;
        const controls = false;
        const muted = true;
        const pre_question = pre_feed && users[pre_feed.display.id] ? users[pre_feed.display.id].question : null;
        const next_question = next_feed && users[next_feed.display.id] ? users[next_feed.display.id].question : null;
        const q = (<div className="questiont">
            <svg viewBox="0 0 50 50">
                <text x="25" y="25" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">&#xF128;</text>
            </svg>
        </div>);

        let group_options = this.state.sorted_feeds.map((feed,i) => {
            const display = feed.display.display;
            return ({ key: i, value: feed, text: display })
        });

        let queue_options = qfeeds.map((feed,i) => {
            if(feed) {
                const {display} = feed.display;
                return ({ key: i, value: feed, text: display, icon: 'help'});
            }
            return true;
        });

        let preview = (<div className={pre_feed ? "" : "hidden"}>
                <div className="fullscrvideo_title"><span>{pre_feed ? pre_feed.display.display : ""}</span></div>
                {pre_question ? q : ''}
                <video
                    onClick={() => this.zoomIn(true)}
                    ref = {"prevewVideo"}
                    id = "prevewVideo"
                    width = "400"
                    height = "220"
                    autoPlay = {autoPlay}
                    controls = {controls}
                    muted = {muted}
                    playsInline = {true} />
                <Button className='close_button'
                        disabled={feeds.length < 14 || disable_button}
                        size='mini'
                        color='red'
                        icon='close'
                        onClick={() => this.disableGroup(null, pre_feed)} />
                <Button className='hide_button'
                        size='mini'
                        color='orange'
                        icon='window minimize'
                        onClick={() => this.props.setProps({pre_feed: null})} />
            </div>
        );

        let nextfeed = (<div className={next_feed ? "" : "hidden"}>
                <div className="fullscrvideo_title"><span>{next_feed ? next_feed.display.display : ""}</span></div>
                {next_question ? q : ''}
                <video onClick={() => this.zoomIn(false)}
                    ref = {"nextVideo"}
                    id = "nextVideo"
                    width = "400"
                    height = "220"
                    autoPlay = {autoPlay}
                    controls = {controls}
                    muted = {muted}
                    playsInline = {true} />
                <Button className='close_button'
                        disabled={feeds.length < 14 || disable_button}
                        size='mini'
                        color='red'
                        icon='close'
                        onClick={() => this.disableGroup(null, next_feed)} />
                <Button className='hide_button'
                        disabled={disable_button}
                        size='mini'
                        color='green'
                        icon='share'
                        onClick={this.props.nextInQueue} />
            </div>
        );

        let disabled_list = disabled_groups.map((data,i) => {
            const {id, display} = data;
            return (
                <Table.Row key={id} warning
                           onClick={() => this.selectGroup(data, i)}
                           onContextMenu={(e) => this.restoreGroup(e, data, i)} >
                    <Table.Cell width={5}>{display.display}</Table.Cell>
                    <Table.Cell width={1}>{0}</Table.Cell>
                    <Table.Cell width={1}>{0}</Table.Cell>
                </Table.Row>
            )
        });

        let groups_list = feeds.map((feed,i) => {
            const {id, display} = feed;
            return (
                <Table.Row className={pre_feed && id === pre_feed.id ? 'active' : 'no'}
                           key={i} onClick={() => this.selectGroup(feed)}
                           onContextMenu={(e) => this.disableGroup(e, feed, i)} disabled={disable_button}>
                    <Table.Cell width={5}>{display.display}</Table.Cell>
                    <Table.Cell width={1}>{0}</Table.Cell>
                    <Table.Cell width={1}>{0}</Table.Cell>
                </Table.Row>
            )
        });

        let action_log = log_list.map((msg,i) => {
            let {user,time,text} = msg;
            return (
                <div key={i}><p>
                    <i style={{color: 'grey'}}>{time}</i>&nbsp;&nbsp;--&nbsp;&nbsp;
                    <i style={{color: 'blue'}}>{user.display} &nbsp;--&nbsp;&nbsp; {text}</i>
                </p></div>
            );
        });

        return (
            <Grid.Row>
                <Grid.Column>
                    <Segment className="preview_conteiner">
                        <Segment className="group_segment" color='blue'>
                            {nextfeed}
                        </Segment>
                        <Label color='brown' attached='bottom left'>
                            <Icon name='address card' />
                                {feeds.length - feeds_queue}
                            <Icon name='delete' onClick={this.props.resetQueue} />
                        </Label>
                        <Label attached='bottom right' color='brown' >
                            Round: {round}
                        </Label>
                    </Segment>
                    <Message attached className='info-panel' color='grey'>
                        {action_log}
                        <div ref='end' />
                    </Message>
                    <Button.Group attached='bottom' >
                        <Button
                            color={sndman ? "green" : "red"}
                            disabled={!sndman || feeds.length < 13}
                            onClick={() => this.sdiAction("restart_sndman", false, 1, this.props.mids)}>
                            SndMan</Button>
                        <Button
                            color={sdiout ? "green" : "red"}
                            disabled={!sdiout || feeds.length < 13}
                            onClick={() => this.sdiAction("restart_sdiout", false, 1, this.props.mids)}>
                            SdiOut</Button>
                    </Button.Group>
                </Grid.Column>
                <Grid.Column>
                    <Segment textAlign='center' >
                        <Label attached='top right' color={feeds.length > 13 ? 'green' : 'grey'}>
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
                        <Label as='a' attached='top left' color='teal' onClick={this.setPreset}>
                            Preset: 1
                        </Label>
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
                                  disabled={qfeeds.length === 0}
                                  placeholder={qfeeds.length > 0 ? ':: Select group from list ::' : 'Questions...'}
                                  fluid
                                  upward
                                  selection
                                  options={queue_options}
                                  onChange={(e,{value}) => this.selectGroup(value)} />
                        <Label attached='top left' color={feeds.length > 13 ? 'blue' : 'grey'} onClick={this.selectNext}>
                            Next: {feeds[feeds_queue] ? feeds[feeds_queue].display.display : ""}
                        </Label>
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
                <Dimmer active={zoom} onClickOutside={this.zoomOut} page>
                    <video ref={"zoomVideo"}
                           id={"zoomVideo"}
                           width="1280"
                           height="720"
                           autoPlay={autoPlay}
                           controls={false}
                           muted={muted}
                           playsInline={true}/>
                </Dimmer>
            </Grid.Row>
        );
    }
}

export default ShidurToran;
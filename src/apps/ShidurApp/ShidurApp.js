import React, {Component} from 'react';
import {Janus} from "../../lib/janus";
import {Grid, Label, Message, Segment, Table, Icon, Popup, Button, Input} from "semantic-ui-react";
import {initJanus} from "../../shared/tools";
import {initGxyProtocol} from "../../shared/protocol";
import ShidurGroups from "./ShidurGroups";
import ShidurUsers from "./ShidurUsers";
import {client, getUser} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";
import './ShidurApp.css';


class ShidurApp extends Component {

    state = {
        janus: null,
        feeds: [],
        qfeeds: [],
        gxyhandle: null,
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
        remotefeed: null,
        myid: null,
        mypvtid: null,
        mystream: null,
        audio: null,
        muted: true,
        feeds_queue: 0,
        user: null,
        users: {},
        zoom: false,
        fullscr: false,
        round: 0,
    };

    componentDidMount() {
        getUser(user => {
            if(user) {
                let gxy_group = user.roles.filter(role => role === 'gxy_shidur').length > 0;
                if (gxy_group) {
                    delete user.roles;
                    user.role = "shidur";
                    this.initGalaxy(user);
                } else {
                    alert("Access denied!");
                    client.signoutRedirect();
                }
            }
        });
    };

    componentWillUnmount() {
        //FIXME: If we don't detach remote handle, Janus still send UDP stream!
        //this may happen because Janus in use for now is very old version
        //Need to check if this shit happend on latest Janus version
        this.state.pre.detach();
        this.state.pr1.forEach(feed => {
            Janus.debug(" Detach feed: ",feed);
            feed.detach();
        });
        this.state.janus.destroy();
    };

    initGalaxy = (user) => {
        initJanus(janus => {
            this.setState({janus,user});
            this.initVideoRoom();

            initGxyProtocol(janus, user, protocol => {
                this.setState({protocol});
            }, ondata => {
                Janus.log("-- :: It's protocol public message: ", ondata);
                this.onProtocolData(ondata);
            });

        });
    };

    initVideoRoom = () => {
        this.state.janus.attach({
            plugin: "janus.plugin.videoroom",
            opaqueId: "preview_shidur",
            success: (gxyhandle) => {
                Janus.log(gxyhandle);
                this.setState({gxyhandle});
                Janus.log("Plugin attached! (" + gxyhandle.getPlugin() + ", id=" + gxyhandle.getId() + ")");
                Janus.log("  -- This is a publisher/manager");
                let {user} = this.state;
                let register = { "request": "join", "room": 1234, "ptype": "publisher", "display": JSON.stringify(user) };
                gxyhandle.send({"message": register});
            },
            error: (error) => {
                Janus.log("Error attaching plugin: " + error);
            },
            consentDialog: (on) => {
                Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
            },
            mediaState: (medium, on) => {
                Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
            },
            webrtcState: (on) => {
                Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
            },
            onmessage: (msg, jsep) => {
                this.onMessage(msg, jsep, false);
            },
            onlocalstream: (mystream) => {
                Janus.debug(" ::: Got a local stream :::", mystream);
            },
            oncleanup: () => {
                Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
            }
        });
    };

    onMessage = (msg, jsep, initdata) => {
        let {gxyhandle} = this.state;
        Janus.debug(" ::: Got a message (publisher) :::");
        Janus.debug(msg);
        let event = msg["videoroom"];
        Janus.debug("Event: " + event);
        if(event !== undefined && event !== null) {
            if(event === "joined") {
                // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
                let myid = msg["id"];
                let mypvtid = msg["private_id"];
                this.setState({myid ,mypvtid});
                Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    let users = {};
                    let feeds = list.filter(feeder => JSON.parse(feeder.display).role === "group");
                    for(let i=0;i<feeds.length;i++) {
                        let user = JSON.parse(feeds[i].display);
                        user.rfid = feeds[i].id;
                        users[user.id] = user;
                    }
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.debug(list);
                    this.setState({feeds, users});
                    setTimeout(() => {
                        this.col1.switchFour();
                        this.col2.switchFour();
                        this.col3.switchFour();
                    }, 3000);
                    // getState('state/galaxy/pr1', (pgm_state) => {
                    //     Janus.log(" :: Get State: ", pgm_state);
                    //     this.setState({pgm_state});
                    //     pgm_state.forEach((feed,i) => {
                    //         let chk = feeds.filter(f => f.id === feed.id).length > 0;
                    //         if(chk)
                    //             this.newSwitchFeed(feed.id,true,i);
                    //     });
                    // });
                }
            } else if(event === "talking") {
                let id = msg["id"];
                Janus.log("User: "+id+" - start talking");
            } else if(event === "stopped-talking") {
                let id = msg["id"];
                Janus.log("User: "+id+" - stop talking");
            } else if(event === "destroyed") {
                // The room has been destroyed
                Janus.warn("The room has been destroyed!");
            } else if(event === "event") {
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    let feed = JSON.parse(list[0].display).role === "group";
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.debug(list[0]);
                    if(feed) {
                        let {feeds,users} = this.state;
                        let user = JSON.parse(list[0].display);
                        user.rfid = list[0].id;
                        users[user.id] = user;
                        feeds.push(list[0]);
                        this.setState({feeds,users});

                        if(feeds.length < 13) {
                            this.col1.switchFour();
                            this.col2.switchFour();
                            this.col3.switchFour();
                        }

                        if(feeds.length === 13) {
                            this.setState({feeds_queue: 12});
                        }
                    }
                } else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
                    // One of the publishers has gone away?
                    let leaving = msg["leaving"];
                    Janus.log("Publisher left: " + leaving);
                    console.log("Publisher left: " + leaving);
                    let {disabled_groups} = this.state;
                    // Delete from disabled_groups
                    for(let i = 0; i < disabled_groups.length; i++){
                        if(disabled_groups[i].id === leaving) {
                            disabled_groups.splice(i, 1);
                            this.setState({disabled_groups});
                            break
                        }
                    }
                    this.removeFeed(leaving);
                } else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                    // One of the publishers has unpublished?
                    let unpublished = msg["unpublished"];
                    Janus.log("Publisher left: " + unpublished);
                    console.log("Publisher left: " + unpublished);
                    if(unpublished === 'ok') {
                        // That's us
                        this.state.gxyhandle.hangup();
                        return;
                    }
                    let {disabled_groups} = this.state;
                    // Delete from disabled_groups
                    for(let i = 0; i < disabled_groups.length; i++){
                        if(disabled_groups[i].id === unpublished) {
                            disabled_groups.splice(i, 1);
                            this.setState({disabled_groups});
                            break
                        }
                    }
                    this.removeFeed(unpublished);
                } else if(msg["error"] !== undefined && msg["error"] !== null) {
                    if(msg["error_code"] === 426) {
                        Janus.log("This is a no such room");
                    } else {
                        Janus.log(msg["error"]);
                    }
                }
            }
        }
        if(jsep !== undefined && jsep !== null) {
            Janus.debug("Handling SDP as well...");
            Janus.debug(jsep);
            gxyhandle.handleRemoteJsep({jsep: jsep});
        }
    };

    onProtocolData = (data) => {
        if(data.type === "question" && data.status) {
            let {quistions_queue,users,qfeeds,pgm_state} = this.state;
            if(users[data.user.id]) {
                users[data.user.id].question = true;
                data.rfid = users[data.user.id].rfid;
                let q = {id: data.rfid, display: JSON.stringify(data.user)};
                quistions_queue.push(data);

                // Check if qfeed already in program
                let chk = pgm_state.filter(q => {return (q !== null && q !== undefined && q.id === data.rfid)});
                if(chk.length === 0)
                    qfeeds.push(q);

                this.setState({quistions_queue, users, qfeeds});
            }
        } else if(data.type === "question" && !data.status) {
            let {quistions_queue,users,qfeeds} = this.state;
            for(let i = 0; i < quistions_queue.length; i++){
                if(quistions_queue[i].user.id === data.user.id) {
                    users[data.user.id].question = false;
                    quistions_queue.splice(i, 1);
                    qfeeds.splice(i, 1);
                    this.setState({quistions_queue,users});
                    break
                }
            }
            for(let i = 0; i < qfeeds.length; i++) {
                if(JSON.parse(qfeeds[i].display).id === data.user.id) {
                    qfeeds.splice(i, 1);
                    this.setState({qfeeds});
                    break
                }
            }
        }
    };

    removeFeed = (id) => {
        let {feeds,users,quistions_queue,qfeeds} = this.state;
        for(let i=0; i<feeds.length; i++){
            if(feeds[i].id === id) {

                // Delete from users mapping object
                let user = JSON.parse(feeds[i].display);
                console.log(" :: Remove feed: " + id + " - Name: " + user.username);
                delete users[user.id];

                // Delete from questions list
                for(let i = 0; i < quistions_queue.length; i++){
                    if(quistions_queue[i].user.id === user.id) {
                        quistions_queue.splice(i, 1);
                        break
                    }
                }

                // Delete from qfeeds
                for(let i = 0; i < qfeeds.length; i++){
                    if(JSON.parse(qfeeds[i].display).id === user.id) {
                        qfeeds.splice(i, 1);
                        break
                    }
                }

                // Remove from general feeds list
                feeds.splice(i, 1);
                this.setState({feeds,users,quistions_queue});
                this.checkProgram(id,feeds);
                break
            }
        }
    };

    checkProgram = (id,feeds) => {
        let {feeds_queue,pgm_state,pr1} = this.state;

        pgm_state.forEach((pgm,i) => {
            if(pgm_state[i] && pgm.id === id) {
                console.log(" :: Feed in program! - " + id);
                if(feeds.length < 13) {
                    //FIXME: Need to check if its really necessary to detach here
                    pr1[i].detach();
                    pgm_state[i] = null;
                    pr1[i] = null;
                } else {
                    if(feeds_queue === 0) {
                        //FIXME: When it's happend?
                         console.log(" -- Feed remove while feeds_queue was - 0");
                    } else {
                        feeds_queue--;
                        this.setState({feeds_queue});
                    }
                    // if program is full we does not remove video element
                    //pgm_state[i] = null;
                    pr1[i] = null;
                    let feed = feeds[feeds_queue];
                    if(i < 4) {
                        this.col1.switchNext(i,feed,"remove");
                    } else if(i < 8) {
                        this.col2.switchNext(i,feed,"remove");
                    } else if(i < 12) {
                        this.col3.switchNext(i,feed,"remove");
                    }
                }
            }
        });

        this.setState({pgm_state});
    };


    setProps = (props) => {
        this.setState({...props})
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

    fixProgram = () => {
        let {feeds,pr1} = this.state;
        let i = this.state.pri;
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

    render() {

        const {user,feeds,feeds_queue,disabled_groups,round,qfeeds,pri} = this.state;

        let disabled_list = disabled_groups.map((data,i) => {
            const {id, display} = data;
            return (
                <Table.Row key={id} warning
                           onClick={() => this.col3.selectGroup(data, i)}
                           onContextMenu={(e) => this.col3.restoreGroup(e, data, i)} >
                    <Table.Cell width={5}>{JSON.parse(display).display}</Table.Cell>
                    <Table.Cell width={1}>{id}</Table.Cell>
                </Table.Row>
            )
        });

        let login = (<LoginPage user={user} />);
        let content = (
            <Grid columns={4}>
                <Grid.Column>
                    <ShidurGroups
                        index={0} {...this.state}
                        ref={col => {this.col1 = col;}}
                        setProps={this.setProps}
                        removeFeed={this.removeFeed} />
                </Grid.Column>
                <Grid.Column>
                    <ShidurGroups
                        index={4} {...this.state}
                        ref={col => {this.col2 = col;}}
                        setProps={this.setProps}
                        removeFeed={this.removeFeed} />
                        <Message className='info-panel' color='grey'>
                            <Popup on='click'
                                trigger={<Label attached='top right' color='grey'>
                                            Online: {feeds.length}
                                        </Label>}
                                flowing
                                position='bottom center'
                                hoverable>
                                <Button negative content='Reload' onClick={this.reloadPage}/>
                            </Popup>
                            <Popup on='click'
                                   trigger={<Label attached='top left' color='grey'>
                                            Next: {feeds[feeds_queue] ? JSON.parse(feeds[feeds_queue].display).display : ""}
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
                            <Label size='big' color='brown'>
                                <Icon name='address card' />
                                <b className='queue_counter'>{feeds.length - feeds_queue}</b>
                                <Icon name='delete' onClick={this.resetQueue} />
                            </Label>
                            <Label attached='bottom left' color='blue'>
                                Round: {round}
                            </Label>
                            <Label attached='bottom right' color={qfeeds.length > 0 ? 'red' : 'grey'}>
                                Questions: {qfeeds.length}
                            </Label>
                        </Message>
                </Grid.Column>
                <Grid.Column>
                    <ShidurGroups
                        index={8} {...this.state}
                        ref={col => {this.col3 = col;}}
                        setProps={this.setProps}
                        removeFeed={this.removeFeed} />
                    <Segment textAlign='center' className="disabled_groups" raised>
                        <Table selectable compact='very' basic structured className="admin_table" unstackable>
                            <Table.Body>
                                {disabled_list}
                            </Table.Body>
                        </Table>
                    </Segment>
                </Grid.Column>
                <Grid.Column>
                    <ShidurUsers
                        ref={col => {this.col4 = col;}}
                        setProps={this.setProps} />
                </Grid.Column>
            </Grid>
        );

        return (
            <div>
                {user ? content : login}
            </div>
        );
    }
}

export default ShidurApp;
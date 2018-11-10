import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Grid} from "semantic-ui-react";
import {getState, putData, initGXYJanus} from "../../shared/tools";
// import {initGxyProtocol} from "../shared/protocol";
//import './ShidurGroups.css'
import SDIOutGroups from "./SDIOutGroups";
import SDIOutClient from "./SDIOutClient";


class SDIOutApp extends Component {

    state = {
        janus: null,
        feeds: [],
        gxyhandle: null,
        name: "",
        disabled_groups: [],
        group: null,
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
        user: {
            session: 0,
            handle: 0,
            role: "sdiout",
            display: "sdiout",
            id: Janus.randomString(10),
            name: "sdiout"
        },
        users: {},
        zoom: false,
        fullscr: false,
    };

    componentDidMount() {
        initGXYJanus(janus => {
            let {user} = this.state;
            user.session = janus.getSessionId();
            this.setState({janus,user});
            this.initVideoRoom();

            // initGxyProtocol(janus, user, protocol => {
            //     this.setState({protocol});
            // }, ondata => {
            //     Janus.log("-- :: It's protocol public message: ", ondata);
            //     this.onProtocolData(ondata);
            // });

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
                // let register = { "request": "join", "room": 1234, "ptype": "publisher", "display": JSON.stringify(user) };
                let register = { "request": "join", "room": 1234, "ptype": "publisher", "display": "sdi_out" };
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
                    //let feeds_list = list.filter(feeder => JSON.parse(feeder.display).role === "user");
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.debug(list);
                    let feeds = list.filter(f => !/_/.test(f.display));
                    this.setState({feeds});
                    // setTimeout(() => {
                    //     this.col1.switchFour();
                    //     this.col2.switchFour();
                    //     this.col3.switchFour();
                    // }, 3000);
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
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.debug(list[0]);
                    if(!/_/.test(list[0].display)) {
                        let {feeds} = this.state;
                        feeds.push(list[0]);
                        this.setState({feeds});

                        // if(feeds.length < 13) {
                        //     this.col1.switchFour();
                        //     this.col2.switchFour();
                        //     this.col3.switchFour();
                        // }
                        //
                        // if(feeds.length === 13) {
                        //     this.setState({feeds_queue: 12});
                        // }
                    }
                } else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
                    // One of the publishers has gone away?
                    let leaving = msg["leaving"];
                    Janus.log("Publisher left: " + leaving);
                    this.removeFeed(leaving);
                } else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                    // One of the publishers has unpublished?
                    let unpublished = msg["unpublished"];
                    Janus.log("Publisher left: " + unpublished);
                    if(unpublished === 'ok') {
                        // That's us
                        this.state.gxyhandle.hangup();
                        return;
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
        if(data.type === "sdi-switch") {
            let {col, feed, i} = data;
            console.log(" :: Git Shidur Action: ",data);
            this["col"+col].switchNext(i,feed);
        } else if(data.type === "sdi-fullscreen" && data.status) {
            let {col, feed, i} = data;
            console.log(" :: Git Shidur Action: ",data);
            this["col"+col].fullScreenGroup(i,feed);
        } else if(data.type === "sdi-fullscreen" && !data.status) {
            let {col, feed, i} = data;
            console.log(" :: Git Shidur Action: ",data);
            this["col"+col].toFourGroup(i,feed);
        } else if(data.type === "sdi-remove") {
            let {col, feed, i} = data;
            console.log(" :: Git Shidur Action: ",data);
            this.removeFeed(feed.id);
        }
    };

    removeFeed = (id,) => {
        let {feeds} = this.state;
        for(let i=0; i<feeds.length; i++){
            if(feeds[i].id === id) {
                Janus.log(" :: Remove Feed: " + id);
                feeds.splice(i, 1);
                this.setState({feeds});
                this.checkProgram(id,feeds);
                break
            }
        }
    };

    checkProgram = (id,feeds) => {
        let {feeds_queue,pgm_state,pr1} = this.state;

        pgm_state.forEach((pgm,i) => {
            if(pgm_state[i] && pgm.id === id) {
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
                    let feed = feeds[feeds_queue];
                    if(i < 4) {
                        this.col1.switchNext(i,feed);
                    } else if(i < 8) {
                        this.col2.switchNext(i,feed);
                    } else if(i < 12) {
                        this.col3.switchNext(i,feed);
                    }
                }
            }
        });

        this.setState({pgm_state});
    };


    setProps = (props) => {
        this.setState({...props})
    };

    render() {

        return (
            <Grid columns={2}>
                <Grid.Row>
                <Grid.Column>
                    <SDIOutGroups
                        index={0} {...this.state}
                        ref={col => {this.col1 = col;}}
                        setProps={this.setProps}
                        removeFeed={this.removeFeed} />
                </Grid.Column>
                <Grid.Column>
                    <SDIOutGroups
                        index={4} {...this.state}
                        ref={col => {this.col2 = col;}}
                        setProps={this.setProps}
                        removeFeed={this.removeFeed} />
                </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                <Grid.Column>
                    <SDIOutGroups
                        index={8} {...this.state}
                        ref={col => {this.col3 = col;}}
                        setProps={this.setProps}
                        removeFeed={this.removeFeed} />
                </Grid.Column>
                <Grid.Column>
                    <SDIOutClient
                        ref={col => {this.col4 = col;}}
                        setProps={this.setProps}
                        onProtocolData={this.onProtocolData} />
                </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }
}

export default SDIOutApp;
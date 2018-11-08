import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Grid} from "semantic-ui-react";
import {getState, putData, initGXYJanus} from "../../shared/tools";
// import {initGxyProtocol} from "../shared/protocol";
import './ShidurGroups.css'
import ShidurGroupsColumn from "./ShidurGroupsColumn";


class ShidurApp extends Component {

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
            role: "shidur",
            display: "shidur",
            id: Janus.randomString(10),
            name: "shidur"
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

    onProtocolData = (data) => {
        if(data.type === "question" && data.status) {
            let {quistions_queue} = this.state;
            quistions_queue.push(data);
            this.setState({quistions_queue});
        } else if(data.type === "question" && !data.status) {
            let {quistions_queue} = this.state;
            for(let i = 0; i < quistions_queue.length; i++){
                if(quistions_queue[i].user.id === data.user.id) {
                    quistions_queue.splice(i, 1);
                    this.setState({quistions_queue});
                    break
                }
            }
        }
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
                let register = { "request": "join", "room": 1234, "ptype": "publisher", "display": "shidur_admin" };
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
                        let {feeds,pr1} = this.state;
                        feeds.push(list[0]);
                        this.setState({feeds});
                        if(pr1.length < 4) {
                            this.col1.switchFour()
                        } else if(pr1.length < 8) {
                            this.col2.switchFour()
                        }
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
            if(pgm.id === id) {
                if(feeds.length < pgm_state.length) {
                    pgm_state.splice(i, 1);
                    pr1[i].detach();
                    pr1.splice(i, 1);
                    //FIXME: We need reattach streams here or do NOT splice array and hide removed feed
                } else {
                    let feed = feeds[feeds_queue];
                    if(i < 4) {
                        this.col1.switchNext(i,feed);
                    } else if(i < 8) {
                        this.col2.switchNext(i,feed);
                    }
                }
            }
        });

        this.setState({pgm_state});

        // let index = pgm_state.findIndex(p => p.id === id);
        // if(index < 4 && index >=0) {
        //     this.col1.removeFeed(id,index);
        // } else if(index < 8 && index >=0) {
        //     this.col2.removeFeed(id,index);
        // } else if(index < 12 && index >=0) {
        //     this.col3.removeFeed(id,index);
        // } else if(index !== -1){
        //     this.col1.removeFeed(id,false);
        // }
    };


    setProps = (props) => {
        this.setState({...props})
    };

    render() {

        return (

            <Grid columns={2}>
                <Grid.Column>
                    <ShidurGroupsColumn ref={col => {this.col1 = col;}} index={0} {...this.state} setProps={this.setProps} removeFeed={this.removeFeed} />
                </Grid.Column>
                <Grid.Column>
                    <ShidurGroupsColumn ref={col => {this.col2 = col;}} index={4} {...this.state} setProps={this.setProps} removeFeed={this.removeFeed} />
                </Grid.Column>
                <Grid.Column>
                    {/*<ShidurUsers/>*/}
                </Grid.Column>
            </Grid>
        );
    }
}

export default ShidurApp;
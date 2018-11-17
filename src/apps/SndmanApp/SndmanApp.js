import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Grid} from "semantic-ui-react";
import {getState, putData, initGXYJanus, initJanus} from "../../shared/tools";
import './SndmanApp.css';
import {initGxyProtocol} from "../../shared/protocol";
import SndmanGroups from "./SndmanGroups";
import SndmanUsers from "./SndmanUsers";
import {DATA_PORT, JANUS_IP_EURND, JANUS_IP_EURUK, JANUS_IP_ISRPT, SECRET} from "../../shared/consts";
import {client, getUser} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";


class SndmanApp extends Component {

    state = {
        janus: null,
        feeds: [],
        gxyhandle: null,
        data_forward: {},
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
        room: 1234,
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
    };

    componentDidMount() {
        getUser(user => {
            if(user) {
                let gxy_group = user.roles.filter(role => role === 'gxy_sndman').length > 0;
                if (gxy_group) {
                    delete user.roles;
                    user.role = "sndman";
                    this.initApp(user);
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

    initApp = (user) => {
        initJanus(janus => {
            user.session = janus.getSessionId();
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
                //let register = { "request": "join", "room": 1234, "ptype": "publisher", "display": "sdi_out" };
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
                this.forwardOwnFeed(this.state.room);
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

    publishOwnFeed = (useAudio) => {
        // Publish our stream
        let {gxyhandle} = this.state;

        gxyhandle.createOffer(
            {
                media: {  audio: false, video: false, data: true },	// Publishers are sendonly
                simulcast: false,
                success: (jsep) => {
                    Janus.debug("Got publisher SDP!");
                    Janus.debug(jsep);
                    let publish = { "request": "configure", "audio": false, "video": false, "data": true };
                    gxyhandle.send({"message": publish, "jsep": jsep});
                },
                error: (error) => {
                    Janus.error("WebRTC error:", error);
                    if (useAudio) {
                        this.publishOwnFeed(false);
                    } else {
                        Janus.error("WebRTC error... " + JSON.stringify(error));
                    }
                }
            });
    };

    forwardOwnFeed = (room) => {
        let {myid,gxyhandle,data_forward} = this.state;
        let isrip = `${JANUS_IP_ISRPT}`;
        let eurip = `${JANUS_IP_EURND}`;
        let ukip = `${JANUS_IP_EURUK}`;
        let dport = DATA_PORT;
        let isrfwd = { "request": "rtp_forward","publisher_id":myid,"room":room,"secret":`${SECRET}`,"host":isrip,"data_port":dport};
        let eurfwd = { "request": "rtp_forward","publisher_id":myid,"room":room,"secret":`${SECRET}`,"host":eurip,"data_port":dport};
        let eukfwd = { "request": "rtp_forward","publisher_id":myid,"room":room,"secret":`${SECRET}`,"host":ukip,"data_port":dport};
        gxyhandle.send({"message": isrfwd,
            success: (data) => {
                data_forward.isr = data["rtp_stream"]["data_stream_id"];
                Janus.log(" :: ISR Data Forward: ", data);
            },
        });
        gxyhandle.send({"message": eurfwd,
            success: (data) => {
                data_forward.eur = data["rtp_stream"]["data_stream_id"];
                Janus.log(" :: EUR Data Forward: ", data);
                this.setState({onoff_but: false});
            },
        });
        gxyhandle.send({"message": eukfwd,
            success: (data) => {
                data_forward.euk = data["rtp_stream"]["data_stream_id"];
                Janus.log(" :: EUK Data Forward: ", data);
            },
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
                this.publishOwnFeed();
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
                    this.setState({feeds,users});
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
            console.log(" :: Got Shidur Action: ",data);
            this["col"+col].switchNext(i,feed);
        } else if(data.type === "sdi-fullscreen" && data.status) {
            let {col, feed, i} = data;
            console.log(" :: Got Shidur Action: ",data);
            this["col"+col].fullScreenGroup(i,feed);
        } else if(data.type === "sdi-fullscreen" && !data.status) {
            let {col, feed, i} = data;
            console.log(" :: Got Shidur Action: ",data);
            this["col"+col].toFourGroup(i,feed);
        } else if(data.type === "sdi-remove") {
            let {col, feed, i} = data;
            console.log(" :: Git Shidur Action: ",data);
            this.removeFeed(feed.id);
        } else if(data.type === "sdi-disable") {
            let {col, feed, i} = data;
            console.log(" :: Got Shidur Action: ",data);
            let {disabled_groups} = this.state;
            disabled_groups.push(feed);
            this.removeFeed(feed.id);
            this.setState({disabled_groups});
        } else if(data.type === "sdi-restart") {
            window.location.reload();
        } else if(data.type === "sdi-restore") {
            let {col, feed, i} = data;
            console.log(" :: Git Shidur Action: ",data);
            let {disabled_groups,feeds,users} = this.state;
            for(let i = 0; i < disabled_groups.length; i++){
                if(disabled_groups[i].id === data.feed.id) {
                    disabled_groups.splice(i, 1);
                    feeds.push(data.feed);
                    let user = JSON.parse(data.feed.display);
                    user.rfid = data.feed.id;
                    users[user.id] = user;
                    this.setState({disabled_groups,feeds,users});
                }
            }
        } else if(data.type === "question" && data.status) {
            let {quistions_queue,users} = this.state;
            if(users[data.user.id]) {
                users[data.user.id].question = true;
                data.rfid = users[data.user.id].rfid;
                quistions_queue.push(data);
                this.setState({quistions_queue, users});
            }
        } else if(data.type === "question" && !data.status) {
            let {quistions_queue,users} = this.state;
            for(let i = 0; i < quistions_queue.length; i++){
                if(quistions_queue[i].user.id === data.user.id) {
                    users[data.user.id].question = false;
                    quistions_queue.splice(i, 1);
                    this.setState({quistions_queue,users});
                    break
                }
            }
        }
    };

    removeFeed = (id,) => {
        let {feeds,users,quistions_queue} = this.state;
        for(let i=0; i<feeds.length; i++){
            if(feeds[i].id === id) {
                Janus.log(" :: Remove Feed: " + id);

                // Delete from users mapping object
                let user = JSON.parse(feeds[i].display);
                delete users[user.id];

                // Delete from questions list
                for(let i = 0; i < quistions_queue.length; i++){
                    if(quistions_queue[i].user.id === user.id) {
                        quistions_queue.splice(i, 1);
                        break
                    }
                }

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
        const {user} = this.state;

        let login = (<LoginPage user={user} />);
        let content = (
            <Grid columns={3}>
                <Grid.Column>
                    <SndmanUsers
                        ref={col => {this.col4 = col;}}
                        setProps={this.setProps}
                        onProtocolData={this.onProtocolData} />
                </Grid.Column>
                <Grid.Row>
                    <Grid.Column>
                        <SndmanGroups
                            index={0} {...this.state}
                            ref={col => {this.col1 = col;}}
                            setProps={this.setProps}
                            removeFeed={this.removeFeed} />
                    </Grid.Column>
                    <Grid.Column>
                        <SndmanGroups
                            index={4} {...this.state}
                            ref={col => {this.col2 = col;}}
                            setProps={this.setProps}
                            removeFeed={this.removeFeed} />
                    </Grid.Column>
                    <Grid.Column>
                        <SndmanGroups
                            index={8} {...this.state}
                            ref={col => {this.col3 = col;}}
                            setProps={this.setProps}
                            removeFeed={this.removeFeed} />
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );

        return (
            <div>
                {user ? content : login}
            </div>
        );
    }
}

export default SndmanApp;
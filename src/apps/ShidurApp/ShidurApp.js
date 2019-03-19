import React, {Component} from 'react';
import {Janus} from "../../lib/janus";
import {Grid, Label, Message, Segment, Table, Icon, Popup, Button, Input, Dropdown} from "semantic-ui-react";
import {initJanus} from "../../shared/tools";
import {initGxyProtocol, sendProtocolMessage} from "../../shared/protocol";
import ShidurGroups from "./ShidurGroups";
import ShidurUsers from "./ShidurUsers";
import {client, getUser} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";
import './ShidurApp.css';


class ShidurApp extends Component {

    state = {
        qam: {0:1,1:2,2:3,3:1,4:2,5:3,6:1,7:2,8:3,9:1,10:2,11:3},
        janus: null,
        feeds: [],
        feedStreams: {},
        mids: [],
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
        sdiout: false,
        sndman: false,
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
        this.state.janus.destroy();
    };

    initGalaxy = (user) => {
        initJanus(janus => {
            this.setState({janus,user});

            initGxyProtocol(janus, user, protocol => {
                this.setState({protocol});
            }, ondata => {
                Janus.log("-- :: It's protocol public message: ", ondata);
                if(ondata.type === "error" && ondata.error_code === 420) {
                    alert(ondata.error);
                    this.state.protocol.hangup();
                } else if(ondata.type === "joined") {
                    this.initVideoRoom();
                }
                this.onProtocolData(ondata);
            });

        },er => {
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        }, true);
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
                    let {feedStreams,users} = this.state;
                    let feeds = list.filter(feeder => JSON.parse(feeder.display).role === "group");

                    let subscription = [];
                    for(let f in feeds) {
                        let id = feeds[f]["id"];
                        let display = JSON.parse(feeds[f]["display"]);
                        let talk = feeds[f]["talking"];
                        let streams = feeds[f]["streams"];
                        feeds[f].display = display;
                        feeds[f].talk = talk;
                        let subst = {feed: id};
                        for (let i in streams) {
                            let stream = streams[i];
                            stream["id"] = id;
                            stream["display"] = display;
                            if(stream.type === "video") {
                                subst.mid = stream.mid;
                            }
                        }
                        feedStreams[id] = {id, display, streams};
                        users[display.id] = display;
                        users[display.id].rfid = id;
                        if(subscription.length < 13)
                            subscription.push(subst);
                    }
                    this.setState({feeds,feedStreams,users});
                    if(subscription.length > 0)
                        this.subscribeTo(subscription);

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
                //Janus.log("User: "+id+" - start talking");
            } else if(event === "stopped-talking") {
                let id = msg["id"];
                //Janus.log("User: "+id+" - stop talking");
            } else if(event === "destroyed") {
                // The room has been destroyed
                Janus.warn("The room has been destroyed!");
            } else if(event === "event") {
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let feed = msg["publishers"];
                    let {feeds,feedStreams,users} = this.state;
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.log(feed);
                    let subscription = [];
                    for(let f in feed) {
                        let id = feed[f]["id"];
                        let display = JSON.parse(feed[f]["display"]);
                        if(display.role !== "group")
                            return;
                        let talk = feed[f]["talking"];
                        let streams = feed[f]["streams"];
                        feed[f].display = display;
                        let subst = {feed: id};
                        for (let i in streams) {
                            let stream = streams[i];
                            stream["id"] = id;
                            stream["display"] = display;
                            if(stream.type === "video") {
                                subst.mid = stream.mid;
                            }
                        }
                        feedStreams[id] = {id, display, streams};
                        users[display.id] = display;
                        users[display.id].rfid = id;
                        subscription.push(subst);
                    }
                    feeds.push(feed[0]);
                    this.setState({feeds,feedStreams,users});
                    if(feeds.length < 13)
                        this.subscribeTo(subscription);
                } else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
                    // One of the publishers has gone away?
                    let leaving = msg["leaving"];
                    Janus.log("Publisher left: " + leaving);
                    console.log("Publisher left: " + leaving);
                    this.removeFeed(leaving);
                    // Delete from disabled_groups
                    let {disabled_groups} = this.state;
                    for(let i = 0; i < disabled_groups.length; i++){
                        if(disabled_groups[i].id === leaving) {
                            disabled_groups.splice(i, 1);
                            this.setState({disabled_groups});
                            break
                        }
                    }
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
                    this.removeFeed(unpublished);
                    // Delete from disabled_groups
                    let {disabled_groups} = this.state;
                    for(let i = 0; i < disabled_groups.length; i++){
                        if(disabled_groups[i].id === unpublished) {
                            disabled_groups.splice(i, 1);
                            this.setState({disabled_groups});
                            break
                        }
                    }
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

    newRemoteFeed = (subscription) => {
        this.state.janus.attach(
            {
                plugin: "janus.plugin.videoroom",
                opaqueId: "switchfeed_user",
                success: (pluginHandle) => {
                    let remoteFeed = pluginHandle;
                    Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
                    Janus.log("  -- This is a multistream subscriber",remoteFeed);
                    this.setState({remoteFeed, creatingFeed: false});
                    let subscribe = { "request": "join", "room": 1234, "ptype": "subscriber", streams: subscription };
                    remoteFeed.send({"message": subscribe});
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
                        let {remoteFeed} = this.state;
                        // Answer and attach
                        remoteFeed.createAnswer(
                            {
                                jsep: jsep,
                                media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
                                success: (jsep) => {
                                    Janus.debug("Got SDP!");
                                    Janus.debug(jsep);
                                    let body = { "request": "start", "room": 1234 };
                                    remoteFeed.send({"message": body, "jsep": jsep});
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
                    Janus.log(" ::: Got a remote track event ::: (remote feed)");
                    Janus.log("Remote track (mid=" + mid + ") " + (on ? "added" : "removed") + ":", track);
                    // Which publisher are we getting on this mid?
                    let {mids,feedStreams,qam} = this.state;
                    let feed = mids[mid].feed_id;
                    Janus.log(" >> This track is coming from feed " + feed + ":", mid);
                    if(!on) {
                        console.log(" :: Going to stop track :: " + track + ":", mid);
                        //FIXME: Remove callback for audio track does not come
                        track.stop();
                        //FIXME: does we really need to stop all track for feed id?
                        return;
                    }
                    if(track.kind !== "video" || !on) {
                        return;
                    }
                    let stream = new MediaStream();
                    stream.addTrack(track.clone());
                    feedStreams[feed].stream = stream;
                    this.setState({feedStreams});
                    //let col = "col" + (mid < 4 ? 1 : mid < 8 ? 2 : mid < 12 ? 3 : 4);
                    let col = "col" + qam[mid];
                    let video = this[col].refs["programVideo" + mid];
                    Janus.log(" Attach remote stream on video: "+mid);
                    Janus.attachMediaStream(video, stream);
                },
                oncleanup: () => {
                    Janus.log(" ::: Got a cleanup notification (remote feed) :::");
                }
            });
    };

    subscribeTo = (subscription) => {
        // New feeds are available, do we need create a new plugin handle first?
        Janus.log(" -- Going to subscribe: ",subscription);
        if (this.state.remoteFeed) {
            this.state.remoteFeed.send({message:
                    {request: "subscribe", streams: subscription}
            });
            return;
        }

        // We don't have a handle yet, but we may be creating one already
        if (this.state.creatingFeed) {
            // Still working on the handle
            setTimeout(() => {
                this.subscribeTo(subscription);
            }, 500);
            return;
        }

        // We don't creating, so let's do it
        this.setState({creatingFeed: true});
        this.newRemoteFeed(subscription);
    };

    onProtocolData = (data) => {
        if(data.type === "question" && data.status) {
            let {quistions_queue,users,qfeeds,pgm_state,pr1,mids} = this.state;
            if(users[data.user.id]) {
                users[data.user.id].question = true;
                data.rfid = users[data.user.id].rfid;
                let q = {id: data.rfid, display: data.user};
                quistions_queue.push(data);

                // Check if qfeed already in program
                //let chk = pgm_state.filter(q => {return (q !== null && q !== undefined && q.id === data.rfid)});
                let chk = mids.find(q => q.feed_id === data.rfid);

                if(!chk) {
                    qfeeds.push(q);
                } else {
                    for(let i = 0; i < pgm_state.length; i++){
                        let c = 0;
                        // FIXME: Array with null will do crash here!
                        if(pgm_state[i].id === chk[c].id) {
                            pr1[i].detach();
                            pr1[i] = null;
                            if(i < 4) {
                                this.col1.switchNext(i,chk[0]);
                            } else if(i < 8) {
                                this.col2.switchNext(i,chk[0]);
                            } else if(i < 12) {
                                this.col3.switchNext(i,chk[0]);
                            }
                            if(chk.length > 1) {
                                c++
                            }
                        }
                    }
                }

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
        } else if(data.type === "event") {
            delete data.type;
            this.setState({...data});
            if(data.sdiout || data.sndman) {
                this.col1.sdiAction("state",this.state.pgm_state,1, data);
            }
        }
    };

    unsubscribeFrom = (id, sub_mid) => {
        Janus.log(" -- GOT SBUMID: ",sub_mid,id)
        // Unsubscribe from this publisher
        let {remoteFeed} = this.state;

        //let streams = [{feed: id}];
        let streams = [];
        if(id && !sub_mid) {
            streams.push({feed: id});
        }

        if(sub_mid) {
            streams.push({sub_mid});
        }

        //streams.push(unsub);
        this.checkPreview(id);
        Janus.log(" -- GOING UNSUB",streams)
        let unsubscribe = {request: "unsubscribe", streams};
        if(remoteFeed !== null)
            remoteFeed.send({ message: unsubscribe });
    };

    removeFeed = (id) => {
        let {feeds,users,quistions_queue,qfeeds,feeds_queue} = this.state;

        // Clean preview
        this.checkPreview(id);

        for(let i=0; i<feeds.length; i++){
            if(feeds[i].id === id) {

                // Delete from users mapping object
                let user = feeds[i].display;
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

                // Fix feeds_queue if equal to last index
                if(feeds_queue >= feeds.length - 1) {
                    feeds_queue = feeds.length - 1;
                    this.setState({feeds_queue});
                }

                // Send an unsubscribe request
                this.unsubscribeFrom(id);

                this.setState({feeds,users,quistions_queue});
                //this.checkProgram(id,feeds,feeds_queue);
                break
            }
        }
    };

    checkProgram = (id,feeds,feeds_queue) => {
        let {pgm_state,pr1,round} = this.state;

        pgm_state.forEach((pgm,i) => {
            if(pgm_state[i] && pgm.id === id) {
                console.log(" :: Feed in program! - " + id);
                if(feeds.length < 13) {
                    pr1[i].detach();
                    pgm_state[i] = null;
                    pr1[i] = null;
                } else {
                    pr1[i].detach();
                    pr1[i] = null;
                    let feed = feeds[feeds_queue];
                    feeds_queue++;
                    if(feeds_queue >= feeds.length) {
                        // End round here!
                        feeds_queue = 0;
                        round++;
                        Janus.log(" -- ROUND END --");
                    }
                    this.setState({feeds_queue,round});

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
        this.state.janus.attach(
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
                                media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
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

    selectGroup = (pre_feed) => {
        this.setState({pre_feed});
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

    disableGroup = (pre_feed) => {
        let {disabled_groups} = this.state;
        Janus.log(" :: Put to disabled: ", pre_feed);
        let chk = disabled_groups.find(g => g.id === pre_feed.id);
        if(chk)
            return;
        this.sdiAction("disable", true, null, pre_feed);
        disabled_groups.push(pre_feed);
        this.removeFeed(pre_feed.id);
        this.hidePreview();
        this.setState({disabled_groups});
    };

    hidePreview = () => {
        //this.state.pre.detach();
        this.setState({pre_feed: null, pre: null});
    };

    checkPreview = (id) => {
        let {pre_feed} = this.state;
        if(pre_feed && pre_feed.id === id) {
            this.hidePreview()
        }
    };

    restoreGroup = (e, data, i) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            let {disabled_groups,feeds,users} = this.state;
            for(let i = 0; i < disabled_groups.length; i++) {
                if(disabled_groups[i].display.id === data.display.id) {
                    //TODO: check if we got question while feed was disable
                    disabled_groups.splice(i, 1);
                    feeds.push(data);
                    let user = data.display;
                    user.rfid = data.id;
                    users[user.id] = user;
                    this.setState({disabled_groups,feeds,users});
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

        const {user,users,feeds,pre_feed,feeds_queue,disabled_groups,round,qfeeds,pri,sdiout,sndman} = this.state;

        const width = "100%";
        const height = "100%";
        const autoPlay = true;
        const controls = false;
        const muted = true;
        const q = (<Icon color='red' name='question circle' />);

        let group_options = feeds.map((feed,i) => {
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
                        onClick={() => this.disableGroup(pre_feed)} />
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
                           onContextMenu={(e) => this.disableRoom(e, feed, i)} >
                    <Table.Cell width={5}>{display.display}</Table.Cell>
                    <Table.Cell width={1}>{0}</Table.Cell>
                    <Table.Cell width={1}>{0}</Table.Cell>
                </Table.Row>
            )
        });

        let login = (<LoginPage user={user} />);

        let content = (
            <Grid columns={4} padded>
                <Grid.Column>
                    <ShidurGroups
                        index={0} {...this.state}
                        ref={col => {this.col1 = col;}}
                        setProps={this.setProps}
                        unsubscribeFrom={this.unsubscribeFrom}
                        subscribeTo={this.subscribeTo}
                        removeFeed={this.removeFeed} />
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
                    <ShidurGroups
                        index={4} {...this.state}
                        ref={col => {this.col2 = col;}}
                        setProps={this.setProps}
                        unsubscribeFrom={this.unsubscribeFrom}
                        subscribeTo={this.subscribeTo}
                        removeFeed={this.removeFeed} />
                    <Dropdown className='select_group'
                              placeholder='Search..'
                              fluid
                              search
                              selection
                              options={group_options}
                              onChange={(e,{value}) => this.selectGroup(value)} />
                    <Segment textAlign='center' className="group_list" raised >
                        <Label attached='top right' color='grey'>
                            Online: {feeds.length}
                        </Label>
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
                    <ShidurGroups
                        index={8} {...this.state}
                        ref={col => {this.col3 = col;}}
                        setProps={this.setProps}
                        unsubscribeFrom={this.unsubscribeFrom}
                        subscribeTo={this.subscribeTo}
                        removeFeed={this.removeFeed} />
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
                <Grid.Column>
                    {/*<ShidurUsers*/}
                        {/*ref={col => {this.col4 = col;}}*/}
                        {/*setProps={this.setProps} />*/}
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
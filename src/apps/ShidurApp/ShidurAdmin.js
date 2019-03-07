import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Segment, Menu, Button, Input, Table, Grid, Message, Transition, Select, Icon, Popup, List} from "semantic-ui-react";
import {initJanus, initChatRoom, getDateString, joinChatRoom, getPublisherInfo} from "../../shared/tools";
import './ShidurAdmin.css';
import './VideoConteiner.scss'
import {MAX_FEEDS, SECRET} from "../../shared/consts";
import {initGxyProtocol} from "../../shared/protocol";
import classNames from "classnames";
import {client, getUser} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";

class ShidurAdmin extends Component {

    state = {
        bitrate: 150000,
        chatroom: null,
        forwarders: [],
        janus: null,
        questions: {},
        quistions_queue: [],
        feedStreams: {},
        mids: [],
        feeds: [],
        rooms: [],
        feed_id: null,
        feed_user: null,
        feed_talk: false,
        feed_rtcp: {},
        current_room: "",
        roomid: "",
        videoroom: null,
        remotefeed: null,
        switchFeed: null,
        myid: null,
        mypvtid: null,
        mystream: null,
        audio: null,
        muted: true,
        user: null,
        description: "",
        messages: [],
        visible: false,
        input_value: "",
        switch_mode: false,
        users: {},
        root: false,
    };

    componentDidMount() {
        document.addEventListener("keydown", this.onKeyPressed);
        getUser(user => {
            if(user) {
                let gxy_group = user.roles.filter(role => role === 'gxy_admin').length > 0;
                let gxy_root = user.roles.filter(role => role === 'gxy_root').length > 0;
                if (gxy_group) {
                    this.setState({root: gxy_root});
                    delete user.roles;
                    user.role = "admin";
                    this.initShidurAdmin(user);
                } else {
                    alert("Access denied!");
                    client.signoutRedirect();
                }
            }
        });
    };

    componentWillUnmount() {
        document.removeEventListener("keydown", this.onKeyPressed);
        this.state.janus.destroy();
    };

    onKeyPressed = (e) => {
        if(e.code === "Enter")
            this.sendPrivateMessage();
    };

    initShidurAdmin = (user) => {
        initJanus(janus => {
            this.setState({janus,user});
            this.initVideoRoom();

            initChatRoom(janus, null, chatroom => {
                Janus.log(":: Got Chat Handle: ",chatroom);
                this.setState({chatroom});
            }, data => {
                this.onData(data);
            });

            initGxyProtocol(janus, this.state.user, protocol => {
                this.setState({protocol});
            }, ondata => {
                Janus.log("-- :: It's protocol public message: ", ondata);
                this.onProtocolData(ondata);
            });
        }, er => {}, true);
        setInterval(() => {
            this.getRoomList();
            if(this.state.feed_user)
                this.getFeedInfo()
        }, 10000 );
    };

    getRoomList = () => {
        const {videoroom,current_room} = this.state;
        if (videoroom) {
            videoroom.send({message: {request: "list"},
                success: (data) => {
                    //Janus.log(" :: Get Rooms List: ", data.list)
                    data.list.sort((a, b) => {
                        // if (a.num_participants > b.num_participants) return -1;
                        // if (a.num_participants < b.num_participants) return 1;
                        if (a.description > b.description) return 1;
                        if (a.description < b.description) return -1;
                        return 0;
                    });
                    this.setState({rooms: data.list});
                    if(current_room !== "") {
                        this.listForward(current_room);
                    }
                }
            });
        }
    };

    getFeedsList = (roomid) => {
        const {videoroom} = this.state;
        if (videoroom) {
            videoroom.send({message: {request: "listparticipants", "room": roomid},
                success: (data) => {
                    Janus.log(" :: Got Feeds List (room :"+roomid+"): ", data);
                    let feeds = data.participants;
                    console.log(feeds)
                }
            });
        }
    };

    listForward = (room) => {
        let {videoroom} = this.state;
        let req = {"request":"listforwarders", "room":room, "secret":`${SECRET}`};
        videoroom.send ({"message": req,
            success: (data) => {
                Janus.log(" :: List forwarders: ", data);
                if(data.rtp_forwarders)
                    this.setState({forwarders: data.rtp_forwarders});
            }
        })
    };

    stopForwardById = (id) => {
        const {videoroom,current_room} = this.state;
        let req = {"request":"listforwarders", "room":1234, "secret":"adminpwd"}
        videoroom.send ({"message": req,
            success: (data) => {
                data.rtp_forwarders.forEach((pitem, p) => {
                    if(pitem.publisher_id === id) {
                        pitem.rtp_forwarder.forEach((item, i) => {
                            if(item.audio_stream_id !== undefined) {
                                console.log(i+" -- AUDIO ID: "+item.audio_stream_id );
                                let audio_id = item.audio_stream_id;
                                let stopfw_audio = { "request":"stop_rtp_forward","stream_id":audio_id,"publisher_id":id,"room":current_room,"secret":"adminpwd" };
                                videoroom.send({"message": stopfw_audio});
                            }
                            if(item.video_stream_id !== undefined) {
                                console.log(i+" -- VIDEO ID: "+item.video_stream_id );
                                let video_id = item.video_stream_id;
                                let stopfw_video = { "request":"stop_rtp_forward","stream_id":video_id,"publisher_id":id,"room":current_room,"secret":"adminpwd" };
                                videoroom.send({"message": stopfw_video});
                            }
                        });
                    }
                });
            }
        });
    };

    stopForwardByRoom = () => {
        const {videoroom,current_room} = this.state;
        if(current_room === "")
            return;
        let req = {"request":"listforwarders", "room":current_room, "secret":"adminpwd"}
        videoroom.send ({"message": req,
            success: (data) => {
                data.rtp_forwarders.forEach((pitem, p) => {
                    let id = pitem.publisher_id;
                    pitem.rtp_forwarder.forEach((item, i) => {
                        if(item.audio_stream_id !== undefined) {
                            console.log(i+" -- AUDIO ID: "+item.audio_stream_id );
                            let audio_id = item.audio_stream_id;
                            let stopfw_audio = { "request":"stop_rtp_forward","stream_id":audio_id,"publisher_id":id,"room":current_room,"secret":"adminpwd" };
                            videoroom.send({"message": stopfw_audio});
                        }
                    });
                });
            }
        });
    };

    initVideoRoom = (roomid) => {
        if(this.state.videoroom)
            this.state.videoroom.detach();
        if(this.state.remoteFeed)
            this.state.remoteFeed.detach();
        this.state.janus.attach({
            plugin: "janus.plugin.videoroom",
            opaqueId: "videoroom_user",
            success: (videoroom) => {
                Janus.log(" :: My handle: ", videoroom);
                Janus.log("Plugin attached! (" + videoroom.getPlugin() + ", id=" + videoroom.getId() + ")");
                Janus.log("  -- This is a publisher/manager");
                let {user} = this.state;
                this.setState({videoroom, remoteFeed: null});

                if(roomid) {
                    this.listForward(roomid);
                    let register = { "request": "join", "room": roomid, "ptype": "publisher", "display": JSON.stringify(user) };
                    videoroom.send({"message": register});
                } else {
                    // Get list rooms
                    this.getRoomList();
                }
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
                this.onMessage(this.state.videoroom, msg, jsep, false);
            },
            onlocalstream: (mystream) => {
                Janus.debug(" ::: Got a local stream :::");
            },
            onremotestream: (stream) => {
                // The publisher stream is sendonly, we don't expect anything here
            },
            ondataopen: (data) => {
                Janus.log("The DataChannel is available!(publisher)");
            },
            ondata: (data) => {
                Janus.debug("We got data from the DataChannel! (publisher) " + data);
            },
            oncleanup: () => {
                Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
            }
        });
    };

    onMessage = (videoroom, msg, jsep, initdata) => {
        Janus.log(" ::: Got a message (publisher) :::");
        Janus.log(msg);
        let event = msg["videoroom"];
        if(event !== undefined && event !== null) {
            if(event === "joined") {
                // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
                let myid = msg["id"];
                let mypvtid = msg["private_id"];
                this.setState({myid ,mypvtid});
                Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
                //this.publishOwnFeed();
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let {feedStreams,users,questions} = this.state;
                    let list = msg["publishers"];

                    // Filter service and camera muted feeds
                    let feeds = list.filter(feeder => JSON.parse(feeder.display).role === "user");

                    Janus.log(":: Got Pulbishers list: ", feeds);
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.log(list);
                    let subscription = [];
                    for(let f in feeds) {
                        let id = feeds[f]["id"];
                        let display = JSON.parse(feeds[f]["display"]);
                        let talk = feeds[f]["talking"];
                        let streams = feeds[f]["streams"];
                        feeds[f].display = display;
                        feeds[f].talk = talk;
                        feeds[f].question = questions[display.id] !== undefined;
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
                    this.setState({feeds,feedStreams,users});
                    if(subscription.length > 0)
                        this.subscribeTo(subscription);
                }
            } else if(event === "talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                Janus.log("User: "+id+" - start talking");
                for(let i=0; i<feeds.length; i++) {
                    if(feeds[i] && feeds[i].id === id) {
                        feeds[i].talk = true;
                    }
                }
                this.setState({feeds});
            } else if(event === "stopped-talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                Janus.log("User: "+id+" - stop talking");
                for(let i=0; i<feeds.length; i++) {
                    if(feeds[i] && feeds[i].id === id) {
                        feeds[i].talk = false;
                    }
                }
                this.setState({feeds});
            } else if(event === "destroyed") {
                // The room has been destroyed
                Janus.warn("The room has been destroyed!");
            } else if(event === "event") {
                // Any info on our streams or a new feed to attach to?
                let {feedStreams,user,myid} = this.state;
                if(msg["streams"] !== undefined && msg["streams"] !== null) {
                    let streams = msg["streams"];
                    for (let i in streams) {
                        let stream = streams[i];
                        stream["id"] = myid;
                        stream["display"] = user;
                    }
                    feedStreams[myid] = {id: myid, display: user, streams: streams};
                    this.setState({feedStreams})
                } else if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let feed = msg["publishers"];
                    let {feeds,feedStreams,users} = this.state;
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.log(feed);
                    let subscription = [];
                    for(let f in feed) {
                        let id = feed[f]["id"];
                        let display = JSON.parse(feed[f]["display"]);
                        if(display.role !== "user")
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
                    if(subscription.length > 0)
                        this.subscribeTo(subscription);
                } else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
                    // One of the publishers has gone away?
                    var leaving = msg["leaving"];
                    Janus.log("Publisher left: " + leaving);
                    this.unsubscribeFrom(leaving);

                } else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                    let unpublished = msg["unpublished"];
                    Janus.log("Publisher left: " + unpublished);
                    if(unpublished === 'ok') {
                        // That's us
                        videoroom.hangup();
                        return;
                    }
                    this.unsubscribeFrom(unpublished);

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
            videoroom.handleRemoteJsep({jsep: jsep});
        }
    };

    newRemoteFeed = (subscription) => {
        this.state.janus.attach(
            {
                plugin: "janus.plugin.videoroom",
                opaqueId: "remotefeed_user",
                success: (pluginHandle) => {
                    let remoteFeed = pluginHandle;
                    Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
                    Janus.log("  -- This is a multistream subscriber",remoteFeed);
                    this.setState({remoteFeed, creatingFeed: false});
                    // We wait for the plugin to send us an offer
                    let subscribe = {request: "join", room: this.state.current_room, ptype: "subscriber", streams: subscription};
                    remoteFeed.send({ message: subscribe });
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
                    Janus.log(" ::: Got a message (subscriber) :::");
                    Janus.log(msg);
                    let event = msg["videoroom"];
                    Janus.log("Event: " + event);
                    if(msg["error"] !== undefined && msg["error"] !== null) {
                        Janus.debug("-- ERROR: " + msg["error"]);
                    } else if(event !== undefined && event !== null) {
                        if(event === "attached") {
                            //this.setState({creatingFeed: false});
                            Janus.log("Successfully attached to feed in room " + msg["room"]);
                        } else if(event === "event") {
                            // Check if we got an event on a simulcast-related event from this publisher
                        } else {
                            // What has just happened?
                        }
                    }
                    if(msg["streams"]) {
                        // Update map of subscriptions by mid
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
                        // Answer and attach
                        this.state.remoteFeed.createAnswer(
                            {
                                jsep: jsep,
                                // Add data:true here if you want to subscribe to datachannels as well
                                // (obviously only works if the publisher offered them in the first place)
                                media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
                                success: (jsep) => {
                                    Janus.debug("Got SDP!");
                                    Janus.debug(jsep);
                                    let body = { request: "start", room: this.state.current_room };
                                    this.state.remoteFeed.send({ message: body, jsep: jsep });
                                },
                                error: (error) => {
                                    Janus.error("WebRTC error:", error);
                                    Janus.debug("WebRTC error... " + JSON.stringify(error));
                                }
                            });
                    }
                },
                onlocaltrack: (track, on) => {
                    // The subscriber stream is recvonly, we don't expect anything here
                },
                onremotetrack: (track, mid, on) => {
                    Janus.log(" ::: Got a remote track event ::: (remote feed)");
                    Janus.log("Remote track (mid=" + mid + ") " + (on ? "added" : "removed") + ":", track);
                    // Which publisher are we getting on this mid?
                    let {mids,feedStreams} = this.state;
                    let feed = mids[mid].feed_id;
                    if(feedStreams[feed].stream) {
                        return
                    }
                    Janus.log(" >> This track is coming from feed " + feed + ":", mid);
                    if(!on) {
                        Janus.log(" :: Going to stop track :: " + feed + ":", mid);
                        //FIXME: Remove callback for audio track does not come
                        track.stop();
                        //FIXME: does we really need to stop all track for feed id?
                        return;
                    }
                    // If we're here, a new track was added
                    if(track.kind === "audio") {
                        // New audio track: create a stream out of it, and use a hidden <audio> element
                        let stream = new MediaStream();
                        stream.addTrack(track.clone());
                        Janus.log("Created remote audio stream:", stream);
                        let remoteaudio = this.refs["remoteAudio" + feed];
                        Janus.attachMediaStream(remoteaudio, stream);
                    } else if(track.kind === "video") {
                        // New video track: create a stream out of it
                        let stream = new MediaStream();
                        stream.addTrack(track.clone());
                        Janus.log("Created remote video stream:", stream);
                        feedStreams[feed].stream = stream;
                        this.setState({feedStreams});
                        let remotevideo = this.refs["remoteVideo" + feed];
                        Janus.attachMediaStream(remotevideo, stream);
                    } else {
                        Janus.log("Created remote data channel");
                    }
                },
                ondataopen: (data) => {
                    Janus.log("The DataChannel is available!(feed)");
                },
                ondata: (data) => {
                    Janus.debug("We got data from the DataChannel! (feed) " + data);
                    // let msg = JSON.parse(data);
                    // this.onRoomData(msg);
                    // Janus.log(" :: We got msg via DataChannel: ",msg)
                },
                oncleanup: () => {
                    Janus.log(" ::: Got a cleanup notification (remote feed) :::");
                }
            });
    };

    subscribeTo = (subscription) => {
        // New feeds are available, do we need create a new plugin handle first?
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
            return
        }

        // We don't creating, so let's do it
        this.setState({creatingFeed: true});
        this.newRemoteFeed(subscription);
    };

    unsubscribeFrom = (id) => {
        // Unsubscribe from this publisher
        let {mids,questions,quistions_queue,cammuteds,feeds,users,feedStreams} = this.state;
        let {remoteFeed} = this.state;
        for (let i=0; i<feeds.length; i++) {
            if (feeds[i].id === id) {
                Janus.log("Feed " + feeds[i] + " (" + id + ") has left the room, detaching");
                //TODO: remove mids
                delete users[feeds[i].display.id];
                delete feedStreams[id];
                if(questions[feeds[i].display.id]) {
                    delete questions[feeds[i].display.id];
                    this.setState({questions});
                    for(let q = 0; q < quistions_queue.length; q++){
                        if(quistions_queue[q].user.id === feeds[i].display.id) {
                            quistions_queue.splice(q, 1);
                            this.setState({quistions_queue});
                            break
                        }
                    }
                }
                feeds.splice(i, 1);
                // Send an unsubscribe request
                let unsubscribe = {
                    request: "unsubscribe",
                    streams: [{ feed: id }]
                };
                if(remoteFeed !== null)
                    remoteFeed.send({ message: unsubscribe });
                this.setState({feeds,users,feedStreams});
                break
            }
        }
        // In case feed exit with camera muted
        if(feedStreams[id]) {
            if(cammuteds[feedStreams[id].display.id]) {
                delete cammuteds[feedStreams[id].display.id];
                delete users[feedStreams[id].display.id];
                if(questions[feedStreams[id].display.id]) {
                    delete questions[feedStreams[id].display.id];
                    this.setState({questions});
                    for(let q = 0; q < quistions_queue.length; q++){
                        if(quistions_queue[q].user.id === feedStreams[id].display.id) {
                            quistions_queue.splice(q, 1);
                            this.setState({quistions_queue});
                            break
                        }
                    }
                }
                delete feedStreams[id];
                this.setState({cammuteds,users,feedStreams});
            }
        }
    };

    // newRemoteFeed = (id, talk) => {
    //     // A new feed has been published, create a new plugin handle and attach to it as a subscriber
    //     var remoteFeed = null;
    //     this.state.janus.attach(
    //         {
    //             plugin: "janus.plugin.videoroom",
    //             opaqueId: "remotefeed_user",
    //             success: (pluginHandle) => {
    //                 remoteFeed = pluginHandle;
    //                 remoteFeed.simulcastStarted = false;
    //                 //this.setState({remotefeed});
    //                 Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
    //                 Janus.log("  -- This is a subscriber");
    //                 // We wait for the plugin to send us an offer
    //                 let listen = { "request": "join", "room": this.state.current_room, "ptype": "subscriber", "feed": id };
    //                 remoteFeed.send({"message": listen});
    //             },
    //             error: (error) => {
    //                 Janus.error("  -- Error attaching plugin...", error);
    //             },
    //             onmessage: (msg, jsep) => {
    //                 Janus.debug(" ::: Got a message (subscriber) :::");
    //                 Janus.debug(msg);
    //                 let event = msg["videoroom"];
    //                 Janus.debug("Event: " + event);
    //                 if(msg["error"] !== undefined && msg["error"] !== null) {
    //                     Janus.debug(":: Error msg: " + msg["error"]);
    //                 } else if(event !== undefined && event !== null) {
    //                     if(event === "attached") {
    //                         // Subscriber created and attached
    //                         let {feeds,users} = this.state;
    //                         for(let i=0;i<MAX_FEEDS;i++) {
    //                             if(feeds[i] === undefined || feeds[i] === null) {
    //                                 remoteFeed.rfindex = i;
    //                                 remoteFeed.rfid = msg["id"];
    //                                 remoteFeed.rfuser = JSON.parse(msg["display"]);
    //                                 remoteFeed.rfuser.rfid = msg["id"];
    //                                 remoteFeed.talk = talk;
    //                                 feeds[i] = remoteFeed;
    //                                 users[remoteFeed.rfuser.id] = remoteFeed.rfuser;
    //                                 break;
    //                             }
    //                         }
    //                         this.setState({feeds,users});
    //                         Janus.log("Successfully attached to feed " + remoteFeed.rfid + " (" + remoteFeed.rfuser + ") in room " + msg["room"]);
    //                     } else if(event === "event") {
    //                         // Check if we got an event on a simulcast-related event from this publisher
    //                         let substream = msg["substream"];
    //                         let temporal = msg["temporal"];
    //                         if((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
    //                             if(!remoteFeed.simulcastStarted) {
    //                                 remoteFeed.simulcastStarted = true;
    //                             }
    //                         }
    //                     } else {
    //                         // What has just happened?
    //                     }
    //                 }
    //                 if(jsep !== undefined && jsep !== null) {
    //                     Janus.debug("Handling SDP as well...");
    //                     Janus.debug(jsep);
    //                     // Answer and attach
    //                     remoteFeed.createAnswer(
    //                         {
    //                             jsep: jsep,
    //                             // Add data:true here if you want to subscribe to datachannels as well
    //                             // (obviously only works if the publisher offered them in the first place)
    //                             media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
    //                             success: (jsep) => {
    //                                 Janus.debug("Got SDP!");
    //                                 Janus.debug(jsep);
    //                                 let body = { "request": "start", "room": this.state.current_room };
    //                                 remoteFeed.send({"message": body, "jsep": jsep});
    //                             },
    //                             error: (error) => {
    //                                 Janus.error("WebRTC error:", error);
    //                             }
    //                         });
    //                 }
    //             },
    //             webrtcState: (on) => {
    //                 Janus.log("Janus says this WebRTC PeerConnection (feed #" + remoteFeed.rfindex + ") is " + (on ? "up" : "down") + " now");
    //             },
    //             onlocalstream: (stream) => {
    //                 // The subscriber stream is recvonly, we don't expect anything here
    //             },
    //             onremotestream: (stream) => {
    //                 Janus.debug("Remote feed #" + remoteFeed.rfindex);
    //                 let remotevideo = this.refs["remoteVideo" + remoteFeed.rfid];
    //                 Janus.attachMediaStream(remotevideo, stream);
    //             },
    //             ondataopen: (data) => {
    //                 Janus.log("The DataChannel is available!(feed)");
    //             },
    //             ondata: (data) => {
    //                 Janus.debug("We got data from the DataChannel! (feed) " + data);
    //                 let msg = JSON.parse(data);
    //                 Janus.log(" :: We got msg via DataChannel: ",msg)
    //             },
    //             oncleanup: () => {
    //                 Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
    //             }
    //         });
    // };
    //
    // newSwitchFeed = (id, talk) => {
    //     this.state.janus.attach(
    //         {
    //             plugin: "janus.plugin.videoroom",
    //             opaqueId: "switchfeed_user",
    //             success: (pluginHandle) => {
    //                 let switchFeed = pluginHandle;
    //                 switchFeed.simulcastStarted = false;
    //                 //this.setState({remotefeed});
    //                 Janus.log("Plugin attached! (" + switchFeed.getPlugin() + ", id=" + switchFeed.getId() + ")");
    //                 Janus.log("  -- This is a subscriber");
    //                 // We wait for the plugin to send us an offer
    //                 let listen = { "request": "join", "room": this.state.current_room, "ptype": "subscriber", "feed": id };
    //                 switchFeed.send({"message": listen});
    //                 this.setState({switchFeed});
    //             },
    //             error: (error) => {
    //                 Janus.error("  -- Error attaching plugin...", error);
    //             },
    //             onmessage: (msg, jsep) => {
    //                 Janus.debug(" ::: Got a message (subscriber) :::");
    //                 Janus.debug(msg);
    //                 let event = msg["videoroom"];
    //                 Janus.debug("Event: " + event);
    //                 if(msg["error"] !== undefined && msg["error"] !== null) {
    //                     Janus.debug(":: Error msg: " + msg["error"]);
    //                 } else if(event !== undefined && event !== null) {
    //                     if(event === "attached") {
    //                         // Subscriber created and attached
    //                         Janus.log("Successfully attached to feed " + this.state.switchFeed.rfid + " (" + this.state.switchFeed.rfuser + ") in room " + msg["room"]);
    //                     } else {
    //                         // What has just happened?
    //                     }
    //                 }
    //                 if(jsep !== undefined && jsep !== null) {
    //                     Janus.debug("Handling SDP as well...");
    //                     Janus.debug(jsep);
    //                     // Answer and attach
    //                     this.state.switchFeed.createAnswer(
    //                         {
    //                             jsep: jsep,
    //                             media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
    //                             success: (jsep) => {
    //                                 Janus.debug("Got SDP!");
    //                                 Janus.debug(jsep);
    //                                 let body = { "request": "start", "room": this.state.current_room };
    //                                 this.state.switchFeed.send({"message": body, "jsep": jsep});
    //                             },
    //                             error: (error) => {
    //                                 Janus.error("WebRTC error:", error);
    //                             }
    //                         });
    //                 }
    //             },
    //             webrtcState: (on) => {
    //                 Janus.log("Janus says this WebRTC PeerConnection (feed #" + this.state.switchFeed.rfindex + ") is " + (on ? "up" : "down") + " now");
    //             },
    //             onlocalstream: (stream) => {
    //                 // The subscriber stream is recvonly, we don't expect anything here
    //             },
    //             onremotestream: (stream) => {
    //                 Janus.debug("Remote feed #" + this.state.switchFeed.rfindex);
    //                 let switchvideo = this.refs.switchVideo;
    //                 Janus.attachMediaStream(switchvideo, stream);
    //                 //var videoTracks = stream.getVideoTracks();
    //             },
    //             oncleanup: () => {
    //                 Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
    //                 this.setState({switchFeed: null});
    //             }
    //         });
    // };
    //
    // onMessage = (videoroom, msg, jsep, initdata) => {
    //     Janus.debug(" ::: Got a message (publisher) :::");
    //     Janus.debug(msg);
    //     let event = msg["videoroom"];
    //     Janus.log("Event: " + event);
    //     if(event !== undefined && event !== null) {
    //         if(event === "joined") {
    //             // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
    //             const {current_room} = this.state;
    //             let myid = msg["id"];
    //             let mypvtid = msg["private_id"];
    //             this.setState({myid ,mypvtid});
    //             Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
    //             //this.publishOwnFeed(true);
    //             // Any new feed to attach to?
    //             if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
    //                 let list = msg["publishers"];
    //                 Janus.log("Got a list of available publishers/feeds:");
    //                 Janus.log(list);
    //                 if(current_room === 1234) {
    //                     let users = {};
    //                     let feeds = list.filter(feeder => JSON.parse(feeder.display).role === "group");
    //                     console.log(feeds);
    //                     feeds.sort((a, b) => {
    //                         if (JSON.parse(a.display).username > JSON.parse(b.display).username) return 1;
    //                         if (JSON.parse(a.display).username < JSON.parse(b.display).username) return -1;
    //                         return 0;
    //                     });
    //                     for(let i=0;i<feeds.length;i++) {
    //                         let user = JSON.parse(feeds[i].display);
    //                         feeds[i].rfuser = user;
    //                         feeds[i].rfid = feeds[i].id;
    //                         user.rfid = feeds[i].id;
    //                         users[user.id] = user;
    //                     }
    //                     this.setState({feeds, users});
    //                 } else {
    //                     for(let i=0;i<list.length;i++) {
    //                         let id = list[i]["id"];
    //                         let talk = list[i]["talking"];
    //                         let user = JSON.parse(list[i].display);
    //                         if(user.role === "user")
    //                             this.newRemoteFeed(id, talk);
    //                     }
    //                 }
    //             }
    //         } else if(event === "talking") {
    //             let {feeds} = this.state;
    //             let id = msg["id"];
    //             let room = msg["room"];
    //             Janus.log("User: "+id+" - start talking");
    //             for(let i=0; i<MAX_FEEDS; i++) {
    //                 if(feeds[i] !== null && feeds[i] !== undefined && feeds[i].rfid === id) {
    //                     feeds[i].talk = true;
    //                 }
    //             }
    //             this.setState({feeds});
    //         } else if(event === "stopped-talking") {
    //             let {feeds} = this.state;
    //             let id = msg["id"];
    //             let room = msg["room"];
    //             Janus.log("User: "+id+" - stop talking");
    //             for(let i=0; i<MAX_FEEDS; i++) {
    //                 if(feeds[i] !== null && feeds[i] !== undefined && feeds[i].rfid === id) {
    //                     feeds[i].talk = false;
    //                 }
    //             }
    //             this.setState({feeds});
    //         } else if(event === "destroyed") {
    //             // The room has been destroyed
    //             Janus.warn("The room has been destroyed!");
    //         } else if(event === "event") {
    //             // Any new feed to attach to?
    //             if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
    //                 let list = msg["publishers"];
    //                 Janus.debug("Got a list of available publishers/feeds:");
    //                 Janus.debug(list);
    //                 for(let f in list) {
    //                     let id = list[f]["id"];
    //                     let display = JSON.parse(list[f]["display"]);
    //                     let audio = list[f]["audio_codec"];
    //                     let video = list[f]["video_codec"];
    //                     Janus.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");
    //                     if(display.role.match(/^(user)$/)) {
    //                         this.newRemoteFeed(id, false);
    //                     }
    //                     if(display.role.match(/^(group)$/)) {
    //                         let {feeds,users} = this.state;
    //                         let feed = list[f];
    //                         feed.rfid = list[f].id;
    //                         feed.rfuser = display;
    //                         feed.rfuser.rfid = list[f].id;
    //                         feed.talk = false;
    //                         users[feed.rfuser.id] = display;
    //                         console.log(":: Feed join: ", feed)
    //                         feeds.push(feed);
    //                         feeds.sort((a, b) => {
    //                             if (JSON.parse(a.display).username > JSON.parse(b.display).username) return 1;
    //                             if (JSON.parse(a.display).username < JSON.parse(b.display).username) return -1;
    //                             return 0;
    //                         });
    //                         this.setState({feeds,users});
    //                     }
    //                 }
    //             } else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
    //                 // One of the publishers has gone away?
    //                 let {feeds,quistions_queue} = this.state;
    //                 let leaving = msg["leaving"];
    //                 Janus.log("Publisher left: " + leaving);
    //                 for(let i=0; i<feeds.length; i++) {
    //                     if(feeds[i].rfid === leaving) {
    //                         feeds.splice(i, 1);
    //                         this.setState({feeds});
    //                         break;
    //                     }
    //                 }
    //                 // Delete from questions list
    //                 for(let i = 0; i < quistions_queue.length; i++){
    //                     if(quistions_queue[i].user.rfid === leaving) {
    //                         quistions_queue.splice(i, 1);
    //                         break
    //                     }
    //                 }
    //             } else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
    //                 // One of the publishers has unpublished?
    //                 let {feeds,quistions_queue} = this.state;
    //                 let unpublished = msg["unpublished"];
    //                 Janus.log("Publisher left: " + unpublished);
    //                 if(unpublished === 'ok') {
    //                     // That's us
    //                     videoroom.hangup();
    //                     return;
    //                 }
    //                 for(let i=0; i<feeds.length; i++) {
    //                     if(feeds[i].rfid === unpublished) {
    //                         feeds.splice(i, 1);
    //                         this.setState({feeds});
    //                         break;
    //                     }
    //                 }
    //                 // Delete from questions list
    //                 for(let i = 0; i < quistions_queue.length; i++){
    //                     if(quistions_queue[i].user.rfid === unpublished) {
    //                         quistions_queue.splice(i, 1);
    //                         break
    //                     }
    //                 }
    //             } else if(msg["error"] !== undefined && msg["error"] !== null) {
    //                 if(msg["error_code"] === 426) {
    //                     Janus.log("This is a no such room");
    //                 } else {
    //                     Janus.log(msg["error"]);
    //                 }
    //             }
    //         }
    //     }
    //     if(jsep !== undefined && jsep !== null) {
    //         Janus.debug("Handling SDP as well...");
    //         Janus.debug(jsep);
    //         videoroom.handleRemoteJsep({jsep: jsep});
    //     }
    // };

    switchFeed = (id) => {
        let {switchFeed} = this.state;
        if(!switchFeed) {
            this.newSwitchFeed(id,false);
        } else {
            let switchfeed = {"request" : "switch", "feed" : id, "audio" : true, "video" : true, "data" : false};
            this.state.switchFeed.send ({"message": switchfeed,
                success: () => {
                    Janus.log(" :: Switch Feed: ", id);
                }
            })
        }
    };

    publishOwnFeed = (useAudio) => {
        // Publish our stream
        let {videoroom} = this.state;

        videoroom.createOffer(
            {
                // Add data:true here if you want to publish datachannels as well
                media: { audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: true, video: "lowres" },
                simulcast: false,
                success: (jsep) => {
                    Janus.debug("Got publisher SDP!");
                    Janus.debug(jsep);
                    let publish = { "request": "configure", "audio": useAudio, "video": true };
                    videoroom.send({"message": publish, "jsep": jsep});
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

    onData = (data) => {
        Janus.log(":: We got message from Data Channel: ",data);
        let json = JSON.parse(data);
        // var transaction = json["transaction"];
        // if (transactions[transaction]) {
        //     // Someone was waiting for this
        //     transactions[transaction](json);
        //     delete transactions[transaction];
        //     return;
        // }
        let what = json["textroom"];
        if (what === "message") {
            // Incoming message: public or private?
            let msg = json["text"];
            let room = json["room"];
            msg = msg.replace(new RegExp('<', 'g'), '&lt');
            msg = msg.replace(new RegExp('>', 'g'), '&gt');
            let from = json["from"];
            let dateString = getDateString(json["date"]);
            let whisper = json["whisper"];
            if (whisper === true) {
                // Private message
                let {messages} = this.state;
                let message = JSON.parse(msg);
                message.user.username = message.user.display;
                message.time = dateString;
                Janus.log("-:: It's private message: ", message, from);
                messages.push(message);
                this.setState({messages});
                this.scrollToBottom();
            } else if(room === 1234){
                // Public message
                let {messages} = this.state;
                let message = JSON.parse(msg);
                message.time = dateString;
                Janus.log("-:: It's public message: ", message);
                messages.push(message);
                this.setState({messages});
                this.scrollToBottom();
            }
        } else if (what === "join") {
            // Somebody joined
            let username = json["username"];
            let display = json["display"];
            Janus.log("-:: Somebody joined - username: "+username+" : display: "+display)
        } else if (what === "leave") {
            // Somebody left
            let username = json["username"];
            let when = new Date();
            Janus.log("-:: Somebody left - username: "+username+" : Time: "+getDateString())
        } else if (what === "kicked") {
            // Somebody was kicked
            // var username = json["username"];
        } else if (what === "destroyed") {
            let room = json["room"];
            Janus.log("The room: "+room+" has been destroyed")
        }
    };

    onProtocolData = (data) => {
        let {current_room,feeds,users,questions} = this.state;

        // List users by user id send question
        if(data.type === "question" && data.status) {
            questions[data.user.id] = data.user;
            this.setState({questions});
        } else if(data.type === "question" && !data.status) {
            let {questions} = this.state;
            if(questions[data.user.id]) {
                delete questions[data.user.id];
                this.setState({questions});
            }
        }

        // Put question state in feeds list
        if (data.type === "question" && data.room === current_room) {
            let rfid = users[data.user.id].rfid;
            for (let i = 0; i < feeds.length; i++) {
                if (feeds[i] && feeds[i].id === rfid) {
                    feeds[i].question = data.status;
                    this.setState({feeds});
                    break
                }
            }
        }

        if(data.type === "question" && data.status && data.room === 1234) {
            let {quistions_queue,users} = this.state;
            data.user.rfid = users[data.user.id].rfid;
            quistions_queue.push(data);
            this.setState({quistions_queue});
        } else if(data.type === "question" && !data.status && data.room === 1234) {
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

    sendDataMessage = () => {
        let {input_value,user} = this.state;
        let msg = {user, text: input_value};
        let message = {
            textroom: "message",
            transaction: Janus.randomString(12),
            room: this.state.current_room,
            text: JSON.stringify(msg),
        };
        // Note: messages are always acknowledged by default. This means that you'll
        // always receive a confirmation back that the message has been received by the
        // server and forwarded to the recipients. If you do not want this to happen,
        // just add an ack:false property to the message above, and server won't send
        // you a response (meaning you just have to hope it succeeded).
        this.state.chatroom.data({
            text: JSON.stringify(message),
            error: (reason) => { alert(reason); },
            success: () => {
                Janus.log(":: Message sent ::");
                this.setState({input_value: ""});
            }
        });
    };

    sendPrivateMessage = () => {
        let {input_value,user,feed_user,current_room} = this.state;
        if(!feed_user) {
            alert("Choose user");
            return
        };
        let msg = {user, text: input_value};
        let message = {
            textroom: "message",
            transaction: Janus.randomString(12),
            room: this.state.current_room,
            to: feed_user.id,
            text: JSON.stringify(msg),
        };
        // Note: messages are always acknowledged by default. This means that you'll
        // always receive a confirmation back that the message has been received by the
        // server and forwarded to the recipients. If you do not want this to happen,
        // just add an ack:false property to the message above, and server won't send
        // you a response (meaning you just have to hope it succeeded).
        this.state.chatroom.data({
            text: JSON.stringify(message),
            error: (reason) => { alert(reason); },
            success: () => {
                Janus.log(":: Message sent ::");
                //FIXME: it's directly put to message box
                let {messages} = this.state;
                msg.time = getDateString();
                msg.to = current_room === 1234 ? feed_user.username : feed_user.display;
                Janus.log("-:: It's public message: "+msg);
                messages.push(msg);
                this.setState({messages, input_value: ""});
                this.scrollToBottom();
            }
        });
    };

    scrollToBottom = () => {
        this.refs.end.scrollIntoView({ behavior: 'smooth' })
    };

    selectRoom = (i) => {
        const {rooms} = this.state;
        let roomid = rooms[i].room;
        this.setState({roomid});
    };

    joinRoom = (data, i) => {
        Janus.log(" -- joinRoom: ", data, i);
        const {feeds,rooms,chatroom,user,switchFeed} = this.state;
        let room = data ? rooms[i].room : 1234;
        if (this.state.current_room === room)
            return;
        Janus.log(" :: Enter to room: ", room);
        if(switchFeed) {
            switchFeed.detach();
            this.setState({switchFeed: null});
        }

        // if(this.state.current_room !== 1234) {
        //     feeds.forEach(feed => {
        //         if (feed !== null && feed !== undefined) {
        //             Janus.log("-- :: Remove Feed: ",feed);
        //             feed.detach();
        //         }
        //     });
        // }

        if(this.state.current_room)
            this.exitRoom(this.state.current_room);
        this.setState({switch_mode: false, current_room: room,feeds: [], feed_user: null, feed_id: null});

        this.initVideoRoom(room);

        joinChatRoom(chatroom,room,user)
    };

    exitRoom = (room) => {
        let {videoroom, chatroom} = this.state;
        let videoreq = {request : "leave", "room": room};
        let chatreq = {textroom : "leave", transaction: Janus.randomString(12),"room": room};
        Janus.log(room);
        videoroom.send({"message": videoreq,
            success: () => {
                Janus.log(":: Video room leave callback: ");
                //this.getRoomList();
            }});
        chatroom.data({text: JSON.stringify(chatreq),
            success: () => {
                Janus.log(":: Text room leave callback: ");
            }
        });
    };

    getRoomID = () => {
        const {rooms} = this.state;
        let id = 1028;
        for(let i=id; i<1100; i++) {
            let roomid = rooms.filter(room => room.room === i);
            if (roomid.length === 0) {
                return i;
            }
        }
    };

    createChatRoom = (id,description) => {
        const {chatroom} = this.state;
        let req = {
            textroom : "create",
            room : id,
            transaction: Janus.randomString(12),
            secret: `${SECRET}`,
            description : description,
            is_private : false,
            permanent : true
        };
        chatroom.data({text: JSON.stringify(req),
            success: () => {
                Janus.log(":: Successfuly created room: ",id);
            },
            error: (reason) => {
                Janus.log(reason);
            }
        });
    };

    removeChatRoom = (id) => {
        const {chatroom} = this.state;
        let req = {
            textroom: "destroy",
            room: id,
            transaction: Janus.randomString(12),
            secret: `${SECRET}`,
            permanent: true,
        };
        chatroom.data({text: JSON.stringify(req),
            success: () => {
                Janus.log(":: Successfuly removed room: ", id);
            },
            error: (reason) => {
                Janus.log(reason);
            }
        });
    };

    setBitrate = (bitrate) => {
        this.setState({bitrate});
    };

    createRoom = () => {
        let {bitrate,description,videoroom} = this.state;
        let roomid = this.getRoomID();
        let janus_room = {
            request : "create",
            room: roomid,
            description: description,
            secret: `${SECRET}`,
            publishers: 20,
            bitrate: bitrate,
            fir_freq: 10,
            audiocodec: "opus",
            videocodec: "h264",
            audiolevel_event: true,
            audio_level_average: 100,
            audio_active_packets: 25,
            record: false,
            is_private: false,
            permanent: true,
        };
        Janus.log(description);
        videoroom.send({"message": janus_room,
            success: (data) => {
                Janus.log(":: Create callback: ", data);
                this.getRoomList();
                alert("Room: "+description+" created!")
                this.createChatRoom(roomid,description);
            },
        });
        this.setState({description: ""});
    };

    removeRoom = () => {
        const {roomid,videoroom} = this.state;
        let janus_room = {
            request: "destroy",
            room: roomid,
            secret: `${SECRET}`,
            permanent: true,
        };
        videoroom.send({"message": janus_room,
            success: (data) => {
                Janus.log(":: Remove callback: ", data);
                this.getRoomList();
                alert("Room ID: "+roomid+" removed!");
                this.removeChatRoom(roomid);
            },
        });
    };

    disableRoom = (e, data, i) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            Janus.log(data)
            // let {disabled_rooms} = this.state;
            // disabled_rooms.push(data);
            // this.setState({disabled_rooms});
            // this.getRoomList();
        }
    };

    kickUser = (id) => {
        const {current_room,videoroom,feed_id} = this.state;
        let request = {
            request: "kick",
            room: current_room,
            secret: `${SECRET}`,
            id: feed_id,
        };
        videoroom.send({"message": request,
            success: (data) => {
                Janus.log(":: Kick callback: ", data);
            },
        });
    };

    getUserInfo = (feed) => {
        let {display,id,talking} = feed;
        //this.setState({feed_id: id, feed_user: display, feed_talk: talking, switch_mode: true});
        this.setState({feed_id: id, feed_user: display, feed_talk: talking});
        Janus.log(display,id,talking);
        //this.switchFeed(id);
    };

    getFeedInfo = () => {
        return;
        let {session,handle} = this.state.feed_user;
        getPublisherInfo(session,handle,json => {
                Janus.log(":: Publisher info", json);
                this.setState({feed_rtcp: json.webrtc.media[1].rtcp.main});
            }, true
        )
    };

    handleShowClick = () => this.setState({ visible: !this.state.visible })



  render() {

      const { bitrate,rooms,current_room,switch_mode,user,feeds,i,messages,description,roomid,root,forwarders,feed_rtcp,feed_talk,quistions_queue } = this.state;
      const width = "134";
      const height = "100";
      const autoPlay = true;
      const controls = false;
      const muted = true;

      let v = (<Icon name='volume up' />);
      let q = (<Icon color='red' name='help' />);

      const bitrate_options = [
          { key: 1, text: '150Kb/s', value: 150000 },
          { key: 2, text: '300Kb/s', value: 300000 },
          { key: 3, text: '600Kb/s', value: 600000 },
      ];

      let rooms_list = rooms.map((data,i) => {
          const {room, num_participants, description} = data;
          return ({ key: room, text: description, value: i, description: num_participants.toString()})
      });

      let rooms_grid = rooms.map((data,i) => {
          const {room, num_participants, description} = data;
          return (
              <Table.Row active={current_room === room}
                         key={i} onClick={() => this.joinRoom(data, i)}
                         onContextMenu={(e) => this.disableRoom(e, data, i)} >
                  <Table.Cell width={5}>{description}</Table.Cell>
                  <Table.Cell width={1}>{num_participants}</Table.Cell>
              </Table.Row>
          )
      });

      let users_grid = feeds.map((feed,i) => {
          if(feed) {
              let fw = forwarders.filter(f => f.publisher_id === (current_room === 1234 ? feed.id : feed.rfid)).length > 0;
              let qt = quistions_queue.find(f => f.user.id === feed.display.id);
              return (
                  <Table.Row active={feed.id === this.state.feed_id} key={i} onClick={() => this.getUserInfo(feed)} >
                      <Table.Cell width={5}>{qt ? q : ""}{feed.display.display}</Table.Cell>
                      <Table.Cell width={1}>{fw ? v : ""}</Table.Cell>
                  </Table.Row>
              )
          }
      });

      let list_msgs = messages.map((msg,i) => {
          let {user,time,text,to} = msg;
          return (
              <div key={i}><p>
                  <i style={{color: 'grey'}}>{time}</i> -
                  <b style={{color: user.role === "admin" ? 'red' : 'blue'}}>{user.username}</b>
                  {to ? <b style={{color: 'blue'}}>-> {to} :</b> : ""}
              </p>{text}</div>
          );
      });

      let videos = this.state.feeds.map((feed) => {
          if(feed && current_room !== 1234) {
              let id = feed.id;
              let talk = feed.talk;
              return (<div className="video"
                           key={"v" + id}
                           ref={"video" + id}
                           id={"video" + id}>
                  <div className={classNames('video__overlay', {'talk' : talk})} />
                  <video key={id}
                         ref={"remoteVideo" + id}
                         id={"remoteVideo" + id}
                         width={width}
                         height={height}
                         autoPlay={autoPlay}
                         controls={controls}
                         playsInline={true}/>
                  <audio
                      key={"a" + id}
                      ref={"remoteAudio" + id}
                      id={"remoteAudio" + id}
                      autoPlay={autoPlay}
                      controls={controls}
                      playsinline={true}/>
              </div>);
          }
          return true;
      });

      let switchvideo = (
          <div className="video">
              <div className={classNames('video__overlay', {'talk' : feed_talk})} />
              <video ref = {"switchVideo"}
                     id = "switchVideo"
                     width = {width}
                     height = {height}
                     autoPlay = {autoPlay}
                     controls
                     muted = {false}
                     playsInline = {true} />
          </div>);

      let login = (<LoginPage user={user} />);

      let root_content = (
          <Menu secondary >
              <Menu.Item>
                  <Button color='orange' icon='volume up' labelPosition='right'
                          content='Stop Forwarders' onClick={this.stopForwardByRoom} />
              </Menu.Item>
              <Menu.Item>
              </Menu.Item>
              <Menu.Item>
                  <Button negative onClick={this.removeRoom}>Remove</Button>
                  :::
                  <Select
                      error={roomid}
                      scrolling
                      placeholder="Select Room:"
                      value={i}
                      options={rooms_list}
                      onChange={(e, {value}) => this.selectRoom(value)} />
              </Menu.Item>
              <Menu.Item>
                  <Input type='text' placeholder='Room description...' action value={description}
                         onChange={(v,{value}) => this.setState({description: value})}>
                      <input />
                      <Select
                          compact={true}
                          scrolling={false}
                          placeholder="Room Bitrate:"
                          value={bitrate}
                          options={bitrate_options}
                          onChange={(e, {value}) => this.setBitrate(value)}/>
                      <Button positive onClick={this.createRoom}>Create</Button>
                  </Input>
              </Menu.Item>
          </Menu>
      );

      let content = (
          <Segment className="virtual_segment" color='blue' raised>

              <Segment textAlign='center' className="ingest_segment">
                  {root ? root_content : ""}
              </Segment>

              <Grid>
                  <Grid.Row stretched>
                      <Grid.Column width={3}>

                          <Segment textAlign='center' className="group_list" raised>
                              <Table selectable compact='very' basic structured className="admin_table" unstackable>
                                  <Table.Header>
                                      <Table.Row>
                                          <Table.HeaderCell colSpan='2'>
                                              <Popup
                                                  trigger={<Button positive icon='info' onClick={this.getFeedInfo} />}
                                                  position='bottom right'
                                                  content={
                                                      <List as='ul'>
                                                          <List.Item as='li'>Video
                                                              <List.List as='ul'>
                                                                  <List.Item as='li'>in-link-quality: {feed_rtcp.video ? feed_rtcp.video["in-link-quality"] : ""}</List.Item>
                                                                  <List.Item as='li'>in-media-link-quality: {feed_rtcp.video ? feed_rtcp.video["in-media-link-quality"] : ""}</List.Item>
                                                                  <List.Item as='li'>jitter-local: {feed_rtcp.video ? feed_rtcp.video["jitter-local"] : ""}</List.Item>
                                                                  <List.Item as='li'>jitter-remote: {feed_rtcp.video ? feed_rtcp.video["jitter-remote"] : ""}</List.Item>
                                                                  <List.Item as='li'>lost: {feed_rtcp.video ? feed_rtcp.video["lost"] : ""}</List.Item>
                                                              </List.List>
                                                          </List.Item>
                                                          <List.Item as='li'>Audio
                                                              <List.List as='ul'>
                                                                  <List.Item as='li'>in-link-quality: {feed_rtcp.audio ? feed_rtcp.audio["in-link-quality"] : ""}</List.Item>
                                                                  <List.Item as='li'>in-media-link-quality: {feed_rtcp.audio ? feed_rtcp.audio["in-media-link-quality"] : ""}</List.Item>
                                                                  <List.Item as='li'>jitter-local: {feed_rtcp.audio ? feed_rtcp.audio["jitter-local"] : ""}</List.Item>
                                                                  <List.Item as='li'>jitter-remote: {feed_rtcp.audio ? feed_rtcp.audio["jitter-remote"] : ""}</List.Item>
                                                                  <List.Item as='li'>lost: {feed_rtcp.audio ? feed_rtcp.audio["lost"] : ""}</List.Item>
                                                              </List.List>
                                                          </List.Item>
                                                      </List>
                                                  }
                                                  on='click'
                                                  hideOnScroll
                                              />
                                              <Button negative icon='user x' onClick={this.kickUser} />
                                          </Table.HeaderCell>
                                      </Table.Row>
                                  </Table.Header>
                                  <Table.Body>
                                      {users_grid}
                                  </Table.Body>
                              </Table>
                          </Segment>

                      </Grid.Column>
                      <Grid.Column largeScreen={10}>
                          {/*<Segment className="videos_segment" onDoubleClick={this.handleShowClick}>*/}
                          <div className="videos-panel">
                              <div className="videos">
                                  <div className="videos__wrapper">
                                      {switch_mode ? "" : videos}
                                      <Transition visible={switch_mode} animation='scale' duration={500}>
                                          {switchvideo}
                                      </Transition>
                                  </div>
                              </div>
                          </div>
                          {/*</Segment>*/}

                      </Grid.Column>
                      <Grid.Column width={3}>

                          <Segment textAlign='center' className="group_list" raised>
                              <Table selectable compact='very' basic structured className="admin_table" unstackable>
                                  <Table.Body>
                                      <Table.Row disabled positive>
                                          <Table.Cell colSpan={2} textAlign='center'>Groups:</Table.Cell>
                                      </Table.Row>
                                      <Table.Row active={current_room === 1234}
                                                 key={i} onClick={() => this.joinRoom(null, i)}>
                                          <Table.Cell width={5}>Galaxy</Table.Cell>
                                          <Table.Cell width={1}>{current_room === 1234 ? feeds.length : 0}</Table.Cell>
                                      </Table.Row>
                                      <Table.Row disabled positive>
                                          <Table.Cell colSpan={2} textAlign='center'>Users:</Table.Cell>
                                      </Table.Row>
                                      {rooms_grid}
                                  </Table.Body>
                              </Table>
                          </Segment>

                      </Grid.Column>
                  </Grid.Row>
              </Grid>

              <Segment className='chat_segment'>

                  <Message className='messages_list'>
                      {list_msgs}
                      <div ref='end' />
                  </Message>

                  <Input fluid type='text' placeholder='Type your message' action value={this.state.input_value}
                         onChange={(v,{value}) => this.setState({input_value: value})}>
                      <input />
                      <Button positive onClick={this.sendPrivateMessage}>Send</Button>
                  </Input>

              </Segment>

          </Segment>
      );

      return (

          <div>
              {user ? content : login}
          </div>

      );
  }
}

export default ShidurAdmin;

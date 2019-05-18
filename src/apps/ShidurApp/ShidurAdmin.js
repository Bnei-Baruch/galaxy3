import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Segment, Menu, Button, Input, Table, Grid, Message, Transition, Select, Icon, Popup, List} from "semantic-ui-react";
import {initJanus, initChatRoom, getDateString, joinChatRoom, getPublisherInfo, getHiddenProp, notifyMe} from "../../shared/tools";
import './ShidurAdmin.css';
import './VideoConteiner.scss'
import {SECRET} from "../../shared/consts";
import {initGxyProtocol,sendProtocolMessage} from "../../shared/protocol";
import classNames from "classnames";
import {client, getUser} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";

class ShidurAdmin extends Component {

    state = {
        bitrate: 150000,
        chatroom: null,
        forwarders: [],
        groups: [],
        janus: null,
        feedStreams: {},
        mids: [],
        feeds: [],
        rooms: [],
        feed_id: null,
        feed_user: null,
        feed_talk: false,
        feed_rtcp: {},
        current_room: "",
        room_id: "",
        room_name: "Forward",
        videoroom: null,
        remotefeed: null,
        switchFeed: null,
        myid: null,
        mypvtid: null,
        mystream: null,
        msg_type: "private",
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
        }, 5000 );
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

    getFeedsList = (room_id) => {
        const {videoroom} = this.state;
        if (videoroom) {
            videoroom.send({message: {request: "listparticipants", "room": room_id},
                success: (data) => {
                    Janus.log(" :: Got Feeds List (room :"+room_id+"): ", data);
                    let feeds = data.participants;
                    Janus.log(feeds)
                }
            });
        }
    };

    listForward = (room) => {
        let {videoroom} = this.state;
        let req = {request:"listforwarders",room,"secret":`${SECRET}`};
        videoroom.send ({"message": req,
            success: (data) => {
                Janus.debug(" :: List forwarders: ", data);
                if(!data.publishers)
                    return;
                //let forwarders = data.publishers.filter(f => f.forwarders);
                let forwarders = [];
                for(let i=0; i<data.publishers.length; i++) {
                    if(data.publishers[i].forwarders) {
                        let user = data.publishers[i].display;
                        data.publishers[i].display = JSON.parse(user);
                        let role = data.publishers[i].display.role;
                        if(role === "user" || role === "group")
                            forwarders.push(data.publishers[i])
                    }
                }
                this.setState({forwarders});
            }
        })
    };

    stopForward = (id) => {
        const {videoroom,current_room} = this.state;
        if(current_room === "")
            return;
        let req = {request:"listforwarders",room:current_room,secret:`${SECRET}`};
        videoroom.send ({"message": req,
            success: (data) => {
                for(let i=0; i<data.publishers.length; i++) {
                    if(data.publishers[i].forwarders) {
                        let user = data.publishers[i].display;
                        data.publishers[i].display = JSON.parse(user);
                        let role = data.publishers[i].display.role;
                        let publisher_id = data.publishers[i].publisher_id;
                        if(id && id === publisher_id) {
                            for(let f=0; f<data.publishers[i].forwarders.length; f++) {
                                let stream_id = data.publishers[i].forwarders[f].stream_id;
                                let stop_forward = {request:"stop_rtp_forward",stream_id,publisher_id,"room":current_room,"secret":`${SECRET}`};
                                videoroom.send({"message": stop_forward});
                            }
                        } else if(role === "user" || role === "group") {
                            for(let f=0; f<data.publishers[i].forwarders.length; f++) {
                                let stream_id = data.publishers[i].forwarders[f].stream_id;
                                let stop_forward = {request:"stop_rtp_forward",stream_id,publisher_id,"room":current_room,"secret":`${SECRET}`};
                                videoroom.send({"message": stop_forward});
                            }
                        }
                    }
                }
            }
        });
    };

    initVideoRoom = (room_id) => {
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
                this.setState({videoroom, remoteFeed: null, groups: []});

                if(room_id) {
                    this.listForward(room_id);
                    let register = { "request": "join", "room": room_id, "ptype": "publisher", "display": JSON.stringify(user) };
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
        Janus.debug(" ::: Got a message (publisher) :::");
        Janus.debug(msg);
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
                    let {feedStreams,users} = this.state;
                    let list = msg["publishers"];

                    // Filter service and camera muted feeds
                    let fr = this.state.current_room === 1234 ? "group" : "user";
                    let feeds = list.filter(feeder => JSON.parse(feeder.display).role === fr);
                    feeds.sort((a, b) => {
                        if (JSON.parse(a.display).username > JSON.parse(b.display).username) return 1;
                        if (JSON.parse(a.display).username < JSON.parse(b.display).username) return -1;
                    });

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
                        let subst = {feed: id};
                        for (let i in streams) {
                            let stream = streams[i];
                            stream["id"] = id;
                            stream["display"] = display;
                        }
                        feedStreams[id] = {id, display, streams};
                        let st = users[display.id] && users[display.id].sound_test;
                        let qt = users[display.id] && users[display.id].question;
                        users[display.id] = display;
                        users[display.id].rfid = id;
                        users[display.id].sound_test = st;
                        users[display.id].question = qt;
                        subscription.push(subst);
                    }
                    this.setState({feeds,feedStreams,users});
                    if(subscription.length > 0 && fr === "user")
                        this.subscribeTo(subscription);
                }
            } else if(event === "talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                Janus.debug("User: "+id+" - start talking");
                for(let i=0; i<feeds.length; i++) {
                    if(feeds[i] && feeds[i].id === id) {
                        feeds[i].talk = true;
                    }
                }
                this.setState({feeds});
            } else if(event === "stopped-talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                Janus.debug("User: "+id+" - stop talking");
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
                    let fr = this.state.current_room === 1234 ? "group" : "user";
                    for(let f in feed) {
                        let id = feed[f]["id"];
                        let display = JSON.parse(feed[f]["display"]);
                        if(display.role !== fr)
                            return;
                        let streams = feed[f]["streams"];
                        feed[f].display = display;
                        let subst = {feed: id};
                        for (let i in streams) {
                            let stream = streams[i];
                            stream["id"] = id;
                            stream["display"] = display;
                        }
                        feedStreams[id] = {id, display, streams};
                        let st = users[display.id] && users[display.id].sound_test;
                        let qt = users[display.id] && users[display.id].question;
                        users[display.id] = display;
                        users[display.id].rfid = id;
                        users[display.id].sound_test = st;
                        users[display.id].question = qt;
                        subscription.push(subst);
                    }
                    feeds.push(feed[0]);
                    feeds.sort((a, b) => {
                        if (a.display.username > b.display.username) return 1;
                        if (a.display.username < b.display.username) return -1;
                    });
                    this.setState({feeds,feedStreams,users});
                    if(subscription.length > 0 && fr === "user")
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
                            mids[mindex] = msg["streams"][i];
                            if(msg["streams"][i]["feed_display"]) {
                                let display = JSON.parse(msg["streams"][i]["feed_display"]);
                                mids[mindex].feed_user = display;
                            }
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
                                media: { audioSend: false, videoSend: false, data: false},	// We want recvonly audio/video
                                success: (jsep) => {
                                    Janus.debug("Got SDP!");
                                    Janus.debug(jsep);
                                    let body = { request: "start", room: this.state.current_room, data: false };
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
                    Janus.debug(" ::: Got a remote track event ::: (remote feed)");
                    if(!mid) {
                       mid = track.id.split("janus")[1];
                    }
                    Janus.debug("Remote track (mid=" + mid + ") " + (on ? "added" : "removed") + ":", track);
                    // Which publisher are we getting on this mid?
                    let {mids,feedStreams} = this.state;
                    let feed = mids[mid].feed_id;
                    Janus.debug(" >> This track is coming from feed " + feed + ":", mid);
                    if(!on) return;
                    // If we're here, a new track was added
                    if(track.kind === "audio") {
                        // New audio track: create a stream out of it, and use a hidden <audio> element
                        let stream = new MediaStream();
                        stream.addTrack(track.clone());
                        Janus.log("Created remote audio stream:", stream);
                        feedStreams[feed].audio_stream = stream;
                        this.setState({feedStreams});
                        let remoteaudio = this.refs["remoteAudio" + feed];
                        Janus.attachMediaStream(remoteaudio, stream);
                    } else if(track.kind === "video") {
                        // New video track: create a stream out of it
                        let stream = new MediaStream();
                        stream.addTrack(track.clone());
                        Janus.log("Created remote video stream:", stream);
                        feedStreams[feed].video_stream = stream;
                        this.setState({feedStreams});
                        let remotevideo = this.refs["remoteVideo" + feed];
                        Janus.attachMediaStream(remotevideo, stream);
                    } else if(track.kind === "data") {
                        Janus.debug("Its data channel");
                    } else {
                        Janus.debug(" :: Track already attached: ",track);
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
        let {feeds,users,feed_id} = this.state;
        let {remoteFeed} = this.state;
        for (let i=0; i<feeds.length; i++) {
            if (feeds[i].id === id) {
                Janus.log("Feed " + feeds[i] + " (" + id + ") has left the room, detaching");

                // Remove from feeds list
                feeds.splice(i, 1);
                // Send an unsubscribe request
                let unsubscribe = {
                    request: "unsubscribe",
                    streams: [{ feed: id }]
                };
                if(remoteFeed !== null)
                    remoteFeed.send({ message: unsubscribe });

                // Detach selected feed
                if(feed_id === id) {
                    remoteFeed.detach();
                    this.setState({remoteFeed: null, groups: []});
                }
                this.setState({feeds,users});
                break
            }
        }
    };

    switchFeed = (id) => {
        let {remoteFeed} = this.state;
        let streams = [
            {feed: id, mid: "0", sub_mid: "0"},
            {feed: id, mid: "1", sub_mid: "1"},
            ];
        let switchfeed = {"request" : "switch", streams};
        remoteFeed.send ({"message": switchfeed,
            success: (cb) => {
                Janus.log(" :: Switch Feed: ", id, cb);
            }
        })
    };

    publishOwnFeed = (useAudio) => {
        // Publish our stream
        let {videoroom} = this.state;

        videoroom.createOffer(
            {
                // Add data:true here if you want to publish datachannels as well
                media: { audio: false, video: false, data: false },
                simulcast: false,
                success: (jsep) => {
                    Janus.debug("Got publisher SDP!");
                    Janus.debug(jsep);
                    let publish = { "request": "configure", "audio": false, "video": false, "data": false };
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
        Janus.debug(":: We got message from Data Channel: ",data);
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
                notifyMe(message.user.username, message.text,(getHiddenProp !== null));
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
        let {users} = this.state;

        if(data.type === "question") {
            if(users[data.user.id]) {
                users[data.user.id].question = data.status;
                this.setState({users});
            } else {
                users[data.user.id] = {question: data.status};
                this.setState({users});
            }
        } else if(data.type === "sound-test") {
            if(users[data.id]) {
                users[data.id].sound_test = true;
                this.setState({users});
            } else {
                users[data.id] = {sound_test: true};
                this.setState({users});
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

    sendBroadcastMessage = () => {
        const { protocol, current_room, input_value, messages, user } = this.state;
        let msg = { type: "chat-broadcast", room: current_room, user, text: input_value};
        sendProtocolMessage(protocol, null, msg );
        msg.time = getDateString();
        msg.to = "ALL";
        Janus.log("-:: It's broadcast message: "+msg);
        messages.push(msg);
        this.setState({messages, input_value: "", msg_type: "private"}, () => {
            this.scrollToBottom();
        });
    };

    sendRemoteCommand = (command_type) => {
        const {protocol,feed_user,user} = this.state;
        if(feed_user) {
            let msg = { type: command_type, id: feed_user.id};
            sendProtocolMessage(protocol, user, msg);
        }
    };

    sendMessage = () => {
        const {msg_type} = this.state;
        msg_type === "private" ? this.sendPrivateMessage() : this.sendBroadcastMessage();
    };

    scrollToBottom = () => {
        this.refs.end.scrollIntoView({ behavior: 'smooth' })
    };

    selectRoom = (i) => {
        const {rooms} = this.state;
        let room_id = rooms[i].room;
        this.setState({room_id});
    };

    joinRoom = (data, i) => {
        Janus.log(" -- joinRoom: ", data, i);
        const {rooms,chatroom,user,switchFeed} = this.state;
        let room = data ? rooms[i].room : 1234;
        let room_name = data ? rooms[i].description : "Galaxy";
        if (this.state.current_room === room)
            return;
        Janus.log(" :: Enter to room: ", room);
        if(switchFeed) {
            switchFeed.detach();
            this.setState({switchFeed: null});
        }

        if(this.state.current_room)
            this.exitRoom(this.state.current_room);
        this.setState({switch_mode: false, current_room: room, room_name,feeds: [], feed_user: null, feed_id: null});

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
            let room_id = rooms.filter(room => room.room === i);
            if (room_id.length === 0) {
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
        let room_id = this.getRoomID();
        let janus_room = {
            request : "create",
            room: room_id,
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
                this.createChatRoom(room_id,description);
            },
        });
        this.setState({description: ""});
    };

    removeRoom = () => {
        const {room_id,videoroom} = this.state;
        let janus_room = {
            request: "destroy",
            room: room_id,
            secret: `${SECRET}`,
            permanent: true,
        };
        videoroom.send({"message": janus_room,
            success: (data) => {
                Janus.log(":: Remove callback: ", data);
                this.getRoomList();
                alert("Room ID: "+room_id+" removed!");
                this.removeChatRoom(room_id);
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
        Janus.log(" :: Selected feed: ",feed);
        let {display,id,talking} = feed;
        let {current_room} =  this.state;
        //this.setState({feed_id: id, feed_user: display, feed_talk: talking, switch_mode: true});
        this.setState({feed_id: id, feed_user: display, feed_talk: talking});
        Janus.log(display,id,talking);

        if(current_room !== 1234)
            return;

        if(this.state.groups.length === 0) {
            let groups = [];
            groups.push(feed);
            this.setState({groups});
            let subscription = [{feed: id, mid: "0"},{feed: id, mid: "1"}];
            this.subscribeTo(subscription);
        } else {
            this.switchFeed(id);
        }
    };

    getFeedInfo = () => {
        if(this.state.feed_user) {
            let {session,handle} = this.state.feed_user;
            if(session && handle) {
                getPublisherInfo(session, handle, json => {
                        Janus.log(":: Publisher info", json);
                        let video = json.info.webrtc.media[1].rtcp.main;
                        let audio = json.info.webrtc.media[0].rtcp.main;
                        this.setState({feed_rtcp: {video, audio}});
                    }, true
                )
            }
        }
    };


  render() {

      const { bitrate,rooms,current_room,switch_mode,user,feeds,feed_id,i,messages,description,room_id,room_name,root,forwarders,feed_rtcp,feed_talk,msg_type,users} = this.state;
      const width = "134";
      const height = "100";
      const autoPlay = true;
      const controls = false;
      const muted = true;

      const f = (<Icon name='volume up' />);
      const q = (<Icon color='red' name='help' />);
      const v = (<Icon name='checkmark' />);
      const x = (<Icon name='close' />);

      const bitrate_options = [
          { key: 1, text: '150Kb/s', value: 150000 },
          { key: 2, text: '300Kb/s', value: 300000 },
          { key: 3, text: '600Kb/s', value: 600000 },
      ];

      const send_options = [
          { key: 'all', text: 'All', value: 'all' },
          { key: 'private', text: 'Private', value: 'private' },
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
              let fw = forwarders.find(f => f.publisher_id === feed.id);
              let qt = users[feed.display.id].question;
              let st = users[feed.display.id].sound_test;
              //let st = feed.display.self_test;
              return (
                  <Table.Row active={feed.id === this.state.feed_id} key={i} onClick={() => this.getUserInfo(feed)} >
                      <Table.Cell width={10}>{qt ? q : ""}{feed.display.display}</Table.Cell>
                      <Table.Cell width={1}>{fw ? f : ""}</Table.Cell>
                      <Table.Cell positive={st} width={1}>{st ? v : ""}</Table.Cell>
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

      let view = current_room !== 1234 ? "feeds" : "groups";

      let videos = this.state[view].map((feed) => {
          if(feed) {
              let id = feed.id;
              let talk = feed.talk;
              let selected = id === feed_id && current_room !== 1234;
              return (<div className="video"
                           key={"v" + id}
                           ref={"video" + id}
                           id={"video" + id}>
                  <div className={classNames('video__overlay', {'talk' : talk}, {'selected' : selected})} />
                  <video key={id}
                         ref={"remoteVideo" + id}
                         id={"remoteVideo" + id}
                         width={width}
                         height={height}
                         autoPlay={autoPlay}
                         controls={controls}
                         muted={muted}
                         playsInline={true}/>
                  <audio
                      key={"a" + id}
                      ref={"remoteAudio" + id}
                      id={"remoteAudio" + id}
                      autoPlay={autoPlay}
                      controls={controls}
                      playsInline={true}/>
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
                  <Button color='orange' icon='bell slash' labelPosition='right'
                          content={room_name} onClick={this.stopForward} />
              </Menu.Item>
              <Menu.Item>
              </Menu.Item>
              <Menu.Item>
                  <Button negative onClick={this.removeRoom}>Remove</Button>
                  :::
                  <Select
                      error={room_id}
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
                  <Button color='blue' icon='sound' onClick={() => this.sendRemoteCommand("sound-test")} />
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
                  {root ? root_content : ""}
              </Segment>

              <Grid>
                  <Grid.Row stretched columns='equal'>
                      <Grid.Column width={4}>
                          <Segment.Group>
                              { root ?
                              <Segment textAlign='center'>
                                  <Popup trigger={<Button color="orange" icon='bell slash' onClick={() => this.stopForward(feed_id)} />} content='Stop forward' inverted />
                                  <Popup trigger={<Button negative icon='user x' onClick={this.kickUser} />} content='Kick' inverted />
                                      <Popup trigger={<Button color="brown" icon='sync alternate' alt="test" onClick={() => this.sendRemoteCommand("client-reconnect")} />} content='Reconnect' inverted />
                                      <Popup trigger={<Button color="olive" icon='redo alternate' onClick={() => this.sendRemoteCommand("client-reload")} />} content='Reload page(LOST FEED HERE!)' inverted />
                                      <Popup trigger={<Button color="teal" icon='microphone' onClick={() => this.sendRemoteCommand("client-mute")} />} content='Mute/Unmute' inverted />
                                      <Popup trigger={<Button color="blue" icon='power off' onClick={() => this.sendRemoteCommand("client-disconnect")} />} content='Disconnect(LOST FEED HERE!)' inverted />
                                      <Popup trigger={<Button color="yellow" icon='question' onClick={() => this.sendRemoteCommand("client-question")} />} content='Set/Unset question' inverted />
                              </Segment>
                                  : ""}
                          <Segment textAlign='center' className="group_list" raised>
                              <Table selectable compact='very' basic structured className="admin_table" unstackable>
                                  <Table.Body>
                                      <Table.Row disabled>
                                          <Table.Cell width={10}>Title</Table.Cell>
                                          <Table.Cell width={1}>FW</Table.Cell>
                                          <Table.Cell width={1}>ST</Table.Cell>
                                      </Table.Row>
                                      {users_grid}
                                  </Table.Body>
                              </Table>
                          </Segment>
                          </Segment.Group>
                      </Grid.Column>
                      <Grid.Column largeScreen={9}>
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
                      <Select options={send_options}
                              value={msg_type}
                              error={msg_type === "all"}
                              onChange={(e,{value}) => this.setState({msg_type: value})} />
                      <Button positive negative={msg_type === "all"} onClick={this.sendMessage}>Send</Button>
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

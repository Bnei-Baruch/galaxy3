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
        chatroom: null,
        forwarders: [],
        janus: null,
        quistions_queue: [],
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
        });
        setInterval(() => this.getRoomList(), 10000 );
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
    }

    initVideoRoom = (roomid) => {
        if(this.state.videoroom)
            this.state.videoroom.detach();
        this.state.janus.attach({
            plugin: "janus.plugin.videoroom",
            opaqueId: "videoroom_user",
            success: (videoroom) => {
                Janus.log(" :: My handle: ", videoroom);
                Janus.log("Plugin attached! (" + videoroom.getPlugin() + ", id=" + videoroom.getId() + ")");
                Janus.log("  -- This is a publisher/manager");
                let {user} = this.state;
                this.setState({videoroom});

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
                    //sfutest.send({"message": { "request": "configure", "bitrate": bitrate }});
                    //return false;
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

    newRemoteFeed = (id, talk) => {
        // A new feed has been published, create a new plugin handle and attach to it as a subscriber
        var remoteFeed = null;
        this.state.janus.attach(
            {
                plugin: "janus.plugin.videoroom",
                opaqueId: "remotefeed_user",
                success: (pluginHandle) => {
                    remoteFeed = pluginHandle;
                    remoteFeed.simulcastStarted = false;
                    //this.setState({remotefeed});
                    Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
                    Janus.log("  -- This is a subscriber");
                    // We wait for the plugin to send us an offer
                    let listen = { "request": "join", "room": this.state.current_room, "ptype": "subscriber", "feed": id };
                    remoteFeed.send({"message": listen});
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
                            let {feeds,users} = this.state;
                            for(let i=0;i<MAX_FEEDS;i++) {
                                if(feeds[i] === undefined || feeds[i] === null) {
                                    remoteFeed.rfindex = i;
                                    remoteFeed.rfid = msg["id"];
                                    remoteFeed.rfuser = JSON.parse(msg["display"]);
                                    remoteFeed.rfuser.rfid = msg["id"];
                                    remoteFeed.talk = talk;
                                    feeds[i] = remoteFeed;
                                    users[remoteFeed.rfuser.id] = remoteFeed.rfuser;
                                    break;
                                }
                            }
                            this.setState({feeds,users});
                            Janus.log("Successfully attached to feed " + remoteFeed.rfid + " (" + remoteFeed.rfuser + ") in room " + msg["room"]);
                        } else if(event === "event") {
                            // Check if we got an event on a simulcast-related event from this publisher
                            let substream = msg["substream"];
                            let temporal = msg["temporal"];
                            if((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
                                if(!remoteFeed.simulcastStarted) {
                                    remoteFeed.simulcastStarted = true;
                                    // Add some new buttons
                                    //addSimulcastButtons(remoteFeed.rfindex, remoteFeed.videoCodec === "vp8");
                                }
                                // We just received notice that there's been a switch, update the buttons
                                //updateSimulcastButtons(remoteFeed.rfindex, substream, temporal);
                            }
                        } else {
                            // What has just happened?
                        }
                    }
                    if(jsep !== undefined && jsep !== null) {
                        Janus.debug("Handling SDP as well...");
                        Janus.debug(jsep);
                        // Answer and attach
                        remoteFeed.createAnswer(
                            {
                                jsep: jsep,
                                // Add data:true here if you want to subscribe to datachannels as well
                                // (obviously only works if the publisher offered them in the first place)
                                media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
                                success: (jsep) => {
                                    Janus.debug("Got SDP!");
                                    Janus.debug(jsep);
                                    let body = { "request": "start", "room": this.state.current_room };
                                    remoteFeed.send({"message": body, "jsep": jsep});
                                },
                                error: (error) => {
                                    Janus.error("WebRTC error:", error);
                                }
                            });
                    }
                },
                webrtcState: (on) => {
                    Janus.log("Janus says this WebRTC PeerConnection (feed #" + remoteFeed.rfindex + ") is " + (on ? "up" : "down") + " now");
                },
                onlocalstream: (stream) => {
                    // The subscriber stream is recvonly, we don't expect anything here
                },
                onremotestream: (stream) => {
                    Janus.debug("Remote feed #" + remoteFeed.rfindex);
                    let remotevideo = this.refs["remoteVideo" + remoteFeed.rfid];
                    // if(remotevideo.length === 0) {
                    //     // No remote video yet
                    // }
                    Janus.attachMediaStream(remotevideo, stream);
                    var videoTracks = stream.getVideoTracks();
                    if(videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
                        // No remote video
                    } else {
                        // Yes remote video
                    }
                    // if(Janus.webRTCAdapter.browserDetails.browser === "chrome" || Janus.webRTCAdapter.browserDetails.browser === "firefox" ||
                    //     Janus.webRTCAdapter.browserDetails.browser === "safari") {
                    //     $('#curbitrate'+remoteFeed.rfindex).removeClass('hide').show();
                    //     bitrateTimer[remoteFeed.rfindex] = setInterval(function() {
                    //         // Display updated bitrate, if supported
                    //         var bitrate = remoteFeed.getBitrate();
                    //         $('#curbitrate'+remoteFeed.rfindex).text(bitrate);
                    //         // Check if the resolution changed too
                    //         var width = $("#remotevideo"+remoteFeed.rfindex).get(0).videoWidth;
                    //         var height = $("#remotevideo"+remoteFeed.rfindex).get(0).videoHeight;
                    //         if(width > 0 && height > 0)
                    //             $('#curres'+remoteFeed.rfindex).removeClass('hide').text(width+'x'+height).show();
                    //     }, 1000);
                    // }
                },
                ondataopen: (data) => {
                    Janus.log("The DataChannel is available!(feed)");
                },
                ondata: (data) => {
                    Janus.debug("We got data from the DataChannel! (feed) " + data);
                    let msg = JSON.parse(data);
                    Janus.log(" :: We got msg via DataChannel: ",msg)
                },
                oncleanup: () => {
                    Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
                }
            });
    };

    newSwitchFeed = (id, talk) => {
        this.state.janus.attach(
            {
                plugin: "janus.plugin.videoroom",
                opaqueId: "switchfeed_user",
                success: (pluginHandle) => {
                    let switchFeed = pluginHandle;
                    switchFeed.simulcastStarted = false;
                    //this.setState({remotefeed});
                    Janus.log("Plugin attached! (" + switchFeed.getPlugin() + ", id=" + switchFeed.getId() + ")");
                    Janus.log("  -- This is a subscriber");
                    // We wait for the plugin to send us an offer
                    let listen = { "request": "join", "room": this.state.current_room, "ptype": "subscriber", "feed": id };
                    switchFeed.send({"message": listen});
                    this.setState({switchFeed});
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
                            Janus.log("Successfully attached to feed " + this.state.switchFeed.rfid + " (" + this.state.switchFeed.rfuser + ") in room " + msg["room"]);
                        } else {
                            // What has just happened?
                        }
                    }
                    if(jsep !== undefined && jsep !== null) {
                        Janus.debug("Handling SDP as well...");
                        Janus.debug(jsep);
                        // Answer and attach
                        this.state.switchFeed.createAnswer(
                            {
                                jsep: jsep,
                                media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
                                success: (jsep) => {
                                    Janus.debug("Got SDP!");
                                    Janus.debug(jsep);
                                    let body = { "request": "start", "room": this.state.current_room };
                                    this.state.switchFeed.send({"message": body, "jsep": jsep});
                                },
                                error: (error) => {
                                    Janus.error("WebRTC error:", error);
                                }
                            });
                    }
                },
                webrtcState: (on) => {
                    Janus.log("Janus says this WebRTC PeerConnection (feed #" + this.state.switchFeed.rfindex + ") is " + (on ? "up" : "down") + " now");
                },
                onlocalstream: (stream) => {
                    // The subscriber stream is recvonly, we don't expect anything here
                },
                onremotestream: (stream) => {
                    Janus.debug("Remote feed #" + this.state.switchFeed.rfindex);
                    let switchvideo = this.refs.switchVideo;
                    Janus.attachMediaStream(switchvideo, stream);
                    //var videoTracks = stream.getVideoTracks();
                },
                oncleanup: () => {
                    Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
                    this.setState({switchFeed: null});
                }
            });
    };

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
        var json = JSON.parse(data);
        // var transaction = json["transaction"];
        // if (transactions[transaction]) {
        //     // Someone was waiting for this
        //     transactions[transaction](json);
        //     delete transactions[transaction];
        //     return;
        // }
        var what = json["textroom"];
        if (what === "message") {
            // Incoming message: public or private?
            var msg = json["text"];
            msg = msg.replace(new RegExp('<', 'g'), '&lt');
            msg = msg.replace(new RegExp('>', 'g'), '&gt');
            var from = json["from"];
            var dateString = getDateString(json["date"]);
            var whisper = json["whisper"];
            if (whisper === true) {
                // Private message
                Janus.log("-:: It's private message: "+dateString+" : from: "+from+" : "+msg)
                let {messages} = this.state;
                //let message = dateString+" : "+from+" : "+msg;
                let message = JSON.parse(msg);
                message.time = dateString;
                Janus.log("-:: It's public message: "+message);
                messages.push(message);
                this.setState({messages});
                this.scrollToBottom();
            } else {
                // Public message
                let {messages} = this.state;
                //let message = dateString+" : "+from+" : "+msg;
                let message = JSON.parse(msg);
                message.time = dateString;
                Janus.log("-:: It's public message: "+message);
                messages.push(message);
                this.setState({messages});
                this.scrollToBottom();
            }
        } else if (what === "join") {
            // Somebody joined
            var username = json["username"];
            var display = json["display"];
            Janus.log("-:: Somebody joined - username: "+username+" : display: "+display)
        } else if (what === "leave") {
            // Somebody left
            var username = json["username"];
            var when = new Date();
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
        let {input_value,user,feed_user} = this.state;
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
                msg.to = feed_user.username;
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

    onMessage = (videoroom, msg, jsep, initdata) => {
        Janus.debug(" ::: Got a message (publisher) :::");
        Janus.debug(msg);
        let event = msg["videoroom"];
        Janus.debug("Event: " + event);
        if(event !== undefined && event !== null) {
            if(event === "joined") {
                // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
                const {current_room} = this.state;
                let myid = msg["id"];
                let mypvtid = msg["private_id"];
                this.setState({myid ,mypvtid});
                Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
                //this.publishOwnFeed(true);
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.log(list);
                    if(current_room === 1234) {
                        let users = {};
                        let feeds = list.filter(feeder => JSON.parse(feeder.display).role === "group");
                        for(let i=0;i<feeds.length;i++) {
                            let user = JSON.parse(feeds[i].display);
                            feeds[i].rfuser = user;
                            feeds[i].rfid = feeds[i].id;
                            user.rfid = feeds[i].id;
                            users[user.id] = user;
                        }
                        this.setState({feeds, users});
                    } else {
                        let feeds = list.filter(feeder => JSON.parse(feeder.display).role === "user");
                        for(let i=0;i<feeds.length;i++) {
                            let id = list[i]["id"];
                            let talk = list[i]["talking"];
                            this.newRemoteFeed(id, talk);
                        }
                    }
                }
            } else if(event === "talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                let room = msg["room"];
                Janus.log("User: "+id+" - start talking");
                for(let i=0; i<MAX_FEEDS; i++) {
                    if(feeds[i] !== null && feeds[i] !== undefined && feeds[i].rfid === id) {
                        feeds[i].talk = true;
                    }
                }
                this.setState({feeds});
            } else if(event === "stopped-talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                let room = msg["room"];
                Janus.log("User: "+id+" - stop talking");
                for(let i=0; i<MAX_FEEDS; i++) {
                    if(feeds[i] !== null && feeds[i] !== undefined && feeds[i].rfid === id) {
                        feeds[i].talk = false;
                    }
                }
                this.setState({feeds});
            } else if(event === "destroyed") {
                // The room has been destroyed
                Janus.warn("The room has been destroyed!");
            } else if(event === "event") {
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.debug(list);
                    console.log(":: ---------- Group feed: ", list[0])
                    for(let f in list) {
                        let id = list[f]["id"];
                        let display = JSON.parse(list[f]["display"]);
                        let audio = list[f]["audio_codec"];
                        let video = list[f]["video_codec"];
                        Janus.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");
                        if(display.role.match(/^(user)$/)) {
                            this.newRemoteFeed(id, false);
                        }
                        if(display.role.match(/^(group)$/)) {
                            let {feeds,users} = this.state;
                            let feed = list[f];
                            feed.rfid = list[f].id;
                            feed.rfuser = display;
                            feed.rfuser.rfid = list[f].id;
                            feed.talk = false;
                            users[feed.rfuser.id] = display;
                            console.log(":: Group feed: ", feed)
                            feeds.push(feed);
                            this.setState({feeds,users});
                        }
                    }
                } else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
                    // One of the publishers has gone away?
                    let {feeds} = this.state;
                    let leaving = msg["leaving"];
                    Janus.log("Publisher left: " + leaving);
                    for(let i=0; i<feeds.length; i++) {
                        if(feeds[i].rfid === leaving) {
                            feeds.splice(i, 1);
                            this.setState({feeds});
                            break;
                        }
                    }
                } else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                    // One of the publishers has unpublished?
                    let {feeds} = this.state;
                    let unpublished = msg["unpublished"];
                    Janus.log("Publisher left: " + unpublished);
                    if(unpublished === 'ok') {
                        // That's us
                        videoroom.hangup();
                        return;
                    }
                    for(let i=0; i<feeds.length; i++) {
                        if(feeds[i].rfid === unpublished) {
                            feeds.splice(i, 1);
                            this.setState({feeds});
                            break;
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
            videoroom.handleRemoteJsep({jsep: jsep});
        }
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

        if(this.state.current_room !== 1234) {
            feeds.forEach(feed => {
                if (feed !== null && feed !== undefined) {
                    Janus.log("-- :: Remove Feed: ",feed);
                    feed.detach();
                }
            });
        }

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

    createRoom = () => {
        let {description,videoroom} = this.state;
        let roomid = this.getRoomID();
        let janus_room = {
            request : "create",
            room: roomid,
            description: description,
            secret: `${SECRET}`,
            publishers: 20,
            bitrate: 150000,
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
        let {rfuser,rfid,talking} = feed;
        this.setState({feed_id: rfid, feed_user: rfuser, feed_talk: talking, switch_mode: true});
        Janus.log(rfuser,rfid,talking);
        this.switchFeed(rfid);
    };

    getFeedInfo = () => {
        let {session,handle} = this.state.feed_user;
        getPublisherInfo(session,handle,json => {
                Janus.log(":: Publisher info", json);
                this.setState({feed_rtcp: json.info.streams[0].rtcp_stats});
            }
        )
    }

    handleShowClick = () => this.setState({ visible: !this.state.visible })



  render() {

      const { rooms,current_room,switch_mode,user,feeds,i,messages,description,roomid,root,forwarders,feed_rtcp,feed_talk } = this.state;
      const width = "134";
      const height = "100";
      const autoPlay = true;
      const controls = false;
      const muted = true;

      let v = (<Icon name='volume up' />);

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
              return (
                  <Table.Row active={feed.rfid === this.state.feed_id} key={i} onClick={() => this.getUserInfo(feed)} >
                      <Table.Cell width={5}>{feed.rfuser.display}</Table.Cell>
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
              let id = feed.rfid;
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

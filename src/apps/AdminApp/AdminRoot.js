import React, {Component} from 'react';
import {Janus} from "../../lib/janus";
import {
    Button,
    Grid,
    Icon,
    Input,
    List,
    Menu,
    Message,
    Popup,
    Segment,
    Select,
    Table
} from "semantic-ui-react";
import {getDateString, getState} from "../../shared/tools";
import './AdminRoot.css';
import './AdminRootVideo.scss'
import {SECRET} from "../../shared/consts";
import classNames from "classnames";
import platform from "platform";
import {client} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";
import GxyJanus from "../../shared/janus-utils";

class AdminRoot extends Component {

    state = {
        bitrate: 128000,
        janus: null,
        gateways: {},
        feedStreams: {},
        mids: [],
        feeds: [],
        rooms: [],
        rooms_list: [],
        feed_id: null,
        feed_info: null,
        feed_user: null,
        feed_talk: false,
        feed_rtcp: {},
        current_room: "",
        room_id: "",
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
        users: {},
    };

    componentDidMount() {
        document.addEventListener("keydown", this.onKeyPressed);
        getState('galaxy/users', (users) => {
            this.setState({users});
        });
    };

    componentWillUnmount() {
        document.removeEventListener("keydown", this.onKeyPressed);
        this.state.gateways.forEach(x => x.destroy());
    };

    onKeyPressed = (e) => {
        if(e.code === "Enter")
            this.sendPrivateMessage();
    };

    checkPermission = (user) => {
        let gxy_root = user.roles.find(role => role === 'gxy_root');
        if (gxy_root) {
            delete user.roles;
            user.role = "root";
            this.setState({user});
            this.initAdminRoot(user);
        } else {
            alert("Access denied!");
            client.signoutRedirect();
        }
    };

    initAdminRoot = (user) => {
        const JANUS_GATEWAYS = ["gxy1", "gxy2", "gxy3"];
        const gateways = {};
        JANUS_GATEWAYS.forEach(inst => {
            gateways[inst] = new GxyJanus(inst);
        });
        this.setState({gateways});

        Object.values(gateways).forEach(gateway => {
            gateway.init()
                .then(() => {
                    gateway.initChatRoom(data => this.onChatData(gateway, data))
                        .catch(err => {
                            console.log("[AdminRoot] gateway.initChatRoom error", gateway.name, err);
                        });

                    gateway.initGxyProtocol(user, data => this.onProtocolData(gateway, data))
                        .catch(err => {
                            console.log("[AdminRoot] gateway.initGxyProtocol error", gateway.name, err);
                        });
                })
                .catch(err => {
                    console.log("[AdminRoot] gateway.init error", gateway.name, err);
                })
        });

        setInterval(() => {
            this.getRoomsState();
            if (this.state.feed_user)
                this.getFeedInfo()
        }, 1000);
    };

    getRoomsState = () => {
        getState('galaxy/rooms', (rooms) => {
            rooms.sort((a, b) => {
                if (a.description > b.description) return 1;
                if (a.description < b.description) return -1;
                return 0;
            });
            this.setState({rooms});
        });
    };

    getRoomList = (inst) => {
        const janus = this.state.gateways[inst];
        if (janus.videoroom) {
            janus.videoroom.send({
                message: {request: "list"},
                success: (data) => {
                    let rooms_list = data.list;
                    rooms_list.sort((a, b) => {
                        if (a.description > b.description) return 1;
                        if (a.description < b.description) return -1;
                        return 0;
                    });
                    this.setState({rooms_list});
                }
            });
        }
    };

    newVideoRoom = (gateway, room) => {
        console.log("[AdminRoot] newVideoRoom", room);

        gateway.initVideoRoom({
            onmessage: (msg, jsep) => {
                this.onVideoroomMessage(gateway, msg, jsep);
            }
        })
            .then(() => {
                console.log("[AdminRoot] gateway.initVideoRoom success");

                this.getRoomList(gateway.name);

                const register = {
                    "request": "join",
                    room,
                    "ptype": "publisher",
                    "display": JSON.stringify(this.state.user)
                };
                console.log("[AdminRoot] join videoroom room", register);
                gateway.videoroom.send({
                    message: register,
                    success: () => {
                        gateway.log('[videoroom] join as publisher success', register)
                    },
                    error: (err) => {
                        gateway.error('[videoroom] error join as publisher', register, err)
                    }
                });
            })
            .catch(err => {
                    console.log("[AdminRoot] gateway.initVideoRoom error", err);
                }
            );
    };

    onVideoroomMessage = (gateway, msg, jsep) => {
        const event = msg["videoroom"];
        if(event !== undefined && event !== null) {
            if(event === "joined") {
                // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
                let myid = msg["id"];
                let mypvtid = msg["private_id"];
                this.setState({myid ,mypvtid});
                console.log("[AdminRoot] Successfully joined room " + msg["room"] + " with ID " + myid + " on " + gateway.name);

                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let {feedStreams,users} = this.state;
                    let list = msg["publishers"];
                    console.log("[AdminRoot] Got Publishers (joined)", list);

                    // Filter service and camera muted feeds
                    let fr = "user";
                    let feeds = list.filter(feeder => JSON.parse(feeder.display).role === fr);
                    feeds.sort((a, b) => {
                        if (JSON.parse(a.display).username > JSON.parse(b.display).username) return 1;
                        if (JSON.parse(a.display).username < JSON.parse(b.display).username) return -1;
                        return 0;
                    });

                    console.log("[AdminRoot] available feeds", feeds);
                    const subscription = [];
                    for(let f in feeds) {
                        let id = feeds[f]["id"];
                        let display = JSON.parse(feeds[f]["display"]);
                        let talk = feeds[f]["talking"];
                        let streams = feeds[f]["streams"];
                        feeds[f].display = display;
                        feeds[f].talk = talk;
                        feeds[f].janus = gateway.name;
                        let subst = {feed: id};
                        for (let i in streams) {
                            let stream = streams[i];
                            stream["id"] = id;
                            stream["display"] = display;
                        }
                        feedStreams[id] = {id, display, streams};
                        users[display.id] = {...display, ...users[display.id], rfid: id};
                        subscription.push(subst);
                    }
                    this.setState({feeds,feedStreams,users});
                    if(subscription.length > 0 && fr === "user")
                        this.subscribeTo(subscription, gateway.name);
                }
            } else if(event === "talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                console.debug("[AdminRoot] User start talking", id);
                for(let i=0; i<feeds.length; i++) {
                    if(feeds[i] && feeds[i].id === id) {
                        feeds[i].talk = true;
                    }
                }
                this.setState({feeds});
            } else if(event === "stopped-talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                console.debug("[AdminRoot] User stop talking", id);
                for(let i=0; i<feeds.length; i++) {
                    if(feeds[i] && feeds[i].id === id) {
                        feeds[i].talk = false;
                    }
                }
                this.setState({feeds});
            } else if(event === "destroyed") {
                console.warn("[AdminRoot] The room has been destroyed!");
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
                    console.log("[AdminRoot] Got Publishers (event)", feed);

                    let {feeds,feedStreams,users} = this.state;
                    let subscription = [];
                    let fr = "user";
                    for(let f in feed) {
                        let id = feed[f]["id"];
                        let display = JSON.parse(feed[f]["display"]);
                        if(display.role !== fr)
                            return;
                        let streams = feed[f]["streams"];
                        feed[f].display = display;
                        feed[f].janus = gateway.name;
                        let subst = {feed: id};
                        for (let i in streams) {
                            let stream = streams[i];
                            stream["id"] = id;
                            stream["display"] = display;
                        }
                        feedStreams[id] = {id, display, streams};
                        users[display.id] = {...display, ...users[display.id], rfid: id};
                        subscription.push(subst);
                    }
                    feeds.push(feed[0]);
                    feeds.sort((a, b) => {
                        if (a.display.username > b.display.username) return 1;
                        if (a.display.username < b.display.username) return -1;
                        return 0;
                    });
                    this.setState({feeds,feedStreams,users});
                    if(subscription.length > 0 && fr === "user")
                        this.subscribeTo(subscription, gateway.name);
                } else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
                    // One of the publishers has gone away?
                    const leaving = msg["leaving"];
                    console.log("[AdminRoot] leaving", leaving);
                    this.unsubscribeFrom(leaving, gateway.name);
                } else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                    let unpublished = msg["unpublished"];
                    console.log("[AdminRoot] unpublished", unpublished);
                    if(unpublished === 'ok') {
                        console.log("[AdminRoot] videoroom.hangup()", gateway.name);
                        gateway.videoroom.hangup(); // That's us
                    } else {
                        this.unsubscribeFrom(unpublished, gateway.name);
                    }
                } else if(msg["error"] !== undefined && msg["error"] !== null) {
                    if(msg["error_code"] === 426) {
                        console.error("[AdminRoot] no such room", gateway.name, msg);
                    } else {
                        console.error("[AdminRoot] videoroom error message", msg);
                    }
                }
            }
        }

        if(jsep !== undefined && jsep !== null) {
            gateway.debug("[videoroom] Handling SDP as well...", jsep);
            gateway.videoroom.handleRemoteJsep({jsep});
        }
    };

    newRemoteFeed = (gateway, subscription) => {
        gateway.newRemoteFeed({
            onmessage:(msg, jsep) => {
                let event = msg["videoroom"];
                if(msg["error"] !== undefined && msg["error"] !== null) {
                    gateway.error("[remoteFeed] error message:", msg["error"]);
                } else if(event !== undefined && event !== null) {
                    if(event === "attached") {
                        //this.setState({creatingFeed: false});
                        gateway.log("[remoteFeed] Successfully attached to feed in room " + msg["room"]);
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
                    gateway.debug("[remoteFeed] Handling SDP as well...", jsep);
                    gateway.remoteFeed.createAnswer(
                        {
                            jsep: jsep,
                            media: { audioSend: false, videoSend: false, data: false},	// We want recvonly audio/video
                            success: (jsep) => {
                                gateway.debug("[remoteFeed] Got SDP", jsep);
                                let body = { request: "start", room: this.state.current_room, data: false };
                                gateway.remoteFeed.send({ message: body, jsep: jsep });
                            },
                            error: (error) => {
                                gateway.error("[remoteFeed] createAnswer error", error);
                            }
                        });
                }
            },
            onremotetrack: (track, mid, on) => {
                // Which publisher are we getting on this mid?
                let {mids,feedStreams} = this.state;
                let feed = mids[mid].feed_id;
                console.log("[AdminRoot] This track is coming from feed " + feed + ":", mid);
                // If we're here, a new track was added
                if(track.kind === "audio" && on) {
                    // New audio track: create a stream out of it, and use a hidden <audio> element
                    let stream = new MediaStream();
                    stream.addTrack(track.clone());
                    console.log("[AdminRoot] Created remote audio stream:", stream);
                    feedStreams[feed].audio_stream = stream;
                    this.setState({feedStreams});
                    let remoteaudio = this.refs["remoteAudio" + feed];
                    Janus.attachMediaStream(remoteaudio, stream);
                } else if(track.kind === "video" && on) {
                    // New video track: create a stream out of it
                    let stream = new MediaStream();
                    stream.addTrack(track.clone());
                    console.log("[AdminRoot] Created remote video stream:", stream);
                    feedStreams[feed].video_stream = stream;
                    this.setState({feedStreams});
                    let remotevideo = this.refs["remoteVideo" + feed];
                    Janus.attachMediaStream(remotevideo, stream);
                } else if(track.kind === "data") {
                    console.debug("[AdminRoot] It's data channel");
                } else {
                    console.debug("[AdminRoot] Track already attached: ", track);
                }
            },
        })
            .then(() => {
                const subscribe = {request: "join", room: this.state.current_room, ptype: "subscriber", streams: subscription};
                console.log("[AdminRoot] newRemoteFeed join", subscribe);
                gateway.remoteFeed.send({
                    message: subscribe,
                    success: () => { gateway.log('[remoteFeed] join as subscriber success', subscribe)},
                    error: (err) => { gateway.error('[remoteFeed] error join as subscriber', subscribe, err)}
                });
            })
            .catch(err => {
                console.error("[AdminRoot] gateway.newRemoteFeed error", err);
            });
    };

    subscribeTo = (subscription, inst) => {
        const gateway = this.state.gateways[inst];

        // New feeds are available, do we need create a new plugin handle first?
        if (gateway.remoteFeed) {
            const subscribe = {request: "subscribe", streams: subscription};
            console.log("[AdminRoot] subscribeTo subscribe", subscribe);
            gateway.remoteFeed.send({
                message: subscribe,
                success: () => { gateway.log('[remoteFeed] subscribe success', subscribe)},
                error: (err) => { gateway.error('[remoteFeed] error subscribe', subscribe, err)}
            });
        } else {
            this.newRemoteFeed(gateway, subscription);
        }
    };

    unsubscribeFrom = (id, inst) => {
        console.log("[AdminRoot] unsubscribeFrom", inst, id);
        const {feeds, users, feed_user, gateways} = this.state;
        const gateway = gateways[inst];
        for (let i = 0; i < feeds.length; i++) {
            if (feeds[i].id === id) {
                console.log("[AdminRoot] unsubscribeFrom feed", feeds[i]);

                // Remove from feeds list
                feeds.splice(i, 1);

                // Send an unsubscribe request
                const unsubscribe = {request: "unsubscribe", streams: [{feed: id}]};
                console.log("[AdminRoot] unsubscribeFrom unsubscribe", unsubscribe);
                gateway.remoteFeed.send({
                    message: unsubscribe,
                    success: () => { gateway.log('[remoteFeed] unsubscribe success', unsubscribe)},
                    error: (err) => { gateway.error('[remoteFeed] error unsubscribe', unsubscribe, err)}
                });

                if (feed_user && feed_user.rfid === id) {
                    this.setState({feed_user: null});
                }

                this.setState({feeds, users});
                break
            }
        }
    };

    onChatData = (gateway, data) => {
        const json = JSON.parse(data);
        const what = json["textroom"];
        if (what === "message") {
            // Incoming message: public or private?
            let msg = json["text"];
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
                console.log("[AdminRoot] private message", gateway.name, from, message);
                messages.push(message);
                this.setState({messages});
                this.scrollToBottom();
            } else {
                console.warn("[AdminRoot] unexpected public chat message", json);
            }
        } else if (what === "join") {
            let username = json["username"];
            let display = json["display"];
            gateway.log("[chatroom] Somebody joined", username, display);
        } else if (what === "leave") {
            let username = json["username"];
            gateway.log("[chatroom] Somebody left", username, getDateString());
        } else if (what === "kicked") {
            let username = json["username"];
            gateway.log("[chatroom] Somebody was kicked", username, getDateString());
        } else if (what === "destroyed") {
            let room = json["room"];
            gateway.log("[chatroom] room destroyed", room);
        }
    };

    onProtocolData = (gateway, data) => {
        let {users} = this.state;

        // Set status in users list
        if(data.type.match(/^(camera|question|sound_test)$/)) {
            gateway.log("[protocol] user", data.type, data.status, data.user.id);
            if(users[data.user.id]) {
                users[data.user.id][data.type] = data.status;
                this.setState({users});
            } else {
                users[data.user.id] = {[data.type]: data.status};
                this.setState({users});
            }
        }

        // Save user on enter
        if(data.type.match(/^(enter)$/)) {
            gateway.log("[protocol] user entered", data.user);
            users[data.user.id] = data.user;
            this.setState({users});
        }
    };

    sendPrivateMessage = () => {
        const {input_value,user,feed_user,current_room, gateways} = this.state;
        if(!feed_user) {
            alert("Choose user");
            return;
        }

        const msg = {user, text: input_value};
        const message = {
            ack: false,
            textroom: "message",
            transaction: Janus.randomString(12),
            room: current_room,
            to: feed_user.id,
            text: JSON.stringify(msg),
        };
        // Note: messages are always acknowledged by default. This means that you'll
        // always receive a confirmation back that the message has been received by the
        // server and forwarded to the recipients. If you do not want this to happen,
        // just add an ack:false property to the message above, and server won't send
        // you a response (meaning you just have to hope it succeeded).
        const gateway = gateways[feed_user.janus];
        gateway.chatroom.data({
            text: JSON.stringify(message),
            error: (err) => {
                gateway.error("[chatroom] error data", err);
                alert(err);
                },
            success: () => {
                gateway.log("[chatroom] data success", message);
                let {messages} = this.state;
                msg.time = getDateString();
                msg.to = feed_user.display;
                messages.push(msg);
                this.setState({messages, input_value: ""}, this.scrollToBottom);
            }
        });
    };

    sendBroadcastMessage = () => {
        const {current_room, input_value, messages, user, rooms, gateways} = this.state;
        const {janus: inst} = rooms.find(x => x.room === current_room);
        const gateway = gateways[inst];

        const msg = {type: "chat-broadcast", room: current_room, user, text: input_value};
        gateway.sendProtocolMessage(null, msg)
            .then(() => {
                msg.time = getDateString();
                msg.to = "all";
                messages.push(msg);
                this.setState({messages, input_value: "", msg_type: "private"}, this.scrollToBottom);
            })
            .catch(alert);
    };

    sendRemoteCommand = (command_type) => {
        const {gateways, feed_user, user} = this.state;
        if(!feed_user) {
            alert("Choose user");
            return;
        }

        if (command_type === "sound_test") {
            feed_user.sound_test = true;
        }

        const gateway = gateways[feed_user.janus];
        gateway.sendProtocolMessage(user, {type: command_type, status: true, id: feed_user.id, user: feed_user})
            .catch(alert);

    };

    sendMessage = () => {
        const {msg_type} = this.state;
        msg_type === "private" ? this.sendPrivateMessage() : this.sendBroadcastMessage();
    };

    scrollToBottom = () => {
        this.refs.end.scrollIntoView({ behavior: 'smooth' })
    };

    selectRoom = (i) => {
        const {rooms_list} = this.state;
        let room_id = rooms_list[i].room;
        this.setState({room_id});
    };

    joinRoom = (data, i) => {
        console.log("[AdminRoot] joinRoom", data, i);
        const {rooms, user, current_room} = this.state;
        const {room, janus: inst} = rooms[i];

        if (current_room === room)
            return;

        console.log("[AdminRoot] joinRoom", room, inst);

        if (current_room)
            this.exitRoom(current_room);

        this.setState({
            current_room: room,
            feeds: [],
            feed_user: null,
            feed_id: null
        });

        const gateway = this.state.gateways[inst];
        this.newVideoRoom(gateway, room);
        gateway.joinChatRoom(room, user);
    };

    exitRoom = (room) => {
        console.log("[AdminRoot] exitRoom", room);
        const {rooms, gateways} = this.state;
        const {janus: inst} = rooms.find(x => x.room === room);
        const gateway = gateways[inst];

        console.log('[AdminRoot] exitRoom janus videoroom', inst, gateway.videoroom);

        if (gateway.videoroom)
            console.log('[AdminRoot] exitRoom detach videoroom', inst, gateway.videoroom);
            gateway.videoroom.detach();
        gateway.videoroom = null;

        let chatreq = {textroom: "leave", transaction: Janus.randomString(12), room};
        gateway.chatroom.data({
            text: JSON.stringify(chatreq),
            success: () => { gateway.log('leave chatroom success', chatreq)},
            error: (err) => { gateway.error('error chatroom room', chatreq, err)}
        });

        if (gateway.remoteFeed)
            console.log('[AdminRoot] exitRoom detach remoteFeed', inst, gateway.remoteFeed);
            gateway.remoteFeed.detach();
        gateway.remoteFeed = null;
    };

    getRoomID = () => {
        const {rooms_list} = this.state;
        let id = 2100;
        for(let i=id; i<9999; i++) {
            let room_id = rooms_list.filter(room => room.room === i);
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

    getUserInfo = (feed) => {
        console.log("[AdminRoot] getUserInfo", feed);
        const {display, id} = feed;
        const {users} = this.state;
        const feed_info = display.system ? platform.parse(display.system) : null;
        const feed_user = {...display, ...users[display.id]};
        this.setState({feed_id: id, feed_user, feed_info});
    };

    getFeedInfo = () => {
        const {gateways, feed_user} = this.state;
        if (feed_user) {
            const {session, handle} = this.state.feed_user;
            if (session && handle) {
                const gateway = gateways[feed_user.janus];
                gateway.getPublisherInfo(session, handle)
                    .then(data => {
                            console.debug("[AdminRoot] Publisher info", data);
                            const video = data.info.webrtc.media[1].rtcp.main;
                            const audio = data.info.webrtc.media[0].rtcp.main;
                            this.setState({feed_rtcp: {video, audio}});
                        }
                    )
            }
        }
    };

  render() {
      const { bitrate,rooms,current_room,user,feeds,feed_id,feed_info,i,messages,description,room_id,feed_rtcp,msg_type,users} = this.state;
      const width = "134";
      const height = "100";
      const autoPlay = true;
      const controls = false;
      const muted = true;

      const f = (<Icon name='volume up' />);
      const q = (<Icon color='red' name='help' />);
      const v = (<Icon name='checkmark' />);
      //const x = (<Icon name='close' />);

      const bitrate_options = [
          { key: 0, text: '64Kb/s', value: 64000 },
          { key: 1, text: '128Kb/s', value: 128000 },
          { key: 2, text: '300Kb/s', value: 300000 },
          { key: 3, text: '600Kb/s', value: 600000 },
      ];

      const send_options = [
          { key: 'all', text: 'All', value: 'all' },
          { key: 'private', text: 'Private', value: 'private' },
      ];

      let rooms_list = this.state.rooms_list.map((data,i) => {
          const {room, num_participants, description} = data;
          return ({ key: room, text: description, value: i, description: num_participants.toString()})
      });

      let rooms_grid = rooms.map((data,i) => {
          const {room, num_users, description, questions} = data;
          return (
              <Table.Row active={current_room === room}
                         key={i} onClick={() => this.joinRoom(data, i)} >
                  <Table.Cell width={5}>{questions ? q : ""}{description}</Table.Cell>
                  <Table.Cell width={1}>{num_users}</Table.Cell>
              </Table.Row>
          )
      });

      let users_grid = feeds.map((feed,i) => {
          if(feed) {
              let qt = users[feed.display.id].question;
              let st = users[feed.display.id].sound_test;
              return (
                  <Table.Row active={feed.id === this.state.feed_id} key={i} onClick={() => this.getUserInfo(feed)} >
                      <Table.Cell width={10}>{qt ? q : ""}{feed.display.display}</Table.Cell>
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

      let videos = this.state.feeds.map((feed) => {
          if(feed) {
              let id = feed.id;
              let talk = feed.talk;
              let selected = id === feed_id;
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

      let login = (<LoginPage user={user} checkPermission={this.checkPermission} />);

      let content = (
          <Segment className="virtual_segment" color='blue' raised>

              <Segment textAlign='center' className="ingest_segment">
                  <Button color='blue' icon='sound' onClick={() => this.sendRemoteCommand("sound_test")} />
                  <Popup
                      trigger={<Button positive icon='info' onClick={this.getFeedInfo} />}
                      position='bottom left'
                      content={
                          <List as='ul'>
                              <List.Item as='li'>System
                                  <List.List as='ul'>
                                      <List.Item as='li'>OS: {feed_info ? feed_info.os.toString() : ""}</List.Item>
                                      <List.Item as='li'>Browser: {feed_info ? feed_info.name : ""}</List.Item>
                                      <List.Item as='li'>Version: {feed_info ? feed_info.version : ""}</List.Item>
                                  </List.List>
                              </List.Item>
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
                  <Menu secondary >
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
                              onClick={this.getRoomList}
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
              </Segment>

              <Grid>
                  <Grid.Row stretched columns='equal'>
                      <Grid.Column width={4}>
                          <Segment.Group>
                              <Segment textAlign='center'>
                                  <Popup trigger={<Button negative icon='user x' onClick={() => this.sendRemoteCommand("client-kicked")} />} content='Kick' inverted />
                                  <Popup trigger={<Button color="brown" icon='sync alternate' alt="test" onClick={() => this.sendRemoteCommand("client-reconnect")} />} content='Reconnect' inverted />
                                  <Popup trigger={<Button color="olive" icon='redo alternate' onClick={() => this.sendRemoteCommand("client-reload")} />} content='Reload page(LOST FEED HERE!)' inverted />
                                  <Popup trigger={<Button color="teal" icon='microphone' onClick={() => this.sendRemoteCommand("client-mute")} />} content='Mic Mute/Unmute' inverted />
                                  <Popup trigger={<Button color="pink" icon='eye' onClick={() => this.sendRemoteCommand("video-mute")} />} content='Cam Mute/Unmute' inverted />
                                  <Popup trigger={<Button color="blue" icon='power off' onClick={() => this.sendRemoteCommand("client-disconnect")} />} content='Disconnect(LOST FEED HERE!)' inverted />
                                  <Popup trigger={<Button color="yellow" icon='question' onClick={() => this.sendRemoteCommand("client-question")} />} content='Set/Unset question' inverted />
                              </Segment>
                          <Segment textAlign='center' className="group_list" raised>
                              <Table selectable compact='very' basic structured className="admin_table" unstackable>
                                  <Table.Body>
                                      <Table.Row disabled positive>
                                          <Table.Cell colSpan={3} textAlign='center'>Users:</Table.Cell>
                                      </Table.Row>
                                      <Table.Row disabled>
                                          <Table.Cell width={10}>Title</Table.Cell>
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
                                      {videos}
                                  </div>
                              </div>
                          </div>
                      </Grid.Column>
                      <Grid.Column width={3}>

                          <Segment textAlign='center' className="group_list" raised>
                              <Table selectable compact='very' basic structured className="admin_table" unstackable>
                                  <Table.Body>
                                      <Table.Row disabled positive>
                                          <Table.Cell colSpan={2} textAlign='center'>Rooms:</Table.Cell>
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

export default AdminRoot;

import React, { Component } from 'react';
import NewWindow from 'react-new-window';
import { Janus } from "../../lib/janus";
import classNames from 'classnames';

import {Menu, Select, Button,Input,Label,Icon,Popup} from "semantic-ui-react";
import {geoInfo, initJanus, getDevicesStream, micLevel, checkNotification,testDevices,testMic} from "../../shared/tools";
import './VirtualClient.scss'
import './VideoConteiner.scss'
import 'eqcss'
import VirtualChat from "./VirtualChat";
import {initGxyProtocol, sendProtocolMessage} from "../../shared/protocol";

class VirtualClient extends Component {

    state = {
        count: 0,
        creatingFeed: false,
        delay: false,
        audioContext: null,
        audio_devices: [],
        video_devices: [],
        audio_device: "",
        video_device: "",
        janus: null,
        feeds: [],
        feedStreams: {},
        rooms: [],
        room: "",
        selected_room: "",
        videoroom: null,
        remoteFeed: null,
        myid: null,
        mypvtid: null,
        mystream: null,
        mids: [],
        audio: null,
        muted: false,
        cammuted: false,
        shidur: false,
        protocol: null,
        user: {
            email: null,
            id: Janus.randomString(10),
            role: "user",
            name: "user-"+Janus.randomString(4),
            username: null,
        },
        users: {},
        username_value: localStorage.getItem("username") || "",
        visible: false,
        question: false,
        selftest: "Self Audio Test",
        tested: false,
        support: false,
    };

    componentDidMount() {
        let {user} = this.state;
        this.initClient(user);
    };

    componentWillUnmount() {
        this.state.janus.destroy();
    };

    initClient = (user,error) => {
        localStorage.setItem("question", false);
        checkNotification();
        geoInfo('https://v4g.kbb1.com/geo.php?action=get', data => {
            Janus.log(data);
            user.ip = data.external_ip;
        });
        initJanus(janus => {
            user.session = janus.getSessionId();
            this.setState({janus, user});
            this.chat.initChat(janus);
            this.initVideoRoom(error);
        }, er => {
            setTimeout(() => {
                this.initClient(user,er);
            }, 5000);
        }, true);
    };

    initDevices = (video) => {
        Janus.listDevices(devices => {
            if (devices.length > 0) {
                let audio_devices = devices.filter(device => device.kind === "audioinput");
                let video_devices = video ? devices.filter(device => device.kind === "videoinput") : [];
                // Be sure device still exist
                let video_device = localStorage.getItem("video_device");
                let audio_device = localStorage.getItem("audio_device");
                let achk = audio_devices.filter(a => a.deviceId === audio_device).length > 0;
                let vchk = video_devices.filter(v => v.deviceId === video_device).length > 0;
                let video_id = video ? (video_device !== "" && vchk ? video_device : video_devices[0].deviceId) : null;
                let audio_id = audio_device !== "" && achk ? audio_device : audio_devices[0].deviceId;
                Janus.log(" :: Got Video devices: ", video_devices);
                Janus.log(" :: Got Audio devices: ", audio_devices);
                this.setState({video_devices, audio_devices});
                this.setDevice(video_id, audio_id);
            } else if(video) {
                //Try to get video fail reson
                testDevices(true, false, steam => {});
                // Right now if we get some problem with video device the - enumerateDevices()
                // back empty array, so we need to call this once more with video:false
                // to get audio device only
                Janus.log(" :: Trying to get audio only");
                this.initDevices(false);
            } else {
                //Try to get audio fail reson
                testDevices(false, true, steam => {});
                alert(" :: No input devices found ::");
                //FIXME: What we going to do in this case?
                this.setState({audio_device: null});
            }
        }, { audio: true, video: video });
    };

    setDevice = (video_device,audio_device) => {
        if(audio_device !== this.state.audio_device || video_device !== this.state.video_device) {
            this.setState({video_device,audio_device});
            if(this.state.audio_device !== "" || this.state.video_device !== "") {
                localStorage.setItem("video_device", video_device);
                localStorage.setItem("audio_device", audio_device);
                Janus.log(" :: Going to check Devices: ");
                getDevicesStream(audio_device,video_device,stream => {
                    Janus.log(" :: Check Devices: ", stream);
                    let myvideo = this.refs.localVideo;
                    Janus.attachMediaStream(myvideo, stream);
                    if(this.state.audioContext) {
                        this.state.audioContext.close();
                    }
                    micLevel(stream ,this.refs.canvas1,audioContext => {
                        this.setState({audioContext, stream});
                    });
                })
            }
        }
    };

    selfTest = () => {
        this.setState({selftest: "Recording... 9"});
        testMic(this.state.stream);

        let rect = 9;
        let rec = setInterval(() => {
            rect--;
            this.setState({selftest: "Recording... " + rect});
            if(rect <= 0) {
                clearInterval(rec);
                let playt = 11;
                let play = setInterval(() => {
                    playt--;
                    this.setState({selftest: "Playing... " + playt});
                    if(playt <= 0) {
                        clearInterval(play);
                        this.setState({selftest: "Self Audio Test", tested: true});
                    }
                },1000);
            }
        },1000);
    };

    getRoomList = () => {
        const {videoroom} = this.state;
        if (videoroom) {
            videoroom.send({message: {request: "list"},
                success: (data) => {
                    Janus.log(" :: Get Rooms List: ", data.list);
                    let filter = data.list.filter(r => !/W\./i.test(r.description));
                    filter.sort((a, b) => {
                        // if (a.num_participants > b.num_participants) return -1;
                        // if (a.num_participants < b.num_participants) return 1;
                        if (a.description > b.description) return 1;
                        if (a.description < b.description) return -1;
                        return 0;
                    });
                    this.setState({rooms: filter});
                    this.getFeedsList(filter)
                }
            });
        }
    };

    //FIXME: tmp solution to show count without service users in room list
    getFeedsList = (rooms) => {
        let {videoroom} = this.state;
        rooms.forEach((room,i) => {
            if(room.num_participants > 0) {
                videoroom.send({
                    message: {request: "listparticipants", "room": room.room},
                    success: (data) => {
                        let count = data.participants.filter(p => JSON.parse(p.display).role === "user");
                        rooms[i].num_participants = count.length;
                        this.setState({rooms});
                    }
                });
            }
        })
    };

    initVideoRoom = (reconnect) => {
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
                user.handle = videoroom.getId();
                this.setState({videoroom, user, remoteFeed: null});
                this.initDevices(true);
                if(reconnect) {
                    setTimeout(() => {
                        this.joinRoom(reconnect);
                    }, 5000);
                }
            },
            error: (error) => {
                Janus.log("Error attaching plugin: " + error);
            },
            consentDialog: (on) => {
                Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
            },
            iceState: (state) => {
                Janus.log("ICE state changed to " + state);
            },
            mediaState: (medium, on) => {
                Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
            },
            webrtcState: (on) => {
                Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
            },
            slowLink: (uplink, nacks) => {
                Janus.log("Janus reports problems " + (uplink ? "sending" : "receiving") +
                    " packets on this PeerConnection (" + nacks + " NACKs/s " + (uplink ? "received" : "sent") + ")");
            },
            onmessage: (msg, jsep) => {
                this.onMessage(this.state.videoroom, msg, jsep, false);
            },
            onlocaltrack: (track, on) => {
                Janus.log(" ::: Got a local track event :::");
                Janus.log("Local track " + (on ? "added" : "removed") + ":", track);
                let {videoroom,} = this.state;
                videoroom.muteAudio();
                this.setState({mystream: track});
            },
            onremotestream: (stream) => {
                // The publisher stream is sendonly, we don't expect anything here
            },
            ondataopen: (data) => {
                Janus.log("The DataChannel is available!(publisher)");
            },
            ondata: (data) => {
                Janus.log("We got data from the DataChannel! (publisher) " + data);
            },
            oncleanup: () => {
                Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
            }
        });
    };

    onRoomData = (data) => {
        let {feeds,users} = this.state;
        let rfid = users[data.id].rfid;
        let camera = data.camera;
        for (let i = 0; i < feeds.length; i++) {
            if (feeds[i] && feeds[i].id === rfid) {
                feeds[i].cammute = !camera;
                this.setState({feeds});
                break
            }
        }
    };

    publishOwnFeed = (useVideo) => {
        // FIXME: Does we allow video only mode?
        let {videoroom,audio_device,video_device} = this.state;
        let height = (Janus.webRTCAdapter.browserDetails.browser === "safari") ? 480 : 360;
        videoroom.createOffer(
            {
                // Add data:true here if you want to publish datachannels as well
                media: {
                    audioRecv: false, videoRecv: false, audioSend: true, videoSend: useVideo, audio: {
                        autoGainControl: false,
                        echoCancellation: false,
                        highpassFilter: false,
                        noiseSuppression: false,
                        deviceId: {
                            exact: audio_device
                        }
                    },
                    video: {
                        width: 640,
                        height: height,
                        deviceId: {
                            exact: video_device
                        }
                    },
                    data: true
                },
                //media: { audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: true, data: true },	// Publishers are sendonly
                simulcast: false,
                success: (jsep) => {
                    Janus.debug("Got publisher SDP!");
                    Janus.debug(jsep);
                    let publish = { "request": "configure", "audio": true, "video": useVideo, "data": true };
                    videoroom.send({"message": publish, "jsep": jsep});
                },
                error: (error) => {
                    Janus.error("WebRTC error:", error);
                    if (useVideo) {
                        this.publishOwnFeed(false);
                    } else {
                        Janus.error("WebRTC error... " + JSON.stringify(error));
                    }
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
                this.publishOwnFeed(true);
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    let feeds = list.filter(feeder => JSON.parse(feeder.display).role === "user");
                    let {feedStreams,users} = this.state;
                    Janus.log(":: Got Pulbishers list: ", feeds);
                    if(feeds.length > 15) {
                        alert("Max users in this room is reached");
                        window.location.reload();
                    }
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
                        for (let i in streams) {
                            let stream = streams[i];
                            stream["id"] = id;
                            stream["display"] = display;
                        }
                        feedStreams[id] = {id, display, streams};
                        users[display.id] = display;
                        users[display.id].rfid = id;
                        subscription.push({
                            feed: id,	// This is mandatory
                            //mid: stream.mid		// This is optional (all streams, if missing)
                        });
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
                        let streams = feed[f]["streams"];
                        feed[f].display = display;
                        for (let i in streams) {
                            let stream = streams[i];
                            stream["id"] = id;
                            stream["display"] = display;
                        }
                        feedStreams[id] = {id, display, streams};
                        users[display.id] = display;
                        users[display.id].rfid = id;
                        subscription.push({
                            feed: id,	// This is mandatory
                            //mid: stream.mid		// This is optional (all streams, if missing)
                        });
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
                    let subscribe = {request: "join", room: this.state.room, ptype: "subscriber", streams: subscription};
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
                    let {remoteFeed} = this.state;
                    if(msg["error"] !== undefined && msg["error"] !== null) {
                        Janus.debug("-- ERROR: " + msg["error"]);
                    } else if(event !== undefined && event !== null) {
                        if(event === "attached") {
                            this.setState({creatingFeed: false});
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
                        remoteFeed.createAnswer(
                            {
                                jsep: jsep,
                                // Add data:true here if you want to subscribe to datachannels as well
                                // (obviously only works if the publisher offered them in the first place)
                                media: { audioSend: false, videoSend: false, data:true },	// We want recvonly audio/video
                                success: (jsep) => {
                                    Janus.debug("Got SDP!");
                                    Janus.debug(jsep);
                                    let body = { request: "start", room: this.state.room };
                                    remoteFeed.send({ message: body, jsep: jsep });
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
                    Janus.log(" >> This track is coming from feed " + feed + ":", mid);
                    if(!on) {
                        Janus.log(" :: Going to stop track :: " + feed + ":", mid);
                        //FIXME: Remove callback for audio track does not come
                        track.stop();
                        //FIXME: does we really need to stop all track for feed id?
                        return;
                    }
                    // If we're here, a new track was added
                    if(track.kind === "audio" && !feedStreams[feed].audio_stream) {
                        // New audio track: create a stream out of it, and use a hidden <audio> element
                        let stream = new MediaStream();
                        stream.addTrack(track.clone());
                        Janus.log("Created remote audio stream:", stream);
                        feedStreams[feed].audio_stream = stream;
                        this.setState({feedStreams});
                        let remoteaudio = this.refs["remoteAudio" + feed];
                        Janus.attachMediaStream(remoteaudio, stream);
                    } else if(track.kind === "video" && !feedStreams[feed].video_stream) {
                        // New video track: create a stream out of it
                        let stream = new MediaStream();
                        stream.addTrack(track.clone());
                        Janus.log("Created remote video stream:", stream);
                        feedStreams[feed].video_stream = stream;
                        this.setState({feedStreams});
                        let remotevideo = this.refs["remoteVideo" + feed];
                        Janus.attachMediaStream(remotevideo, stream);
                    } else if(track.kind === "data") {
                        Janus.log("Created remote data channel");
                    } else {
                        Janus.log("-- Already active stream --");
                    }
                },
                ondataopen: (data) => {
                    Janus.log("The DataChannel is available!(feed)");
                },
                ondata: (data) => {
                    Janus.debug("We got data from the DataChannel! (feed) " + data);
                    let msg = JSON.parse(data);
                    this.onRoomData(msg);
                    Janus.log(" :: We got msg via DataChannel: ",msg)
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
            return;
        }

        // We don't creating, so let's do it
        this.setState({creatingFeed: true});
        this.newRemoteFeed(subscription);
    };

    unsubscribeFrom = (id) => {
        // Unsubscribe from this publisher
        let {feeds,remoteFeed,users,feedStreams} = this.state;
        for (let i=0; i<feeds.length; i++) {
            if (feeds[i].id === id) {
                Janus.log("Feed " + feeds[i] + " (" + id + ") has left the room, detaching");
                //TODO: remove mids
                delete users[feeds[i].display.id];
                delete feedStreams[id];
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
    };

    onProtocolData = (data) => {
        //TODO: Need to add transaction handle (filter and acknowledge)
        let {room,feeds,users,user} = this.state;
        if (data.type === "question" && data.room === room && user.id !== data.user.id) {
            let rfid = users[data.user.id].rfid;
            for (let i = 0; i < feeds.length; i++) {
                if (feeds[i] && feeds[i].id === rfid) {
                    feeds[i].question = data.status;
                    break
                }
            }
            this.setState({feeds});
        }
    };

    sendDataMessage = (key,value) => {
        let {videoroom,user} = this.state;
        user[key] = value;
        var message = JSON.stringify(user);
        Janus.log(":: Sending message: ",message);
        videoroom.data({ text: message })
    };

    joinRoom = (reconnect) => {
        this.setState({delay: true});
        setTimeout(() => {
            this.setState({delay: false});
        }, 3000);
        let {janus, videoroom, selected_room, user, username_value} = this.state;
        localStorage.setItem("room", selected_room);
        //This name will see other users
        user.display = username_value || user.name;
        localStorage.setItem("username", user.display);

        initGxyProtocol(janus, user, protocol => {
            this.setState({protocol});
            // Send question event if before join it was true
            if(reconnect && JSON.parse(localStorage.getItem("question"))) {
                let msg = { type: "question", status: true, room: selected_room, user};
                setTimeout(() => {
                    sendProtocolMessage(protocol, user, msg );
                }, 5000);
            }
        }, ondata => {
            Janus.log("-- :: It's protocol public message: ", ondata);
            if(ondata.type === "error" && ondata.error_code === 420) {
                alert(ondata.error);
                this.state.protocol.hangup();
            } else if(ondata.type === "joined") {
                let register = { "request": "join", "room": selected_room, "ptype": "publisher", "display": JSON.stringify(user) };
                videoroom.send({"message": register});
                this.setState({user, muted: true, room: selected_room});
                this.chat.initChatRoom(user,selected_room);
            }
            this.onProtocolData(ondata);
        });
    };

    exitRoom = () => {
        let {videoroom, remoteFeed, protocol, room} = this.state;
        let leave = {request : "leave"};
        if(remoteFeed)
            remoteFeed.send({"message": leave});
        videoroom.send({"message": leave});
        this.chat.exitChatRoom(room);
        localStorage.setItem("question", false);
        this.setState({muted: false, cammuted: false, mystream: null, room: "", selected_room: "", i: "", feeds: [], mids: [], remoteFeed: null, question: false});
        this.initVideoRoom();
        protocol.detach();
    };

    selectRoom = (i) => {
        const {rooms} = this.state;
        let selected_room = rooms[i].room;
        let name = rooms[i].description;
        if (this.state.room === selected_room)
            return;
        this.setState({selected_room,name,i});
    };

    handleQuestion = () => {
        //TODO: only when shidur user is online will be avelable send question event, so we need to add check
        const { protocol, user, room, question} = this.state;
        localStorage.setItem("question", !question);
        let msg = { type: "question", status: !question, room, user};
        sendProtocolMessage(protocol, user, msg );
        this.setState({question: !question});
    };

    camMute = () => {
        let {videoroom,cammuted,protocol,user,room} = this.state;
        cammuted ? videoroom.unmuteVideo() : videoroom.muteVideo();
        this.setState({cammuted: !cammuted, delay: true});
        setTimeout(() => {
            this.setState({delay: false});
        }, 3000);
        this.sendDataMessage("camera", this.state.cammuted);
        // Send to protocol camera status event
        let msg = { type: "camera", status: cammuted, room, user};
        sendProtocolMessage(protocol, user, msg );
    };

    micMute = () => {
        let {videoroom, muted} = this.state;
        //mystream.getAudioTracks()[0].enabled = !muted;
        muted ? videoroom.unmuteAudio() : videoroom.muteAudio();
        this.setState({muted: !muted});
    };

    showShidur = () => {
        this.setState({shidur: !this.state.shidur})
    };

    onUnload = () => {
        this.setState({shidur: false})
    };

    onBlock = () => {
        alert("You browser is block our popup! You need allow it")
    };

    onNewMsg = (private_message) => {
        this.setState({count: this.state.count + 1});
    };


    render() {

        const { rooms,room,audio_devices,video_devices,video_device,audio_device,i,muted,cammuted,delay,mystream,selected_room,count,question,selftest,tested} = this.state;
        const width = "134";
        const height = "100";
        const autoPlay = true;
        const controls = false;
        //const vmuted = true;

        //let iOS = ['iPad', 'iPhone', 'iPod'].indexOf(navigator.platform) >= 0;

        let rooms_list = rooms.map((data,i) => {
            const {room, num_participants, description} = data;
            return ({ key: room, text: description, value: i, description: num_participants.toString()})
        });

        let adevices_list = audio_devices.map((device,i) => {
            const {label, deviceId} = device;
            return ({ key: i, text: label, value: deviceId})
        });

        let vdevices_list = video_devices.map((device,i) => {
            const {label, deviceId} = device;
            return ({ key: i, text: label, value: deviceId})
        });

        let videos = this.state.feeds.map((feed) => {
            if(feed) {
                let id = feed.id;
                let talk = feed.talk;
                let question = feed.question;
                let cammute = feed.cammute;
                //let name = feed.display.name;
                let display_name = feed.display.display;
                return (<div className="video"
                key={"v" + id}
                ref={"video" + id}
                id={"video" + id}>
                <div className={classNames('video__overlay', {'talk' : talk})}>
                    {question ? <div className="question">
                        <svg viewBox="0 0 50 50">
                            <text x="25" y="25" text-anchor="middle" alignment-baseline="central" dominant-baseline="central">&#xF128;</text>
                        </svg>
                    </div>:''}
                    <div className="video__title">{!talk ? <Icon name="microphone slash" size="small" color="red"/> : ''}{display_name}</div>
                </div>
                    <svg className={classNames('nowebcam',{'hidden':!cammute})} viewBox="0 0 32 18" preserveAspectRatio="xMidYMid meet" ><text x="16" y="9" text-anchor="middle" alignment-baseline="central" dominant-baseline="central">&#xf2bd;</text></svg>
                    <video
                        key={"v"+id}
                        ref={"remoteVideo" + id}
                        id={"remoteVideo" + id}
                        width={width}
                        height={height}
                        autoPlay={autoPlay}
                        controls={controls}
                        muted={true}
                        playsInline={true}/>
                    <audio
                        key={"a"+id}
                        ref={"remoteAudio" + id}
                        id={"remoteAudio" + id}
                        autoPlay={autoPlay}
                        controls={controls}
                        playsInline={true}/>
                </div>);
            }
            return true;
        });

        let l = (<Label key='Carbon' floating size='mini' color='red'>{count}</Label>);

        return (

            <div className={classNames('vclient', { 'vclient--chat-open': this.state.visible })} >
                <div className="vclient__toolbar">
                    <Input 
                    iconPosition='left'
                    placeholder="Type your name..."
                    value={this.state.username_value}
                    onChange={(v,{value}) => this.setState({username_value: value})}
                    action>
                    <input iconPosition='left' disabled={mystream}/>
                    <Icon name='user circle' />
                    <Select
                    disabled={mystream}
                    error={!selected_room}
                    
                    placeholder="Select Room:"
                    value={i}
                    options={rooms_list}
                    onClick={this.getRoomList}
                    onChange={(e, {value}) => this.selectRoom(value)} />
                    {mystream ? <Button negative icon='sign-out' onClick={this.exitRoom} />:""}
                    {!mystream ? <Button primary icon='sign-in' disabled={delay||!selected_room||!audio_device} onClick={this.joinRoom} />:""}
                    </Input>
                    <Menu icon='labeled' secondary size="mini">
                        <Menu.Item disabled={!mystream} onClick={() => this.setState({ visible: !this.state.visible, count: 0 })}>
                            <Icon name="comments"/>
                            {this.state.visible ? "Close" : "Open"} Chat 
                            {count > 0 ? l : ""} 
                        </Menu.Item>
                        <Menu.Item disabled={!mystream} onClick={this.handleQuestion}>
                            <Icon color={question ? 'green' : ''} name='question'/>
                            Ask a Question
                        </Menu.Item>
                        <Menu.Item disabled={this.state.shidur} onClick={this.showShidur} >
                            <Icon name="tv"/>
                            Open Broadcast
                            {this.state.shidur ?
                                <NewWindow
                                url='https://galaxy.kli.one/gxystr'
                                features={{width:"725",height:"635",left:"200",top:"200",location:"no"}}
                                title='V4G' onUnload={this.onUnload} onBlock={this.onBlock}>
                                </NewWindow> :
                                null
                            }
                        </Menu.Item>
                    </Menu>
                    <Menu icon='labeled' secondary size="mini">
                        <Menu.Item position='right' disabled={selftest !== "Self Audio Test" || mystream} onClick={this.selfTest}>
                            <Icon color={tested ? 'green' : 'red'} name="sound" />
                            {selftest}
                        </Menu.Item>
                        <Menu.Item disabled={!mystream} onClick={this.micMute} className="mute-button">
                            <canvas className={muted ? 'hidden' : 'vumeter'} ref="canvas1" id="canvas1" width="15" height="35" />
                            <Icon color={muted ? "red" : ""} name={!muted ? "microphone" : "microphone slash"} />
                            {!muted ? "Mute" : "Unmute"}
                        </Menu.Item>
                        <Menu.Item disabled={!mystream || delay} onClick={this.camMute}>
                            <Icon color={cammuted ? "red" : ""} name={!cammuted ? "eye" : "eye slash"} />
                            {!cammuted ? "Stop Video" : "Start Video"}
                        </Menu.Item>
                        <Popup
                            trigger={<Menu.Item icon="setting" name="Settings"/>}
                            on='click'
                            position='bottom right'
                        >
                            <Popup.Content>
                                <Select className='select_device'
                                disabled={mystream}
                                error={!audio_device}
                                placeholder="Select Device:"
                                value={audio_device}
                                options={adevices_list}
                                onChange={(e, {value}) => this.setDevice(video_device,value)}/>
                                <Select className='select_device'
                                disabled={mystream}
                                error={!video_device}
                                placeholder="Select Device:"
                                value={video_device}
                                options={vdevices_list}
                                onChange={(e, {value}) => this.setDevice(value,audio_device)} />
                            </Popup.Content>
                        </Popup>
                    </Menu>
                </div>
                <div basic className="vclient__main" onDoubleClick={() => this.setState({ visible: !this.state.visible })} >
                    <div className="vclient__main-wrapper">
                        <div className="videos-panel">
                            <div className="videos">
                                <div className="videos__wrapper">
                                    <div className="video">
                                        <div className={classNames('video__overlay')}>
                                            {question ?
                                                <div className="question">
                                                    <svg viewBox="0 0 50 50"><text x="25" y="25" text-anchor="middle" alignment-baseline="central" dominant-baseline="central">&#xF128;</text></svg>
                                                </div>
                                            :
                                                ''
                                            }
                                            <div className="video__title">
                                                {muted ? <Icon name="microphone slash" size="small" color="red"/> : ''}{this.state.username_value || this.state.user.name}
                                            </div>
                                        </div>
                                        <svg className={classNames('nowebcam',{'hidden':!cammuted})} viewBox="0 0 32 18" preserveAspectRatio="xMidYMid meet" ><text x="16" y="9" text-anchor="middle" alignment-baseline="central" dominant-baseline="central">&#xf2bd;</text></svg>
                                        <video
                                        className={classNames('mirror',{'hidden':cammuted})}
                                        ref="localVideo"
                                        id="localVideo"
                                        width={width}
                                        height={height}
                                        autoPlay={autoPlay}
                                        controls={controls}
                                        muted={true}
                                        playsInline={true}/>
                                    
                                    </div>
                                    {videos}
                                </div>
                            </div>
                        </div>
                        <VirtualChat
                            ref={chat => {this.chat = chat;}}
                            visible={this.state.visible}
                            janus={this.state.janus}
                            room={room}
                            user={this.state.user}
                            onNewMsg={this.onNewMsg} />
                    </div>
                </div>
            </div>
        );
    }
}

export default VirtualClient;

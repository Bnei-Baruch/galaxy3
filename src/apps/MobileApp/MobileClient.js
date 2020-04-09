import React, { Component } from 'react';
//import NewWindow from 'react-new-window';
import { Janus } from "../../lib/janus";
import classNames from 'classnames';
import ReactSwipe from 'react-swipe';

import {Menu, Select, Button,Input,Label,Icon,Popup} from "semantic-ui-react";
import {
    geoInfo,
    initJanus,
    getDevicesStream,
    checkNotification,
    testDevices,
    testMic,
    genUUID
} from "../../shared/tools";
import './MobileClient.scss'
import './MobileConteiner.scss'
import 'eqcss'
//import MobileChat from "./MobileChat";
import {initGxyProtocol, sendProtocolMessage} from "../../shared/protocol";
import MobileStreaming from "./MobileStreaming";
import {GEO_IP_INFO, PROTOCOL_ROOM, vsettings_list} from "../../shared/consts";
import platform from "platform";
import { isMobile } from 'react-device-detect';

class MobileClient extends Component {

    state = {
        count: 0,
        index: 4,
        creatingFeed: false,
        delay: false,
        audioContext: null,
        audio_devices: [],
        video_devices: [],
        audio_device: "",
        video_device: "",
        video_setting: {width: 320, height: 180, fps: 15},
        audio: null,
        video: null,
        janus: null,
        feeds: [],
        feedStreams: {},
        rooms: [],
        room: "",
        selected_room: parseInt(localStorage.getItem("room"), 10) || "",
        videoroom: null,
        remoteFeed: null,
        myid: null,
        mypvtid: null,
        mystream: null,
        mids: [],
        video_mids: [],
        muted: false,
        cammuted: false,
        shidur: false,
        protocol: null,
        user: {
            email: null,
            id: localStorage.getItem("uuid") || genUUID(),
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
        women: window.location.pathname === "/women/",
        card: 0,
    };

    componentDidMount() {
        if(!isMobile)
        {
            if(window.location.href.indexOf("userm")> -1)
            {
                window.location = '/user/';
                return;
            }
        }
        let {user} = this.state;
        const { t } = this.props;
        localStorage.setItem('question', false);
        localStorage.setItem('sound_test', false);
        localStorage.setItem('uuid', user.id);
        checkNotification();
        let system  = navigator.userAgent;
        let browser = platform.parse(system);
        if (/Safari|Firefox|Chrome/.test(browser.name)) {
            geoInfo(`${GEO_IP_INFO}`, data => {
                user.ip = data ? data.ip : '127.0.0.1';
                user.system = system;
                if (!data) {
                    alert("Failed to get Geo Info");
                }

                this.setState({geoinfo: !!data});
                this.getRoomList(user);
            });
        } else {
            alert("Browser not supported");
            window.location = 'https://galaxy.kli.one';
        }
    };

    initClient = (user,error) => {
        const { t } = this.props;
        if(this.state.janus)
            this.state.janus.destroy();
        initJanus(janus => {
            // Check if unified plan supported
            if (Janus.unifiedPlan) {
                user.session = janus.getSessionId();
                this.setState({janus, user});
                //this.chat.initChat(janus);
                this.initVideoRoom(error);
            } else {
                alert("Unified Plan is NOT supported");
                this.setState({ audio_device: null });
            }
        }, er => {
            console.log(er);
            // setTimeout(() => {
            //     this.initClient(user,er);
            // }, 5000);
        }, user.janus);
    };

    initDevices = (video) => {
        Janus.listDevices(devices => {
            if (devices.length > 0) {
                let audio_devices = devices.filter(device => device.kind === "audioinput");
                let video_devices = video ? devices.filter(device => device.kind === "videoinput") : [];
                // Be sure device still exist
                let video_device = localStorage.getItem("video_device");
                let audio_device = localStorage.getItem("audio_device");
                let video_setting = JSON.parse(localStorage.getItem("video_setting")) || this.state.video_setting;
                let achk = audio_devices.filter(a => a.deviceId === audio_device).length > 0;
                let vchk = video_devices.filter(v => v.deviceId === video_device).length > 0;
                let video_id = video ? (video_device !== "" && vchk ? video_device : video_devices[0].deviceId) : null;
                let audio_id = audio_device !== "" && achk ? audio_device : audio_devices[0].deviceId;
                Janus.log(" :: Got Video devices: ", video_devices);
                Janus.log(" :: Got Audio devices: ", audio_devices);
                this.setState({video_devices, audio_devices});
                this.setDevice(video_id, audio_id, video_setting);
            } else if(video) {
                alert("Video device not detected!");
                this.setState({cammuted: true, video_device: null});
                //Try to get video fail reson
                testDevices(true, false, steam => {});
                // Right now if we get some problem with video device the - enumerateDevices()
                // back empty array, so we need to call this once more with video:false
                // to get audio device only
                Janus.log(" :: Trying to get audio only");
                this.initDevices(false);
            } else {
                //Try to get audio fail reason
                testDevices(false, true, steam => {});
                alert(" :: No input devices found ::");
                //FIXME: What we going to do in this case?
                this.setState({audio_device: null});
            }
        }, { audio: true, video: video });
    };

    setDevice = (video_device,audio_device,video_setting) => {
        if(audio_device !== this.state.audio_device
            || video_device !== this.state.video_device
            || JSON.stringify(video_setting) !== JSON.stringify(this.state.video_setting)) {
            this.setState({video_device,audio_device,video_setting});
            if(this.state.audio_device !== "" || this.state.video_device !== "") {
                localStorage.setItem("video_device", video_device);
                localStorage.setItem("audio_device", audio_device);
                localStorage.setItem("video_setting", JSON.stringify(video_setting));
                Janus.log(" :: Going to check Devices: ");
                getDevicesStream(audio_device,video_device,video_setting,stream => {
                    Janus.log(" :: Check Devices: ", stream);
                    let myvideo = this.refs.localVideo;
                    Janus.attachMediaStream(myvideo, stream);
                    // if(this.state.audioContext) {
                    //     this.state.audioContext.close();
                    // }
                    // micLevel(stream ,this.refs.canvas1,audioContext => {
                    //     this.setState({audioContext, stream});
                    // });
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

    // getRoomList = () => {
    //     const {videoroom, women} = this.state;
    //     if (videoroom) {
    //         videoroom.send({message: {request: "list"},
    //             success: (data) => {
    //                 Janus.log(" :: Get Rooms List: ", data.list);
    //                 let filter = data.list.filter(r => /W\./i.test(r.description) === women);
    //                 filter.sort((a, b) => {
    //                     // if (a.num_participants > b.num_participants) return -1;
    //                     // if (a.num_participants < b.num_participants) return 1;
    //                     if (a.description > b.description) return 1;
    //                     if (a.description < b.description) return -1;
    //                     return 0;
    //                 });
    //                 this.setState({rooms: filter});
    //                 this.getFeedsList(filter)
    //             }
    //         });
    //     }
    // };

    getRoomList = (user) => {
        geoInfo('rooms.json', groups => {
            this.setState({groups});
            const {women,selected_room} = this.state;
            let rooms = groups.filter(r => /W\./i.test(r.description) === women);
            this.setState({groups,rooms});
            if (selected_room !== '') {
                let room   = rooms.find(r => r.room === selected_room);
                let name   = room.description;
                user.room  = selected_room;
                user.janus  = room.janus;
                user.group = name;
                this.setState({user,name});
            }
            this.initClient(user, false)
        });
    };

    selectRoom = (roomid) => {
        const { rooms, user } = this.state;
        let room              = rooms.find(r => r.room === roomid);
        let name              = room.description;
        if (this.state.room === roomid) {
            return;
        }
        user.room  = roomid;
        user.group = name;
        let reconnect = user.janus && user.janus !== room.janus;
        user.janus  = room.janus;
        this.setState({ user, selected_room: roomid, name }, () => {
            if(reconnect) {
                this.setState({ delay: true });
                this.initClient(user, false);
            }
        });
    };

    getFeedsList = (rooms) => {
        //TODO: Need solution to show count without service users in room list
        // rooms.forEach((room,i) => {
        //     if(room.num_participants > 0) {
        //         videoroom.send({
        //             message: {request: "listparticipants", "room": room.room},
        //             success: (data) => {
        //                 let count = data.participants.filter(p => JSON.parse(p.display).role === "user");
        //                 rooms[i].num_participants = count.length;
        //                 this.setState({rooms});
        //             }
        //         });
        //     }
        // })
    };

    iceState = () => {
        let count = 0;
        let chk = setInterval(() => {
            count++;
            let {ice} = this.state;
            if(count < 11 && ice === "connected") {
                clearInterval(chk);
            }
            if(count >= 10) {
                clearInterval(chk);
                this.exitRoom(false);
                alert("Network setting is changed!");
                window.location.reload();
            }
        },3000);
    };

    mediaState = (media) => {
        // Handle video
        if(media === "video") {
            let count = 0;
            let chk = setInterval(() => {
                count++;
                let {video,ice} = this.state;

                // Video is back stop counter
                if(count < 11 && video) {
                    clearInterval(chk);
                }

                // Network problem handled in iceState
                if(count < 11 && ice === "disconnected") {
                    clearInterval(chk);
                }

                // Video still not back disconnecting
                if(count >= 10) {
                    clearInterval(chk);
                    this.exitRoom(false);
                    alert("Server stopped receiving our media! Check your video device.");
                }
            },3000);
        }

        //Handle audio
        if(media === "audio") {
            let count = 0;
            let chk = setInterval(() => {
                count++;
                let {audio,video,ice,question} = this.state;

                // Audio is back stop counter
                if(count < 11 && audio) {
                    clearInterval(chk);
                }

                // Network problem handled in iceState
                if(count < 11 && ice === "disconnected") {
                    clearInterval(chk);
                }

                // The problem with both devices, leave resolve it in video loop
                if(count < 11 && !audio && !video) {
                    clearInterval(chk);
                }

                // Audio still not back
                if(count >= 10 && !audio && video) {
                    clearInterval(chk);
                    if(question)
                        this.handleQuestion();
                    alert("Server stopped receiving our Audio! Check your Mic");
                }
            },3000);
        }
    };

    initVideoRoom = (reconnect) => {
        if(this.state.videoroom)
            this.state.videoroom.detach();
        if(this.state.remoteFeed)
            this.state.remoteFeed.detach();
        if(this.state.protocol)
            this.state.protocol.detach();
        this.state.janus.attach({
            plugin: "janus.plugin.videoroom",
            opaqueId: "videoroom_user",
            success: (videoroom) => {
                Janus.log(" :: My handle: ", videoroom);
                Janus.log("Plugin attached! (" + videoroom.getPlugin() + ", id=" + videoroom.getId() + ")");
                Janus.log("  -- This is a publisher/manager");
                let {user} = this.state;
                user.handle = videoroom.getId();
                this.setState({videoroom, user, remoteFeed: null, protocol: null, delay: false});
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
                this.setState({ice: state});
                if(state === "disconnected") {
                    // FIXME: ICE restart does not work properly, so we will do silent reconnect
                    this.iceState();
                }
            },
            mediaState: (media, on) => {
                Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + media);
                this.setState({[media]: on});
                if(!on) {
                    this.mediaState(media);
                }
            },
            webrtcState: (on) => {
                Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
            },
            slowLink: (uplink, lost, mid) => {
                Janus.log("Janus reports problems " + (uplink ? "sending" : "receiving") +
                    " packets on mid " + mid + " (" + lost + " lost packets)");
            },
            onmessage: (msg, jsep) => {
                this.onMessage(this.state.videoroom, msg, jsep, false);
            },
            onlocaltrack: (track, on) => {
                Janus.log(" ::: Got a local track event :::");
                Janus.log("Local track " + (on ? "added" : "removed") + ":", track);
                let {videoroom,women} = this.state;
                if(!women) videoroom.muteAudio();
                if(!this.state.mystream)
                    this.setState({mystream: track});
            },
            onremotestream: (stream) => {
                // The publisher stream is sendonly, we don't expect anything here
            },
            ondataopen: (label) => {
                Janus.log("Publisher - DataChannel is available! ("+label+")");
            },
            ondata: (data, label) => {
                Janus.log("Publisher - Got data from the DataChannel! ("+label+")" + data);
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
        let {videoroom,audio_device,video_device,video_setting} = this.state;
        const width = video_setting.width;
        const height = video_setting.height;
        const ideal = video_setting.fps;
        videoroom.createOffer({
            media: {
                audioRecv: false, videoRecv: false, audioSend: true, videoSend: useVideo,
                audio: {
                    autoGainControl: false, echoCancellation: false, highpassFilter: false, noiseSuppression: false,
                    deviceId: {exact: audio_device}
                },
                video: {
                    width, height,
                    frameRate: {ideal, min: 1},
                    deviceId: {exact: video_device}
                },
                data: true
            },
            simulcast: false,
            success: (jsep) => {
                Janus.debug("Got publisher SDP!");
                Janus.debug(jsep);
                let publish = { request: "configure", audio: true, video: useVideo, data: true };
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

    onMessage = (videoroom, msg, jsep) => {
        Janus.log(" ::: Got a message (publisher) :::");
        Janus.log(msg);
        let event = msg["videoroom"];
        if(event !== undefined && event !== null) {
            if(event === "joined") {
                let {user,selected_room,protocol,video_device} = this.state;
                let myid = msg["id"];
                let mypvtid = msg["private_id"];
                user.rfid = myid;
                user.timestamp = Date.now();
                this.setState({user,myid ,mypvtid});
                let pmsg = { type: "enter", status: true, room: selected_room, user};
                Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
                sendProtocolMessage(protocol, user, pmsg);
                this.publishOwnFeed(video_device !== null);
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    //FIXME: Tmp fix for black screen in room caoused by feed with video_codec = none
                    let feeds = list.filter(feeder => JSON.parse(feeder.display).role === "user" && feeder.video_codec !== "none");
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
                        let video = streams.filter(v => v.type === "video").length === 0;
                        feeds[f].cammute = video;
                        feeds[f].display = display;
                        feeds[f].talk = talk;
                        let subst = {feed: id};
                        for (let i in streams) {
                            let stream = streams[i];
                            stream["id"] = id;
                            stream["display"] = display;
                            if(subscription.length > 3) {
                                subst.mid = "0";
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
                        let streams = feed[f]["streams"];
                        let video = streams.filter(v => v.type === "video").length === 0;
                        feed[f].cammute = video;
                        feed[f].display = display;
                        let subst = {feed: id};
                        for (let i in streams) {
                            let stream = streams[i];
                            stream["id"] = id;
                            stream["display"] = display;
                            if(feeds.length > 3) {
                                subst.mid = "0";
                            }
                        }
                        feedStreams[id] = {id, display, streams};
                        users[display.id] = display;
                        users[display.id].rfid = id;
                        subscription.push(subst);
                    }
                    feeds.push(feed[0]);
                    this.setState({feeds,feedStreams,users});
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
                        let {mids,video_mids,feedStreams} = this.state;
                        let m = 0;
                        for(let i in msg["streams"]) {
                            let sub_mid = msg["streams"][i];
                            let mindex = msg["streams"][i]["mid"];
                            //let feed_id = msg["streams"][i]["feed_id"];
                            mids[mindex] = msg["streams"][i];
                            if(sub_mid.type === "video") {
                                video_mids[m] = sub_mid;
                                if(feedStreams[sub_mid.feed_id])
                                    feedStreams[sub_mid.feed_id].slot = m;
                                m++
                            }
                        }
                        this.setState({mids,video_mids,feedStreams});
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
                    if(!mid) {
                        mid = track.id.split("janus")[1];
                    }
                    Janus.log("Remote track (mid=" + mid + ") " + (on ? "added" : "removed") + ":", track);
                    // Which publisher are we getting on this mid?
                    let {mids,feedStreams} = this.state;
                    let feed = mids[mid].feed_id;
                    Janus.log(" >> This track is coming from feed " + feed + ":", mid);
                    // If we're here, a new track was added
                    if(track.kind === "audio" && on) {
                        // New audio track: create a stream out of it, and use a hidden <audio> element
                        let stream = new MediaStream();
                        stream.addTrack(track.clone());
                        Janus.log("Created remote audio stream:", stream);
                        feedStreams[feed].audio_stream = stream;
                        this.setState({feedStreams});
                        let remoteaudio = this.refs["remoteAudio" + feed];
                        Janus.attachMediaStream(remoteaudio, stream);
                    } else if(track.kind === "video" && on) {
                        // New video track: create a stream out of it
                        let stream = new MediaStream();
                        stream.addTrack(track.clone());
                        Janus.log("Created remote video stream:", stream);
                        feedStreams[feed].video_stream = stream;
                        this.setState({feedStreams});
                        //FIXME: this must be based on video mids
                        let remotevideo = this.refs["remoteVideo" + feedStreams[feed].slot];
                        Janus.log("Attach to slot: ", feedStreams[feed].slot);
                        Janus.attachMediaStream(remotevideo, stream);
                    } else if(track.kind === "data") {
                        Janus.log("Created remote data channel");
                    } else {
                        Janus.log("-- Already active stream --");
                    }
                },
                ondataopen: (label) => {
                    Janus.log("Feed - DataChannel is available! ("+label+")");
                },
                ondata: (data, label) => {
                    Janus.log("Feed - Got data from the DataChannel! ("+label+")" + data);
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
        Janus.log(" :: Got subscribtion: ", subscription);
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
        let {feeds,remoteFeed,users,feedStreams,index} = this.state;
        for (let i=0; i<feeds.length; i++) {
            if (feeds[i].id === id) {
                Janus.log("Feed " + feeds[i] + " (" + id + ") has left the room, detaching");
                //TODO: remove mids
                delete users[feeds[i].display.id];
                //delete feedStreams[id];
                feeds.splice(i, 1);

                // Fix index if equal to last index
                if(index >= feeds.length - 1) {
                    index = feeds.length - 1;
                    this.setState({index});
                }

                // Send an unsubscribe request
                let unsubscribe = {
                    request: "unsubscribe",
                    streams: [{ feed: id }]
                };
                if(remoteFeed !== null)
                    remoteFeed.send({ message: unsubscribe });

                // Check if we need atoswitch feeds in program
                setTimeout(() => {
                    //FIXME: Here we must be sure
                    // we get mids updated event after unsubscribing event
                    this.fillQuad(id,feeds,index);
                }, 500);

                this.setState({feeds,users,feedStreams});
                break
            }
        }
    };

    fillQuad = (id,feeds,index) => {
        let {round,video_mids} = this.state;

        // Switch to next feed if Quad full
        if(feeds.length >= 4) {
            Janus.log(" :: Let's check mids - ", video_mids);
            video_mids.forEach((mid,i) => {
                Janus.debug(" :: mids iteration - ", i, mid);
                if (mid && !mid.active) {
                    Janus.log(" :: Found empty slot in Quad! - ", video_mids[i]);
                    let feed = feeds[index];
                    index++;
                    if(index >= feeds.length) {
                        // End round here!
                        index = 0;
                        round++;
                        Janus.log(" -- ROUND END --");
                    }
                    this.setState({index,round});
                    Janus.log(":: Auto switch program to: ", feed);
                    let streams = [{feed: feed.id, mid: "1"}];
                    this.subscribeTo(streams);
                }
            })
        } else if(feeds.length < 4) {
            Janus.log(" :: Clean up Quad");
            for (let i=0; i<video_mids.length; i++) {
                if(!video_mids[i].active) {
                    video_mids[i] = null;
                    this.setState({video_mids});
                }
            }
        }
    };

    switchFour = () => {
        Janus.log(" :: Switch");
        let {feeds,index,video_mids} = this.state;

        if(feeds.length < 5)
            return;

        if(index === feeds.length) {
            // End round here!
            Janus.log(" -- ROUND END --");
            this.setState({index: 0});
            index = 0;
        }

        let streams = [];
        let m = 0;

        for(let i=index; i<feeds.length && m<4; i++) {

            Janus.log(" :: ITer: ", i ,feeds[i]);

            if(i > feeds.length) {
                // End round here!
                Janus.log(" -- ROUND END --");
                this.setState({index: 0});
                index = 0;
                m = 0;
                break;
            }

            let sub_mid = video_mids[m].mid;
            let feed = feeds[i].id;
            streams.push({feed, mid: "1", sub_mid});
            index++;
            m++;
        }

        this.setState({index});

        Janus.log(" :: Going to switch four: ", streams);
        let switch_four = {request: "switch", streams};
        this.state.remoteFeed.send ({"message": switch_four,
            success: () => {
                Janus.debug(" -- Switch success: ");
            }
        })
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
        let {janus, videoroom, selected_room, user, username_value, women, name, video_device} = this.state;
        localStorage.setItem("room", selected_room);
        //This name will see other users
        user.display = username_value || user.name;
        localStorage.setItem("username", user.display);
        user.question = false;
        user.room = selected_room;
        user.group = name;
        user.camera = video_device !== null;
        initGxyProtocol(janus, user, protocol => {
            this.setState({protocol});
            // Send question event if before join it was true
            if(reconnect && JSON.parse(localStorage.getItem("question"))) {
                user.question = true;
                let msg = { type: "question", status: true, room: selected_room, user};
                setTimeout(() => {
                    sendProtocolMessage(protocol, user, msg );
                }, 5000);
            }
        }, ondata => {
            Janus.log("-- :: It's protocol public message: ", ondata);
            const {type,error_code,id} = ondata;
            if(ondata.type === "error" && error_code === 420) {
                alert(ondata.error);
                this.state.protocol.hangup();
            } else if(ondata.type === "joined") {
                let register = { "request": "join", "room": selected_room, "ptype": "publisher", "display": JSON.stringify(user) };
                videoroom.send({"message": register});
                this.setState({user, muted: !women, room: selected_room});
                //this.chat.initChatRoom(user,selected_room);
            } else if(type === "client-reconnect" && user.id === id) {
                this.exitRoom(true);
            } else if(type === "client-reload" && user.id === id) {
                window.location.reload();
            } else if(type === "client-disconnect" && user.id === id) {
                this.exitRoom();
            } else if(type === "client-question" && user.id === id) {
                this.handleQuestion();
            } else if(type === "client-mute" && user.id === id) {
                this.micMute();
            } else if(type === "video-mute" && user.id === id) {
                this.camMute();
            }
            this.onProtocolData(ondata);
        });
    };

    exitRoom = (reconnect) => {
        let {videoroom, remoteFeed, protocol, room} = this.state;
        let leave = {request : "leave"};
        if(remoteFeed)
            remoteFeed.send({"message": leave});
        videoroom.send({"message": leave});
        //this.chat.exitChatRoom(room);
        let pl = {textroom : "leave", transaction: Janus.randomString(12),"room": PROTOCOL_ROOM};
        localStorage.setItem("question", false);
        this.setState({video_device: null, muted: false, cammuted: false, mystream: null, name: "", room: "", selected_room: (reconnect ? room : ""), feeds: [],video_mids: [], mids: [], remoteFeed: null, question: false});
        protocol.data({text: JSON.stringify(pl),
            success: () => {
                this.initVideoRoom(reconnect);
            }
        });
    };

    handleQuestion = () => {
        //TODO: only when shidur user is online will be avelable send question event, so we need to add check
        let {protocol, user, room, question} = this.state;
        localStorage.setItem("question", !question);
        user.question = !question;
        let msg = {type: "question", status: !question, room, user};
        sendProtocolMessage(protocol, user, msg );
        this.setState({question: !question, delay: true});
        setTimeout(() => {
            this.setState({delay: false});
        }, 3000);
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

    onNewMsg = (private_message) => {
        this.setState({count: this.state.count + 1});
    };

    handleSwipe = (i) => {
        this.stream.videoMute(i)
    };


    render() {

        const {video_setting,audio,rooms,name,audio_devices,video_devices,video_device,audio_device,muted,cammuted,delay,mystream,selected_room,count,question,selftest,tested,women,feedStreams} = this.state;
        const width = "134";
        const height = "100";
        const autoPlay = true;
        const controls = false;
        //const vmuted = true;

        //let iOS = ['iPad', 'iPhone', 'iPod'].indexOf(navigator.platform) >= 0;

        let rooms_list = rooms.map((data,i) => {
            const {room, description} = data;
            return ({ key: i, text: description, value: room})
            //return ({ key: i, text: description, value: room, description: num_participants.toString()})
        });

        let adevices_list = audio_devices.map((device,i) => {
            const {label, deviceId} = device;
            return ({ key: i, text: label, value: deviceId})
        });

        let vdevices_list = video_devices.map((device,i) => {
            const {label, deviceId} = device;
            return ({ key: i, text: label, value: deviceId})
        });

        let videos = this.state.video_mids.map((mid,i) => {
            if(mid && i < 4) {
                if(mid.active) {
                    let feed = this.state.feeds.find(f => f.id === mid.feed_id);
                    //let id = feed.id;
                    let talk = feed ? feed.talk : false;
                    let question = feed ? feed.question : false;
                    let cammute = feed ? feed.cammute : false;
                    let display_name = feed ? feed.display.display : "";
                    return (<div className="video"
                                 key={"vk" + i}
                                 ref={"video" + i}
                                 id={"video" + i}>
                        <div className={classNames('video__overlay', {'talk': talk})}>
                            {question ? <div className="question">
                                <svg viewBox="0 0 50 50">
                                    <text x="25" y="25" textAnchor="middle" alignmentBaseline="central"
                                          dominantBaseline="central">&#xF128;</text>
                                </svg>
                            </div> : ''}
                            <div className="video__title">{!talk ?
                                <Icon name="microphone slash" size="small" color="red"/> : ''}{display_name}</div>
                        </div>
                        <svg className={classNames('nowebcam', {'hidden': !cammute})} viewBox="0 0 32 18"
                             preserveAspectRatio="xMidYMid meet">
                            <text x="16" y="9" textAnchor="middle" alignmentBaseline="central"
                                  dominantBaseline="central">&#xf2bd;</text>
                        </svg>
                        <video
                            key={"v" + i}
                            ref={"remoteVideo" + i}
                            id={"remoteVideo" + i}
                            width={width}
                            height={height}
                            autoPlay={autoPlay}
                            controls={controls}
                            muted={true}
                            playsInline={true}/>
                    </div>);
                }
            }
            return true;
        });

        let audios = this.state.feeds.map((feed) => {
            if(feed) {
                let id = feed.id;
                return (<audio
                        key={"a"+id}
                        ref={"remoteAudio" + id}
                        id={"remoteAudio" + id}
                        autoPlay={autoPlay}
                        controls={controls}
                        playsInline={true}/>);
            }
            return true;
        });

        let l = (<Label key='Carbon' floating size='mini' color='red'>{count}</Label>);
        let reactSwipeEl;

        return (
            <div>
                <ReactSwipe
                    className="carousel"
                    swipeOptions={{
                        startSlide: 0,
                        continuous: false,
                        disableScroll: true,
                        transitionEnd: (index, elem) => {
                            this.handleSwipe(index);
                        }
                    }}
                    ref={el => (reactSwipeEl = el)}
                >
                    <div>
                        <div className='vclient' >
                            <div className="vclient__toolbar">
                                <Select className='select_room'
                                        disabled={audio_device === null || mystream}
                                        error={!selected_room}
                                        placeholder=" Select Room: "
                                        value={selected_room}
                                        //text={name ? name + ' : ( ' + this.state.feeds.length + ' ) ': ""}
                                        text={name}
                                        //icon={name ? 'users' : ''}
                                        options={rooms_list}
                                        //onClick={this.getRoomList}
                                        onChange={(e, {value}) => this.selectRoom(value)} />
                                <Input
                                    iconPosition='left'
                                    placeholder="Type your name..."
                                    value={this.state.username_value}
                                    onChange={(v,{value}) => this.setState({username_value: value})}
                                    action>
                                    <input disabled={mystream}/>
                                    <Icon name='user circle' />
                                    {mystream ? <Button size='massive' negative icon='sign-out' onClick={() => this.exitRoom(false)} />:""}
                                    {!mystream ? <Button size='massive' primary icon='sign-in' disabled={delay||!selected_room||!audio_device} onClick={this.joinRoom} />:""}
                                </Input>
                                <Menu icon='labeled' secondary size="mini">
                                    {/*<Menu.Item disabled={!mystream} onClick={() => this.setState({ visible: !this.state.visible, count: 0 })}>*/}
                                    {/*<Icon name="comments"/>*/}
                                    {/*{this.state.visible ? "Close" : "Open"} Chat */}
                                    {/*{count > 0 ? l : ""} */}
                                    {/*</Menu.Item>*/}
                                    <Menu.Item disabled={!audio || video_device === null || !mystream || delay} onClick={this.handleQuestion}>
                                        <Icon color={question ? 'green' : ''} name='question'/>Question
                                    </Menu.Item>
                                </Menu>
                                <Menu icon='labeled' secondary size="mini">
                                    {/*<Menu.Item position='right' disabled={selftest !== "Self Audio Test" || mystream} onClick={this.selfTest}>*/}
                                    {/*<Icon color={tested ? 'green' : 'red'} name="sound" />*/}
                                    {/*{selftest}*/}
                                    {/*</Menu.Item>*/}
                                    <Menu.Item disabled={women || !mystream} onClick={this.micMute} className="mute-button">
                                        {/*<canvas className={muted ? 'hidden' : 'vumeter'} ref="canvas1" id="canvas1" width="15" height="35" />*/}
                                        <Icon color={muted ? "red" : "green"} name={!muted ? "microphone" : "microphone slash"} />
                                        {!muted ? "Mute" : "Unmute"}
                                    </Menu.Item>
                                    <Menu.Item disabled={video_device === null || !mystream || delay} onClick={this.camMute}>
                                        <Icon color={cammuted ? "red" : ""} name={!cammuted ? "eye" : "eye slash"} />
                                        {!cammuted ? "Stop Video" : "Start Video"}
                                    </Menu.Item>
                                    {mystream ?
                                    <Menu.Item icon="angle right" name="Broadcast" onClick={() => reactSwipeEl.next()}/>
                                        :
                                    <Popup flowing
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
                                                    onChange={(e, {value}) => this.setDevice(video_device, value, video_setting)}/>
                                            <Select className='select_device'
                                                    disabled={mystream}
                                                    error={!video_device}
                                                    placeholder="Select Device:"
                                                    value={video_device}
                                                    options={vdevices_list}
                                                    onChange={(e, {value}) => this.setDevice(value, audio_device, video_setting)}/>
                                            <Select className='select_device'
                                                    disabled={mystream}
                                                    error={!video_device}
                                                    placeholder="Video Settings:"
                                                    value={video_setting}
                                                    options={vsettings_list}
                                                    onChange={(e, {value}) => this.setDevice(video_device, audio_device, value)}/>
                                        </Popup.Content>
                                    </Popup>}
                                </Menu>
                            </div>

                            <div basic className="vclient__main">
                                <div className="vclient__main-wrapper">
                                    <div className="videos-panel">
                                        <div className="videos" onClick={this.switchFour}>
                                            <div className="videos__wrapper">
                                                {mystream ? "" :
                                                    <div className="video">
                                                        <div className={classNames('video__overlay')}>
                                                            {question ?
                                                                <div className="question">
                                                                    <svg viewBox="0 0 50 50"><text x="25" y="25" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">&#xF128;</text></svg>
                                                                </div>
                                                                :
                                                                ''
                                                            }
                                                            <div className="video__title">
                                                                {muted ? <Icon name="microphone slash" size="small" color="red"/> : ''}{this.state.username_value || this.state.user.name}
                                                            </div>
                                                        </div>
                                                        <svg className={classNames('nowebcam',{'hidden':!cammuted})} viewBox="0 0 32 18" preserveAspectRatio="xMidYMid meet" >
                                                            <text x="16" y="9" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">&#xf2bd;</text>
                                                        </svg>
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

                                                    </div>}
                                                {videos}
                                            </div>
                                        </div>
                                    </div>
                                    {audios}
                                    {/*<MobileChat*/}
                                    {/*ref={chat => {this.chat = chat;}}*/}
                                    {/*visible={this.state.visible}*/}
                                    {/*janus={this.state.janus}*/}
                                    {/*room={room}*/}
                                    {/*user={this.state.user}*/}
                                    {/*onNewMsg={this.onNewMsg} />*/}
                                </div>
                            </div>
                        </div>

                    </div>
                    <div><MobileStreaming
                        ref={stream => {this.stream = stream;}}
                        prev={() => reactSwipeEl.prev()}
                    /></div>
                    {/*<div>PANE 3</div>*/}
                </ReactSwipe>
                {/*<button onClick={() => reactSwipeEl.next()}>Next</button>*/}
                {/*<button onClick={() => reactSwipeEl.prev()}>Previous</button>*/}
            </div>
        );
    }
}

export default MobileClient;

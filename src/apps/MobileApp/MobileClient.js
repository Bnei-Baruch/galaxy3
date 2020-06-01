import React, {Component, Fragment} from 'react';
//import NewWindow from 'react-new-window';
import {Janus} from "../../lib/janus";
import classNames from 'classnames';
import ReactSwipe from 'react-swipe';

import Dots from 'react-carousel-dots';
import { right } from 'semantic-ui-react';
import {Button, Icon, Input, Label, Menu, Popup, Select} from "semantic-ui-react";
import {checkNotification, geoInfo, getMedia, getMediaStream, initJanus, micLevel, testMic,} from "../../shared/tools";
import './MobileClient.scss'
import './MobileConteiner.scss'
import 'eqcss'
//import MobileChat from "./MobileChat";
import {initGxyProtocol} from "../../shared/protocol";
import MobileStreaming from "./MobileStreaming";
import {PROTOCOL_ROOM, vsettings_list} from "../../shared/consts";
import {GEO_IP_INFO} from "../../shared/env";
import platform from "platform";
import { isMobile } from 'react-device-detect';

import {Monitoring} from '../../components/Monitoring';
import {MonitoringData} from '../../shared/MonitoringData';
import api from '../../shared/Api';
import {kc} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";
import {Profile} from "../../components/Profile";
import GxyJanus from "../../shared/janus-utils";
import {addLostStat, getLostStat} from "../VirtualApp/components/NetStatus";

class MobileClient extends Component {

    state = {
        count: 0,
        index: 3,
        creatingFeed: false,
        delay: false,
        media: {
            audio:{
                context: null,
                audio_device: null,
                devices: [],
                error: null,
                stream: null,
            },
            video:{
                setting: { width: 320, height: 180, ideal: 15 },
                video_device: null,
                devices: [],
                error: null,
                stream: null,
            },
        },
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
        localVideoTrack: null,
        localAudioTrack: null,
        mids: [],
        video_mids: [],
        showed_mids:[],
        muted: false,
        cammuted: false,
        shidur: false,
        protocol: null,
        user: null,
        username_value: "",
        visible: false,
        question: false,
        selftest: "Self Audio Test",
        tested: false,
        support: false,
        women: window.location.pathname === "/women/",
        card: 0,
        monitoringData: new MonitoringData(),
        appInitialized: false,
        appInitError: null,
        net_status: 1,
    };

    componentDidUpdate(prevProps, prevState) {
      if (this.state.videoroom !== prevState.videoroom ||
          this.state.localVideoTrack !== prevState.localVideoTrack ||
          this.state.localAudioTrack !== prevState.localAudioTrack ||
          JSON.stringify(this.state.user) !== JSON.stringify(prevState.user)) {
        this.state.monitoringData.setConnection(
          this.state.videoroom,
          this.state.localAudioTrack,
          this.state.localVideoTrack,
          this.state.user);
      }
    };

    checkPermission = (user) => {
        let pending_approval = kc.hasRealmRole("pending_approval");
        let gxy_user = kc.hasRealmRole("gxy_user");
        user.role = pending_approval ? 'ghost' : 'user';
        if (gxy_user || pending_approval) {
            this.initApp(user);
        } else {
            alert("Access denied!");
            kc.logout();
        }
    }

    componentDidMount() {
        if(!isMobile && window.location.href.indexOf("userm") > -1) {
            window.location = '/user/';
            return;
        }
        setInterval(() => {
            const {net_status} = this.state;
            const cur_status = getLostStat();
            if(net_status !== cur_status)
                this.setState({net_status: cur_status})
        }, 5000);
    };

    initApp = (user) => {
        localStorage.setItem('question', false);
        localStorage.setItem('sound_test', false);
        localStorage.setItem('uuid', user.id);
        checkNotification();
        let system  = navigator.userAgent;
        let browser = platform.parse(system);
        if (/Safari|Firefox|Chrome/.test(browser.name)) {
            geoInfo(`${GEO_IP_INFO}`, data => {
                user.ip = data ? data.ip : '127.0.0.1';
                user.country = data.country;
                user.system = system;
                if (!data) {
                    alert("Failed to get Geo Info");
                    this.setState({appInitError: "Error fetching geo info"});
                }
                this.setState({ geoinfo: !!data, user });

                api.fetchConfig()
                    .then(data => GxyJanus.setGlobalConfig(data))
                    .then(() => (api.fetchAvailableRooms({with_num_users: true})))
                    .then(data => {
                        const {rooms} = data;
                        this.setState({rooms});
                        this.initDevices();
                        const {selected_room} = this.state;
                        if (selected_room !== "") {
                            const room = rooms.find(r => r.room === selected_room);
                            if (room) {
                                const name = room.description;
                                user.room = selected_room;
                                user.janus = room.janus;
                                user.group = name;
                                this.setState({name});
                            }
                            this.initClient(user, false);
                        }
                    })
                    .then(() => this.setState({appInitialized: true}))
                    .catch(err => {
                        console.error("[MobileClient] error initializing app", err);
                        this.setState({appInitError: err});
                    });
            });
        } else {
            alert("Browser not supported");
            window.location = 'https://galaxy.kli.one';
        }
    };

    initClient = (user,error) => {
        if(this.state.janus)
            this.state.janus.destroy();

        const config = GxyJanus.instanceConfig(user.janus);
        initJanus(janus => {
            // Check if unified plan supported
            if (Janus.unifiedPlan) {
                user.session = janus.getSessionId();
                this.setState({janus, user, username_value: user.title});
                //this.chat.initChat(janus);
                this.initVideoRoom(error);
            } else {
                alert("Unified Plan is NOT supported");
                this.setState({ audio_device: null });
            }
        }, err => {
            console.error("[MobileClient] error initializing janus", err);
        }, config.url, config.token, config.iceServers);
    };

    initDevices = () => {
        getMedia(this.state.media)
            .then(media => {
                console.log("Got media: ", media);
                const {audio,video} = media;

                if(audio.error && video.error) {
                    alert('No input devices detected');
                    this.setState({cammuted: true});
                } else if(audio.error) {
                    alert(audio.error);
                } else if(video.error) {
                    alert(video.error);
                    this.setState({cammuted: true});
                }

                if(video.stream) {
                    let myvideo = this.refs.localVideo;
                    if(myvideo)
                        myvideo.srcObject = media.video.stream;
                }

                if(audio.stream) {
                    micLevel(audio.stream, this.refs.canvas1, audioContext => {
                        audio.context = audioContext;
                        this.setState({media})
                    });
                }

                this.setState({media})
            });
    };

    setVideoSize = (video_setting) => {
        let {media} = this.state;
        if(JSON.stringify(video_setting) === JSON.stringify(media.video.setting))
            return
        getMediaStream(false,true, video_setting,null, media.video.video_device)
            .then(data => {
                console.log(data)
                const [stream, error] = data;
                if(error) {
                    console.error(error)
                } else {
                    localStorage.setItem("video_setting", JSON.stringify(video_setting));
                    media.video.stream = stream;
                    media.video.setting = video_setting;
                    let myvideo = this.refs.localVideo;
                    myvideo.srcObject = stream;
                    this.setState({media});
                }
            })
    };

    setVideoDevice = (video_device) => {
        let {media} = this.state;
        if(video_device === media.video.video_device)
            return
        getMediaStream(false,true, media.video.setting,null,video_device)
            .then(data => {
                console.log(data)
                const [stream, error] = data;
                if(error) {
                    console.error(error)
                } else {
                    localStorage.setItem("video_device", video_device);
                    media.video.stream = stream;
                    media.video.video_device = video_device;
                    let myvideo = this.refs.localVideo;
                    myvideo.srcObject = stream;
                    this.setState({media});
                }
            })
    };

    setAudioDevice = (audio_device) => {
        let {media} = this.state;
        if(audio_device === media.audio.audio_device)
            return
        getMediaStream(true,false, media.video.setting, audio_device,null)
            .then(data => {
                console.log(data)
                const [stream, error] = data;
                if(error) {
                    console.error(error)
                } else {
                    localStorage.setItem("audio_device", audio_device);
                    media.audio.stream = stream;
                    media.audio.audio_device = audio_device;
                    if (media.audio.context) {
                        media.audio.context.close()
                    }
                    micLevel(stream, this.refs.canvas1, audioContext => {
                        media.audio.context = audioContext;
                        this.setState({media});
                    });
                }
            })
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

    selectRoom = (roomid) => {
        const { rooms, user } = this.state;
        const room      = rooms.find(r => r.room === roomid);
        const name      = room.description;
        if (this.state.room === roomid) {
            return;
        }
        this.setState({ selected_room: roomid, name });
        user.room       = roomid;
        user.group      = name;
        user.janus      = room.janus;
        this.setState({ delay: true });
        this.initClient(user, false);
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
                addLostStat(lost);
            },
            onmessage: (msg, jsep) => {
                this.onMessage(this.state.videoroom, msg, jsep, false);
            },
            onlocaltrack: (track, on) => {
              Janus.log(" ::: Got a local track event :::");
              Janus.log("Local track " + (on ? "added" : "removed") + ":", track);
              let {videoroom,women} = this.state;
              if(!women) videoroom.muteAudio();
              if (on && track && track.kind === 'video') {
                  let stream = new MediaStream();
                  stream.addTrack(track.clone());
                  let myvideo = this.refs.localVideo;
                  Janus.attachMediaStream(myvideo, stream);
                this.setState({localVideoTrack: track});
              }
              if (on && track && track.kind === 'audio') {
                this.setState({localAudioTrack: track});
              }
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
        const {user} = this.state;
        const feeds = Object.assign([], this.state.feeds);
        const {camera,question,rcmd,type,id} = data;
        if(rcmd) {
            if (type === 'client-reconnect' && user.id === id) {
                this.exitRoom(true);
            } else if (type === 'client-reload' && user.id === id) {
                window.location.reload();
            } else if (type === 'client-disconnect' && user.id === id) {
                this.exitRoom(false);
            } else if(type === "client-kicked" && user.id === id) {
                localStorage.setItem("ghost", true);
                kc.logout();
            } else if (type === 'client-question' && user.id === id) {
                this.handleQuestion();
            } else if (type === 'client-mute' && user.id === id) {
                this.micMute();
            } else if (type === 'video-mute' && user.id === id) {
                this.camMute();
            } else if (type === 'sound_test' && user.id === id) {
                user.sound_test = true;
                localStorage.setItem('sound_test', true);
                this.setState({user});
            } else if (type === 'audio-out') {
                this.handleAudioOut(data);
            }
        } else {
            for (let i = 0; i < feeds.length; i++) {
                if (feeds[i] && feeds[i].id === data.rfid) {
                    feeds[i].cammute = !camera;
                    feeds[i].question = question;
                    this.setState({feeds});
                    break;
                }
            }
        }
    };

    publishOwnFeed = (useVideo, useAudio) => {
        const {videoroom, media} = this.state;
        const {audio: {audio_device}, video: {setting,video_device}} = media;
        let offer = {audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: useVideo, data: true};

        if(useVideo) {
            const {width,height,ideal} = setting;
            offer.video = {width, height, frameRate: {ideal, min: 1}, deviceId: {exact: video_device}};
        }

        if(useAudio) {
            offer.audio = {deviceId: {exact: audio_device}};
        }
        videoroom.createOffer({
            media: offer,
            simulcast: false,
            success: (jsep) => {
                Janus.debug("Got publisher SDP!");
                Janus.debug(jsep);
                let publish = { request: "configure", audio: useAudio, video: useVideo, data: true };
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
                let {user} = this.state;
                let myid = msg["id"];
                let mypvtid = msg["private_id"];
                user.rfid = myid;
                this.setState({user,myid ,mypvtid});
                Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);

                api.updateUser(user.id, user)
                    .catch(err => console.error("[User] error updating user state", user.id, err))

                const {media: {audio: {audio_device}, video: {video_device}}} = this.state;
                this.publishOwnFeed(!!video_device, !!audio_device);

                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    //FIXME: display property is JSON write now, let parse it in one place
                    let list = msg['publishers'].filter(l => l.display = (JSON.parse(l.display)));
                    let feeds = list.sort((a, b) => a.display.timestamp - b.display.timestamp).filter(f => !f.display.role.match(/^(ghost|guest)$/));
                    Janus.log(':: Got Pulbishers list: ', feeds);

                    // Feeds count with user role
                    let feeds_count = feeds.filter(f => f.display.role === "user").length;
                    if (feeds_count > 25) {
                        alert("Max users in this room is reached");
                        this.exitRoom(false);
                    }

                    this.makeSubscription(feeds, false);
                }
            } else if(event === "talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                Janus.log("User: "+id+" - start talking");
                for(let i=0; i<feeds.length; i++) {
                    if(feeds[i] && feeds[i].id === id) {
                        feeds[i].taking = true;
                    }
                }
                this.setState({feeds});
            } else if(event === "stopped-talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                Janus.log("User: "+id+" - stop talking");
                for(let i=0; i<feeds.length; i++) {
                    if(feeds[i] && feeds[i].id === id) {
                        feeds[i].taking = false;
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
                    let feeds = msg['publishers'].filter(l => l.display = (JSON.parse(l.display)));
                    Janus.debug('New list of available publishers/feeds:', feeds);
                    this.makeSubscription(feeds, true);
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
                        let {mids,video_mids,feedStreams,showed_mids,feeds} = this.state;
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


                    //go over all feeds and find if it has only audio

                    showed_mids= (msg["streams"].filter(e => e.type === "audio" && feeds.some(item => item.id === e.feed_id && item.streams.length ===2)));

                    showed_mids = video_mids.concat(showed_mids);

                    Janus.log("switch got streams subscribed ",showed_mids,"and feedstream: ",feedStreams);

                    this.setState({mids,video_mids,feedStreams,showed_mids});
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

    makeSubscription = (feeds, new_feed) => {
        let {feedStreams} = this.state;
        let subscription = [];
        for (let f=0; f<feeds.length; f++) {
            let feed = feeds[f];
            let {id,streams} = feed;
            feed.video = !!streams.find(v => v.type === 'video' && v.codec === "h264");
            feed.audio = !!streams.find(a => a.type === 'audio' && a.codec === "opus");
            feed.data = !!streams.find(d => d.type === 'data');
            feed.cammute = !feed.video;
            for (let i in streams) {
                let stream = streams[i];
                const video = stream.type === "video" && stream.codec === "h264";
                const audio = stream.type === "audio" && stream.codec === "opus";
                const data = stream.type === "data";
                if(new_feed) {
                    // We subscribe for video to fill 3 slots
                    if (video && this.state.feeds.length < 4) {
                        subscription.push({feed: id, mid: stream.mid});
                    }
                } else {
                    // We subscribe for video to fill 3 slots
                    if (video && f < 4) {
                        subscription.push({feed: id, mid: stream.mid});
                    }
                }
                if (audio) {
                    subscription.push({feed: id, mid: stream.mid});
                }
                if (data) {
                    subscription.push({feed: id, mid: stream.mid});
                }
            }
            feedStreams[id] = {id, display: feed.display, streams};
        }
        this.setState({feeds:[...this.state.feeds,...feeds], feedStreams});
        if (subscription.length > 0) {
            this.subscribeTo(subscription);
            //FIXME: Write now questions is disabled
            // if(new_feed) {
            //     // Send question event for new feed
            //     setTimeout(() => {
            //         if (this.state.question) {
            //             this.sendDataMessage('question', true);
            //         }
            //     }, 3000);
            // }
        }
    }

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
        let {feeds,remoteFeed,feedStreams,index} = this.state;
        for (let i=0; i<feeds.length; i++) {
            if (feeds[i].id === id) {
                Janus.log("Feed " + feeds[i] + " (" + id + ") has left the room, detaching");
                //TODO: remove mids
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

                this.setState({feeds,feedStreams});
                break
            }
        }
    };

    fillQuad = (id,feeds,index) => {
        let {round,video_mids} = this.state;

        // Switch to next feed if Quad full
        if(feeds.length >= 3) {
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
        } else if(feeds.length < 3) {
            Janus.log(" :: Clean up Quad");
            for (let i=0; i<video_mids.length; i++) {
                if(!video_mids[i].active) {
                    video_mids[i] = null;
                    this.setState({video_mids});
                }
            }
        }
    };

    switchFour = (isForward) => {
        Janus.log(" :: Switch");
        let {feeds,index,video_mids,showed_mids} = this.state;
        Janus.log("Index start: "+index);


        if(feeds.length < 3)
            return;

        if(!isForward && index>=3)
         index = index-3;
        else if(!isForward)
          return;

        if(index === feeds.length) {
            // End round here!
            Janus.log(" -- ROUND END --");
            this.setState({index: 0});
            index = 0;
        }

        let streams = [];
        let m = 0;

        for(let i=index; i<feeds.length && m<3; i++) {

            Janus.log(" :: ITer: ", i ,feeds[i]);

            if(i > feeds.length) {
                // End round here!
                Janus.log(" -- ROUND END --");
                this.setState({index: 0});
                index = 0;
                m = 0;
                break;
            }
            debugger;
            let sub_mid = showed_mids[m].mid;
            let feed = feeds[i].id;
            if(showed_mids[m].type === "video" )
                streams.push({feed, mid: "1", sub_mid});

            index++;
            m++;
        }

        this.setState({index});
        Janus.log("Index end: "+index);
        Janus.log(" :: Going to switch four: ", streams);
        let switch_four = {request: "switch", streams};
        this.state.remoteFeed.send ({"message": switch_four,
            success: () => {
                Janus.debug(" -- Switch success: ");
            }
        })
    };

    sendDataMessage = (user) => {
        const {videoroom} = this.state;
        const message = JSON.stringify(user);
        Janus.log(':: Sending message: ', message);
        videoroom.data({ text: message });
    };

    joinRoom = (reconnect) => {
        this.makeDelay();
        let {janus, videoroom, selected_room, user, username_value, women, name, media} = this.state;
        const {video: {video_device}} = media;
        localStorage.setItem("room", selected_room);
        //This name will see other users
        user.display = username_value || user.name;
        localStorage.setItem("username", user.display);
        user.question = false;
        user.room = selected_room;
        user.group = name;
        user.camera = video_device !== null;
        user.timestamp = Date.now();
        if(JSON.parse(localStorage.getItem("ghost")))
            user.role = "ghost";
        initGxyProtocol(janus, user, protocol => {
            this.setState({protocol});
            // Send question event if before join it was true
            if(reconnect && JSON.parse(localStorage.getItem("question"))) {
                user.question = true;
                setTimeout(() => {
                    api.updateUser(user.id, user)
                        .catch(err => console.error("[User] error updating user state", user.id, err))
                }, 5000);
            }
        }, ondata => {
            Janus.log("-- :: It's protocol public message: ", ondata);
            const {type,error_code,id} = ondata;
            if(ondata.type === "error" && error_code === 420) {
                alert(ondata.error);
                this.state.protocol.hangup();
            } else if(ondata.type === "joined") {
                const {id,timestamp,role,display} = user;
                const d = {id,timestamp,role,display};
                let register = {"request": "join", "room": selected_room, "ptype": "publisher", "display": JSON.stringify(d)};
                videoroom.send({"message": register});
                this.setState({user, muted: !women, room: selected_room});
                //this.chat.initChatRoom(user,selected_room);
            } else if(type === "client-reconnect" && user.id === id) {
                this.exitRoom(true);
            } else if(type === "client-reload" && user.id === id) {
                window.location.reload();
            } else if(type === "client-disconnect" && user.id === id) {
                this.exitRoom();
            } else if(type === "client-kicked" && user.id === id) {
                localStorage.setItem("ghost", true);
                kc.logout();
            } else if(type === "client-question" && user.id === id) {
                this.handleQuestion();
            } else if(type === "client-mute" && user.id === id) {
                this.micMute();
            } else if(type === "video-mute" && user.id === id) {
                this.camMute();
            }
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
        protocol.data({text: JSON.stringify(pl)});
        localStorage.setItem("question", false);
        api.fetchAvailableRooms({with_num_users: true})
            .then(data => {
                const {rooms} = data;
                this.setState({rooms});
            });
        this.setState({
          cammuted: false,
          feeds: [],
          localAudioTrack: null,
          localVideoTrack: null,
          mids: [],
          muted: false,
          name: "",
          question: false,
          remoteFeed: null,
          room: "",
          selected_room: (reconnect ? room : ""),
          video_device: null,
          video_mids: [],
          showed_mids: [],

        });
        this.initVideoRoom(reconnect);
        if(!this.stream.state.muted)
            this.stream.audioMute();
        this.stream.videoMute();
    };

    makeDelay = () => {
        this.setState({delay: true});
        setTimeout(() => {
            this.setState({delay: false});
        }, 3000);
    };

    handleQuestion = () => {
        const {question} = this.state;
        const user = Object.assign({}, this.state.user);
        if(user.role === "ghost") return;
        this.makeDelay();
        user.question = !question;
        api.updateUser(user.id, user)
            .then(data => {
                if(data.result === "success") {
                    localStorage.setItem('question', !question);
                    this.setState({user, question: !question});
                    this.sendDataMessage(user);
                }
            })
            .catch(err => console.error("[User] error updating user state", user.id, err))
    };

    camMute = () => {
        let {videoroom, cammuted} = this.state;
        const user = Object.assign({}, this.state.user);
        if(user.role === "ghost") return;
        this.makeDelay();
        user.camera = cammuted;
        api.updateUser(user.id, user)
            .then(data => {
                if(data.result === "success") {
                    cammuted ? videoroom.unmuteVideo() : videoroom.muteVideo();
                    this.setState({user, cammuted: !cammuted});
                    this.sendDataMessage(user);
                }
            })
            .catch(err => console.error("[User] error updating user state", user.id, err))
    };

    micMute = () => {
        let {videoroom, muted} = this.state;
        muted ? videoroom.unmuteAudio() : videoroom.muteAudio();
        this.setState({muted: !muted});
    };

    onNewMsg = (private_message) => {
        this.setState({count: this.state.count + 1});
    };

    handleSwipe = (i) => {
      //  this.stream.videoMute(i)
    };


    render() {
        const {
            user,
          audio,
          cammuted,
          count,
          delay,
          feedStreams,
          localAudioTrack,
          monitoringData,
          muted,
          name,
          question,
          rooms,
          selected_room,
          selftest,
            room,
          women,
            appInitialized,
            appInitError,
            net_status,
            media
        } = this.state;
        const {video_device} = media.video;
        const {audio_device} = media.audio;

        if (appInitError) {
            return (
                <Fragment>
                    <h1>Error Initializing Application</h1>
                    {`${appInitError}`}
                </Fragment>
            );
        }

        const width = "134";
        const height = "100";
        const autoPlay = true;
        const controls = false;
        //const vmuted = true;

        //let iOS = ['iPad', 'iPhone', 'iPod'].indexOf(navigator.platform) >= 0;

        let rooms_list = rooms.map((data,i) => {
            const { room, description, num_users } = data;
            return ({ key: i, text: description, description: num_users, value: room });
        });

        let adevices_list = media.audio.devices.map((device,i) => {
            const {label, deviceId} = device;
            return ({ key: i, text: label, value: deviceId})
        });

        let vdevices_list = media.video.devices.map((device,i) => {
            const {label, deviceId} = device;
            return ({ key: i, text: label, value: deviceId})
        });

        let videos = this.state.showed_mids.map((mid,i) => {
            if(mid && i <3) {
                if(mid.active) {
                    let feed = this.state.feeds.find(f => f.id === mid.feed_id);
                    //let id = feed.id;
                    let taking = feed ? feed.taking : false;
                    let question = feed ? feed.question : false;
                    let cammute = feed ? feed.cammute : false;
                    let display_name = feed ? feed.display.display : "";
                    return (<div className="video"
                                 key={"vk" + i}
                                 ref={"video" + i}
                                 id={"video" + i}>
                        <div className={classNames('video__overlay', {'talk': taking})}>
                            {question ? <div className="question">
                                <svg viewBox="0 0 50 50">
                                    <text x="25" y="25" textAnchor="middle" alignmentBaseline="central"
                                          dominantBaseline="central">&#xF128;</text>
                                </svg>
                            </div> : ''}
                            <div className="video__title">{!taking ?
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
        let login = (<LoginPage user={user} checkPermission={this.checkPermission} />);
        let content = (
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
                                <Input
                                    iconPosition='left'
                                    action>
                                    <Select className='select_room'
                                            search
                                            disabled={audio_device === null || !!localAudioTrack}
                                            error={!selected_room}
                                            placeholder=" Select Room: "
                                            value={selected_room}
                                        //text={name ? name + ' : ( ' + this.state.feeds.length + ' ) ': ""}
                                            text={name}
                                        //icon={name ? 'users' : ''}
                                            options={rooms_list}
                                        //onClick={this.getRoomList}
                                            onChange={(e, {value}) => this.selectRoom(value)} />
                                    {/*<input disabled={!!localAudioTrack}/>*/}
                                    {/*<Icon name='user circle' />*/}
                                    {!!localAudioTrack ? <Button size='massive' negative icon='sign-out' onClick={() => this.exitRoom(false)} />:""}
                                    {!localAudioTrack ? <Button size='massive' primary icon='sign-in' disabled={delay||!selected_room||!audio_device} onClick={this.joinRoom} />:""}
                                </Input>
                                <Menu icon='labeled' secondary size="mini">
                                    {/*<Menu.Item disabled={!localAudioTrack} onClick={() => this.setState({ visible: !this.state.visible, count: 0 })}>*/}
                                    {/*<Icon name="comments"/>*/}
                                    {/*{this.state.visible ? "Close" : "Open"} Chat */}
                                    {/*{count > 0 ? l : ""} */}
                                    {/*</Menu.Item>*/}
                                    {/*<Menu.Item disabled={!audio || video_device === null || !localAudioTrack || delay} onClick={this.handleQuestion}>*/}
                                    {/*    <Icon color={question ? 'green' : ''} name='question'/>Question*/}
                                    {/*</Menu.Item>*/}
                                </Menu>
                                <Menu icon='labeled' secondary size="mini">
                                    {/*<Menu.Item position='right' disabled={selftest !== "Self Audio Test" || !!localAudioTrack} onClick={this.selfTest}>*/}
                                    {/*<Icon color={tested ? 'green' : 'red'} name="sound" />*/}
                                    {/*{selftest}*/}
                                    {/*</Menu.Item>*/}
                                    <Menu.Item disabled={women || !localAudioTrack} onClick={this.micMute} className="mute-button">
                                        <canvas className={muted ? 'hidden' : 'vumeter'} ref="canvas1" id="canvas1" width="15" height="35" />
                                        <Icon color={muted ? "red" : "green"} name={!muted ? "microphone" : "microphone slash"} />
                                        {!muted ? "Mute" : "Unmute"}
                                    </Menu.Item>
                                    <Menu.Item disabled={video_device === null || !localAudioTrack || delay} onClick={this.camMute}>
                                        <Icon color={cammuted ? "red" : ""} name={!cammuted ? "eye" : "eye slash"} />
                                        {!cammuted ? "Stop Video" : "Start Video"}
                                    </Menu.Item>
                                    {!!localAudioTrack ?
                                        <Menu.Item icon="angle right" name="Broadcast" onClick={() => reactSwipeEl.next()}/>
                                        :
                                        <Popup flowing
                                               trigger={<Menu.Item icon="setting" name="Settings"/>}
                                               on='click'
                                               position='bottom right'
                                        >
                                            <Popup.Content>
                                                <Button className='select_device' fluid>
                                                    <Icon name='user circle'/>
                                                    <Profile title={this.state.username_value} kc={kc} />
                                                </Button>
                                                <Select className='select_device'
                                                        disabled={!!room}
                                                        error={!media.audio.audio_device}
                                                        placeholder="Select Device:"
                                                        value={media.audio.audio_device}
                                                        options={adevices_list}
                                                        onChange={(e, { value }) => this.setAudioDevice(value)} />
                                                <Select className='select_device'
                                                        disabled={!!room}
                                                        error={!media.video.video_device}
                                                        placeholder="Select Device:"
                                                        value={media.video.video_device}
                                                        options={vdevices_list}
                                                        onChange={(e, { value }) => this.setVideoDevice(value)} />
                                                <Select className='select_device'
                                                        disabled={!!room}
                                                        error={!media.video.video_device}
                                                        placeholder="Video Settings:"
                                                        value={media.video.setting}
                                                        options={vsettings_list}
                                                        onChange={(e, { value }) => this.setVideoSize(value)} />
                                            </Popup.Content>
                                        </Popup>}
                                    <Monitoring monitoringData={monitoringData} />
                                </Menu>
                            </div>

                            <div basic className="vclient__main">
                                <div className="vclient__main-wrapper">
                                    <div className="videos-panel">
                                        <div className="videos" >
                                            <div className="videos__wrapper">
                                                {/* {!!localAudioTrack ? "" : */}
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
                                                                {muted ? <Icon name="microphone slash" size="small" color="red"/> : ''}{this.state.username_value}
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

                                                    </div>
                                                    {/* } */}
                                                {videos}
                                                    {videos.length>0?
                                                    <div  class="dots">
                                                    <Dots  length={Math.floor(this.state.feeds.length/3)+1} active={(Math.ceil(this.state.index/3)-1)} />
                                                    </div>
                                                    :""}
                                            </div>
                                        </div>
                                        {videos.length>0 ?
                                        <div class="right-arrow" onClick={()=>this.switchFour(true)}>
                                                    <Icon name='chevron right' color='blue' size='huge' />

                                        </div>
                                        :""}
                                         {videos.length>0?
                                        <div class="left-arrow" onClick={()=>this.switchFour(false)}>
                                        <Icon name='chevron left' color='blue' size='huge' />

                                        </div>
                                          :""  }
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
                        { !(new URL(window.location.href).searchParams.has('lost')) ? null :
                            (<Label color={net_status === 2 ? 'yellow' : net_status === 3 ? 'red' : 'green'} icon='wifi' corner='right' />)}
                    </div>
                    {
                        appInitialized ?
                            <div>
                                <MobileStreaming
                                    ref={stream => {this.stream = stream;}}
                                    prev={() => reactSwipeEl.prev()}
                                    ip={user.ip}
                                    country={user.country}
                                />
                            </div>
                            : null
                    }

                    {/*<div>PANE 3</div>*/}
                </ReactSwipe>
                {/*<button onClick={() => reactSwipeEl.next()}>Next</button>*/}
                {/*<button onClick={() => reactSwipeEl.prev()}>Previous</button>*/}
            </div>
        );

        return (
            <Fragment>
                {/*{user && isMobile ? content : isMobile ? login : ""}*/}
                {user ? content : login}
            </Fragment>
        );
    }
}

export default MobileClient;

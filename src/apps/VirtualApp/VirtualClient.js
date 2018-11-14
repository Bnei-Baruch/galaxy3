import React, { Component } from 'react';
import NewWindow from 'react-new-window';
import { Janus } from "../../lib/janus";
import classNames from 'classnames';

import {Menu, Select, Button,Input,Label,Icon,Popup} from "semantic-ui-react";
import {geoInfo, initJanus, getDevicesStream, micLevel, checkNotification,testDevices} from "../../shared/tools";
import './VirtualClient.scss'
import './VideoConteiner.scss'
import {MAX_FEEDS} from "../../shared/consts";
import nowebcam from './nowebcam.jpeg';
import VirtualChat from "./VirtualChat";
import {initGxyProtocol, sendProtocolMessage} from "../../shared/protocol";

class VirtualClient extends Component {

    state = {
        count: 0,
        audioContext: null,
        audio_devices: [],
        video_devices: [],
        audio_device: "",
        video_device: "",
        janus: null,
        feeds: [],
        rooms: [],
        room: "",
        selected_room: "",
        videoroom: null,
        remotefeed: null,
        myid: null,
        mypvtid: null,
        mystream: null,
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
    };

    componentDidMount() {
        let {user} = this.state;
        checkNotification();
        geoInfo('https://v4g.kbb1.com/geo.php?action=get', data => {
            Janus.log(data);
            user.ip = data.external_ip;
        });
        initJanus(janus => {
            user.session = janus.getSessionId();
            this.setState({janus, user});
            this.initVideoRoom();
        });
    };

    componentWillUnmount() {
        this.state.janus.destroy();
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
                        this.setState({audioContext});
                    });
                })
            }
        }
    };

    getRoomList = () => {
        const {videoroom} = this.state;
        if (videoroom) {
            videoroom.send({message: {request: "list"},
                success: (data) => {
                    Janus.debug(" :: Get Rooms List: ", data.list);
                    data.list.sort((a, b) => {
                        // if (a.num_participants > b.num_participants) return -1;
                        // if (a.num_participants < b.num_participants) return 1;
                        if (a.description > b.description) return 1;
                        if (a.description < b.description) return -1;
                        return 0;
                    });
                    this.setState({rooms: data.list});
                    this.getFeedsList(data.list)
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

    initVideoRoom = () => {
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
                user.handle = videoroom.getId();
                this.setState({videoroom, user});
                this.initDevices(true);
                // Get list rooms
                //this.getRoomList();
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
                let {videoroom} = this.state;
                Janus.log(mystream);
                // Janus.log(" -- GOT AUDIO TRACK: ", mystream.getAudioTracks()[0])
                // mystream.getAudioTracks()[0].enabled = false;
                videoroom.muteAudio();
                this.setState({mystream});
                //let myvideo = this.refs.localVideo;
                //Janus.attachMediaStream(myvideo, mystream);
                if(videoroom.webrtcStuff.pc.iceConnectionState !== "completed" &&
                    videoroom.webrtcStuff.pc.iceConnectionState !== "connected") {
                    Janus.debug("Publishing... ");
                }
                let videoTracks = mystream.getVideoTracks();
                if(videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
                    Janus.debug("No webcam");
                } else {
                    Janus.debug("Yes webcam");
                }
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
                    Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
                    Janus.log("  -- This is a subscriber");

                    let listen = { "request": "join", "room": this.state.room, "ptype": "subscriber", "feed": id, "private_id": this.state.mypvtid };
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
                            for(let i=1;i<MAX_FEEDS;i++) {
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
                                media: { audioSend: false, videoSend: false, data:true },	// We want recvonly audio/video
                                success: (jsep) => {
                                    Janus.debug("Got SDP!");
                                    Janus.debug(jsep);
                                    let body = { "request": "start", "room": this.state.room };
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

    publishOwnFeed = (useVideo) => {
        // FIXME: Does we allow video only mode?
        let {videoroom,audio_device,video_device} = this.state;
        let height = (Janus.webRTCAdapter.browserDetails.browser === "safari") ? 480 : 360;
        videoroom.createOffer(
            {
                // Add data:true here if you want to publish datachannels as well
                media: {
                    audioRecv: false, videoRecv: false, audioSend: true, videoSend: useVideo, audio: {
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
                //media: { audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: true },	// Publishers are sendonly
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
                this.publishOwnFeed(true);
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    let feeds_list = list.filter(feeder => JSON.parse(feeder.display).role === "user");
                    Janus.log(":: Got Pulbishers list: ", feeds_list);
                    if(feeds_list.length > 11) {
                        alert("Max users in this room is reached");
                        window.location.reload();
                    }
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.log(list);
                    for(let f in feeds_list) {
                        let id = feeds_list[f]["id"];
                        let display = JSON.parse(feeds_list[f]["display"]);
                        let talk = feeds_list[f]["talking"];
                        Janus.debug("  >> [" + id + "] " + display);
                        this.newRemoteFeed(id, talk);
                    }
                }
            } else if(event === "talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                //let room = msg["room"];
                Janus.log("User: "+id+" - start talking");
                for(let i=1; i<MAX_FEEDS; i++) {
                    if(feeds[i] !== null && feeds[i] !== undefined && feeds[i].rfid === id) {
                        feeds[i].talk = true;
                    }
                }
                this.setState({feeds});
            } else if(event === "stopped-talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                //let room = msg["room"];
                Janus.log("User: "+id+" - stop talking");
                for(let i=1; i<MAX_FEEDS; i++) {
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
                    for(let f in list) {
                        let id = list[f]["id"];
                        let display = JSON.parse(list[f]["display"]);
                        Janus.debug("  >> [" + id + "] " + display);
                        if(display.role === "user")
                            this.newRemoteFeed(id, false);
                    }
                } else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
                    // One of the publishers has gone away?
                    let {feeds} = this.state;
                    let leaving = msg["leaving"];
                    Janus.log("Publisher left: " + leaving);
                    let remoteFeed = null;
                    for(let i=1; i<MAX_FEEDS; i++) {
                        if(feeds[i] != null && feeds[i] !== undefined && feeds[i].rfid === leaving) {
                            remoteFeed = feeds[i];
                            break;
                        }
                    }
                    if(remoteFeed != null) {
                        Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfuser + ") has left the room, detaching");
                        feeds[remoteFeed.rfindex] = null;
                        remoteFeed.detach();
                    }
                    this.setState({feeds});
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
                    let remoteFeed = null;
                    for(let i=1; i<MAX_FEEDS; i++) {
                        if(feeds[i] != null && feeds[i] !== undefined && feeds[i].rfid === unpublished) {
                            remoteFeed = feeds[i];
                            break;
                        }
                    }
                    if(remoteFeed !== null) {
                        Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfuser + ") has left the room, detaching");
                        feeds[remoteFeed.rfindex] = null;
                        remoteFeed.detach();
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

    onProtocolData = (data) => {
        //TODO: Need to add transaction handle (filter and acknowledge)
        let {room,feeds,users,user} = this.state;
        if (data.type === "question" && data.status && data.room === room && user.id !== data.user.id) {
            let rfid = users[data.user.id].rfid;
            for (let i = 1; i < feeds.length; i++) {
                if (feeds[i] !== null && feeds[i] !== undefined && feeds[i].rfid === rfid) {
                    feeds[i].question = true;
                    break
                }
            }
            this.setState({feeds});
        } else if (data.type === "question" && !data.status && data.room === room && user.id !== data.user.id) {
            let rfid = users[data.user.id].rfid;
            for (let i = 1; i < feeds.length; i++) {
                if (feeds[i] !== null && feeds[i] !== undefined && feeds[i].rfid === rfid) {
                    feeds[i].question = false;
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

    joinRoom = () => {
        let {janus, videoroom, selected_room, user, username_value} = this.state;
        localStorage.setItem("room", selected_room);
        //This name will see other users
        user.display = username_value || user.name;
        localStorage.setItem("username", user.display);
        let register = { "request": "join", "room": selected_room, "ptype": "publisher", "display": JSON.stringify(user) };
        videoroom.send({"message": register});
        this.setState({user, muted: true, room: selected_room});
        initGxyProtocol(janus, user, protocol => {
            this.setState({protocol});
        }, ondata => {
            Janus.log("-- :: It's protocol public message: ", ondata);
            this.onProtocolData(ondata);
        });
    };

    exitRoom = () => {
        let {videoroom, protocol, room} = this.state;
        let leave = {request : "leave"};
        Janus.log(room);
        videoroom.send({"message": leave});
        this.setState({muted: false, mystream: null, room: "", selected_room: "", i: "", feeds: []});
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

    registerUsername = (i) => {
        Janus.log(i);
        let {videoroom, rooms, user} = this.state;
        let room = rooms[i].room;
        let name = rooms[i].description;
        user.role = "user";
        user.display = "user-"+Janus.randomString(4);
        let register = { "request": "join", "room": room, "ptype": "publisher", "display": JSON.stringify(user) };
        videoroom.send({"message": register});
        this.setState({room,name,user,i});
    };

    handleQuestion = () => {
        //TODO: only when shidur user is online will be avelable send question event, so we need to add check
        const { protocol, user, room, question} = this.state;
        let msg = { type: "question", status: !question, room, user};
        sendProtocolMessage(protocol, user, msg );
        this.setState({question: !question});
    };


    camMute = () => {
        let {videoroom,cammuted} = this.state;
        cammuted ? videoroom.unmuteVideo() : videoroom.muteVideo();
        this.setState({cammuted: !cammuted});
        this.sendDataMessage("camera", this.state.cammuted);
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

    onNewMsg = () => {
        this.setState({count: this.state.count + 1});
    };


  render() {

      const { rooms,room,audio_devices,video_devices,video_device,audio_device,i,muted,cammuted,mystream,selected_room,count,question} = this.state;
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
              let id = feed.rfid;
              let talk = feed.talk;
              let question = feed.question;
              let name = feed.rfuser.display;
              return (<div className="video"
                        key={"v" + id}
                        ref={"video" + id}
                        id={"video" + id}>
                        <div className={classNames('video__overlay', {'talk' : talk})}>
                            {question ? <div className="question"><Icon name="question circle" size="massive"/></div>:''}
                            <div className="video__title">{!talk ? <Icon name="microphone slash" size="small" color="red"/> : ''}{name}</div>
                        </div>
                  <video 
                         poster={nowebcam}
                         key={id}
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
              {mystream ? 
                <Button negative icon='sign-out' onClick={this.exitRoom} />:""}
              {!mystream ?
                <Button primary icon='sign-in' disabled={!selected_room||!audio_device} onClick={this.joinRoom} />:""}  
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
                    url='https://v4g.kbb1.com/gxystr'
                    features={{width:"725",height:"635",left:"200",top:"200",location:"no"}}
                    title='V4G' onUnload={this.onUnload} onBlock={this.onBlock}>
                  </NewWindow> :
                  null
                }
              </Menu.Item>
            </Menu>
            <Menu icon='labeled' secondary size="mini">
              <Menu.Item disabled={!mystream} onClick={this.micMute} className="mute-button">
                <canvas className={muted ? 'hidden' : 'vumeter'} ref="canvas1" id="canvas1" width="15" height="35" />
                <Icon color={muted ? "red" : ""} name={!muted ? "microphone" : "microphone slash"} />
                {!muted ? "Mute" : "Unmute"}
              </Menu.Item>
              <Menu.Item disabled={!mystream} onClick={this.camMute}>
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
                        
                            <div className="video__title">{muted ? <Icon name="microphone slash" size="small" color="red"/> : ''}{this.state.username_value}</div>
                        </div>
                  
                    <video className={cammuted ? 'hidden' : 'mirror'}
                      ref="localVideo"
                      id="localVideo"
                      poster={nowebcam}
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

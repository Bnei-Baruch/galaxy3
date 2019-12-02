import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import classNames from 'classnames';

import {Menu, Select,Label,Icon,Popup} from "semantic-ui-react";
import {geoInfo, initJanus, getDevicesStream, micLevel, checkNotification,testDevices,testMic} from "../../shared/tools";
import './GroupClient.scss'
import './VideoConteiner.scss'
import nowebcam from './nowebcam.jpeg';
import GroupChat from "./GroupChat";
import {initGxyProtocol, sendProtocolMessage} from "../../shared/protocol";
import {client} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";
import {GEO_IP_INFO, GROUPS_ROOM} from "../../shared/consts";

class GroupClient extends Component {

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
        selected_room: GROUPS_ROOM,
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
        progress: false,
        user: null,
        users: {},
        visible: false,
        question: false,
        geoinfo: false,
        selftest: "Self Audio Test",
        tested: false,
    };

    checkPermission = (user) => {
        let gxy_group = user.roles.filter(role => role === 'gxy_group').length > 0;
        if (gxy_group) {
            delete user.roles;
            user.role = "group";
            this.initClient(user);
        } else {
            alert("Access denied!");
            client.signoutRedirect();
        }
    };

    componentWillUnmount() {
        this.state.janus.destroy();
    };

    initClient = (user,error) => {
        localStorage.setItem("question", false);
        localStorage.setItem("sound_test", false);
        checkNotification();
        geoInfo(`${GEO_IP_INFO}`, data => {
            user.ip = data ? data.ip : "127.0.0.1";
            if(!data) alert('Fail to get GeoInfo! Question will be disabled!');
            initJanus(janus => {
                user.session = janus.getSessionId();
                user.system = navigator.userAgent;
                this.setState({janus, user, geoinfo: !!data});
                this.chat.initChat(janus);
                this.initVideoRoom(error);
            }, er => {
                setTimeout(() => {
                    this.initClient(user,er);
                }, 5000);
            }, true);
        });

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

    initVideoRoom = (reconnect) => {
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
            mediaState: (medium, on) => {
                Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
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
                Janus.debug(" ::: Got a local stream :::");
                if(on) {
                    let {videoroom} = this.state;
                    let mystream = new MediaStream();
                    mystream.addTrack(track.clone());
                    Janus.log(mystream);
                    this.setState({mystream});
                    if(videoroom.webrtcStuff.pc.iceConnectionState !== "completed" &&
                        videoroom.webrtcStuff.pc.iceConnectionState !== "connected") {
                        Janus.debug("Publishing... ");
                    }
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
                let {user,selected_room,protocol} = this.state;
                let myid = msg["id"];
                let mypvtid = msg["private_id"];
                user.rfid = myid;
                this.setState({user,myid,mypvtid});
                let pmsg = { type: "enter", status: true, room: selected_room, user};
                Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
                sendProtocolMessage(protocol, user, pmsg);
                this.publishOwnFeed(true);
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    let feeds_list = list.filter(feeder => JSON.parse(feeder.display).role === "group");
                    Janus.log(":: Got Pulbishers list: ", feeds_list);
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.log(list);
                }
            } else if(event === "destroyed") {
                // The room has been destroyed
                Janus.warn("The room has been destroyed!");
            } else if(event === "event") {
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.debug(list);
                } else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
                    // One of the publishers has gone away?
                    let {feeds} = this.state;
                    let leaving = msg["leaving"];
                    Janus.log("Publisher left: " + leaving);
                    let remoteFeed = null;
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

    sendDataMessage = (key,value) => {
        let {videoroom,user} = this.state;
        user[key] = value;
        var message = JSON.stringify(user);
        Janus.log(":: Sending message: ",message);
        videoroom.data({ text: message })
    };

    joinRoom = (reconnect) => {
        let {janus,videoroom,selected_room,user,tested} = this.state;
        user.display = user.title || user.name;
        user.self_test = tested;
        user.sound_test = reconnect ? JSON.parse(localStorage.getItem("sound_test")) : false;
        user.question = false;
        localStorage.setItem("username", user.display);
        initGxyProtocol(janus, user, protocol => {
            this.setState({protocol});
            if(reconnect && JSON.parse(localStorage.getItem("question"))) {
                // Send question event if before join it was true
                user.question = true;
                let msg = { type: "question", status: true, room: selected_room, user};
                setTimeout(() => {
                    sendProtocolMessage(protocol, user, msg );
                }, 5000);
            }
        }, ondata => {
            Janus.log("-- :: It's protocol public message: ", ondata);
            const {type,error_code,id,room} = ondata;
            if(type === "error" && error_code === 420) {
                alert(ondata.error);
                this.state.protocol.hangup();
            } else if(type === "joined") {
                let register = { "request": "join", "room": selected_room, "ptype": "publisher", "display": JSON.stringify(user) };
                videoroom.send({"message": register});
                this.setState({user, muted: false, room: selected_room});
                this.chat.initChatRoom(user);
            } else if(type === "chat-broadcast" && room === GROUPS_ROOM) {
                this.chat.showMessage(ondata);
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
            } else if(type === "sound-test" && user.id === id) {
                let {user} = this.state;
                user.sound_test = true;
                localStorage.setItem("sound_test", true);
                this.setState({user});
            }
        });
    };

    exitRoom = (reconnect) => {
        let {videoroom, protocol} = this.state;
        let leave = {request : "leave"};
        videoroom.send({"message": leave});
        localStorage.setItem("question", false);
        this.setState({muted: false, mystream: null, room: "", i: "", feeds: [], question: false});
        this.chat.exitChatRoom(GROUPS_ROOM);
        this.exitProtocol();
        this.initVideoRoom(reconnect);
        protocol.detach();
    };

    exitProtocol = () => {
        let {protocol} = this.state;
        let chatreq = {textroom : "leave", transaction: Janus.randomString(12),"room": 1000};
        protocol.data({text: JSON.stringify(chatreq),
            success: () => {
                Janus.log(":: Protocol leave callback: ");
                this.setState({protocol: null});
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
        this.setState({question: !question});
    };

    micMute = () => {
        let {videoroom, muted} = this.state;
        //mystream.getAudioTracks()[0].enabled = !muted;
        muted ? videoroom.unmuteAudio() : videoroom.muteAudio();
        this.setState({muted: !muted});
    };

    onNewMsg = () => {
        this.setState({count: this.state.count + 1});
    };

    initConnection = () => {
        this.setDelay();
        const {mystream} = this.state;
        mystream ? this.exitRoom() : this.joinRoom();
    };

    setDelay = () => {
        this.setState({progress: true});
        setTimeout(() => {
            this.setState({progress: false});
        }, 2000);
    };


  render() {

      const {user,audio_devices,video_devices,video_device,audio_device,muted,mystream,room,count,question,selftest,tested,progress,geoinfo} = this.state;
      const width = "134";
      const height = "100";
      const autoPlay = true;
      const controls = false;
      const talk = false;
      //const vmuted = true;

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
              return (<div className="video"
                           key={"v" + id}
                           ref={"video" + id}
                           id={"video" + id}>
                  <video className={talk ? "talk" : ""}
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
      let login = (<LoginPage user={user} checkPermission={this.checkPermission} />);
      let content =  (
        <div className={classNames('gclient', { 'gclient--chat-open': this.state.visible })} >
          <div className="gclient__toolbar">
            <Menu icon='labeled' secondary size="mini">
                <Menu.Item disabled={!video_device || progress} onClick={this.initConnection}>
                    <Icon color={mystream ? 'green' : 'red'} name='power off'/>
                    {!mystream ? "Disconnected" : "Connected"}
                </Menu.Item>
              <Menu.Item disabled={!mystream} onClick={() => this.setState({ visible: !this.state.visible, count: 0 })}>
                <Icon name="comments"/>
                {this.state.visible ? "Close" : "Open"} Chat 
                {count > 0 ? l : ""} 
              </Menu.Item>
              <Menu.Item disabled={!geoinfo || !mystream} onClick={this.handleQuestion}>
                <Icon color={question ? 'green' : ''} name='question'/>
                Ask a Question
              </Menu.Item>
              <Menu.Item onClick={() => window.open("https://galaxy.kli.one/stream")} >
                <Icon name="tv"/>
                Open Broadcast
              </Menu.Item>
            </Menu>
            <Menu icon='labeled' secondary size="mini">
                <Menu.Item position='right' disabled={selftest !== "Self Audio Test" || mystream} onClick={this.selfTest}>
                    <Icon color={tested ? 'green' : 'red'} name="sound" />
                    {selftest}
                </Menu.Item>
              <Menu.Item position='right' disabled onClick={this.micMute} className="mute-button">
                <Icon color={muted ? "red" : ""} name={!muted ? "microphone" : "microphone slash"} />
                {!muted ? "Mute" : "Unmute"}
                  <canvas className={muted ? 'hidden' : 'vumeter'} ref="canvas1" id="canvas1" width="15" height="35" />
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
          <div basic className="gclient__main" onDoubleClick={() => this.setState({ visible: !this.state.visible })} >
            <div className="videos-panel">

              <div className="videos">
                <div className="videos__wrapper">
                  <div className="video">
                      <div className={classNames('video__overlay', {'talk' : talk})}>
                          {question ? <div className="question">
                              <svg viewBox="0 0 50 50"><text x="25" y="25" textAnchor="middle" alignmentBaseline="central">&#xF128;</text></svg>
                          </div> : ''}
                          {/*<div className="video__title">{!talk ? <Icon name="microphone slash" size="small" color="red"/> : ''}{name}</div>*/}
                      </div>
                    <video ref="localVideo"
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
            <GroupChat
                ref={chat => {this.chat = chat;}}
              visible={this.state.visible}
              janus={this.state.janus}
              room={room}
              user={this.state.user}
              onNewMsg={this.onNewMsg} />
          </div>
        </div>
    )

      return (
          <div>
              {user ? content : login}
          </div>
      )
  }
}

export default GroupClient;

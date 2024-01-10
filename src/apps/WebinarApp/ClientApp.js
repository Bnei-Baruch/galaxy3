import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import classNames from 'classnames';
import {Menu, Select,Label,Icon,Popup} from "semantic-ui-react";
import {
  geoInfo,
  initJanus,
  getDevicesStream,
  micLevel,
  checkNotification,
  testDevices,
  testMic,
  notifyMe, getDateString
} from "../../shared/tools";
import './ClientApp.scss'
import './VideoConteiner.scss'
import nowebcam from './nowebcam.png';
import ClientChat from "./ClientChat";
import {initGxyProtocol, sendProtocolMessage} from "../../shared/protocol";
import {kc} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";
import {GROUPS_ROOM, media_object, PROTOCOL_ROOM} from "../../shared/consts";
import {GEO_IP_INFO, PAY_USER_FEE} from "../../shared/env";
import log from "loglevel";
import version from "../VirtualApp/Version";
import {getUserRole, userRolesEnum} from "../../shared/enums";
import {updateSentryUser} from "../../shared/sentry";
import devices from "../../lib/devices";
import JanusStream from "../../shared/streaming-utils";
import {initCrisp} from "../VirtualApp/components/Support";
import platform from "platform";
import api from "../../shared/Api";
import ConfigStore from "../../shared/ConfigStore";
import GxyJanus from "../../shared/janus-utils";
import mqtt from "../../shared/mqtt";

class ClientApp extends Component {

    state = {
        count: 0,
        audioContext: null,
      media: media_object,
        kicked: false,
        audio_devices: [],
        video_devices: [],
        audio_device: "",
        video_device: "",
        video_setting: {width: 640, height: 360, fps: 30},
        audio: null,
        video: null,
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
    log.info(" :: Version :: ", version);
    user.role = getUserRole();
    user.isClient = true;
    if (user.role !== null) {
      //this.setState({user});
      this.initApp(user);
    } else {
      alert("Access denied!");
      kc.logout();
      updateSentryUser(null);
    }
  };

  initApp = (user) => {
    //JanusStream.setUser(user);
    //initCrisp(user, this.props.i18n.language);

    this.initMQTT(user);

    // Clients not authorized to app may see shidur only
    if (user.role !== userRolesEnum.user) {
      return;
    }

    const {t} = this.props;
    localStorage.setItem("question", false);
    localStorage.setItem("sound_test", false);
    localStorage.setItem("uuid", user.id);
    checkNotification();

    let system = navigator.userAgent;
    user.system = system;
    user.extra = {};

    let browser = platform.parse(system);
    if (!/Safari|Firefox|Chrome/.test(browser.name)) {
      alert(t("oldClient.browserNotSupported"));
      return;
    }

    geoInfo(`${GEO_IP_INFO}`, (data) => {
      user.ip = data && data.ip ? data.ip : "127.0.0.1";
      user.country = data && data.country ? data.country : "XX";

      this.setState({user});
      updateSentryUser(user);

      api.fetchConfig().then((data) => {
        log.debug("[client] got config: ", data);
        ConfigStore.setGlobalConfig(data);
        const premodStatus = ConfigStore.dynamicConfig(ConfigStore.PRE_MODERATION_KEY) === "true";
        this.setState({premodStatus});
        GxyJanus.setGlobalConfig(data);
      }).then(() => {
        api.fetchAvailableRooms({with_num_users: true}).then(data => {
          const {rooms} = data;
          this.setState({rooms});
          this.initDevices();
          const {selected_room} = this.state;
          if (selected_room !== "") {
            const room = rooms.find((r) => r.room === selected_room);
            if (room) {
              user.room = selected_room;
              user.janus = room.janus;
              user.group = room.description;
              this.setState({delay: false, user});
              updateSentryUser(user);
            } else {
              this.setState({selected_room: "", delay: false});
            }
          } else {
            this.setState({delay: false});
          }
        }).catch((err) => {
          log.error("[client] error initializing app", err);
          this.setState({appInitError: err});
        });
      })
    });
  };

  initMQTT = (user) => {
    mqtt.init(user, (reconnected, error) => {
      if (error) {
        log.info("[client] MQTT disconnected");
        this.setState({mqttOn: false});
        window.location.reload();
        alert("- Lost Connection to Arvut System -");
      } else if (reconnected) {
        this.setState({mqttOn: true});
        log.info("[client] MQTT reconnected");
      } else {
        this.setState({mqttOn: true});

        mqtt.join("galaxy/users/notification");
        mqtt.join("galaxy/users/broadcast");
        mqtt.join("galaxy/users/" + user.id);

        mqtt.watch((message) => {
          this.handleCmdData(message);
        });

        // Public chat
        mqtt.mq.on("MqttChatEvent", (data) => {
          let json = JSON.parse(data);
          if (json?.type === "client-chat") {
            this.chat.onChatMessage(json);
          }
        });

        // Private chat
        mqtt.mq.on("MqttPrivateMessage", (data) => {
          let message = JSON.parse(data);
          if (message?.type === "client-chat") {
            notifyMe("Arvut System", message.text, true);
          }
          //TODO: Make private dialog exchange
        });

        // Broadcast message
        mqtt.mq.on("MqttBroadcastMessage", (data) => {
          let message = JSON.parse(data);
          if (message?.type === "client-chat") {
            message.time = getDateString();
            notifyMe("Arvut System", message.text, true);
          } else {
            this.handleCmdData(message);
          }
        });

        // Notification message
        mqtt.mq.on("MqttNotificationMessage", (data) => {
          let message = JSON.parse(data);
          if(message?.type === "broadcast-message" && user.role === userRolesEnum.user) {
            const readed = localStorage.getItem("msg_id");
            if(readed !== message.id) {
              localStorage.setItem("msg_id" , message.id);
              this.setState({broadcast_message: message.text, show_message: true})
            }
          }
        });

        // Clients not authorized to app may see shidur only
        if (user.role !== userRolesEnum.user) {
          localStorage.setItem("room", "-1");
          this.setState({user});
          JanusStream.initStreaming( "str1");
        }
      }
    });
  };

  initDevices = () => {
    const {t} = this.props;

    devices.init((media) => {
      setTimeout(() => {
        if (media.audio.device) {
          this.setAudioDevice(media.audio.device);
        } else {
          log.warn("[client] No left audio devices");
          //FIXME: remove it from pc?
        }
        if (!media.video.device) {
          log.warn("[client] No left video devices");
          //FIXME: remove it from pc?
        }
      }, 1000);
    }).then((data) => {
      log.info("[client] init devices: ", data);
      const {audio, video} = data;
      if (audio.error && video.error) {
        alert(t("oldClient.noInputDevices"));
        this.setState({cammuted: true});
      } else if (audio.error) {
        alert("audio device not detected");
      } else if (video.error) {
        alert(t("oldClient.videoNotDetected"));
        this.setState({cammuted: true});
      }

      if (video.stream) {
        let myvideo = this.refs.localVideo;
        if (myvideo) myvideo.srcObject = video.stream;
      }

      const localVideoTrack = video?.stream ? video.stream?.getVideoTracks()[0] : null;
      const localAudioTrack = audio?.stream ? audio.stream?.getAudioTracks()[0] : null;

      this.setState({media: data, localVideoTrack, localAudioTrack});
    });
  };

  setVideoSize = (setting) => {
    devices.setVideoSize(setting).then((media) => {
      if (media.video.stream) {
        let myvideo = this.refs.localVideo;
        myvideo.srcObject = media.video.stream;
        this.setState({media, localVideoTrack: media.video.stream.getVideoTracks()[0]});
      }
    });
  };

  setVideoDevice = (device) => {
    return devices.setVideoDevice(device).then((media) => {
      if (media.video.device) {
        let myvideo = this.refs.localVideo;
        myvideo.srcObject = media.video.stream;
        this.setState({media, localVideoTrack: media.video.stream.getVideoTracks()[0]});
      }
    });
  };

  setAudioDevice = (device, cam_mute) => {
    devices.setAudioDevice(device, cam_mute).then((media) => {
      if (media.audio.device) {
        this.setState({media, localAudioTrack: media.audio.stream.getAudioTracks()[0]});
        const {videoroom} = this.state;
        if (videoroom) {
          media.audio.stream.getAudioTracks()[0].enabled = false;
          videoroom.audio(media.audio.stream);
        }
      }
    });
  };

    selfTest = () => {
        this.setState({selftest: "Recording... 9"});
        testMic(this.state.media.audio.stream);

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
        if(this.state.protocol)
            this.state.protocol.detach();
        if(this.state.kicked) {
            client.signoutRedirect();
            return
        }
        this.state.janus.attach({
            plugin: "janus.plugin.videoroom",
            opaqueId: "videoroom_user",
            success: (videoroom) => {
                Janus.log(" :: My handle: ", videoroom);
                Janus.log("Plugin attached! (" + videoroom.getPlugin() + ", id=" + videoroom.getId() + ")");
                Janus.log("  -- This is a publisher/manager");
                let {user} = this.state;
                user.handle = videoroom.getId();
                this.setState({videoroom, user, protocol: null});
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
                if(!this.state.mystream)
                    this.setState({mystream: track});
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
            } else if(event === "event") {
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.debug(list);
                } else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                    let unpublished = msg["unpublished"];
                    Janus.log("Publisher left: " + unpublished);
                    if(unpublished === 'ok') {
                        // That's us
                        videoroom.hangup();
                        return;
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
            } else if(type === "client-kicked" && user.id === id) {
                this.setState({kicked: true}, () => {
                    this.exitRoom();
                });
            } else if(type === "client-question" && user.id === id) {
                this.handleQuestion();
            } else if(type === "client-mute" && user.id === id) {
                this.micMute();
            } else if(type === "sound_test" && user.id === id) {
                let {user} = this.state;
                user.sound_test = true;
                localStorage.setItem("sound_test", true);
                this.setState({user});
            }
        });
    };

    exitRoom = (reconnect) => {
        let {videoroom,protocol} = this.state;
        let leave = {request : "leave"};
        videoroom.send({"message": leave});
        localStorage.setItem("question", false);
        this.setState({muted: false, mystream: null, room: "", i: "", feeds: [], question: false});
        this.chat.exitChatRoom(GROUPS_ROOM);
        let pl = {textroom : "leave", transaction: Janus.randomString(12),"room": PROTOCOL_ROOM};
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
        this.setState({question: !question});
    };

    micMute = () => {
        let {videoroom, muted} = this.state;
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

      const {audio,user, media ,video_device,audio_device,muted,mystream,room,count,question,selftest,tested,progress,geoinfo} = this.state;
      const width = "134";
      const height = "100";
      const autoPlay = true;
      const controls = false;
      const talk = false;

      let adevices_list = media.audio.devices.map((device,i) => {
          const {label, deviceId} = device;
          return ({ key: i, text: label, value: deviceId})
      });

      let vdevices_list = media.video.devices.map((device,i) => {
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
                      <Menu.Item disabled={!audio || video_device === null || !geoinfo || !mystream} onClick={this.handleQuestion}>
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
                                      error={!media.audio.device}
                                      placeholder="Select Device:"
                                      value={media.audio.device}
                                      options={adevices_list}
                                      onChange={(e, {value}) => this.setAudioDevice(value)}/>
                              <Select className='select_device'
                                      disabled={mystream}
                                      error={!media.video.device}
                                      placeholder="Select Device:"
                                      value={media.video.device}
                                      options={vdevices_list}
                                      onChange={(e, {value}) => this.setVideoDevice(value)} />
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
                  <ClientChat
                      ref={chat => {this.chat = chat;}}
                      visible={this.state.visible}
                      janus={this.state.janus}
                      room={room}
                      user={this.state.user}
                      onNewMsg={this.onNewMsg} />
              </div>
          </div>
      );

      return (
          <div>
              {user ? content : login}
          </div>
      )
  }
}

export default ClientApp;

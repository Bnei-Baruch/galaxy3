import React, {Component, Fragment} from "react";
import {Janus} from "../../lib/janus";
import classNames from "classnames";
import {isMobile} from "react-device-detect";
import {Icon, Popup} from "semantic-ui-react";
import {
  checkNotification,
  geoInfo,
  getDateString,
  initJanus,
  notifyMe,
  sendUserState,
  testMic,
  updateGxyUser,
} from "../../shared/tools";
import "./VirtualClient.scss";
import "./VideoConteiner.scss";
import "./CustomIcons.scss";
import "eqcss";
import VirtualChat from "./VirtualChat";
import {NO_VIDEO_OPTION_VALUE, sketchesByLang, VIDEO_360P_OPTION_VALUE} from "../../shared/consts";
import {APP_JANUS_SRV_STR, APP_STUN_SRV_STR, GEO_IP_INFO, PAY_USER_FEE} from "../../shared/env";
import platform from "platform";
import {TopMenu} from "./components/TopMenu";
import {withTranslation} from "react-i18next";
import {
  LINK_STATE_GOOD,
  LINK_STATE_INIT,
  LINK_STATE_MEDIUM,
  LINK_STATE_WEAK,
  MonitoringData,
} from "../../shared/MonitoringData";
import api from "../../shared/Api";
import VirtualStreaming from "./VirtualStreaming";
import VirtualStreamingJanus from "../../shared/VirtualStreamingJanus";
import {getUser, kc} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";
import {captureMessage, updateSentryUser} from "../../shared/sentry";
import GxyJanus from "../../shared/janus-utils";
import ConfigStore from "../../shared/ConfigStore";
import {isFullScreen, toggleFullScreen} from "./FullScreenHelper";
import {AppBar, Badge, Box, Button as ButtonMD, ButtonGroup, Grid, IconButton} from "@mui/material";
import {ChevronLeft, ChevronRight, PlayCircleOutline} from "@mui/icons-material";
import {grey} from "@mui/material/colors";
import {AskQuestion, AudioMode, CloseBroadcast, Fullscreen, Layout, Mute, MuteVideo, Vote} from "./buttons";
import Settings from "./settings/Settings";
import SettingsJoined from "./settings/SettingsJoined";
import HomerLimud from "./components/HomerLimud";
import {initCrisp, Support} from "./components/Support";
import SendQuestionContainer from "./components/SendQuestions/container";
import {RegistrationModals} from "./components/RegistrationModals";
import {getUserRole, userRolesEnum} from "../../shared/enums";
import KliOlamiStream from "./components/KliOlamiStream";
import KliOlamiToggle from "./buttons/KliOlamiToggle";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import withTheme from "@mui/styles/withTheme";
import ThemeSwitcher from "./components/ThemeSwitcher/ThemeSwitcher";
import mqtt from "../../shared/mqtt";
import devices from "../../lib/devices";
import log from "loglevel";
import Donations from "./buttons/Donations";
//import {iceRestart as iceRestartKliOlami} from "./components/KliOlamiStreamHelper";

const sortAndFilterFeeds = (feeds) =>
  feeds
    .filter((feed) => !feed.display.role.match(/^(ghost|guest)$/))
    .sort((a, b) => a.display.timestamp - b.display.timestamp);

const userFeeds = (feeds) => feeds.filter((feed) => feed.display.role === userRolesEnum.user);

class VirtualHttpClient extends Component {
  state = {
    chatMessagesCount: 0,
    creatingFeed: false,
    delay: true,
    media: {
      audio: {
        context: null,
        device: null,
        devices: [],
        error: null,
        stream: null,
      },
      video: {
        setting: {width: 320, height: 180, ideal: 15},
        device: null,
        devices: [],
        error: null,
        stream: null,
      },
    },
    audio: null,
    video: null,
    janus: null,
    feeds: [],
    rooms: [],
    room: "",
    selected_room: parseInt(localStorage.getItem("room"), 10) || "",
    videoroom: null,
    remoteFeed: null,
    myid: null,
    mypvtid: null,
    mystream: null,
    localVideoTrack: null,
    localAudioTrack: null,
    mids: [],
    muted: false,
    cammuted: false,
    shidur: true,
    protocol: null,
    user: null,
    chatVisible: false,
    question: false,
    selftest: this.props.t("oldClient.selfAudioTest"),
    tested: false,
    support: false,
    monitoringData: new MonitoringData(),
    connectionStatus: "",
    numberOfVirtualUsers: localStorage.getItem("number_of_virtual_users") || "1",
    currentLayout: localStorage.getItem("currentLayout") || "split",
    attachedSource: true,
    sourceLoading: true,
    virtualStreamingJanus: new VirtualStreamingJanus(() => this.virtualStreamingInitialized()),
    appInitError: null,
    upval: null,
    net_status: 1,
    keepalive: null,
    muteOtherCams: false,
    videos: Number(localStorage.getItem("vrt_video")) || 1,
    premodStatus: false,
    asideMsgCounter: {drawing: 0, chat: 0},
    leftAsideSize: 3,
    shidurForGuestReady: false,
    kliOlamiAttached: true,
    isKliOlamiShown: true,
    audios: {audios: Number(localStorage.getItem("vrt_lang")) || 2},
    msg_protocol: "mqtt",
    mqttOn: false,
    isGroup: false,
  };

  virtualStreamingInitialized() {
    this.setState({sourceLoading: false});
  }

  componentDidUpdate(prevProps, prevState) {
    const {
      shidurForGuestReady,
      shidur,
      sourceLoading,
      room,
      virtualStreamingJanus,
      videoroom,
      localVideoTrack,
      localAudioTrack,
      user,
      monitoringData,
    } = this.state;

    if (shidur && !prevState.shidur && !sourceLoading && room) {
      virtualStreamingJanus.unmuteAudioElement();
    }

    if (!sourceLoading && prevState.sourceLoading && shidur && room) {
      virtualStreamingJanus.unmuteAudioElement();
    }

    if (room && !prevState.room && shidur && !sourceLoading) {
      virtualStreamingJanus.unmuteAudioElement();
    }

    if (
      (!sourceLoading && shidurForGuestReady && !prevState.shidurForGuestReady) ||
      (shidurForGuestReady && !sourceLoading && prevState.sourceLoading)
    ) {
      virtualStreamingJanus.setVideo(this.state.videos);
      virtualStreamingJanus.audioElement.play();
      virtualStreamingJanus.unmuteAudioElement();
    }

    if (
      videoroom !== prevState.videoroom ||
      localVideoTrack !== prevState.localVideoTrack ||
      localAudioTrack !== prevState.localAudioTrack ||
      JSON.stringify(user) !== JSON.stringify(prevState.user)
    ) {
      monitoringData.setConnection(videoroom, localAudioTrack, localVideoTrack, user, virtualStreamingJanus);
      monitoringData.setOnStatus((connectionStatus) => {
        this.setState({connectionStatus});
      });
    }
  }

  componentDidMount() {
    if (isMobile) {
      window.location = "/userm";
    }
  }

  checkPermission = (user) => {
    user.role = getUserRole();

    if (user.role !== null) {
      this.initApp(user);
    } else {
      alert("Access denied!");
      kc.logout();
      updateSentryUser(null);
    }
  };

  initApp = (user) => {
    initCrisp(user, this.props.i18n.language);

    this.initMQTT(user);

    //Clients not authorized to app may see shidur only
    if (user.role !== userRolesEnum.user) {
      const config = {
        gateways: {
          streaming: {
            str: {
              name: "str",
              url: APP_JANUS_SRV_STR,
              type: "streaming",
              token: "",
            },
          },
        },
        ice_servers: {streaming: [APP_STUN_SRV_STR]},
        dynamic_config: {galaxy_premod: "false"},
        last_modified: new Date().toISOString(),
      };
      ConfigStore.setGlobalConfig(config);
      GxyJanus.setGlobalConfig(config);
      localStorage.setItem("room", "-1");
      this.state.virtualStreamingJanus.init(user);
      this.setState({user, sourceLoading: true});
      return;
    }

    const {t} = this.props;
    localStorage.setItem("question", false);
    localStorage.setItem("sound_test", false);
    localStorage.setItem("uuid", user.id);
    checkNotification();
    let system = navigator.userAgent;
    user.system = system;
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

      api
        .fetchConfig()
        .then((data) => {
          ConfigStore.setGlobalConfig(data);
          this.setState({
            premodStatus: ConfigStore.dynamicConfig(ConfigStore.PRE_MODERATION_KEY) === "true",
            msg_protocol: ConfigStore.dynamicConfig("galaxy_protocol"),
          });
          GxyJanus.setGlobalConfig(data);
        })
        .then(() => api.fetchAvailableRooms({with_num_users: true}))
        .then((data) => {
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
        })
        .catch((err) => {
          console.error("[User] error initializing app", err);
          this.setState({appInitError: err});
        });
    });
  };

  initMQTT = (user) => {
    mqtt.init(user, (reconnected, error) => {
      if (error) {
        console.log("MQTT disconnected");
        this.setState({mqttOn: false});
        //notifyMe("Arvut System", "MQTT Offline", true);
        if (this.state.question) {
          this.handleQuestion();
        }
      } else if (reconnected) {
        //notifyMe("Arvut System", "MQTT Online", true);
        this.setState({mqttOn: true});
        console.log("MQTT reconnected");
      } else {
        this.setState({mqttOn: true});
        console.log("[mqtt] connected");
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
      }
    });
  };

  initClient = (reconnect, retry = 0) => {
    this.setState({delay: true});
    const user = Object.assign({}, this.state.user);
    const {t} = this.props;
    if (this.state.janus) {
      this.state.janus.destroy();
    }

    const config = GxyJanus.instanceConfig(user.janus);
    initJanus(
      (janus) => {
        // Check if unified plan supported
        if (Janus.unifiedPlan) {
          user.session = janus.getSessionId();
          this.setState({janus});
          this.initVideoRoom(reconnect, user);
        } else {
          alert(t("oldClient.unifiedPlanNotSupported"));
        }
      },
      (err) => {
        this.exitRoom(/* reconnect= */ true, () => {
          console.error("[User] error initializing janus", err);
          this.reinitClient(retry);
        });
      },
      config.url,
      config.token,
      config.iceServers
    );

    if (!reconnect) {
      this.state.virtualStreamingJanus.init(user.ip, user.country);
    }
  };

  reinitClient = (retry) => {
    retry++;
    console.error("[User] reinitializing try: ", retry);
    if (retry < 10) {
      setTimeout(() => {
        this.initClient(/* reconnect= */ true, retry);
      }, 5000);
    } else {
      this.exitRoom(/* reconnect= */ false, () => {
        console.error("[User] reinitializing failed after: " + retry + " retries");
        alert(this.props.t("oldClient.networkSettingsChanged"));
      });
    }
  };

  initDevices = () => {
    const {t} = this.props;

    devices
      .init((media) => {
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
      })
      .then((data) => {
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

        this.setState({media: data});
      });
  };

  setVideoSize = (setting) => {
    devices.setVideoSize(setting).then((media) => {
      if (media.video.stream) {
        let myvideo = this.refs.localVideo;
        myvideo.srcObject = media.video.stream;
        this.setState({media});
      }
    });
  };

  setVideoDevice = (device) => {
    return devices.setVideoDevice(device).then((media) => {
      if (media.video.device) {
        let myvideo = this.refs.localVideo;
        myvideo.srcObject = media.video.stream;
        this.setState({media});
      }
    });
  };

  setAudioDevice = (device, cam_mute) => {
    devices.setAudioDevice(device, cam_mute).then((media) => {
      if (media.audio.device) {
        this.setState({media});
      }
    });
  };

  selfTest = () => {
    const {t} = this.props;
    this.setState({selftest: t("oldClient.recording") + 9});
    testMic(this.state.media.audio.stream);
    let rect = 9;
    let rec = setInterval(() => {
      rect--;
      this.setState({selftest: t("oldClient.recording") + rect});
      if (rect <= 0) {
        clearInterval(rec);
        let playt = 11;
        let play = setInterval(() => {
          playt--;
          this.setState({selftest: t("oldClient.playing") + playt});
          if (playt <= 0) {
            clearInterval(play);
            this.setState({selftest: t("oldClient.selfAudioTest"), tested: true});
          }
        }, 1000);
      }
    }, 1000);
  };

  selectRoom = (selected_room) => {
    const {rooms} = this.state;
    const user = Object.assign({}, this.state.user);
    const room = rooms.find((r) => r.room === selected_room);
    const name = room.description;
    if (this.state.room === selected_room) {
      return;
    }
    localStorage.setItem("room", selected_room);
    user.room = selected_room;
    user.group = name;
    user.janus = room.janus;
    this.setState({selected_room, user});
    updateSentryUser(user);
  };

  iceState = () => {
    let {
      user: {system},
    } = this.state;
    //let browser = platform.parse(system);
    let count = 0;
    let chk = setInterval(() => {
      count++;
      //console.debug("ICE counter: ", count);
      let {ice} = this.state;
      if (count < 60 && ice.match(/^(connected|completed)$/)) {
        clearInterval(chk);
      }
      // if (browser.name.match(/^(Safari|Firefox)$/) && count === 10) {
      //   console.log(" :: ICE Restart :: ");
      //   this.iceRestart();
      // }
      // if (browser.name === "Chrome" && count === 10) {
      //   console.log(" :: ICE Restart :: ");
      //   this.iceRestart();
      // }
      if (count >= 60) {
        clearInterval(chk);
        console.log(" :: ICE Filed: Reconnecting... ");
        this.exitRoom(/* reconnect= */ true, () => {
          console.error("ICE Disconnected");
          this.initClient(/* reconnect= */ true);
        });
      }
    }, 1000);
  };

  mediaState = (media) => {
    const {t} = this.props;
    // Handle video
    if (media === "video") return;

    //Handle audio
    if (media === "audio") {
      let count = 0;
      let chk = setInterval(() => {
        count++;
        let {audio, video, ice, question} = this.state;

        // Audio is back stop counter
        if (count < 11 && audio) {
          clearInterval(chk);
        }

        // Network problem handled in iceState
        if (count < 11 && ice === "disconnected") {
          clearInterval(chk);
        }

        // The problem with both devices, leave resolve it in video loop
        if (count < 11 && !audio && !video) {
          clearInterval(chk);
        }

        // Audio still not back
        if (count >= 10 && !audio && video) {
          clearInterval(chk);
          if (question) {
            this.handleQuestion();
          }
          alert(t("oldClient.serverStoppedReceiveOurAudio"));
        }
      }, 3000);
    }
  };

  initVideoRoom = (reconnect, user) => {
    this.state.janus.attach({
      plugin: "janus.plugin.videoroom",
      opaqueId: user.id,
      success: (videoroom) => {
        Janus.log(" :: My handle: ", videoroom);
        Janus.log("Plugin attached! (" + videoroom.getPlugin() + ", id=" + videoroom.getId() + ")");
        Janus.log("  -- This is a publisher/manager");
        user.handle = videoroom.getId(); // User state updated in this.joinRoom.
        this.setState({videoroom});
        this.joinRoom(reconnect, videoroom, user);
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
        this.state.monitoringData.onIceState(state);
        if (state === "disconnected") {
          // Chrome: iceconnectionstate does not go to failed if connection drops - https://bugs.chromium.org/p/chromium/issues/detail?id=982793
          // Safari/Firefox ice restart may be triggered on state: failed as in example - https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/restartIce
          this.iceState();
        }
      },
      mediaState: (media, on) => {
        Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + media);
        this.setState({[media]: on});
        if (!on) {
          this.mediaState(media);
        }
      },
      webrtcState: (on) => {
        Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
      },
      slowLink: (uplink, lost, mid) => {
        const slowLinkType = uplink ? "sending" : "receiving";
        Janus.log("Janus reports problems " + slowLinkType + " packets on mid " + mid + " (" + lost + " lost packets)");
        this.state.monitoringData.onSlowLink(slowLinkType, lost);
      },
      onmessage: (msg, jsep) => {
        this.onMessage(this.state.videoroom, msg, jsep, false);
      },
      onlocaltrack: (track, on) => {
        Janus.log(" ::: Got a local track event :::");
        Janus.log("Local track " + (on ? "added" : "removed") + ":", track);
        let {videoroom} = this.state;
        videoroom.muteAudio();
        if (track && track.kind) {
          if (track.kind === "video") {
            const localVideoTrack = on ? track : null;
            this.setState({localVideoTrack});
          }
          if (track.kind === "audio") {
            const localAudioTrack = on ? track : null;
            this.setState({localAudioTrack});
          }
        }
      },
      onremotestream: (stream) => {
        // The publisher stream is sendonly, we don't expect anything here
        Janus.warn("Send only publisher stream, if this happends, it is not expected, stream:", stream);
      },
      ondataopen: (label) => {
        Janus.log("Publisher - DataChannel is available! (" + label + ")");
      },
      ondata: (data, label) => {
        Janus.log("Publisher - Got data from the DataChannel! (" + label + ")" + data);
      },
      ondataerror: (error) => {
        Janus.warn("Publisher - DataChannel error: " + error);
      },
      oncleanup: () => {
        Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
      },
    });
  };

  joinRoom = (reconnect, videoroom, user) => {
    let {selected_room, tested, media, cammuted} = this.state;
    const {
      video: {device},
    } = media;
    user.camera = !!device && cammuted === false;
    user.self_test = tested;
    user.sound_test = reconnect ? JSON.parse(localStorage.getItem("sound_test")) : false;
    user.question = false;
    user.timestamp = Date.now();
    this.setState({user, muted: true});

    updateSentryUser(user);

    const {id, timestamp, role, username} = user;
    const d = {id, timestamp, role, display: username};
    const register = {request: "join", room: selected_room, ptype: "publisher", display: JSON.stringify(d)};
    videoroom.send({
      message: register,
      success: () => {
        console.log("Request join success");
      },
      error: (error) => {
        console.error(error);
        this.exitRoom(/* reconnect= */ false);
      },
    });
  };

  setBitrate = (bitrate) => {
    this.setState({bitrate});
    this.state.videoroom.send({"message": { "request": "configure", "bitrate": bitrate }});
  };

  exitRoom = (reconnect, callback, error) => {
    this.setState({delay: true});

    clearInterval(this.state.upval);
    this.clearKeepAlive();

    localStorage.setItem("question", false);

    api
      .fetchAvailableRooms({with_num_users: true})
      .then((data) => {
        const {rooms} = data;
        this.setState({rooms});
      })
      .catch((err) => {
        console.error("Error exiting room", err);
      });

    let {videoroom, remoteFeed, janus, room, shidur, virtualStreamingJanus} = this.state;
    if (remoteFeed) remoteFeed.detach();
    if (videoroom) videoroom.send({message: {request: "leave", room}});

    mqtt.exit("galaxy/room/" + room);
    mqtt.exit("galaxy/room/" + room + "/chat");

    if (shidur && !reconnect) {
      virtualStreamingJanus.destroy({
        success: () => {
          console.log("Virtual streaming destroyed on exit room.");
        },
        error: (error) => {
          console.log("Error destroying VirtualStreaming on exit room", error);
        },
      });
    }
    if (!reconnect && isFullScreen()) {
      toggleFullScreen();
    }
    setTimeout(() => {
      if (videoroom) videoroom.detach();
      if (janus) janus.destroy();
      if (!reconnect) {
        this.state.virtualStreamingJanus.muteAudioElement();
      } else {
        this.state.virtualStreamingJanus.unmuteAudioElement();
      }
      this.setState({
        muted: false,
        question: false,
        feeds: [],
        mids: [],
        localAudioTrack: null,
        localVideoTrack: null,
        upval: null,
        remoteFeed: null,
        videoroom: null,
        janus: null,
        delay: reconnect,
        room: reconnect ? room : "",
        chatMessagesCount: 0,
        isSettings: false,
      });
      if (typeof callback === "function") callback();
    }, 2000);
  };

  publishOwnFeed = (useVideo, useAudio) => {
    const {
      videoroom,
      media: {video, audio},
    } = this.state;
    const offer = {audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: useVideo, data: false};

    if (useVideo) {
      const {width, height, ideal} = video.setting;
      offer.video = {width, height, frameRate: {ideal, min: 1}, deviceId: {exact: video.device}};
    }

    if (useAudio) {
      offer.audio = {noiseSuppression: true, deviceId: {exact: audio.device}};
    }

    videoroom.createOffer({
      media: offer,
      simulcast: false,
      success: (jsep) => {
        Janus.debug("Got publisher SDP!");
        Janus.debug(jsep);
        const publish = {request: "configure", audio: useAudio, video: useVideo, data: false};
        videoroom.send({message: publish, jsep: jsep});
        if (!useVideo) {
          devices.video?.stream?.getTracks().forEach((t) => t.stop());
          this.setState({cammuted: true});
        }
      },
      error: (error) => {
        Janus.error("WebRTC error:", error);
      },
    });
  };

  // iceRestart = () => {
  //   const {videoroom, remoteFeed} = this.state;
  //
  //   if (videoroom) {
  //     videoroom.createOffer({
  //       media: {audioRecv: false, videoRecv: false, audioSend: true, videoSend: true},
  //       iceRestart: true,
  //       simulcast: false,
  //       success: (jsep) => {
  //         Janus.debug("Got publisher SDP!");
  //         Janus.debug(jsep);
  //         const publish = {request: "configure", restart: true};
  //         videoroom.send({message: publish, jsep: jsep});
  //       },
  //       error: (err) => {
  //         Janus.error("WebRTC error:", err);
  //       },
  //     });
  //   }
  //
  //   if (remoteFeed) remoteFeed.send({message: {request: "configure", restart: true}});
  //   if (this.state.virtualStreamingJanus) this.state.virtualStreamingJanus.iceRestart();
  //   iceRestartKliOlami();
  // };

  onMessage = (videoroom, msg, jsep) => {
    const {t} = this.props;
    Janus.log(`::: Got a message (publisher) :::`, msg);
    const event = msg["videoroom"];
    if (event !== undefined && event !== null) {
      if (event === "joined") {
        const user = Object.assign({}, this.state.user);
        const myid = msg["id"];
        let mypvtid = msg["private_id"];
        Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);

        user.rfid = myid;
        this.setState({user, myid, mypvtid, room: msg["room"], delay: false, wipSettings: false});

        updateSentryUser(user);
        updateGxyUser(user);

        this.keepAlive();

        // Subscribe to mqtt topic
        // FIXME: Make sure here the stream is initialized
        setTimeout(() => {
          mqtt.join("galaxy/room/" + msg["room"]);
          mqtt.join("galaxy/room/" + msg["room"] + "/chat", true);
          if(this.state.isGroup) this.setBitrate(600000)
        }, 3000);

        const {
          media: {audio, video},
          cammuted,
        } = this.state;
        this.publishOwnFeed(!!video.device && !cammuted, !!audio.device);

        // Any new feed to attach to?
        if (msg["publishers"] !== undefined && msg["publishers"] !== null) {
          //FIXME: display property is JSON write now, let parse it in one place
          const feeds = sortAndFilterFeeds(msg["publishers"].filter((l) => (l.display = JSON.parse(l.display))));
          Janus.log(":: Got Pulbishers list: ", feeds);

          // Feeds count with user role
          let feeds_count = userFeeds(feeds).length;
          if (feeds_count > 25) {
            alert(t("oldClient.maxUsersInRoom"));
            this.exitRoom(/* reconnect= */ false);
          }

          Janus.debug("Got a list of available publishers/feeds:");
          Janus.log(feeds);
          this.makeSubscription(feeds);
        }
      } else if (event === "talking") {
        const feeds = Object.assign([], this.state.feeds);
        const id = msg["id"];
        Janus.log("User: " + id + " - start talking");
        for (let i = 0; i < feeds.length; i++) {
          if (feeds[i] && feeds[i].id === id) {
            feeds[i].talking = true;
          }
        }
        this.setState({feeds});
      } else if (event === "stopped-talking") {
        const feeds = Object.assign([], this.state.feeds);
        const id = msg["id"];
        Janus.log("User: " + id + " - stop talking");
        for (let i = 0; i < feeds.length; i++) {
          if (feeds[i] && feeds[i].id === id) {
            feeds[i].talking = false;
          }
        }
        this.setState({feeds});
      } else if (event === "destroyed") {
        // The room has been destroyed
        Janus.warn("The room has been destroyed!");
      } else if (event === "event") {
        if (msg["configured"] === "ok") {
          // User published own feed successfully.
          const user = {
            ...this.state.user,
            extra: {
              ...(this.state.user.extra || {}),
              streams: msg.streams,
              isGroup: this.state.isGroup,
            },
          };
          const vst = msg.streams.find((v) => v.type === "video" && v.h264_profile);
          if(vst && vst?.h264_profile !== "42e01f") {
            captureMessage("h264_profile", vst);
          }
          this.setState({user});
          if (this.state.muteOtherCams) {
            this.setState({videos: NO_VIDEO_OPTION_VALUE});
            this.state.virtualStreamingJanus.setVideo(NO_VIDEO_OPTION_VALUE);
          }
        } else if (msg["publishers"] !== undefined && msg["publishers"] !== null) {
          // User just joined the room.
          const feeds = sortAndFilterFeeds(msg["publishers"].filter((l) => (l.display = JSON.parse(l.display))));
          Janus.debug("New list of available publishers/feeds:", this.state.feeds, feeds);
          this.makeSubscription(feeds);
        } else if (msg["leaving"] !== undefined && msg["leaving"] !== null) {
          // One of the publishers has gone away?
          const leaving = msg["leaving"];
          Janus.log("Publisher left: " + leaving);
          this.unsubscribeFrom([leaving], /* onlyVideo= */ false);
        } else if (msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
          const unpublished = msg["unpublished"];
          Janus.log("Publisher left: " + unpublished);
          if (unpublished === "ok") {
            // That's us
            videoroom.hangup();
            return;
          }
          this.unsubscribeFrom([unpublished], /* onlyVideo= */ false);
        } else if (msg["error"] !== undefined && msg["error"] !== null) {
          if (msg["error_code"] === 426) {
            Janus.log("This is a no such room");
          } else {
            Janus.log(msg["error"]);
          }
        }
      }
    }
    if (jsep !== undefined && jsep !== null) {
      Janus.debug("Handling SDP as well...");
      Janus.debug(jsep);
      videoroom.handleRemoteJsep({jsep: jsep});
    }
  };

  newRemoteFeed = (subscription) => {
    this.state.janus.attach({
      plugin: "janus.plugin.videoroom",
      opaqueId: "remotefeed_user",
      success: (pluginHandle) => {
        const remoteFeed = pluginHandle;
        Janus.log(
          `2 Plugin attached! (${remoteFeed.getPlugin()}, id=${remoteFeed.getId()}). -- This is a multistream subscriber ${remoteFeed}`
        );
        this.setState({remoteFeed, creatingFeed: false});
        // We wait for the plugin to send us an offer
        const subscribe = {request: "join", room: this.state.room, ptype: "subscriber", streams: subscription};
        remoteFeed.send({message: subscribe});
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
        Janus.warn(
          "Janus reports problems " +
            (uplink ? "sending" : "receiving") +
            " packets on this PeerConnection (remote feed, " +
            nacks +
            " NACKs/s " +
            (uplink ? "received" : "sent") +
            ")"
        );
      },
      onmessage: (msg, jsep) => {
        const event = msg["videoroom"];
        Janus.log(`::: Got a message (subscriber) ::: Event: ${event} Msg: `, msg);
        if (msg["error"] !== undefined && msg["error"] !== null) {
          Janus.debug("-- ERROR: " + msg["error"]);
        } else if (event !== undefined && event !== null) {
          if (event === "attached") {
            this.setState({creatingFeed: false});
            Janus.log("Successfully attached to feed in room " + msg["room"]);
          } else if (event === "event") {
            // Check if we got an event on a simulcast-related event from this publisher
          } else {
            // What has just happened?
          }
        }
        if (msg["streams"]) {
          // Update map of subscriptions by mid
          const mids = Object.assign([], this.state.mids);
          for (let i in msg["streams"]) {
            let mindex = msg["streams"][i]["mid"];
            //let feed_id = msg["streams"][i]["feed_id"];
            mids[mindex] = msg["streams"][i];
          }
          this.setState({mids});
        }
        if (jsep !== undefined && jsep !== null) {
          const {remoteFeed} = this.state;
          Janus.debug("Handling SDP as well...");
          Janus.debug(jsep);
          // Answer and attach
          remoteFeed.createAnswer({
            jsep: jsep,
            // Add data:true here if you want to subscribe to datachannels as well
            // (obviously only works if the publisher offered them in the first place)
            media: {audioSend: false, videoSend: false, data: false}, // We want recvonly audio/video
            success: (jsep) => {
              Janus.debug("Got SDP!");
              Janus.debug(jsep);
              let body = {request: "start", room: this.state.room};
              remoteFeed.send({message: body, jsep: jsep});
            },
            error: (error) => {
              Janus.error("WebRTC error:", error);
              Janus.debug("WebRTC error... " + JSON.stringify(error));
            },
          });
        }
      },
      onlocaltrack: (track, on) => {
        // The subscriber stream is recvonly, we don't expect anything here
      },
      onremotetrack: (track, mid, on) => {
        Janus.log(" ::: Got a remote track event ::: (remote feed)");
        if (!mid) {
          mid = track.id.split("janus")[1];
        }
        Janus.log("Remote track (mid=" + mid + ") " + (on ? "added" : "removed") + ":", track);
        // Which publisher are we getting on this mid?
        let {mids} = this.state;
        let feed = mids[mid].feed_id;
        Janus.log(" >> This track is coming from feed " + feed + ":", mid);
        if (on) {
          // If we're here, a new track was added
          if (track.kind === "audio") {
            // New audio track: create a stream out of it, and use a hidden <audio> element
            let stream = new MediaStream();
            stream.addTrack(track.clone());
            Janus.log("Created remote audio stream:", stream);
            let remoteaudio = this.refs["remoteAudio" + feed];
            Janus.attachMediaStream(remoteaudio, stream);
          } else if (track.kind === "video" && !track.muted) {
            const remotevideo = this.refs["remoteVideo" + feed];
            // New video track: create a stream out of it
            const stream = new MediaStream();
            stream.addTrack(track.clone());
            Janus.log("Created remote video stream:", stream);
            Janus.attachMediaStream(remotevideo, stream);
          }
        }
      },
      ondataopen: (label) => {
        Janus.log("Feed - DataChannel is available! (" + label + ")");
      },
      ondata: (data, label) => {
        Janus.debug("Feed - Got data from the DataChannel! (" + label + ")" + data);
      },
      ondataerror: (error) => {
        Janus.warn("Feed - DataChannel error: " + error);
      },
      oncleanup: () => {
        Janus.log(" ::: Got a cleanup notification (remote feed) :::");
      },
    });
  };

  // Subscribe to feeds, whether already existing in the room, when I joined
  // or new feeds that join the room when I'm already in. In both cases I
  // should add those feeds to my feeds list.
  // In case of feeds just joined and |question| is set, we should notify the
  // new entering user by notifying everyone.
  // Subscribes selectively to different stream types |subscribeToVideo|, |subscribeToAudio|, |subscribeToData|.
  // This is required to stop and then start only the videos to save bandwidth.
  makeSubscription = (newFeeds) => {
    console.log("makeSubscription", newFeeds);
    const subscription = [];
    const {feeds: prevFeeds, muteOtherCams} = this.state;
    const prevFeedsMap = new Map(prevFeeds.map((f) => [f.id, f]));

    newFeeds.forEach((feed) => {
      const {id, streams} = feed;
      const vst = streams.find((v) => v.type === "video" && v.h264_profile);
      if(vst) {
        feed.video = vst.h264_profile === "42e01f";
      } else {
        feed.video = !!streams.find((v) => v.type === "video" && v.codec === "h264");
      }
      feed.audio = !!streams.find((a) => a.type === "audio" && a.codec === "opus");
      feed.data = !!streams.find((d) => d.type === "data");
      feed.cammute = !feed.video;

      const prevFeed = prevFeedsMap.get(feed.id);
      const prevVideo = !!prevFeed && prevFeed.streams?.find((v) => v.type === "video" && v.codec === "h264");
      const prevAudio = !!prevFeed && prevFeed.streams?.find((a) => a.type === "audio" && a.codec === "opus");

      streams.forEach((stream) => {
        let hasVideo = !muteOtherCams && stream.type === "video" && stream.codec === "h264" && !prevVideo;
        const hasAudio = stream.type === "audio" && stream.codec === "opus" && !prevAudio;
        if(stream?.h264_profile && stream?.h264_profile !== "42e01f") {
          hasVideo = false;
        }

        if (hasVideo || hasAudio || stream.type === "data") {
          prevFeedsMap.set(feed.id, feed);
          subscription.push({feed: id, mid: stream.mid});
        }
      });
    });
    const feeds = Array.from(prevFeedsMap, ([k, v]) => v);
    this.setState({feeds: sortAndFilterFeeds(feeds)});
    if (subscription.length > 0) {
      this.subscribeTo(subscription);
      // Send question event for new feed, by notifying all room.
      // FIXME: Can this be done by notifying only the joined feed?
      setTimeout(() => {
        if (this.state.question || this.state.cammuted) {
          sendUserState(this.state.user);
        }
      }, 3000);
    }
  };

  makeSubscriptionAudioMode = () => {
    const subscription = [];
    const {feeds} = this.state;

    feeds.forEach(({id, streams}) => {
      streams
        .filter((s) => s.type === "video" && s.codec === "h264")
        .forEach((s) => subscription.push({feed: id, mid: s.mid}));
    });

    if (subscription.length > 0) this.subscribeTo(subscription);
  };

  subscribeTo = (subscription) => {
    // New feeds are available, do we need create a new plugin handle first?
    if (this.state.remoteFeed) {
      this.state.remoteFeed.send({
        message: {request: "subscribe", streams: subscription},
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

  // Unsubscribe from feeds defined by |ids| (with all streams) and remove it when |onlyVideo| is false.
  // If |onlyVideo| is true, will unsubscribe only from video stream of those specific feeds, keeping those feeds.
  unsubscribeFrom = (ids, onlyVideo) => {
    const {feeds} = this.state;
    const idsSet = new Set(ids);
    const unsubscribe = {request: "unsubscribe", streams: []};
    feeds
      .filter((feed) => idsSet.has(feed.id))
      .forEach((feed) => {
        if (onlyVideo) {
          // Unsubscribe only from one video stream (not all publisher feed).
          // Acutally expecting only one video stream, but writing more generic code.
          feed.streams
            .filter((stream) => stream.type === "video")
            .map((stream) => ({feed: feed.id, mid: stream.mid}))
            .forEach((stream) => unsubscribe.streams.push(stream));
        } else {
          // Unsubscribe the whole feed (all it's streams).
          unsubscribe.streams.push({feed: feed.id});
          Janus.log("Feed " + JSON.stringify(feed) + " (" + feed.id + ") has left the room, detaching");
        }
      });
    // Send an unsubscribe request.
    const {remoteFeed} = this.state;
    if (remoteFeed !== null && unsubscribe.streams.length > 0) {
      remoteFeed.send({message: unsubscribe});
    }
    if (!onlyVideo) {
      this.setState({feeds: feeds.filter((feed) => !idsSet.has(feed.id))});
    }
  };

  userState = (user) => {
    const feeds = Object.assign([], this.state.feeds);
    const {camera, question, rfid} = user;

    for (let i = 0; i < feeds.length; i++) {
      if (feeds[i] && feeds[i].id === rfid) {
        feeds[i].cammute = !camera;
        feeds[i].question = question;
        this.setState({feeds});
        break;
      }
    }
  };

  handleCmdData = (data) => {
    const {user, cammuted} = this.state;
    const {type, id, bitrate} = data;

    if (type === "client-reconnect" && user.id === id) {
      this.exitRoom(/* reconnect= */ true, () => {
        this.initClient(/* reconnect= */ true);
      });
    } else if (type === "client-reload" && user.id === id) {
      window.location.reload();
    } else if (type === "client-disconnect" && user.id === id) {
      this.exitRoom(/* reconnect= */ false);
    } else if (type === "client-kicked" && user.id === id) {
      kc.logout();
      updateSentryUser(null);
    } else if (type === "client-question" && user.id === id) {
      this.handleQuestion();
    } else if (type === "client-mute" && user.id === id) {
      this.micMute();
    } else if (type === "video-mute" && user.id === id) {
      this.camMute(cammuted);
    } else if (type === "sound_test" && user.id === id) {
      user.sound_test = true;
      localStorage.setItem("sound_test", true);
      this.setState({user});
      updateSentryUser(user);
    } else if (type === "client-bitrate" && user.id === id) {
      const isGroup = bitrate !== 64000;
      user.extra.isGroup = isGroup;
      this.setState({isGroup, user});
      this.setBitrate(bitrate);
    } else if (type === "audio-out") {
      this.handleAudioOut(data);
    } else if (type === "reload-config") {
      this.reloadConfig();
    } else if (type === "client-reload-all") {
      window.location.reload();
    } else if (type === "client-state") {
      this.userState(data.user);
    }
  };

  keepAlive = () => {
    // send every 2 seconds
    this.setState({keepalive: setInterval(this.sendKeepAlive, 2 * 1000)});

    // after 20 seconds, increase interval from 2 to 30 seconds.
    setTimeout(() => {
      this.clearKeepAlive();
      this.setState({keepalive: setInterval(this.sendKeepAlive, 30 * 1000)});
    }, 20 * 1000);
  };

  sendKeepAlive = () => {
    const {user, janus} = this.state;
    if (user && janus && janus.isConnected() && user.session && user.handle) {
      api
        .updateUser(user.id, user)
        .then((data) => {
          if (ConfigStore.isNewer(data.config_last_modified)) {
            console.info("[User] there is a newer config. Reloading ", data.config_last_modified);
            this.reloadConfig();
          }
        })
        .catch((err) => {
          console.error("[User] error sending keepalive", user.id, err);
        });
    }
  };

  clearKeepAlive = () => {
    const {keepalive} = this.state;
    if (keepalive) {
      clearInterval(keepalive);
    }
    this.setState({keepalive: null});
  };

  reloadConfig = () => {
    api
      .fetchConfig()
      .then((data) => {
        ConfigStore.setGlobalConfig(data);
        const {premodStatus, question} = this.state;
        const newPremodStatus = ConfigStore.dynamicConfig(ConfigStore.PRE_MODERATION_KEY) === "true";
        if (newPremodStatus !== premodStatus) {
          this.setState({premodStatus: newPremodStatus});
          if (question) {
            this.handleQuestion();
          }
        }
      })
      .catch((err) => {
        console.error("[User] error reloading config", err);
      });
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
    if (user.role === userRolesEnum.ghost) return;
    this.makeDelay();
    this.questionState(user, question);
  };

  questionState = (user, question) => {
    user.question = !question;

    localStorage.setItem("question", !question);
    this.setState({user, question: !question});

    updateSentryUser(user);
    updateGxyUser(user);
    sendUserState(user);
  };

  handleAudioOut = (data) => {
    this.state.virtualStreamingJanus.streamGalaxy(data.status, 4, "");
    if (data.status) {
      // remove question mark when sndman unmute our room
      if (this.state.question) {
        this.handleQuestion();
      }
    }
  };

  camMute = (cammuted) => {
    const {videoroom, media} = this.state;
    const {
      video: {setting, device},
    } = media;
    const {width, height, ideal} = setting;

    const user = Object.assign({}, this.state.user);
    if (user.role === userRolesEnum.ghost) return;
    this.makeDelay();

    if (videoroom) {
      if (!cammuted) {
        videoroom.createOffer({
          media: {removeVideo: true},
          simulcast: false,
          success: (jsep) => {
            Janus.debug("Got publisher SDP!");
            Janus.debug(jsep);
            videoroom.send({message: {request: "configure"}, jsep: jsep});
          },
          error: (error) => {
            Janus.error("WebRTC error:", error);
          },
        });
        this.stopLocalMedia();
      } else {
        videoroom.createOffer({
          media: {
            addVideo: true,
            video: {width, height, frameRate: {ideal, min: 1}, deviceId: {exact: device}},
          },
          simulcast: false,
          success: (jsep) => {
            Janus.debug("Got publisher SDP!");
            Janus.debug(jsep);
            videoroom.send({message: {request: "configure"}, jsep: jsep});
          },
          error: (error) => {
            Janus.error("WebRTC error:", error);
          },
        });
        this.startLocalMedia();
      }

      user.camera = cammuted;
      this.setState({user});

      updateSentryUser(user);
      updateGxyUser(user);
      sendUserState(user);
    } else {
      if (!cammuted) {
        this.stopLocalMedia();
      } else {
        this.startLocalMedia();
      }
    }
  };

  stopLocalMedia = () => {
    const {
      media: {video, audio},
      cammuted,
      videoroom,
    } = this.state;
    if (cammuted) return;
    console.log("Stop local video stream");
    video?.stream?.getTracks().forEach((t) => t.stop());
    devices?.audio_stream?.getTracks().forEach((t) => t.stop());
    const deviceId = audio.device || audio.devices?.[0]?.deviceId;
    if (deviceId) {
      this.setAudioDevice(deviceId, !!videoroom);
    }
    this.setState({cammuted: true});
  };

  startLocalMedia = () => {
    const {
      media: {video: {devices, device} = {}},
      cammuted,
    } = this.state;
    if (!cammuted) return;
    console.log("Bind local video stream");
    const deviceId = device || devices?.[0]?.deviceId;
    if (deviceId) {
      this.setVideoDevice(deviceId).then(() => {
        this.setState({cammuted: false});
      });
    }
  };

  micMute = () => {
    const {videoroom, muted} = this.state;
    if (muted) this.micVolume();
    muted ? videoroom.unmuteAudio() : videoroom.muteAudio();
    muted ? devices.audio.context.resume() : devices.audio.context.suspend();
    this.setState({muted: !muted});
  };

  micVolume = () => {
    const c = this.refs.canvas1;
    let cc = c.getContext("2d");
    let gradient = cc.createLinearGradient(0, 0, 0, 55);
    gradient.addColorStop(1, "green");
    gradient.addColorStop(0.35, "#80ff00");
    gradient.addColorStop(0.1, "orange");
    gradient.addColorStop(0, "red");
    devices.micLevel = (volume) => {
      //console.log("[client] volume: ", volume)
      cc.clearRect(0, 0, c.width, c.height);
      cc.fillStyle = gradient;
      cc.fillRect(0, c.height - volume * 300, c.width, c.height);
    };
  };

  otherCamsMuteToggle = () => {
    const {feeds, muteOtherCams} = this.state;
    if (!muteOtherCams) {
      // Should hide/mute now all videos.
      this.unsubscribeFrom(
        feeds.map((feed) => feed.id),
        /* onlyVideo= */ true
      );
      this.camMute(/* cammuted= */ false);
      this.setState({videos: NO_VIDEO_OPTION_VALUE, isKliOlamiShown: false});
      this.state.virtualStreamingJanus.setVideo(NO_VIDEO_OPTION_VALUE);
    } else {
      // Should unmute/show now all videos.
      this.makeSubscriptionAudioMode();
      this.camMute(/* cammuted= */ true);
      this.setState({videos: VIDEO_360P_OPTION_VALUE, isKliOlamiShown: true});
      this.state.virtualStreamingJanus.setVideo(VIDEO_360P_OPTION_VALUE);
    }
    this.setState({muteOtherCams: !muteOtherCams});
  };

  toggleShidur = () => {
    const {virtualStreamingJanus, shidur, user} = this.state;
    const stateUpdate = {shidur: !shidur};
    if (shidur) {
      virtualStreamingJanus.destroy({
        success: () => {
          console.log("Virtual streming destroyed.");
          this.setState(stateUpdate);
        },
        error: (error) => {
          console.log("Error destroying VirtualStreaming", error);
          this.setState(stateUpdate);
        },
      });
    } else {
      virtualStreamingJanus.init(user);
      stateUpdate.sourceLoading = true;
      this.setState(stateUpdate);
    }
  };

  toggleKliOlami = (isKliOlamiShown = !this.state.isKliOlamiShown) => this.setState({isKliOlamiShown});

  updateLayout = (currentLayout) => {
    this.setState({currentLayout}, () => {
      localStorage.setItem("currentLayout", currentLayout);
    });
  };

  onChatMessage = () => {
    const {asideMsgCounter, chatMessagesCount} = this.state;
    asideMsgCounter.chat++;
    this.setState({chatMessagesCount: chatMessagesCount + 1, asideMsgCounter});
  };

  mapDevices = (devices) => {
    return devices.map(({label, deviceId}, i) => {
      return {key: i, text: label, value: deviceId};
    });
  };

  connectionColor = () => {
    switch (this.state.connectionStatus) {
      case LINK_STATE_INIT:
        return "grey";
      case LINK_STATE_GOOD:
        return null; // white.
      case LINK_STATE_MEDIUM:
        return "orange";
      case LINK_STATE_WEAK:
        return "red";
      default:
        return "grey";
    }
  };

  renderLocalMedia = (width, height, index) => {
    const {user, cammuted, question, muted} = this.state;

    return (
      <div className="video" key={index}>
        <div className={classNames("video__overlay", {"talk-frame": !muted})}>
          {question ? (
            <div className="question">
              <svg viewBox="0 0 50 50">
                <text x="25" y="25" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">
                  &#xF128;
                </text>
              </svg>
            </div>
          ) : (
            ""
          )}
          <div className="video__title">
            {muted ? <Icon name="microphone slash" size="small" color="red" /> : ""}
            <Popup
              content={user ? user.username : ""}
              mouseEnterDelay={200}
              mouseLeaveDelay={500}
              on="hover"
              trigger={<div className="title-name">{user ? user.username : ""}</div>}
            />
            <Icon style={{marginLeft: "0.3rem"}} name="signal" size="small" color={this.connectionColor()} />
          </div>
        </div>
        <svg
          className={classNames("nowebcam", {hidden: !cammuted})}
          viewBox="0 0 32 18"
          preserveAspectRatio="xMidYMid meet"
        >
          <text x="16" y="9" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">
            &#xf2bd;
          </text>
        </svg>
        <video
          className={classNames("mirror", {hidden: cammuted})}
          ref="localVideo"
          id="localVideo"
          width={width}
          height={height}
          autoPlay={true}
          controls={false}
          muted={true}
          playsInline={true}
        />
      </div>
    );
  };

  renderMedia = (feed, width, height) => {
    const {
      id,
      talking,
      question,
      cammute,
      display: {display},
    } = feed;
    const {muteOtherCams} = this.state;
    const mute = cammute || muteOtherCams;

    return (
      <div className="video" key={"v" + id} ref={"video" + id} id={"video" + id}>
        <div className={classNames("video__overlay", {"talk-frame": talking})}>
          {question ? (
            <div className="question">
              <svg viewBox="0 0 50 50">
                <text x="25" y="25" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">
                  &#xF128;
                </text>
              </svg>
            </div>
          ) : (
            ""
          )}
          <div className="video__title">
            {!talking ? <Icon name="microphone slash" size="small" color="red" /> : ""}
            <Popup
              content={display}
              mouseEnterDelay={200}
              mouseLeaveDelay={500}
              on="hover"
              trigger={<span className="title-name">{display}</span>}
            />
          </div>
        </div>
        <svg
          className={classNames("nowebcam", {hidden: !mute})}
          viewBox="0 0 32 18"
          preserveAspectRatio="xMidYMid meet"
        >
          <text x="16" y="9" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">
            &#xf2bd;
          </text>
        </svg>
        <video
          key={"v" + id}
          ref={"remoteVideo" + id}
          id={"remoteVideo" + id}
          width={width}
          height={height}
          autoPlay={true}
          controls={false}
          muted={true}
          playsInline={true}
        />
        <audio
          key={"a" + id}
          ref={"remoteAudio" + id}
          id={"remoteAudio" + id}
          autoPlay={true}
          controls={false}
          playsInline={true}
        />
      </div>
    );
  };

  renderBottomBar = (layout, otherFeedHasQuestion) => {
    const {t} = this.props;
    const {
      attachedSource,
      cammuted,
      delay,
      localAudioTrack,
      muteOtherCams,
      muted,
      question,
      room,
      shidur,
      sourceLoading,
      user,
      premodStatus,
      media,
      isKliOlamiShown,
      mqttOn,
    } = this.state;

    const {video, audio} = media;

    return (
      <AppBar position="static" color="default">
        <Toolbar className="bottom-toolbar" variant="dense">
          <ButtonGroup variant="contained" className={classNames("bottom-toolbar__item")} disableElevation>
            <Mute t={t} action={this.micMute.bind(this)} disabled={!localAudioTrack} isOn={muted} ref="canvas1" />
            <MuteVideo
              t={t}
              action={this.camMute.bind(this)}
              disabled={video.device === null || delay}
              isOn={cammuted}
            />
          </ButtonGroup>

          {/* ~~~~~~~~~~~ */}

          <ButtonGroup className={classNames("bottom-toolbar__item")} variant="contained" disableElevation>
            <Fullscreen t={t} isOn={isFullScreen()} action={toggleFullScreen} />
            <KliOlamiToggle isOn={isKliOlamiShown} action={this.toggleKliOlami} />
            <CloseBroadcast
              t={t}
              isOn={shidur}
              action={this.toggleShidur.bind(this)}
              disabled={room === "" || sourceLoading}
            />
            <Layout
              t={t}
              active={layout}
              action={this.updateLayout.bind(this)}
              disabled={room === "" || !shidur || sourceLoading || !attachedSource}
              iconDisabled={sourceLoading}
            />
            <AudioMode t={t} action={this.otherCamsMuteToggle.bind(this)} isOn={muteOtherCams} />
          </ButtonGroup>

          <ButtonGroup
            className={classNames("bottom-toolbar__item")}
            variant="contained"
            disableElevation
            // style={{ color: grey[50] }}
          >
            <AskQuestion
              t={t}
              isOn={!!question}
              disabled={!mqttOn || premodStatus || !audio.device || !localAudioTrack || delay || otherFeedHasQuestion}
              action={this.handleQuestion.bind(this)}
            />
            <Vote t={t} id={user?.id} disabled={!user || !user.id || room === ""} />
          </ButtonGroup>

          <ButtonMD
            onClick={() => this.exitRoom(false)}
            variant="contained"
            color="error"
            className={classNames("bottom-toolbar__item")}
            disableElevation
          >
            {t("oldClient.leave")}
          </ButtonMD>
        </Toolbar>
      </AppBar>
    );
  };

  toggleRightAside = (name) => {
    const {rightAsideName: oldName, asideMsgCounter} = this.state;
    const rightAsideName = name === oldName ? null : name;

    if (asideMsgCounter[name]) asideMsgCounter[name] = 0;

    this.setState({rightAsideName, asideMsgCounter});
  };

  toggleLeftAside = (name) => {
    const {leftAsideName: oldName, asideMsgCounter} = this.state;
    const leftAsideName = name === oldName ? null : name;

    if (asideMsgCounter[name]) asideMsgCounter[name] = 0;

    this.setState({leftAsideName, asideMsgCounter});
  };

  renderRightAside = () => {
    const {t, theme} = this.props;
    const {user, room, rightAsideName, isRoomChat} = this.state;

    let content;
    let displayChat = "none";

    if (rightAsideName === "chat" || rightAsideName === "support") {
      displayChat = "block";
    }

    const chat = (
      <Box style={{display: displayChat, height: "100%"}}>
        <VirtualChat
          t={t}
          ref={(chat) => {
            this.chat = chat;
          }}
          visible={rightAsideName === "chat"}
          room={room}
          user={user}
          onCmdMsg={this.handleCmdData}
          onNewMsg={this.onChatMessage}
          room_chat={isRoomChat}
          setIsRoomChat={this.setIsRoomChat}
        />
      </Box>
    );

    if (rightAsideName === "question") {
      content = <SendQuestionContainer user={user} />;
    }

    return (
      <Grid item xs={rightAsideName ? 3 : false} style={{backgroundColor: theme.palette.background.paper}}>
        {content}
        {chat}
      </Grid>
    );
  };

  handleAsideResize = (incr) => {
    const {leftAsideSize, rightAsideName, leftAsideName} = this.state;

    const size = incr ? leftAsideSize + 1 : leftAsideSize - 1;

    const rightName = size > 3 ? null : rightAsideName;

    const leftName = size > 3 ? leftAsideName : null;

    this.setState({leftAsideSize: size, rightAsideName: rightName, leftAsideName: leftName});
  };

  renderTopBar = (isDeb) => {
    const {t, i18n} = this.props;
    const {user, asideMsgCounter, leftAsideName, rightAsideName, isOpenTopMenu} = this.state;

    const notApproved = user && user.role !== userRolesEnum.user;
    return (
      <AppBar color="default" position="static">
        <Toolbar className="top-toolbar">
          <TopMenu
            t={t}
            openSettings={() => this.setState({isSettings: true})}
            open={isOpenTopMenu}
            setOpen={(isOpen) => this.setState({isOpenTopMenu: isOpen})}
            notApproved={notApproved}
            user={user}
            i18n={i18n}
          />
          <ButtonMD
            color="info"
            variant="contained"
            onClick={() => window.open(`${PAY_USER_FEE}` + i18n.language, "_blank")}
            className="top-toolbar__item"
            disableElevation
            size="small"
          >
            {t("oldClient.myProfile")}
          </ButtonMD>
          <ButtonGroup
            variant="outlined"
            color="primary"
            size="small"
            disableElevation
            className={classNames("top-toolbar__item", "top-toolbar__toggle")}
          >
            <Badge color="error" badgeContent={asideMsgCounter.drawing} showZero={false} overlap="circular">
              <ButtonMD
                variant={leftAsideName === "drawing" ? "contained" : "outlined"}
                onClick={() => this.toggleLeftAside("drawing")}
                disableElevation
              >
                {t("oldClient.drawing")}
              </ButtonMD>
            </Badge>
            <ButtonMD
              variant={leftAsideName === "material" ? "contained" : "outlined"}
              onClick={() => this.toggleLeftAside("material")}
            >
              {t("oldClient.material")}
            </ButtonMD>
          </ButtonGroup>
          {/*  button of congress
          <ButtonMD
            color="secondary"
            variant="contained"
            onClick={() =>
              window.open(`https://convention.kli.one/${i18n.language === "en" ? "" : i18n.language}`, "_blank")
            }
            className="top-toolbar__item"
            disableElevation
            style={{backgroundColor: "#97119e"}}
          >
            <OpenInNewOutlined style={{marginRight: "5px"}} />
            {t("temp.linkToCongress")}
          </ButtonMD>
*/}

          <Typography variant="h6" align="center" className={classNames("top-toolbar__item", "top-toolbar__title")}>
            {user?.group}
          </Typography>

          {/* Debug buttons to locally emulate as if "ON" is turned on. */}
          {isDeb ? (
            <ButtonMD onClick={() => this.state.virtualStreamingJanus.streamGalaxy(true, 4, "")}>ON</ButtonMD>
          ) : null}
          {isDeb ? (
            <ButtonMD onClick={() => this.state.virtualStreamingJanus.streamGalaxy(false, 4, "")}>OFF</ButtonMD>
          ) : null}

          {/* ---------- */}
          <ButtonGroup
            variant="outlined"
            color="primary"
            size="small"
            disableElevation
            className={classNames("top-toolbar__item", "top-toolbar__toggle")}
          >
            <Badge badgeContent={asideMsgCounter.chat} showZero={false} color="error" overlap="circular">
              <ButtonMD
                variant={rightAsideName === "chat" ? "contained" : "outlined"}
                onClick={() => {
                  this.toggleRightAside("chat");
                  this.setState({isRoomChat: true});
                }}
                disableElevation
              >
                {t("oldClient.chat")}
              </ButtonMD>
            </Badge>
            <ButtonMD
              onClick={() => this.toggleRightAside("question")}
              variant={rightAsideName === "question" ? "contained" : "outlined"}
            >
              {t("oldClient.sendQuestion")}
            </ButtonMD>
          </ButtonGroup>

          <Support />
          <Donations />
          {/* ---------- */}
        </Toolbar>
      </AppBar>
    );
  };

  renderLeftAside = () => {
    const {leftAsideName, leftAsideSize} = this.state;
    const {
      i18n: {language},
      theme,
    } = this.props;

    let content;
    if (leftAsideName === "material") {
      content = <HomerLimud />;
    } else if (leftAsideName === "drawing") {
      content = (
        <iframe
          title={"classboard"}
          src={`https://www.kab.tv/classboard/classboard.php?lang=${sketchesByLang[language]}`}
          style={{width: "100%", height: "100%", padding: "1rem"}}
          frameBorder="0"
        ></iframe>
      );
    }

    return (
      <Grid
        item
        xs={leftAsideSize >= 3 && leftAsideName ? leftAsideSize : false}
        style={{backgroundColor: theme.palette.background.paper}}
      >
        {
          //buttons for resize tab (if want open study materials on browser tab)
          leftAsideName && false ? (
            <ButtonGroup>
              <IconButton onClick={() => this.handleAsideResize(false)} size="large">
                <ChevronLeft />
              </IconButton>
              <IconButton onClick={() => this.handleAsideResize(true)} disabled={leftAsideSize > 7} size="large">
                <ChevronRight />
              </IconButton>
            </ButtonGroup>
          ) : null
        }
        {content}
      </Grid>
    );
  };

  renderNewVersionContent = (
    layout,
    isDeb,
    source,
    rooms_list,
    otherFeedHasQuestion,
    adevices_list,
    vdevices_list,
    noOfVideos,
    remoteVideos
  ) => {
    const {i18n} = this.props;
    const {
      attachedSource,
      chatVisible,
      room,
      shidur,
      user,
      rightAsideName,
      leftAsideSize,
      leftAsideName,
      sourceLoading,
      isKliOlamiShown,
      kliOlamiAttached,
    } = this.state;

    const notApproved = user && user.role !== userRolesEnum.user;

    if (!sourceLoading && isKliOlamiShown) {
      noOfVideos += layout === "equal" || layout === "double" ? 1 : 0;
    }

    const kliOlami = !sourceLoading && isKliOlamiShown && (
      <KliOlamiStream
        close={() => this.toggleKliOlami(false)}
        toggleAttach={(val = !kliOlamiAttached) => this.setState({kliOlamiAttached: val})}
        attached={kliOlamiAttached}
      />
    );
    return (
      <div className={classNames("vclient", {"vclient--chat-open": chatVisible})}>
        {this.renderTopBar(isDeb)}
        <RegistrationModals user={user} language={i18n.language} updateUserRole={this.updateUserRole.bind(this)} />

        <Grid container className="vclient__main">
          {this.renderLeftAside()}
          <Grid
            item
            xs={12 - (!leftAsideName ? 0 : leftAsideSize) - (!rightAsideName ? 0 : 3)}
            style={{display: "flex", flexDirection: "column", overflow: "hidden"}}
          >
            <div
              className={`
            vclient__main-wrapper
            no-of-videos-${noOfVideos}
            layout--${layout}
          ${!isKliOlamiShown ? "" : "with-kli-olami"}
            broadcast--${room !== "" && shidur ? "on" : "off"}
            ${!attachedSource ? " broadcast--popup" : "broadcast--inline"}
           `}
            >
              <div className="broadcast-panel">
                <div className="broadcast__wrapper">
                  {layout === "split" && !notApproved && source}
                  {layout === "split" && !notApproved && kliOlami}
                </div>
              </div>

              <div className="videos-panel">
                <div className="videos__wrapper">
                  {(layout === "equal" || layout === "double" || notApproved) && source}
                  {(layout === "equal" || layout === "double" || notApproved) && kliOlami}
                  {!notApproved && remoteVideos}
                </div>
              </div>
            </div>
            {!notApproved && this.renderBottomBar(layout, otherFeedHasQuestion)}
          </Grid>

          {this.renderRightAside()}
        </Grid>
      </div>
    );
  };

  updateUserRole = () => {
    getUser(this.checkPermission);
  };

  setIsRoomChat = (isRoomChat) => this.setState({isRoomChat});

  setAudio(audios, text) {
    this.setState({audios: {audios, text}});
    this.state.virtualStreamingJanus.setAudio(audios, text);
  }

  render() {
    const {
      appInitError,
      attachedSource,
      cammuted,
      currentLayout,
      feeds,
      media,
      muteOtherCams,
      myid,
      numberOfVirtualUsers,
      room,
      rooms,
      selected_room,
      shidur,
      user,
      virtualStreamingJanus,
      videos,
      isSettings,
      audios,
      shidurForGuestReady,
      wipSettings,
      isGroup,
    } = this.state;

    if (appInitError) {
      return (
        <Fragment>
          <h1>Error Initializing Application</h1>
          {`${appInitError}`}
        </Fragment>
      );
    }

    const notApproved = user && user.role !== userRolesEnum.user;
    const width = "134";
    const height = "100";
    const layout = room === "" || !shidur || !attachedSource ? "equal" : currentLayout;

    let source;

    //in chrome must be any event for audio autorun https://developers.google.com/web/updates/2017/09/autoplay-policy-changes
    if (!shidurForGuestReady && notApproved) {
      source = (
        <Grid container justifyContent="center" style={{height: "100%", fontSize: "100em"}}>
          <IconButton onClick={() => this.setState({shidurForGuestReady: true})} size="large">
            <PlayCircleOutline style={{fontSize: "20em", color: grey[200]}} />
          </IconButton>
        </Grid>
      );
    } else if ((room !== "" && shidur) || notApproved) {
      source = (
        <VirtualStreaming
          virtualStreamingJanus={virtualStreamingJanus}
          attached={attachedSource}
          closeShidur={this.toggleShidur}
          setVideo={(v) => this.setState({videos: v})}
          setDetached={() => {
            this.setState({attachedSource: false});
          }}
          setAttached={() => {
            this.setState({attachedSource: true});
          }}
          videos={videos}
          setAudio={this.setAudio.bind(this)}
          audios={audios.audios}
        />
      );
    }
    let rooms_list = rooms.map((data, i) => {
      const {room, description, num_users} = data;
      return {key: i, text: description, description: num_users, value: room};
    });

    let adevices_list = this.mapDevices(media.audio.devices);
    let vdevices_list = this.mapDevices(media.video.devices);

    let otherFeedHasQuestion = false;
    let localPushed = false;
    let remoteVideos = userFeeds(feeds).reduce((result, feed) => {
      const {question, id} = feed;
      otherFeedHasQuestion = otherFeedHasQuestion || (question && id !== myid);
      if (!localPushed && feed.display.timestamp >= user.timestamp) {
        localPushed = true;
        for (let i = 0; i < parseInt(numberOfVirtualUsers, 10); i++) {
          result.push(this.renderLocalMedia(width, height, i));
        }
      }
      result.push(this.renderMedia(feed, width, height));
      return result;
    }, []);
    if (!localPushed) {
      for (let i = 0; i < parseInt(numberOfVirtualUsers, 10); i++) {
        remoteVideos.push(this.renderLocalMedia(width, height, i));
      }
    }

    let noOfVideos = remoteVideos.length;
    if (room !== "") {
      if (shidur && attachedSource && ["double", "equal"].includes(layout)) {
        noOfVideos += 1; // + Source
      }
    }

    let login = <LoginPage user={user} checkPermission={this.checkPermission} />;

    const isDeb = new URL(window.location.href).searchParams.has("deb");

    let content = this.renderNewVersionContent(
      layout,
      isDeb,
      source,
      rooms_list,
      otherFeedHasQuestion,
      adevices_list,
      vdevices_list,
      noOfVideos,
      remoteVideos
    );

    return (
      <Fragment>
        {user && !isMobile && Boolean(room) && (
          <SettingsJoined
            userDisplay={user.display}
            isOpen={isSettings}
            audio={media.audio}
            video={media.video}
            closeModal={() => this.setState({isSettings: false, isOpenTopMenu: false})}
            setAudio={this.setAudio.bind(this)}
            setVideo={(v) => {
              virtualStreamingJanus.setVideo(v);
              this.setState({videos: v});
            }}
            videos={videos}
            videoLength={media.video?.devices.length}
            audioModeChange={this.otherCamsMuteToggle}
            isAudioMode={muteOtherCams}
            audioDevice={media.audio?.device}
            setAudioDevice={this.setAudioDevice.bind(this)}
            audios={audios.audios}
          />
        )}
        {user && !isMobile && !notApproved && !Boolean(room) && (
          <Settings
            userDisplay={user.display}
            rooms={rooms}
            selectRoom={this.selectRoom.bind(this)}
            selectedRoom={selected_room}
            initClient={this.initClient.bind(this)}
            isAudioMode={muteOtherCams}
            isGroup={isGroup}
            setAudioDevice={this.setAudioDevice.bind(this)}
            setVideoDevice={this.setVideoDevice.bind(this)}
            settingsChange={this.setVideoSize}
            audioModeChange={this.otherCamsMuteToggle}
            handleGroupChange={() => this.setState({isGroup: !isGroup})}
            audio={media.audio}
            video={media.video}
            cammuted={cammuted}
            videoDevice={media.video?.device}
            audioDevice={media.audio?.device}
            videoLength={media.video?.devices.length}
            videoSettings={JSON.stringify(media.video.setting)}
            wip={wipSettings}
            setWip={(wip) => this.setState({wipSettings: wip})}
            startLocalMedia={this.startLocalMedia.bind(this)}
            stopLocalMedia={this.stopLocalMedia.bind(this)}
          />
        )}
        {user && !isMobile ? content : !isMobile ? login : ""}
      </Fragment>
    );
  }
}

const WrappedClass = withTranslation()(withTheme(VirtualHttpClient));

export default class WrapperForThemes extends React.Component {
  render() {
    return (
      <ThemeSwitcher>
        <WrappedClass />
      </ThemeSwitcher>
    );
  }
}

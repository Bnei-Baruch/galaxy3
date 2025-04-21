import React, {Component, Fragment} from "react";
import classNames from "classnames";
import {Icon, Popup} from "semantic-ui-react";
import {
  checkNotification,
  geoInfo,
  getDateString,
  getIsAv1FromLocalstorage,
  getVideosFromLocalstorage,
  notifyMe,
  sendUserState,
  updateGxyUser,
} from "../../shared/tools";
import "./VirtualClient.scss";
import "./VideoConteiner.scss";
import "./CustomIcons.scss";
import "eqcss";
import VirtualChat from "./VirtualChat";
import {
  media_object,
  NO_VIDEO_OPTION_VALUE,
  sketchesByLang,
  VIDEO_360P_OPTION_VALUE,
  VIDEO_IS_AV1_360P_OPTION_VALUE
} from "../../shared/consts";
import {GEO_IP_INFO, PAY_USER_FEE} from "../../shared/env";
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
import JanusStream from "../../shared/streaming-utils";
import {kc} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";
import {captureMessage, sentryDebugAction, setSentryGeo, setSentryTag, updateSentryUser} from "../../shared/sentry";
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
import {getUserRole, userRolesEnum} from "../../shared/enums";
import QuadStream from "./components/QuadStream";
import KliOlamiToggle from "./buttons/KliOlamiToggle";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import withTheme from "@mui/styles/withTheme";
import ThemeSwitcher from "./components/ThemeSwitcher/ThemeSwitcher";
import mqtt from "../../shared/mqtt";
import devices from "../../lib/devices";
import {JanusMqtt} from "../../lib/janus-mqtt";
import {PublisherPlugin} from "../../lib/publisher-plugin";
import {SubscriberPlugin} from "../../lib/subscriber-plugin";
import log from "loglevel";
import Donations from "./buttons/Donations";
import version from './Version.js';
import {PopUp} from "./components/PopUp"
import {BroadcastNotification} from "./components/BroadcastNotification";
import GlobalOptions, {GlobalOptionsContext} from "./components/GlobalOptions/GlobalOptions";
import ShowSelfBtn from "./buttons/ShowSelfBtn";
import OnboardingDoor from "./components/OnboardingDoor.js";

const sortAndFilterFeeds = (feeds) =>
  feeds
    .filter((feed) => !feed.display.role.match(/^(ghost|guest)$/))
    .sort((a, b) => {
      // Groups should go first before non-groups.
      // When both are groups or both non-groups use timestamp
      // to order.
      if (!!a.display.is_group && !b.display.is_group) {
        return -1;
      }
      if (!a.display.is_group && !!b.display.is_group) {
        return 1;
      }
      return a.display.timestamp - b.display.timestamp;
    });

const userFeeds = (feeds) => feeds.filter((feed) => feed.display.role === userRolesEnum.user);
const monitoringData = new MonitoringData();


class VirtualMqttClient extends Component {
  constructor(props) {
    super(props);
    const isAv1 = getIsAv1FromLocalstorage()
    const videos = getVideosFromLocalstorage(isAv1)

    this.state = {
      show_message: false,
      broadcast_message: {en: ""},
      chatMessagesCount: 0,
      creatingFeed: false,
      delay: true,
      media: media_object,
      audio: null,
      video: null,
      janus: null,
      exit_room: true,
      show_notification: false,
      feeds: [],
      rooms: [],
      room: "",
      selected_room: parseInt(localStorage.getItem("room"), 10) || "",
      videoroom: null,
      remoteFeed: null,
      myid: null,
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
      support: false,
      connectionStatus: "",
      numberOfVirtualUsers: localStorage.getItem("number_of_virtual_users") || "1",
      currentLayout: localStorage.getItem("currentLayout") || "split",
      attachedSource: true,
      sourceLoading: true,
      appInitError: null,
      keepalive: null,
      muteOtherCams: false,
      videos,
      isAv1,
      premodStatus: false,
      asideMsgCounter: {drawing: 0, chat: 0},
      leftAsideSize: 3,
      shidurForGuestReady: false,
      kliOlamiAttached: true,
      isKliOlamiShown: true,
      audios: {audios: Number(localStorage.getItem("vrt_lang")) || 2},
      mqttOn: false,
      isGroup: false,
      hideUserDisplays: localStorage.getItem("hideUserDisplays")?.toLowerCase() === "true" || false,
    };
  }


  componentDidUpdate(prevProps, prevState) {
    const {videoroom, localVideoTrack, localAudioTrack, user} = this.state;
    if (videoroom !== prevState.videoroom || localVideoTrack !== prevState.localVideoTrack || localAudioTrack !== prevState.localAudioTrack || JSON.stringify(user) !== JSON.stringify(prevState.user)) {
      monitoringData.setConnection(videoroom, localAudioTrack, localVideoTrack, user, JanusStream);
      monitoringData.setOnStatus((connectionStatus) => {
        this.setState({connectionStatus});
      });
    }
  }

  checkPermission = (user) => {
    log.info(" :: Version :: ", version);
    user.role = getUserRole();
    user.isClient = true;
    if (user.role !== null) {
      api.fetchVHInfo().then((data) => {
        user.vhinfo = data;
      }).catch(err => {
        console.error('Error fetching VH info data: ', err?.message);
        user.vhinfo = {active: false, error: err?.message};
      }).finally(() => {
        //user.allowed = !!user.vhinfo.active && user.role === userRolesEnum.user;
        user.allowed = user.role === userRolesEnum.user;
        this.initApp(user);
      });
    } else {
      alert("Access denied!");
      kc.logout();
      updateSentryUser(null);
    }
  };

  initApp = (user) => {
    initCrisp(user, this.props.i18n.language);

    if (!user.allowed) {
      this.setState({user});
      return;
    }

    JanusStream.setUser(user);
    this.initMQTT(user);

    const {t} = this.props;
    localStorage.setItem("question", false);
    localStorage.setItem("sound_test", false);
    localStorage.setItem("uuid", user.id);
    checkNotification();

    let system = navigator.userAgent;
    user.system = system;
    user.extra = {};

    let browser = platform.parse(system);
    if (!/Safari|Firefox|Chrome|Yandex Browser|Edge/.test(browser.name)) {
      alert(t("oldClient.browserNotSupported"));
      return;
    }

    geoInfo(`${GEO_IP_INFO}`, (data) => {
      setSentryGeo(user, data)
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
                captureMessage("This test message", {});
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
        captureMessage("disconnected", {});
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

  initClient = (reconnect, retry = 0) => {
    this.setState({delay: true});
    const {user, shidur} = this.state;
    if (this.state.janus) {
      this.state.janus.destroy();
    }

    const config = GxyJanus.instanceConfig(user.janus);
    log.info("[client] Got config: ", config);
    this.initJanus(user, config, retry);
    if (!reconnect && shidur) {
      JanusStream.initStreaming();
    }
  };

  reinitClient = (retry) => {
    retry++;
    log.error("[client] reinitializing try: ", retry);
    if(!mqtt.isConnected) {
      log.error("[client] mqtt is not connected, waiting 5 sec");
      setTimeout(() => {
        this.reinitClient(retry);
      }, 5000);
    }
    if (retry < 10) {
      setTimeout(() => {
        this.initClient(true, retry);
      }, 5000);
    } else {
      this.exitRoom(false, () => {
        log.error("[client] reinitializing failed after: " + retry + " retries");
        alert(this.props.t("oldClient.networkSettingsChanged"));
      });
    }
  };

    iceFailed = (data) => {
      const {exit_room} = this.state;
      if(!exit_room && data === "publisher") {
        this.setState({show_notification: true});
        this.exitRoom();
        captureMessage("reconnect", {});
        log.warn("[client] iceFailed for: ", data);
      }
    };

  initJanus = (user, config, retry) => {
    setSentryTag(config.name)
    let janus = new JanusMqtt(user, config.name);
    janus.onStatus = (srv, status) => {
      if (status === "offline") {
        alert("Janus Server - " + srv + " - Offline");
        window.location.reload();
      }

      if (status === "error") {
        log.error("[client] Janus error, reconnecting...");
        this.exitRoom(true, () => {
          this.reinitClient(retry);
        });
      }
    };

    let videoroom = new PublisherPlugin(config.iceServers);
    videoroom.subTo = this.makeSubscription;
    videoroom.unsubFrom = this.unsubscribeFrom;
    videoroom.talkEvent = this.handleTalking;
    videoroom.iceFailed = this.iceFailed;

    let subscriber = new SubscriberPlugin(config.iceServers);
    subscriber.onTrack = this.onRemoteTrack;
    subscriber.onUpdate = this.onUpdateStreams;
    subscriber.iceFailed = this.iceFailed;

    janus.init(config.token).then((data) => {
        log.info("[client] Janus init", data);

      janus.attach(videoroom).then((data) => {
        log.info("[client] Publisher Handle: ", data);
        this.joinRoom(false, janus, videoroom, user);
      });

      janus.attach(subscriber).then((data) => {
        this.setState({subscriber});
        log.info("[client] Subscriber Handle: ", data);
      });
    })
      .catch((err) => {
        log.error("[client] Janus init", err);
        this.exitRoom(true, () => {
          this.reinitClient(retry);
        });
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

  selectRoom = (selected_room) => {
    const {rooms, user} = this.state;
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

  joinRoom = (reconnect, janus, videoroom, user) => {
    this.setState({exit_room: false});
    let {selected_room, media, cammuted, isGroup} = this.state;
    const {video: {device}} = media;

    user.camera = !!device && cammuted === false;
    user.question = false;
    user.timestamp = Date.now();
    user.session = janus.sessionId;
    user.handle = videoroom.janusHandleId;

    this.setState({janus, videoroom, user, room: selected_room});

    this.micMute();

    const {id, timestamp, role, username} = user;
    const d = {id, timestamp, role, display: username, is_group: isGroup, is_desktop: true};

    videoroom.join(selected_room, d).then((data) => {
      log.info("[client] Joined respond :", data);

      // Feeds count with user role
      let feeds_count = userFeeds(data.publishers).length;
      if (feeds_count > 25) {
        alert(t("oldClient.maxUsersInRoom"));
        this.exitRoom(false);
        return;
      }

      const {id, room} = data;
      user.rfid = data.id;

      const {audio, video} = this.state.media;
      videoroom.publish(video.stream, audio.stream).then((json) => {
        user.extra.streams = json.streams;
        user.extra.isGroup = this.state.isGroup;

        const vst = json.streams.find((v) => v.type === "video" && v.h264_profile);
        if (vst && vst?.h264_profile !== "42e01f") {
          captureMessage("h264_profile", vst);
        }

        this.setState({user, myid: id, delay: false, sourceLoading: false});
        updateSentryUser(user);
        updateGxyUser(user);
        //this.keepAlive();

        mqtt.join("galaxy/room/" + selected_room);
        mqtt.join("galaxy/room/" + selected_room + "/chat", true);
        if (isGroup) videoroom.setBitrate(600000);

        log.info("[client] Pulbishers list: ", data.publishers);

        this.makeSubscription(data.publishers);
      }).catch((err) => {
        log.error("[client] Publish error :", err);
        this.exitRoom(false);
      });
    }).catch((err) => {
      log.error("[client] Join error :", err);
      this.exitRoom(false);
    });
  };

  exitRoom = (reconnect, callback) => {
    this.setState({delay: true, exit_room: true});
    const {videoroom} = this.state;

    if (videoroom) {
      videoroom.leave().then((data) => {
        log.info("[client] leave respond:", data);
        this.resetClient(reconnect, callback);
      }).catch(e => {
        this.resetClient(reconnect, callback);
      });
    } else {
      this.resetClient(reconnect, callback);
    }
  };

  resetClient = (reconnect, callback) => {
    let {janus, room, shidur} = this.state;

    //this.clearKeepAlive();

    localStorage.setItem("question", false);

    const params = {with_num_users: true};
    api.fetchAvailableRooms(params).then(data => {
      const {rooms} = data;
      this.setState({rooms});
    }).catch((err) => {
      log.error("[client] Error exiting room", err);
    });

    mqtt.exit("galaxy/room/" + room);
    mqtt.exit("galaxy/room/" + room + "/chat");

    if (shidur && !reconnect) {
      JanusStream.destroy();
    }

    if (!reconnect && isFullScreen()) {
      toggleFullScreen();
    }

    if (janus) janus.destroy();

    this.setState({
      muted: false,
      question: false,
      feeds: [],
      mids: [],
      localAudioTrack: null,
      localVideoTrack: null,
      remoteFeed: null,
      videoroom: null,
      subscriber: null,
      janus: null,
      delay: reconnect,
      room: reconnect ? room : "",
      chatMessagesCount: 0,
      isSettings: false,
      sourceLoading: true
    });

    if (typeof callback === "function") callback();
  }

  makeSubscription = (newFeeds) => {
    log.info("[client] makeSubscription", newFeeds);
    const subscription = [];
    const {feeds: prevFeeds, muteOtherCams} = this.state;
    const prevFeedsMap = new Map(prevFeeds.map((f) => [f.id, f]));

    newFeeds.forEach((feed) => {
      const {id, streams} = feed;
      feed.display = JSON.parse(feed.display);
      const vst = streams.find((v) => v.type === "video" && v.h264_profile);
      if (vst) {
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
        if (stream?.h264_profile && stream?.h264_profile !== "42e01f") {
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
    if (this.state.remoteFeed) {
      this.state.subscriber.sub(subscription);
      return;
    }

    if (this.state.creatingFeed) {
      setTimeout(() => {
        this.subscribeTo(subscription);
      }, 500);
      return;
    }

    this.setState({creatingFeed: true});

    this.state.subscriber.join(subscription, this.state.room).then((data) => {
      log.info("[client] Subscriber join: ", data);

      this.onUpdateStreams(data.streams);

      this.setState({remoteFeed: true, creatingFeed: false});
    });
  };

  handleTalking = (id, talking) => {
    const {feeds} = this.state;
    for (let i = 0; i < feeds.length; i++) {
      if (feeds[i] && feeds[i].id === id) {
        feeds[i].talking = talking;
      }
    }
    this.setState({feeds});
  };

  onUpdateStreams = (streams) => {
    const {mids} = this.state;
    log.debug("[client] Updated streams :", streams);
    for (let i in streams) {
      let mindex = streams[i]["mid"];
      //let feed_id = streams[i]["feed_id"];
      mids[mindex] = streams[i];
    }
    this.setState({mids});
  };

  onRemoteTrack = (track, stream, on) => {
    let mid = track.id;
    let feed = stream.id;
    log.info("[client] >> This track is coming from feed " + feed + ":", mid, track);
    if (on) {
      if (track.kind === "audio") {
        log.debug("[client] Created remote audio stream:", stream);
        let remoteaudio = this.refs["remoteAudio" + feed];
        if (remoteaudio) remoteaudio.srcObject = stream;
      } else if (track.kind === "video") {
        log.debug("[client] Created remote video stream:", stream);
        const remotevideo = this.refs["remoteVideo" + feed];
        if (remotevideo) remotevideo.srcObject = stream;
      }
    }
  };

  // Unsubscribe from feeds defined by |ids| (with all streams) and remove it when |onlyVideo| is false.
  // If |onlyVideo| is true, will unsubscribe only from video stream of those specific feeds, keeping those feeds.
  unsubscribeFrom = (ids, onlyVideo) => {
    const {feeds} = this.state;
    const idsSet = new Set(ids);
    const streams = [];
    feeds
      .filter((feed) => idsSet.has(feed.id))
      .forEach((feed) => {
        if (onlyVideo) {
          // Unsubscribe only from one video stream (not all publisher feed).
          // Acutally expecting only one video stream, but writing more generic code.
          feed.streams
            .filter((stream) => stream.type === "video")
            .map((stream) => ({feed: feed.id, mid: stream.mid}))
            .forEach((stream) => streams.push(stream));
        } else {
          // Unsubscribe the whole feed (all it's streams).
          streams.push({feed: feed.id});
          log.info("[client] Feed " + JSON.stringify(feed) + " (" + feed.id + ") has left the room, detaching");
        }
      });
    // Send an unsubscribe request.
    const {remoteFeed} = this.state;
    if (remoteFeed !== null && streams.length > 0) {
      this.state.subscriber.unsub(streams);
    }
    if (!onlyVideo) {
      this.setState({feeds: feeds.filter((feed) => !idsSet.has(feed.id))});
    }
  };

  userState = (user) => {
    const {feeds} = this.state;
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
    const {user, cammuted, videoroom} = this.state;
    const {type, id, bitrate} = data;

    if (type === "client-reconnect" && user.id === id) {
      this.exitRoom(true, () => {
        this.reinitClient(0);
      });
    } else if (type === "client-reload" && user.id === id) {
      window.location.reload();
    } else if (type === "client-disconnect" && user.id === id) {
      this.exitRoom(false);
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
      if (videoroom) videoroom.setBitrate(bitrate);
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
      //this.clearKeepAlive();
      this.setState({keepalive: setInterval(this.sendKeepAlive, 30 * 1000)});
    }, 20 * 1000);
  };

  sendKeepAlive = () => {
    const {user, janus} = this.state;
    if (user && janus && janus.isConnected && user.session && user.handle) {
      api
        .updateUser(user.id, user)
        .then((data) => {
          if (ConfigStore.isNewer(data.config_last_modified)) {
            log.info("[client] there is a newer config. Reloading ", data.config_last_modified);
            this.reloadConfig();
          }
        })
        .catch((err) => {
          log.error("[client] error sending keepalive", user.id, err);
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
    api.fetchConfig().then((data) => {
      ConfigStore.setGlobalConfig(data);
      const {premodStatus, question} = this.state;
      const newPremodStatus = ConfigStore.dynamicConfig(ConfigStore.PRE_MODERATION_KEY) === "true";
      if (newPremodStatus !== premodStatus) {
        this.setState({premodStatus: newPremodStatus});
        if (question) {
          this.handleQuestion();
        }
      }
    }).catch((err) => {
      log.error("[client] error reloading config", err);
    });
  };

  makeDelay = () => {
    this.setState({delay: true});
    setTimeout(() => {
      this.setState({delay: false});
    }, 3000);
  };

  handleQuestion = () => {
    const {question, user} = this.state;
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
    JanusStream.streamGalaxy(data.status, 4, "");
    if (data.status) {
      // remove question mark when sndman unmute our room
      if (this.state.question) {
        this.handleQuestion();
      }
    }
  };

  camMute = (cammuted) => {
    const {videoroom, user} = this.state;

    if (user.role === userRolesEnum.ghost) return;
    this.makeDelay();

    if (videoroom) {
      if (!cammuted) {
        this.stopLocalMedia(videoroom);
      } else {
        this.startLocalMedia(videoroom);
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

  stopLocalMedia = (videoroom) => {
    const {media, cammuted} = this.state;
    if (cammuted) return;
    log.info("[client] Stop local video stream");
    media?.video?.stream?.getTracks().forEach((t) => t.stop());
    devices?.audio_stream?.getTracks().forEach((t) => t.stop());
    const deviceId = media?.audio?.device || media?.audio?.devices?.[0]?.deviceId;
    if (deviceId) {
      this.setAudioDevice(deviceId, !!videoroom);
    }
    this.setState({cammuted: true, media});
    if (videoroom) videoroom.mute(true);
  };

  startLocalMedia = (videoroom) => {
    const {media: {video: {devices, device} = {}}, cammuted,} = this.state;
    if (!cammuted) return;
    log.info("[client] Bind local video stream");
    const deviceId = device || devices?.[0]?.deviceId;
    if (deviceId) {
      this.setVideoDevice(deviceId).then(() => {
        const {stream} = this.state.media.video;
        if (videoroom) videoroom.mute(false, stream);
        this.setState({cammuted: false});
      });
    }
  };

  micMute = () => {
    const {media: {audio: {stream}}, muted} = this.state;
    if (stream) {
      if (muted) this.micVolume();
      stream.getAudioTracks()[0].enabled = muted;
      muted ? devices.audio.context.resume() : devices.audio.context.suspend();
      this.setState({muted: !muted});
    }
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
      log.trace("[client] volume: ", volume);
      cc.clearRect(0, 0, c.width, c.height);
      cc.fillStyle = gradient;
      cc.fillRect(0, c.height - volume * 300, c.width, c.height);
    };
  };

  otherCamsMuteToggle = () => {
    const {feeds, muteOtherCams, isAv1} = this.state;

    if (!muteOtherCams) {
      // Should hide/mute now all videos.
      this.unsubscribeFrom(
        feeds.map((feed) => feed.id),
        /* onlyVideo= */ true
      );
      this.camMute(/* cammuted= */ false);
      this.setState({videos: NO_VIDEO_OPTION_VALUE, isKliOlamiShown: false});
      JanusStream.setVideo(NO_VIDEO_OPTION_VALUE);
    } else {
      // Should unmute/show now all videos.
      this.makeSubscriptionAudioMode();
      this.camMute(/* cammuted= */ true);
      const videos = isAv1 ? VIDEO_IS_AV1_360P_OPTION_VALUE : VIDEO_360P_OPTION_VALUE;
      this.setState({videos, isKliOlamiShown: true});
      JanusStream.setVideo(videos);
    }

    this.setState({muteOtherCams: !muteOtherCams});
  };

  toggleShidur = () => {
    const {shidur, user} = this.state;
    const stateUpdate = {shidur: !shidur};
    if (shidur) {
      JanusStream.toggle('shidur');
      this.setState(stateUpdate);
    } else {
      JanusStream.initStreaming(user);
      //stateUpdate.sourceLoading = true;
      this.setState(stateUpdate);
    }
  };

  toggleQuad = (isKliOlamiShown = !this.state.isKliOlamiShown) => {
    // JanusStream.toggle('quad');
    this.setState({isKliOlamiShown});
  }

  toggleUsersDisplays = () => {
    const hideUserDisplays = !this.state.hideUserDisplays
    localStorage.setItem("hideUserDisplays", hideUserDisplays);
    this.setState({hideUserDisplays});
  }

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

  renderLocalMedia = (width, height, index, isGroup) => {
    const {user, cammuted, question, muted} = this.state;
    const userName = user ? user.username : "";

    return (
      <div className={classNames("video", {"hidden": this.context.hideSelf})} key={index}>
        {this.renderVideoOverlay(!muted, question, cammuted, userName, isGroup)}

        {this.renderVideo(cammuted, "localVideo", width, height)}
      </div>
    );
  }

  renderMedia = (feed, width, height, layout) => {
    const {id, talking, question, cammute, display: {display: userName, is_group: isGroup}} = feed;
    const {muteOtherCams} = this.state;
    const muteCamera = cammute || muteOtherCams;

    const videoId = "video" + id;
    const remoteVideoId = "remoteVideo" + id;
    const remoteAudioId = "remoteAudio" + id;

    return (
      <div className={classNames("video", {"is-double-size": isGroup && layout !== "equal"})} key={"v" + id}
           ref={videoId} id={videoId}>
        {this.renderVideoOverlay(talking, question, muteCamera, userName, isGroup)}

        {this.renderVideo(muteCamera, remoteVideoId, width, height)}

        <audio
          key={"a" + id}
          ref={remoteAudioId}
          id={remoteAudioId}
          autoPlay={true}
          controls={false}
          playsInline={true}
        />
      </div>
    );
  };

  renderVideoOverlay = (talking, question, muteCamera, userName, isGroup) => {
    const { hideUserDisplays } = this.state;

    return (
      <div className={classNames("video__overlay", { "talk-frame": talking })}>
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
        {muteCamera &&
          <div className="camera-off-name">
              <span>{userName}</span>
          </div>
        }
        <div className="video__title">
          {!talking ? <Icon name="microphone slash" size="small" color="red" /> : ""}
          {isGroup ? <Icon name="group" size="small" style={{ margin: "0 .7em 0 .7em" }} /> : ""}
          {!muteCamera && !hideUserDisplays && (
            <Popup
              content={userName}
              mouseEnterDelay={200}
              mouseLeaveDelay={500}
              on="hover"
              trigger={<span className="title-name">{userName}</span>}/>
          )}
        </div>
      </div>
    );
  };

  renderVideo = (cammuted, id, width, height) =>
    <video
      className={classNames("", {hidden: cammuted})}
      ref={id}
      id={id}
      width={width}
      height={height}
      autoPlay={true}
      controls={false}
      muted={true}
      playsInline={true}
    />;

  renderBottomBar = (layout, otherFeedHasQuestion) => {
    const {t} = this.props;
    const {
      cammuted,
      delay,
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

    return (
      <AppBar position="static" color="default">
        <Toolbar className="bottom-toolbar" variant="dense">
          <ButtonGroup variant="contained" className={classNames("bottom-toolbar__item")} disableElevation>
            <Mute t={t} action={this.micMute.bind(this)} isOn={muted} ref="canvas1"/>
            <MuteVideo
              t={t}
              action={this.camMute.bind(this)}
              disabled={media.video.device === null || delay}
              isOn={cammuted}
            />
          </ButtonGroup>

          <ButtonGroup className={classNames("bottom-toolbar__item")} variant="contained" disableElevation>
            <Fullscreen t={t} isOn={isFullScreen()} action={toggleFullScreen}/>
            <KliOlamiToggle isOn={isKliOlamiShown} action={this.toggleQuad}/>
            <CloseBroadcast
              t={t}
              isOn={shidur}
              action={this.toggleShidur.bind(this)}
              disabled={room === "" || sourceLoading}
            />
            <ShowSelfBtn/>
            <Layout
              t={t}
              active={layout}
              action={this.updateLayout.bind(this)}
              disabled={room === "" || sourceLoading}
              iconDisabled={sourceLoading}
            />
            <AudioMode t={t} action={this.otherCamsMuteToggle.bind(this)} isOn={muteOtherCams} />
          </ButtonGroup>

          <ButtonGroup className={classNames("bottom-toolbar__item")} variant="contained" disableElevation>
            <AskQuestion
              t={t}
              isOn={!!question}
              disabled={!mqttOn || premodStatus || !media.audio.device || delay || otherFeedHasQuestion}
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

  renderTopBar = () => {
    const {t, i18n} = this.props;
    const {user, asideMsgCounter, leftAsideName, rightAsideName, isOpenTopMenu} = this.state;

    return (
      <AppBar color="default" position="static">
        <Toolbar className="top-toolbar">
          <TopMenu
            t={t}
            openSettings={() => this.setState({isSettings: true})}
            open={isOpenTopMenu}
            setOpen={(isOpen) => this.setState({isOpenTopMenu: isOpen})}
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
          { user?.allowed && (
            <>
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

              <Typography variant="h6" align="center" className={classNames("top-toolbar__item", "top-toolbar__title")}>
                {user?.group}
              </Typography>

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
            </>)
          }

          <Support />
          <Donations />
        </Toolbar>
      </AppBar>
    );
  };

  renderLeftAside = () => {
    const {leftAsideName, leftAsideSize} = this.state;
    const {i18n: {language}, theme,} = this.props;

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
        />
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

  renderNewVersionContent = (layout, isDeb, source, otherFeedHasQuestion, noOfVideos, remoteVideos) => {
    const {i18n} = this.props;
    const {attachedSource, chatVisible, room, shidur, user, rightAsideName, leftAsideSize, leftAsideName, isKliOlamiShown, kliOlamiAttached} = this.state;

    const notApproved = user && user.role !== userRolesEnum.user;

    const kliOlami = !!room && isKliOlamiShown && (
      <QuadStream
        close={() => this.toggleQuad(false)}
        toggleAttach={(val = !kliOlamiAttached) => this.setState({kliOlamiAttached: val})}
        attached={kliOlamiAttached}
        isDoubleSize={"double" === layout}
      />
    );

    const noBroadcastPanel = layout !== "split" ||
      (((room === "" || !shidur) || !attachedSource) && (!isKliOlamiShown || !kliOlamiAttached));

    return (
      <div className={classNames("vclient", {"vclient--chat-open": chatVisible})}>
        {this.renderTopBar(isDeb)}

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
                  broadcast--${(room !== "" && shidur) ? "on" : "off"}
                  broadcast--${!attachedSource ? "popup" : "inline"}
                  kli-olami--${isKliOlamiShown ? "on" : "off"}
                  kli-olami--${!kliOlamiAttached ? "popup" : "inline"}
                  ${noBroadcastPanel ? "no-broadcast-panel" : ""}
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

  renderNotAllowed = (isDeb) => {
    const {user} = this.state;

    return (
      <div className={classNames("vclient")}>
        {this.renderTopBar(isDeb)}
        <OnboardingDoor user={user} />
      </div>
    );
  }

  updateUserRole = () => {
    //getUser(this.checkPermission);
  };

  setIsRoomChat = (isRoomChat) => this.setState({isRoomChat});

  setVideos = (videos, isAv1 = this.state.isAv1) => this.setState({videos, isAv1});

  setAudio(audios, text) {
    this.setState({audios: {audios, text}});
    JanusStream.setAudio(audios, text);
  }

  render() {
    const {
      show_message,
      broadcast_message,
      show_notification,
      delay,
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
      videos,
      isAv1,
      isSettings,
      audios,
      shidurForGuestReady,
      isGroup,
      hideUserDisplays,
      isKliOlamiShown,
      kliOlamiAttached
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
    const layout = room === "" || currentLayout;

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
          attached={attachedSource}
          closeShidur={this.toggleShidur}
          setVideo={this.setVideos.bind(this)}
          setDetached={() => {
            this.setState({attachedSource: false});
          }}
          setAttached={() => {
            this.setState({attachedSource: true});
          }}
          videos={videos}
          isAv1={isAv1}
          setAudio={this.setAudio.bind(this)}
          audios={audios.audios}
          isDoubleSize={"double" === layout}
        />
      );
    }

    let otherFeedHasQuestion = false;
    let localPushed = false;
    let groupsNum = 0;
    let remoteVideos = sortAndFilterFeeds(feeds).reduce((result, feed) => {
      const {question, id} = feed;
      otherFeedHasQuestion = otherFeedHasQuestion || (question && id !== myid);

      if (!localPushed && ((!feed.display.is_group && isGroup) ||
          (feed.display.is_group === isGroup && feed.display.timestamp >= user.timestamp))) {
        localPushed = true;
        for (let i = 0; i < parseInt(numberOfVirtualUsers, 10); i++) {
          result.push(this.renderLocalMedia(width, height, i, isGroup));
        }
      }

      if (feed.display.is_group) {
        groupsNum += 1;
      }

      result.push(this.renderMedia(feed, width, height, layout));
      return result;
    }, []);

    if (!localPushed) {
      for (let i = 0; i < parseInt(numberOfVirtualUsers, 10); i++) {
        remoteVideos.push(this.renderLocalMedia(width, height, i, isGroup));
      }
    }

    const groupMultiplier = "equal" === layout ? 0 : 3;
    let noOfVideos = remoteVideos.length + groupMultiplier * groupsNum;
    if (this.context.hideSelf)
      noOfVideos -= 1;

    if (room !== "" && shidur && attachedSource) {
      if ("double" === layout) {
        noOfVideos += 4;
      } else if ("equal" === layout) {
        noOfVideos += 1;
      }
    }

    if (isKliOlamiShown && kliOlamiAttached) {
      if ("double" === layout) {
        noOfVideos += 4;
      } else if ("equal" === layout) {
        noOfVideos += 1;
      }
    }

    let login = <LoginPage user={user} checkPermission={this.checkPermission} loading={true} />;

    const isDeb = new URL(window.location.href).searchParams.has("deb");

    let content = user?.allowed ?
      this.renderNewVersionContent(layout, isDeb, source, otherFeedHasQuestion, noOfVideos, remoteVideos) :
      this.renderNotAllowed(isDeb);

    return (
      <Fragment>
        <PopUp show={show_notification} setClose={() => this.setState({show_notification: false})}/>
        <BroadcastNotification show={show_message} msg={broadcast_message} setClose={() => this.setState({show_message: false})} />
        {user?.allowed && Boolean(room) && (
          <SettingsJoined
            userDisplay={user.display}
            isOpen={isSettings}
            audio={media.audio}
            video={media.video}
            closeModal={() => this.setState({isSettings: false, isOpenTopMenu: false})}
            setAudio={this.setAudio.bind(this)}
            videoLength={media.video?.devices.length}
            audioModeChange={this.otherCamsMuteToggle}
            isAudioMode={muteOtherCams}
            audioDevice={media.audio?.device}
            setAudioDevice={this.setAudioDevice.bind(this)}
            audios={audios.audios}
            hideUserDisplays={hideUserDisplays}
            toggleUsersDisplays={this.toggleUsersDisplays.bind(this)}
          />
        )}
        {user?.allowed && !Boolean(room) && (
          <Settings
            user={user}
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
            delay={delay}
            startLocalMedia={this.startLocalMedia.bind(this)}
            stopLocalMedia={this.stopLocalMedia.bind(this)}
            hideUserDisplays={hideUserDisplays}
            toggleUsersDisplays={this.toggleUsersDisplays.bind(this)}
          />
        )}
        {user ? content : login}
      </Fragment>
    );
  }
}

VirtualMqttClient.contextType = GlobalOptionsContext
const WrappedClass = withTranslation()(withTheme(VirtualMqttClient));

export default class WrapperForThemes extends React.Component {
  render() {
    return (
      <ThemeSwitcher>
        <GlobalOptions>
          <WrappedClass/>
        </GlobalOptions>
      </ThemeSwitcher>
    );
  }
}

import React, {Component, Fragment} from 'react';
import {Janus} from '../../lib/janus';
import classNames from 'classnames';
import {isMobile} from 'react-device-detect';
import {Button, Icon, Input, Label, Menu, Popup, Select,Image} from 'semantic-ui-react';
import {checkNotification, geoInfo, getMedia, getMediaStream, initJanus, micLevel, reportToSentry, takeImage, testMic, wkliLeave} from '../../shared/tools';
import './VirtualClient.scss';
import './VideoConteiner.scss';
import './CustomIcons.scss';
import 'eqcss';
import VirtualChat from './VirtualChat';
import {initGxyProtocol} from '../../shared/protocol';
import {PROTOCOL_ROOM, vsettings_list} from '../../shared/consts';
import {GEO_IP_INFO, SENTRY_KEY} from '../../shared/env';
import platform from 'platform';
import {Help} from './components/Help';
import {withTranslation} from 'react-i18next';
import {languagesOptions, setLanguage} from '../../i18n/i18n';
import {Monitoring} from '../../components/Monitoring';
import {MonitoringData, LINK_STATE_INIT, LINK_STATE_GOOD, LINK_STATE_MEDIUM, LINK_STATE_WEAK} from '../../shared/MonitoringData';
import api from '../../shared/Api';
import VirtualStreaming from './VirtualStreaming';
import VirtualStreamingJanus from './VirtualStreamingJanus';
import {kc} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";
import {Profile} from "../../components/Profile";
import * as Sentry from "@sentry/browser";
import VerifyAccount from './components/VerifyAccount';
import GxyJanus from "../../shared/janus-utils";
import connectionOrange from './connection-orange.png';
import connectionWhite from './connection-white.png';
import connectionRed from './connection-red.png';
import connectionGray from './connection-gray.png';

class VirtualClient extends Component {

  state = {
    chatMessagesCount: 0,
    creatingFeed: false,
    delay: true,
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
    rooms: [],
    room: '',
    selected_room: parseInt(localStorage.getItem('room'), 10) || '',
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
    selftest: this.props.t('oldClient.selfAudioTest'),
    tested: false,
    support: false,
    monitoringData: new MonitoringData(),
    connectionStatus: '',
    numberOfVirtualUsers: localStorage.getItem('number_of_virtual_users') || '1',
    currentLayout: localStorage.getItem('currentLayout') || 'double',
    attachedSource: true,
    sourceLoading: true,
    virtualStreamingJanus: new VirtualStreamingJanus(() => this.virtualStreamingInitialized()),
    appInitError: null,
    upval: null,
    net_status: 1,
    keepalive: null,
  };

  virtualStreamingInitialized() {
    this.setState({sourceLoading: false});
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.shidur && !prevState.shidur && !this.state.sourceLoading && this.room) {
      this.state.virtualStreamingJanus.audioElement.muted = false;
    }
    if (!this.state.sourceLoading && prevState.sourceLoading && this.state.shidur && this.room) {
      this.state.virtualStreamingJanus.audioElement.muted = false;
    }
    if (this.state.room && !prevState.room && this.state.shidur && !this.sourceLoading) {
      this.state.virtualStreamingJanus.audioElement.muted = false;
    }
    if (this.state.videoroom !== prevState.videoroom ||
      this.state.localVideoTrack !== prevState.localVideoTrack ||
      this.state.localAudioTrack !== prevState.localAudioTrack ||
      JSON.stringify(this.state.user) !== JSON.stringify(prevState.user)) {
      this.state.monitoringData.setConnection(
        this.state.videoroom,
        this.state.localAudioTrack,
        this.state.localVideoTrack,
        this.state.user);
      this.state.monitoringData.setOnStatus((connectionStatus, connectionStatusMessage) => {
        this.setState({connectionStatus});
      });
    }
  }

  componentDidMount() {
    Sentry.init({dsn: `https://${SENTRY_KEY}@sentry.kli.one/2`});
    if (isMobile) {
      window.location = '/userm';
    }
  }

  componentWillUnmount() {
    this.state.virtualStreamingJanus.destroy();
  }

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

  initApp = (user) => {
    const {t} = this.props;
    localStorage.setItem('question', false);
    localStorage.setItem('sound_test', false);
    localStorage.setItem('uuid', user.id);
    checkNotification();
    let system = navigator.userAgent;
    user.system = system;
    let browser = platform.parse(system);
    if (!(/Safari|Firefox|Chrome/.test(browser.name))) {
      alert(t('oldClient.browserNotSupported'));
      return
    }

    geoInfo(`${GEO_IP_INFO}`, data => {
      user.ip = data && data.ip ? data.ip : '127.0.0.1';
      user.country = data && data.country ? data.country : 'XX';
      this.setState({user});

      api.fetchConfig()
          .then(data => GxyJanus.setGlobalConfig(data))
          .then(() => (api.fetchAvailableRooms({with_num_users: true})))
          .then(data => {
            const {rooms} = data;
            this.setState({rooms});
            this.initDevices();
            const {selected_room} = this.state;
            if (selected_room !== '') {
              const room = rooms.find(r => r.room === selected_room);
              if (room) {
                user.room = selected_room;
                user.janus = room.janus;
                user.group = room.description;
                this.setState({delay: false, user});
              } else {
                this.setState({selected_room: '', delay: false});
              }
            } else {
              this.setState({delay: false});
            }
          })
          .catch(err => {
            console.error("[VirtualClient] error initializing app", err);
            this.setState({appInitError: err});
          });
    });
  }

  initClient = (reconnect, retry = 0) => {
    this.setState({delay: true});
    const user = Object.assign({}, this.state.user);
    const {t} = this.props;
    if (this.state.janus) {
      this.state.janus.destroy();
    }


    const config = GxyJanus.instanceConfig(user.janus);
    initJanus(janus => {
      // Check if unified plan supported
      if (Janus.unifiedPlan) {
        user.session = janus.getSessionId();
        this.setState({janus});
        this.chat.initChat(janus);
        this.initVideoRoom(reconnect, user);
      } else {
        alert(t('oldClient.unifiedPlanNotSupported'));
      }
    }, err => {
      this.exitRoom(true, () => {
        console.error("[VirtualClient] error initializing janus", err);
        this.reinitClient(retry);
      });
    }, config.url, config.token, config.iceServers);

    if(!reconnect) {
      const {ip, country} = user;
      this.state.virtualStreamingJanus.init(ip, country);
    }
  };

  reinitClient = (retry) => {
    retry++;
    console.error("[VirtualClient] reinitializing try: ", retry);
    if(retry < 10) {
      setTimeout(() => {
        this.initClient(true, retry);
      }, 5000)
    } else {
      this.exitRoom(false, () => {
        console.error("[VirtualClient] reinitializing failed after: " + retry + " retries");
        alert(this.props.t('oldClient.networkSettingsChanged'));
      });
    }
  };

  initDevices = () => {
    const {t} = this.props;
    getMedia(this.state.media)
        .then(media => {
          console.log("Got media: ", media);
          const {audio,video} = media;

          if(audio.error && video.error) {
            alert(t('oldClient.noInputDevices'));
            this.setState({cammuted: true});
          } else if(audio.error) {
            alert('audio device not detected');
          } else if(video.error) {
            alert(t('oldClient.videoNotDetected'));
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
    const {t} = this.props;
    this.setState({ selftest: t('oldClient.recording') + 9 });
    testMic(this.state.media.audio.stream);
    let rect = 9;
    let rec = setInterval(() => {
      rect--;
      this.setState({ selftest: t('oldClient.recording') + rect });
      if (rect <= 0) {
        clearInterval(rec);
        let playt = 11;
        let play = setInterval(() => {
          playt--;
          this.setState({ selftest: t('oldClient.playing') + playt });
          if (playt <= 0) {
            clearInterval(play);
            this.setState({ selftest: t('oldClient.selfAudioTest'), tested: true });
          }
        }, 1000);
      }
    }, 1000);
  };

  selectRoom = (selected_room) => {
    const {rooms} = this.state;
    const user = Object.assign({}, this.state.user);
    const room = rooms.find(r => r.room === selected_room);
    const name = room.description;
    if (this.state.room === selected_room) {
      return;
    }
    localStorage.setItem('room', selected_room);
    user.room = selected_room;
    user.group = name;
    user.janus = room.janus;
    this.setState({selected_room, user});
  };

  exitRoom = (reconnect, callback) => {
    this.setState({delay: true})
    wkliLeave(this.state.user);
    clearInterval(this.state.upval);
    this.clearKeepAlive();

    localStorage.setItem('question', false);

    api.fetchAvailableRooms({with_num_users: true})
        .then(data => {
          const {rooms} = data;
          this.setState({rooms});
        });


    let {videoroom, remoteFeed, protocol, janus, room} = this.state;
    if(remoteFeed) remoteFeed.detach();
    if(videoroom) videoroom.send({"message": {request: 'leave', room}});
    let pl = {textroom: 'leave', transaction: Janus.randomString(12), 'room': PROTOCOL_ROOM};
    if(protocol) protocol.data({text: JSON.stringify(pl)});
    this.chat.exitChatRoom(room);

    setTimeout(() => {
      if(videoroom) videoroom.detach();
      if(protocol) protocol.detach();
      if(janus) janus.destroy();
      this.state.virtualStreamingJanus.audioElement.muted = !reconnect;
      this.setState({
        cammuted: false, muted: false, question: false,
        feeds: [], mids: [],
        localAudioTrack: null, localVideoTrack: null, upval: null,
        remoteFeed: null, videoroom: null, protocol: null, janus: null,
        delay: reconnect,
        room: reconnect ? room : '',
        chatMessagesCount: 0,
      });
      if(typeof callback === "function") callback();
    }, 2000);
  }

  iceState = () => {
    let count = 0;
    let chk = setInterval(() => {
      count++;
      let {ice} = this.state;
      if (count < 11 && ice === 'connected') {
        clearInterval(chk);
      }
      if (count >= 10) {
        clearInterval(chk);
        this.exitRoom(true, () => {
          console.error("ICE Disconnected");
          this.initClient(true);
        });
        reportToSentry("ICE State disconnected",{source: "ice"}, this.state.user);
      }
    }, 3000);
  };

  mediaState = (media) => {
    const {t} = this.props;
    // Handle video
    if (media === 'video') {
      let count = 0;
      let chk = setInterval(() => {
        count++;
        let {video, ice} = this.state;

        // Video is back stop counter
        if (count < 11 && video) {
          clearInterval(chk);
        }

        // Network problem handled in iceState
        if (count < 11 && ice === 'disconnected') {
          clearInterval(chk);
        }

        // Video still not back disconnecting
        if (count >= 10) {
          clearInterval(chk);
          reportToSentry("Video stopped",{source: "media"}, this.state.user);
          alert(t('oldClient.serverStoppedReceiveOurMedia'));
        }
      }, 3000);
    }

    //Handle audio
    if (media === 'audio') {
      let count = 0;
      let chk = setInterval(() => {
        count++;
        let {audio, video, ice, question} = this.state;

        // Audio is back stop counter
        if (count < 11 && audio) {
          clearInterval(chk);
        }

        // Network problem handled in iceState
        if (count < 11 && ice === 'disconnected') {
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
          reportToSentry("Audio stopped",{source: "media"}, this.state.user);
          alert(t('oldClient.serverStoppedReceiveOurAudio'));
        }
      }, 3000);
    }
  };

  initVideoRoom = (reconnect, user) => {
    this.state.janus.attach({
      plugin: 'janus.plugin.videoroom',
      opaqueId: 'videoroom_user',
      success: (videoroom) => {
        Janus.log(' :: My handle: ', videoroom);
        Janus.log('Plugin attached! (' + videoroom.getPlugin() + ', id=' + videoroom.getId() + ')');
        Janus.log('  -- This is a publisher/manager');
        user.handle = videoroom.getId();
        this.setState({videoroom});
        this.joinRoom(reconnect, videoroom, user);
      },
      error: (error) => {
        Janus.log('Error attaching plugin: ' + error);
        reportToSentry(error,{source: "videoroom"}, this.state.user);
      },
      consentDialog: (on) => {
        Janus.debug('Consent dialog should be ' + (on ? 'on' : 'off') + ' now');
      },
      iceState: (state) => {
        Janus.log('ICE state changed to ' + state);
        this.setState({ ice: state });
        this.state.monitoringData.onIceState(state);
        if (state === 'disconnected') {
          // FIXME: ICE restart does not work properly, so we will do silent reconnect
          this.iceState();
        }
      },
      mediaState: (media, on) => {
        Janus.log('Janus ' + (on ? 'started' : 'stopped') + ' receiving our ' + media);
        this.setState({ [media]: on });
        if (!on) {
          this.mediaState(media);
        }
      },
      webrtcState: (on) => {
        Janus.log('Janus says our WebRTC PeerConnection is ' + (on ? 'up' : 'down') + ' now');
      },
      slowLink: (uplink, lost, mid) => {
        const slowLinkType = uplink ? 'sending' : 'receiving';
        Janus.log('Janus reports problems ' + slowLinkType + ' packets on mid ' + mid + ' (' + lost + ' lost packets)');
        this.state.monitoringData.onSlowLink(slowLinkType, lost);
      },
      onmessage: (msg, jsep) => {
        this.onMessage(this.state.videoroom, msg, jsep, false);
      },
      onlocaltrack: (track, on) => {
        Janus.log(' ::: Got a local track event :::');
        Janus.log('Local track ' + (on ? 'added' : 'removed') + ':', track);
        let {videoroom} = this.state;
        videoroom.muteAudio();
        if(track && track.kind) {
          if (track.kind === 'video') {
            this.setState({localVideoTrack: track});
          }
          if (track.kind === 'audio') {
            this.setState({localAudioTrack: track});
          }
        }
      },
      onremotestream: (stream) => {
        // The publisher stream is sendonly, we don't expect anything here
      },
      ondataopen: (label) => {
        Janus.log('Publisher - DataChannel is available! (' + label + ')');
      },
      ondata: (data, label) => {
        Janus.log('Publisher - Got data from the DataChannel! (' + label + ')' + data);
      },
      oncleanup: () => {
        Janus.log(' ::: Got a cleanup notification: we are unpublished now :::');
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
        Janus.debug('Got publisher SDP!');
        Janus.debug(jsep);
        let publish = { request: 'configure', audio: useAudio, video: useVideo, data: true };
        videoroom.send({ 'message': publish, 'jsep': jsep });
      },
      error: (error) => {
        Janus.error('WebRTC error:', error);
        reportToSentry(JSON.stringify(error),{source: "webrtc"}, this.state.user);
      }
    });
  };

  onMessage = (videoroom, msg, jsep) => {
    const {t} = this.props;
    Janus.log(' ::: Got a message (publisher) :::');
    Janus.log(msg);
    let event = msg['videoroom'];
    if (event !== undefined && event !== null) {
      if (event === 'joined') {
        const user = Object.assign({}, this.state.user);
        let myid = msg['id'];
        let mypvtid = msg['private_id'];
        Janus.log('Successfully joined room ' + msg['room'] + ' with ID ' + myid);

        user.rfid = myid;
        this.setState({user, myid, mypvtid, room: msg['room'], delay: false});

        api.updateUser(user.id, user)
            .catch(err => console.error("[User] error updating user state", user.id, err));
        this.keepAlive();

        const {media: {audio: {audio_device}, video: {video_device}}} = this.state;
        this.publishOwnFeed(!!video_device, !!audio_device);

        // Any new feed to attach to?
        if (msg['publishers'] !== undefined && msg['publishers'] !== null) {
          //FIXME: display property is JSON write now, let parse it in one place
          let list = msg['publishers'].filter(l => l.display = (JSON.parse(l.display)));
          let feeds = list.sort((a, b) => a.display.timestamp - b.display.timestamp).filter(f => !f.display.role.match(/^(ghost|guest)$/));
          Janus.log(':: Got Pulbishers list: ', feeds);

          // Feeds count with user role
          let feeds_count = feeds.filter(f => f.display.role === "user").length;
          if (feeds_count > 25) {
            alert(t('oldClient.maxUsersInRoom'));
            this.exitRoom(false);
          }

          Janus.debug('Got a list of available publishers/feeds:');
          Janus.log(list);
          this.makeSubscription(feeds, false);
        }
      } else if (event === 'talking') {
        const feeds = Object.assign([], this.state.feeds);
        const id = msg['id'];
        Janus.log('User: ' + id + ' - start talking');
        for (let i = 0; i < feeds.length; i++) {
          if (feeds[i] && feeds[i].id === id) {
            feeds[i].talking = true;
          }
        }
        this.setState({feeds});
      } else if (event === 'stopped-talking') {
        const feeds = Object.assign([], this.state.feeds);
        const id = msg['id'];
        Janus.log('User: ' + id + ' - stop talking');
        for (let i = 0; i < feeds.length; i++) {
          if (feeds[i] && feeds[i].id === id) {
            feeds[i].talking = false;
          }
        }
        this.setState({feeds});
      } else if (event === 'destroyed') {
        // The room has been destroyed
        Janus.warn('The room has been destroyed!');
      } else if (event === 'event') {

        // Any info on our streams or a new feed to attach to?
        let { user, myid } = this.state;
        if (msg['streams'] !== undefined && msg['streams'] !== null) {
          let streams = msg['streams'];
          for (let i in streams) {
            let stream = streams[i];
            stream['id'] = myid;
            stream['display'] = user;
          }
          //console.log("MY STREAM: ",streams)
        } else if (msg['publishers'] !== undefined && msg['publishers'] !== null) {
          let feeds = msg['publishers'].filter(l => l.display = (JSON.parse(l.display)));

          Janus.debug('New list of available publishers/feeds:');
          Janus.debug(feeds);

          this.makeSubscription(feeds, true);

        } else if (msg['leaving'] !== undefined && msg['leaving'] !== null) {
          // One of the publishers has gone away?
          const leaving = msg['leaving'];
          Janus.log('Publisher left: ' + leaving);
          this.unsubscribeFrom(leaving);
        } else if (msg['unpublished'] !== undefined && msg['unpublished'] !== null) {
          const unpublished = msg['unpublished'];
          Janus.log('Publisher left: ' + unpublished);
          if (unpublished === 'ok') {
            // That's us
            videoroom.hangup();
            return;
          }
          this.unsubscribeFrom(unpublished);
        } else if (msg['error'] !== undefined && msg['error'] !== null) {
          if (msg['error_code'] === 426) {
            Janus.log('This is a no such room');
          } else {
            Janus.log(msg['error']);
            reportToSentry(msg['error'],{source: "videoroom"}, this.state.user);
          }
        }
      }
    }
    if (jsep !== undefined && jsep !== null) {
      Janus.debug('Handling SDP as well...');
      Janus.debug(jsep);
      videoroom.handleRemoteJsep({ jsep: jsep });
    }
  };

  newRemoteFeed = (subscription) => {
    this.state.janus.attach(
      {
        plugin: 'janus.plugin.videoroom',
        opaqueId: 'remotefeed_user',
        success: (pluginHandle) => {
          const remoteFeed = pluginHandle;
          Janus.log('2 Plugin attached! (' + remoteFeed.getPlugin() + ', id=' + remoteFeed.getId() + ')');
          Janus.log('  -- This is a multistream subscriber', remoteFeed);
          this.setState({remoteFeed, creatingFeed: false});
          // We wait for the plugin to send us an offer
          let subscribe = {
            request: 'join',
            room: this.state.room,
            ptype: 'subscriber',
            streams: subscription
          };
          remoteFeed.send({message: subscribe});
        },
        error: (error) => {
          Janus.error('  -- Error attaching plugin...', error);
          reportToSentry(error,{source: "remotefeed"}, this.state.user);
        },
        iceState: (state) => {
          Janus.log('ICE state (remote feed) changed to ' + state);
        },
        webrtcState: (on) => {
          Janus.log('Janus says this WebRTC PeerConnection (remote feed) is ' + (on ? 'up' : 'down') + ' now');
        },
        slowLink: (uplink, nacks) => {
          Janus.warn('Janus reports problems ' + (uplink ? 'sending' : 'receiving') +
            ' packets on this PeerConnection (remote feed, ' + nacks + ' NACKs/s ' + (uplink ? 'received' : 'sent') + ')');
        },
        onmessage: (msg, jsep) => {
          Janus.log(' ::: Got a message (subscriber) :::');
          Janus.log(msg);
          const event = msg['videoroom'];
          Janus.log('Event: ' + event);
          if (msg['error'] !== undefined && msg['error'] !== null) {
            Janus.debug('-- ERROR: ' + msg['error']);
            reportToSentry(msg['error'],{source: "remotefeed"}, this.state.user);
          } else if (event !== undefined && event !== null) {
            if (event === 'attached') {
              this.setState({ creatingFeed: false });
              Janus.log('Successfully attached to feed in room ' + msg['room']);
            } else if (event === 'event') {
              // Check if we got an event on a simulcast-related event from this publisher
            } else {
              // What has just happened?
            }
          }
          if (msg['streams']) {
            // Update map of subscriptions by mid
            const mids = Object.assign([], this.state.mids);
            for (let i in msg['streams']) {
              let mindex = msg['streams'][i]['mid'];
              //let feed_id = msg["streams"][i]["feed_id"];
              mids[mindex] = msg['streams'][i];
            }
            this.setState({mids});
          }
          if (jsep !== undefined && jsep !== null) {
            const { remoteFeed } = this.state;
            Janus.debug('Handling SDP as well...');
            Janus.debug(jsep);
            // Answer and attach
            remoteFeed.createAnswer(
              {
                jsep: jsep,
                // Add data:true here if you want to subscribe to datachannels as well
                // (obviously only works if the publisher offered them in the first place)
                media: { audioSend: false, videoSend: false, data: true },  // We want recvonly audio/video
                success: (jsep) => {
                  Janus.debug('Got SDP!');
                  Janus.debug(jsep);
                  let body = {request: 'start', room: this.state.room};
                  remoteFeed.send({message: body, jsep: jsep});
                },
                error: (error) => {
                  Janus.error('WebRTC error:', error);
                  Janus.debug('WebRTC error... ' + JSON.stringify(error));
                  reportToSentry(JSON.stringify(error),{source: "remotefeed"}, this.state.user);
                }
              });
          }
        },
        onlocaltrack: (track, on) => {
          // The subscriber stream is recvonly, we don't expect anything here
        },
        onremotetrack: (track, mid, on) => {
          Janus.log(' ::: Got a remote track event ::: (remote feed)');
          if (!mid) {
            mid = track.id.split('janus')[1];
          }
          Janus.log('Remote track (mid=' + mid + ') ' + (on ? 'added' : 'removed') + ':', track);
          // Which publisher are we getting on this mid?
          let {mids} = this.state;
          let feed = mids[mid].feed_id;
          Janus.log(' >> This track is coming from feed ' + feed + ':', mid);
          // If we're here, a new track was added
          if (track.kind === 'audio' && on) {
            // New audio track: create a stream out of it, and use a hidden <audio> element
            let stream = new MediaStream();
            stream.addTrack(track.clone());
            Janus.log('Created remote audio stream:', stream);
            let remoteaudio = this.refs['remoteAudio' + feed];
            Janus.attachMediaStream(remoteaudio, stream);
          } else if (track.kind === 'video' && on) {
            // New video track: create a stream out of it
            let stream = new MediaStream();
            stream.addTrack(track.clone());
            Janus.log('Created remote video stream:', stream);
            let remotevideo = this.refs['remoteVideo' + feed];
            Janus.attachMediaStream(remotevideo, stream);
          }
        },
        ondataopen: (label) => {
          Janus.log('Feed - DataChannel is available! (' + label + ')');
        },
        ondata: (data, label) => {
          Janus.debug('Feed - Got data from the DataChannel! (' + label + ')' + data);
          let msg = JSON.parse(data);
          this.onRoomData(msg);
          Janus.log(' :: We got msg via DataChannel: ', msg);
        },
        oncleanup: () => {
          Janus.log(' ::: Got a cleanup notification (remote feed) :::');
        }
      });
  };

  makeSubscription = (feeds, new_feed) => {
    let subscription = [];
    for (let f in feeds) {
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
        if (video) {
          subscription.push({feed: id, mid: stream.mid});
        }
        if (audio) {
          subscription.push({feed: id, mid: stream.mid});
        }
        if (data) {
          subscription.push({feed: id, mid: stream.mid});
        }
      }
    }
    this.setState({feeds:[...this.state.feeds,...feeds]});
    if (subscription.length > 0) {
      this.subscribeTo(subscription);
      if(new_feed) {
        // Send question event for new feed
        setTimeout(() => {
          if (this.state.question) {
            this.sendDataMessage('question', true);
          }
        }, 3000);
      }
    }
  }

  subscribeTo = (subscription) => {
    // New feeds are available, do we need create a new plugin handle first?
    if (this.state.remoteFeed) {
      this.state.remoteFeed.send({
        message: {request: 'subscribe', streams: subscription}
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
    this.setState({ creatingFeed: true });
    this.newRemoteFeed(subscription);
  };

  unsubscribeFrom = (id) => {
    // Unsubscribe from this publisher
    const {remoteFeed} = this.state;
    const feeds = Object.assign([], this.state.feeds);
    for (let i = 0; i<feeds.length; i++) {
      if (feeds[i].id === id) {
        Janus.log('Feed ' + feeds[i] + ' (' + id + ') has left the room, detaching');
        feeds.splice(i, 1);
        // Send an unsubscribe request
        let unsubscribe = {request: 'unsubscribe', streams: [{ feed: id }]};
        if (remoteFeed !== null) {
          remoteFeed.send({ message: unsubscribe });
        }
        this.setState({feeds});
        break;
      }
    }
  };

  sendDataMessage = (user) => {
    const {videoroom} = this.state;
    const message = JSON.stringify(user);
    Janus.log(':: Sending message: ', message);
    videoroom.data({ text: message });
  };

  joinRoom = (reconnect, videoroom, user) => {
    let {janus, selected_room, tested, media} = this.state;
    const {video: {video_device}} = media;
    user.self_test = tested;
    user.camera = !!video_device;
    user.sound_test = reconnect ? JSON.parse(localStorage.getItem('sound_test')) : false;
    //user.question = reconnect ? JSON.parse(localStorage.getItem('question')) : false;
    user.question = false;
    user.timestamp = Date.now();
    this.setState({user, muted: true});

    if(video_device) {
      if(this.state.upval) {
        clearInterval(this.state.upval);
      }
      takeImage(user);
      let upval = setInterval(() => {
        takeImage(user);
      }, 10*60000);
      this.setState({upval});
    }

    this.setState({user});

    initGxyProtocol(janus, user, protocol => {
      this.setState({protocol});
    }, ondata => {
      Janus.log('-- :: It\'s protocol public message: ', ondata);
      const { type, error_code, id, room } = ondata;
      if (type === 'error' && error_code === 420) {
        this.exitRoom(false, () => {
          alert(this.props.t('oldClient.error') + ondata.error);
        });
      } else if (type === 'joined') {
        const {id,timestamp,role,display} = user;
        const d = {id,timestamp,role,display};
        let register = {'request': 'join', 'room': selected_room, 'ptype': 'publisher', 'display': JSON.stringify(d)};
        videoroom.send({"message": register,
          success: () => {
            this.chat.initChatRoom(user, selected_room);
          },
          error: (error) => {
            console.error(error);
            reportToSentry(error,{source: "register"}, this.state.user);
            this.exitRoom(false);
          }
        });
      } else if (type === 'chat-broadcast' && room === selected_room) {
        this.chat.showSupportMessage(ondata);
      } else if (type === 'client-reconnect' && user.id === id) {
        this.exitRoom(true);
      } else if (type === 'client-reload' && user.id === id) {
        window.location.reload();
      } else if (type === 'client-disconnect' && user.id === id) {
        this.exitRoom(false);
      } else if(type === "client-kicked" && user.id === id) {
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
      } else if (type === 'audio-out' && room === selected_room) {
        this.handleAudioOut(ondata);
      }
    });
  };

  keepAlive = () => {
    // send every 2 seconds
    this.setState({keepalive: setInterval(this.sendKeepAlive, 2*1000)});

    // after 20 seconds, increase interval from 2 to 30 seconds.
    setTimeout(() => {
      this.clearKeepAlive();
      this.setState({keepalive: setInterval(this.sendKeepAlive, 30*1000)});
    }, 20*1000);
  };

  sendKeepAlive = () => {
    const {user, janus} = this.state;
    if (user && janus && janus.isConnected() && user.session && user.handle) {
      console.debug("[User] sendKeepAlive", new Date());
      api.updateUser(user.id, user)
          .catch(err => console.error("[User] error sending keepalive", user.id, err));
    }
  };

  clearKeepAlive = () => {
    const {keepalive} = this.state;
    if (keepalive) {
      clearInterval(keepalive);
    }
    this.setState({keepalive: null});
  }

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

  handleAudioOut = (data) => {
    this.state.virtualStreamingJanus.streamGalaxy(data.status, 4, "");
    if (data.status) {
      // remove question mark when sndman unmute our room
      if (this.state.question) {
        this.handleQuestion();
      }
    }
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

  toggleShidur = () => {
    const {virtualStreamingJanus, shidur, user} = this.state;
    const stateUpdate = {shidur: !shidur};
    if (shidur) {
      virtualStreamingJanus.destroy();
    } else {
      const {ip, country} = user;
      virtualStreamingJanus.init(ip, country);
      stateUpdate.sourceLoading = true;
    }
    this.setState(stateUpdate);
  };

  updateLayout = (currentLayout) => {
    this.setState({ currentLayout }, () => {
      localStorage.setItem('currentLayout', currentLayout);
    });
  }

  onChatMessage = () => {
    this.setState({chatMessagesCount: this.state.chatMessagesCount + 1});
  };

  mapDevices = (devices) => {
    return devices.map(({label, deviceId}, i) => {
      return ({key: i, text: label, value: deviceId});
    });
  };

  connectionIcon = () => {
    switch (this.state.connectionStatus) {
      case LINK_STATE_INIT:
        return connectionGray;
      case LINK_STATE_GOOD:
        return connectionWhite;
      case LINK_STATE_MEDIUM:
        return connectionOrange;
      case LINK_STATE_WEAK:
        return connectionRed;
      default:
        return connectionGray;
    }
  }

  renderLocalMedia = (width, height, index) => {
    const {user, cammuted, question, muted} = this.state;

    return (<div className="video" key={index}>
      <div className={classNames('video__overlay')}>
        {question ?
          <div className="question">
            <svg viewBox="0 0 50 50">
              <text x="25" y="25" textAnchor="middle"
                    alignmentBaseline="central"
                    dominantBaseline="central">&#xF128;</text>
            </svg>
          </div>
          :
          ''
        }
        <div className="video__title">
          {muted ? <Icon name="microphone slash" size="small" color="red" style={{verticalAlign: 'middle'}} /> : ''}
          <div style={{display: 'inline-block', verticalAlign: 'middle'}}>{user ? user.display : ''}</div>
          <Image src={this.connectionIcon()} style={{height: '1em', objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle', marginLeft: '0.4em'}} />
        </div>
      </div>
      <svg className={classNames('nowebcam', {'hidden': !cammuted})} viewBox="0 0 32 18"
           preserveAspectRatio="xMidYMid meet">
        <text x="16" y="9" textAnchor="middle" alignmentBaseline="central"
              dominantBaseline="central">&#xf2bd;</text>
      </svg>
      <video
        className={classNames('mirror', {'hidden': cammuted})}
        ref="localVideo"
        id="localVideo"
        width={width}
        height={height}
        autoPlay={true}
        controls={false}
        muted={true}
        playsInline={true} />
    </div>);
  };

  renderMedia = (feed, width, height) => {
    const {id, talking, question, cammute, display: { display }} = feed;

    return (<div className="video" key={'v' + id} ref={'video' + id} id={'video' + id}>
      <div className={classNames('video__overlay', { 'talk-frame': talking })}>
        {question ? <div className="question">
          <svg viewBox="0 0 50 50">
            <text x="25" y="25" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">&#xF128;</text>
          </svg>
        </div> : ''}
        <div className="video__title">{!talking ? <Icon name="microphone slash" size="small" color="red" /> : ''}{display}</div>
      </div>
      <svg className={classNames('nowebcam', {'hidden': !cammute})} viewBox="0 0 32 18" preserveAspectRatio="xMidYMid meet">
        <text x="16" y="9" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">&#xf2bd;</text>
      </svg>
      <video
        key={'v' + id}
        ref={'remoteVideo' + id}
        id={'remoteVideo' + id}
        width={width}
        height={height}
        autoPlay={true}
        controls={false}
        muted={true}
        playsInline={true} />
      <audio
        key={'a' + id}
        ref={'remoteAudio' + id}
        id={'remoteAudio' + id}
        autoPlay={true}
        controls={false}
        playsInline={true} />
    </div>);
  }

  render() {
    const {
      attachedSource,
      cammuted,
      chatMessagesCount,
      chatVisible,
      currentLayout,
      delay,
      feeds,
      janus,
      localVideoTrack,
      localAudioTrack,
      monitoringData,
      muted,
      myid,
      numberOfVirtualUsers,
      question,
      room,
      rooms,
      selected_room,
      selftest,
      shidur,
      sourceLoading,
      tested,
      user,
      virtualStreamingJanus,
      appInitError,
      net_status,
      media,
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

    const {t, i18n} = this.props;
    const width = '134';
    const height = '100';
    const layout = (room === '' || !shidur || !attachedSource) ? 'equal' : currentLayout;

    let layoutIcon;
    switch (layout) {
    case 'double':
      layoutIcon = 'layout-double';
      break;
    case 'split':
      layoutIcon = 'layout-split';
      break;
    default:
      layoutIcon = 'layout-equal';
      break;
    }

    let source = room !== '' && shidur &&
      <VirtualStreaming
        virtualStreamingJanus={virtualStreamingJanus}
        attached={attachedSource}
        closeShidur={this.toggleShidur}
        setDetached={() => {
          this.setState({ attachedSource: false });
        }}
        setAttached={() => {
          this.setState({ attachedSource: true });
        }}
      />;

    let rooms_list = rooms.map((data, i) => {
      const { room, description, num_users } = data;
      return ({ key: i, text: description, description: num_users, value: room });
    });

    let adevices_list = this.mapDevices(media.audio.devices);
    let vdevices_list = this.mapDevices(media.video.devices);

    let otherFeedHasQuestion = false;
    let localPushed          = false;
    let videos = feeds.filter(feed => feed.display.role === "user").reduce((result, feed) => {
      const { question, id } = feed;
      otherFeedHasQuestion   = otherFeedHasQuestion || (question && id !== myid);
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
        videos.push(this.renderLocalMedia(width, height, i));
      }
    }

    let noOfVideos = videos.length;
    if (room !== '') {
      if (shidur && attachedSource && ['double', 'equal'].includes(layout)) {
        noOfVideos += 1; // + Source
      }
    }

    const chatCountLabel = (<Label key='Carbon' floating size='mini' color='red'>{chatMessagesCount}</Label>);

    let login = (<LoginPage user={user} checkPermission={this.checkPermission} />);

    let content = (<div className={classNames('vclient', { 'vclient--chat-open': chatVisible })}>
			<VerifyAccount user={user} loginPage={false} i18n={i18n} />
      <div className="vclient__toolbar">
        <Input>
          <Select
            className = "room-selection"
            search
            disabled={!!room}
            error={!selected_room}
            placeholder={t('oldClient.selectRoom')}
            value={selected_room}
            options={rooms_list}
            noResultsMessage={t('oldClient.noResultsFound')}
            //onClick={this.getRoomList}
            onChange={(e, { value }) => this.selectRoom(value)} />
          {room ? <Button attached='right' negative icon='sign-out' disabled={delay} onClick={() => this.exitRoom(false)} /> : ''}
          {!room ? <Button attached='right' primary icon='sign-in' loading={delay} disabled={delay || !selected_room} onClick={() => this.initClient(false)} /> : ''}
        </Input>
        { !(new URL(window.location.href).searchParams.has('deb')) ? null : (
        <Input>
          <Select placeholder='number of virtual users' options={[
            { value: '1', text: '1' },
            { value: '2', text: '2' },
            { value: '3', text: '3' },
            { value: '4', text: '4' },
            { value: '5', text: '5' },
            { value: '6', text: '6' },
            { value: '7', text: '7' },
            { value: '8', text: '8' },
            { value: '9', text: '9' },
            { value: '10', text: '10' },
            { value: '11', text: '11' },
            { value: '12', text: '12' },
            { value: '13', text: '13' },
            { value: '14', text: '14' },
            { value: '15', text: '15' },
            { value: '16', text: '16' },
            { value: '17', text: '17' },
            { value: '18', text: '18' },
            { value: '19', text: '19' },
            { value: '20', text: '20' },
            { value: '21', text: '21' },
            { value: '22', text: '22' },
            { value: '23', text: '23' },
            { value: '24', text: '24' },
            { value: '25', text: '25' },

          ]} value={numberOfVirtualUsers} onChange={(e, { value }) => {
            this.setState({ numberOfVirtualUsers: value });
            localStorage.setItem('number_of_virtual_users', value);
          }}>
          </Select>
        </Input>)}
        <Menu icon='labeled' secondary size="mini">
          <Menu.Item disabled={!localAudioTrack} onClick={() => this.setState({chatVisible: !chatVisible, chatMessagesCount: 0})}>
            <Icon name="comments" />
            {t(chatVisible ? 'oldClient.closeChat' : 'oldClient.openChat')}
            {chatMessagesCount > 0 ? chatCountLabel : ''}
          </Menu.Item>
          <Menu.Item
            disabled={!audio_device || !localAudioTrack || delay || otherFeedHasQuestion}
            onClick={this.handleQuestion}>
            <Icon {...(question ? {color: 'green'} : {})} name='question' />
            {t('oldClient.askQuestion')}
          </Menu.Item>
          <Menu.Item onClick={this.toggleShidur} disabled={room === '' || sourceLoading}>
            <Icon name="tv" />
            {shidur ? t('oldClient.closeBroadcast') : t('oldClient.openBroadcast')}
          </Menu.Item>
          <Popup
            trigger={<Menu.Item disabled={room === '' || !shidur || sourceLoading || !attachedSource} icon={{className:`icon--custom ${layoutIcon}`}} name={t('oldClient.layout')} />}
            disabled={room === '' || !shidur || !attachedSource}
            on='click'
            position='bottom center'
          >
            <Popup.Content>
              <Button.Group>
                <Button onClick={() => this.updateLayout('double')} active={layout === 'double'} disabled={sourceLoading} icon={{className:'icon--custom layout-double'}} /> {/* Double first */}
                <Button onClick={() => this.updateLayout('split')} active={layout === 'split'} disabled={sourceLoading} icon={{className:'icon--custom layout-split'}} /> {/* Split */}
                <Button onClick={() => this.updateLayout('equal')} active={layout === 'equal'} disabled={sourceLoading} icon={{className:'icon--custom layout-equal'}} /> {/* Equal */}
              </Button.Group>
            </Popup.Content>
          </Popup>
          <Popup
            trigger={<Menu.Item disabled={!user || !user.id || room === ''} icon='hand paper outline' name={t('oldClient.vote')} />}
            disabled={!user || !user.id || room === ''}
            on='click'
            position='bottom center'
          >
            <Popup.Content>
              <Button.Group>
                <iframe src={`https://vote.kli.one/button.html?answerId=1&userId=${user && user.id}`} width="40px" height="36px" frameBorder="0"></iframe>
                <iframe src={`https://vote.kli.one/button.html?answerId=2&userId=${user && user.id}`} width="40px" height="36px" frameBorder="0"></iframe>
              </Button.Group>
            </Popup.Content>
          </Popup>
          <Popup
            trigger={<Menu.Item icon='book' name={t('oldClient.homerLimud')} />}
            on='click'
            position='bottom center'
          >
            <Popup.Content>
              <iframe src={`https://groups.google.com/forum/embed/?place=forum/bb-study-materials&showpopout=true&showtabs=false&parenturl=${encodeURIComponent(window.location.href)}`}
                style={{width: '50em', height: '50em'}} frameBorder="0"></iframe>
            </Popup.Content>
          </Popup>
        </Menu>
        <Menu icon='labeled' secondary size="mini">
          {!room ?
            <Menu.Item position='right' disabled={!audio_device || selftest !== t('oldClient.selfAudioTest')} onClick={this.selfTest}>
              <Icon color={tested ? 'green' : 'red'} name="sound" />
              {selftest}
            </Menu.Item>
            : ''}
          <Menu.Item disabled={!localAudioTrack} onClick={this.micMute} className="mute-button">
            <canvas className={muted ? 'hidden' : 'vumeter'} ref="canvas1" id="canvas1" width="15" height="35" />
            <Icon color={muted ? 'red' : ''} name={!muted ? 'microphone' : 'microphone slash'} />
            {t(muted ? 'oldClient.unMute' : 'oldClient.mute')}
          </Menu.Item>
          <Menu.Item disabled={video_device === null || !localVideoTrack || delay} onClick={this.camMute}>
            <Icon color={cammuted ? 'red' : ''} name={!cammuted ? 'eye' : 'eye slash'} />
            {t(cammuted ? 'oldClient.startVideo' : 'oldClient.stopVideo')}
          </Menu.Item>
          {/*<Menu.Item>*/}
          {/*  <Select*/}
          {/*    compact*/}
          {/*    value={i18n.language}*/}
          {/*    options={languagesOptions}*/}
          {/*    onChange={(e, { value }) => {*/}
          {/*      setLanguage(value);*/}
          {/*      this.setState({ selftest: t('oldClient.selfAudioTest') });*/}
          {/*    }} />*/}
          {/*</Menu.Item>*/}
          <Popup
            trigger={<Menu.Item icon="setting" name={t('oldClient.settings')} />}
            on='click'
            position='bottom right'
          >
            <Popup.Content>
              <Button size='huge' fluid>
                <Icon name='user circle'/>
                <Profile title={user && user.display} kc={kc} />
              </Button>
              <Select className='select_device'
                      disabled={!!room}
                      error={!media.audio.audio_device}
                      placeholder={t('oldClient.selectDevice')}
                      value={media.audio.audio_device}
                      options={adevices_list}
                      onChange={(e, { value }) => this.setAudioDevice(value)} />
              <Select className='select_device'
                      disabled={!!room}
                      error={!media.video.video_device}
                      placeholder={t('oldClient.selectDevice')}
                      value={media.video.video_device}
                      options={vdevices_list}
                      onChange={(e, { value }) => this.setVideoDevice(value)} />
              <Select className='select_device'
                      disabled={!!room}
                      error={!media.video.video_device}
                      placeholder={t('oldClient.videoSettings')}
                      value={media.video.setting}
                      options={vsettings_list}
                      onChange={(e, { value }) => this.setVideoSize(value)} />
              <Select className='select_device'
                      value={i18n.language}
                      options={languagesOptions}
                      onChange={(e, { value }) => {
                        setLanguage(value);
                        this.setState({ selftest: t('oldClient.selfAudioTest') });
                      }} />
            </Popup.Content>
          </Popup>
          <Help t={t} />
          <Button primary style={{margin: 'auto'}} onClick={() => window.open('https://virtualhome.kli.one', '_blank')}>{t('loginPage.userFee')}</Button>
          <Monitoring monitoringData={monitoringData} />
        </Menu>
        { !(new URL(window.location.href).searchParams.has('lost')) ? null :
            (<Label color={net_status === 2 ? 'yellow' : net_status === 3 ? 'red' : 'green'} icon='wifi' corner='right' />)}
      </div>
      <div className="vclient__main" onDoubleClick={() => this.setState({
        chatVisible: !chatVisible
      })}>
        <div className={`
          vclient__main-wrapper
          no-of-videos-${noOfVideos}
          layout--${layout}
          broadcast--${room !== '' && shidur ? 'on' : 'off'}
          ${!attachedSource ? ' broadcast--popup' : 'broadcast--inline'}
         `}>

          {/* ${layout === 'equal' ? ' broadcast--equal' : ''} */}
          {/* ${layout === 'double' ? ' broadcast--double' : ''} */}
          {/* ${layout === 'split' ? ' broadcast--split' : ''} */}

          <div className="broadcast-panel">
            {/* <div className="videos"> */}
              <div className="broadcast__wrapper">
                {layout === 'split' && source}
              </div>
            {/* </div> */}
          </div>

          <div className="videos-panel">
            {/* <div className="videos"> */}
              <div className="videos__wrapper">
                {(layout === 'equal' || layout === 'double') && source}
                {videos}
              </div>
            {/* </div> */}
          </div>
          <VirtualChat
            t={t}
            ref={chat => {this.chat = chat;}}
            visible={chatVisible}
            janus={janus}
            room={room}
            user={user}
            onNewMsg={this.onChatMessage} />
        </div>
      </div>
    </div>);

    return (
        <Fragment>
          {user && !isMobile ? content : !isMobile ? login : ""}
        </Fragment>
    );
  }
}

export default withTranslation()(VirtualClient);

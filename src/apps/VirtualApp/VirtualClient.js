import React, {Component, Fragment} from 'react';
import { Janus } from '../../lib/janus';
import classNames from 'classnames';
import { isMobile } from 'react-device-detect';
import {Button, Dropdown, Icon, Input, Label, Menu, Popup, Select} from 'semantic-ui-react';
import {
  checkNotification,
  geoInfo,
  getDevicesStream,
  initJanus,
  micLevel,
  reportToSentry,
  takeImage,
  testDevices,
  testMic,
  wkliLeave,
} from '../../shared/tools';
import './VirtualClient.scss';
import './VideoConteiner.scss';
import './CustomIcons.scss';
import 'eqcss';
import VirtualChat from './VirtualChat';
import { initGxyProtocol, sendProtocolMessage } from '../../shared/protocol';
import { PROTOCOL_ROOM, vsettings_list } from '../../shared/consts';
import {GEO_IP_INFO, SENTRY_KEY} from '../../shared/env';
import platform from 'platform';
import {Help} from './components/Help';
import {withTranslation} from 'react-i18next';
import {mapNameToLanguage, setLanguage} from '../../i18n/i18n';
import {Monitoring} from '../../components/Monitoring';
import {MonitoringData} from '../../shared/MonitoringData';
import api from '../../shared/Api';
import VirtualStreaming from './VirtualStreaming';
import VirtualStreamingJanus from './VirtualStreamingJanus';
import {client} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";
import * as Sentry from "@sentry/browser";

class VirtualClient extends Component {

  state = {
    chatMessagesCount: 0,
    creatingFeed: false,
    delay: false,
    audioContext: null,
    audio_devices: [],
    video_devices: [],
    audio_device: '',
    video_device: '',
    video_setting: { width: 320, height: 180, fps: 15 },
    audio: null,
    video: null,
    janus: null,
    feeds: [],
    feedStreams: {},
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
    users: {},
    username_value: '',
    chatVisible: false,
    question: false,
    geoinfo: false,
    selftest: this.props.t('oldClient.selfAudioTest'),
    tested: false,
    support: false,
    women: window.location.pathname === '/women/',
    monitoringData: new MonitoringData(),
    gatewaysConfig: {},
    iceServers: {},
    numberOfVirtualUsers: localStorage.getItem('number_of_virtual_users') || '1',
    currentLayout: localStorage.getItem('currentLayout') || 'double',
    attachedSource: true,
    sourceLoading: true,
    virtualStreamingJanus: new VirtualStreamingJanus(() => this.virtualStreamingInitialized()),
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
    }
  }

  componentDidMount() {
    Sentry.init({dsn: `https://${SENTRY_KEY}@sentry.kli.one/2`});
    if (isMobile) {
      window.location = '/userm';
    }
  };

  checkPermission = (user) => {
    const {t} = this.props;
    let gxy_user = user.roles.filter(role => role === 'gxy_user').length > 0;
    let pending_approval = user.roles.filter(role => role === 'pending_approval').length > 0;
    if (pending_approval) {
      alert(t('galaxyApp.pendingApproval'));
      client.signoutRedirect();
    } else if (gxy_user) {
      delete user.roles;
      user.role = "user";
      this.initApp(user);
    } else {
      alert("Access denied!");
      client.signoutRedirect();
    }
  };

  initApp = (user) => {
    const { t } = this.props;
    localStorage.setItem('question', false);
    localStorage.setItem('sound_test', false);
    localStorage.setItem('uuid', user.id);
    checkNotification();
    let system  = navigator.userAgent;
    let browser = platform.parse(system);
    if (/Safari|Firefox|Chrome/.test(browser.name)) {
      geoInfo(`${GEO_IP_INFO}`, data => {
        user.ip     = data ? data.ip : '127.0.0.1';
        user.system = system;
        if (!data) {
          alert(t('oldClient.failGeoInfo'));
        }
        this.setState({ geoinfo: !!data, user });

        api.setAccessToken(user.access_token);
        client.events.addUserLoaded((user) => api.setAccessToken(user.access_token));
        client.events.addUserUnloaded(() => api.setAccessToken(null));

        api.fetchConfig()
            .then(data => {
              this.setState({
                gatewaysConfig: data.gateways,
                iceServers: data.ice_servers,
              });
            })
            .then(() => (api.fetchAvailableRooms()))
            .then(data => {
              const { rooms } = data;
              this.setState({ rooms });

              const { selected_room } = this.state;
              if (selected_room !== '') {
                const room = rooms.find(r => r.room === selected_room);
                if (room) {
                  const name = room.description;
                  user.room     = selected_room;
                  user.janus    = room.janus;
                  user.group    = name;
                  this.setState({ name });
                }
                this.initClient(user, false);
              }
            })
      });
    } else {
      alert(t('oldClient.browserNotSupported'));
      window.location = 'https://galaxy.kli.one';
    }
    this.state.virtualStreamingJanus.init();
  }

  componentWillUnmount() {
    this.state.virtualStreamingJanus.destroy();
  }

  initClient = (user, error) => {
    const { t } = this.props;
    if (this.state.janus) {
      this.state.janus.destroy();
    }

    const {gatewaysConfig, iceServers} = this.state;
    const gatewayConfig = gatewaysConfig.rooms[user.janus];
    const ice = iceServers.rooms.map((urls) => ({urls}));

    initJanus(janus => {
      // Check if unified plan supported
      if (Janus.unifiedPlan) {
        user.session = janus.getSessionId();
        this.setState({ janus, user, username_value: user.title });
        this.chat.initChat(janus);
        this.initVideoRoom(error);
      } else {
        alert(t('oldClient.unifiedPlanNotSupported'));
        this.setState({ audio_device: null });
      }
    }, er => {
      console.log(er);
      reportToSentry(error, {source: "janus",janus: user.janus, user})
      // setTimeout(() => {
      //     this.initClient(user,er);
      // }, 5000);
    }, gatewayConfig.url, ice);
  };

  initDevices = (video) => {
    const { t } = this.props;
    Janus.listDevices(devices => {
      if (devices.length > 0) {
        let audio_devices = devices.filter(device => device.kind === 'audioinput');
        let video_devices = video ? devices.filter(device => device.kind === 'videoinput') : [];
        // Be sure device still exist
        let video_device  = localStorage.getItem('video_device');
        let audio_device  = localStorage.getItem('audio_device');
        let video_setting = JSON.parse(localStorage.getItem('video_setting')) || this.state.video_setting;
        let achk          = audio_devices.filter(a => a.deviceId === audio_device).length > 0;
        let vchk          = video_devices.filter(v => v.deviceId === video_device).length > 0;
        let video_id      = video ? (video_device !== '' && vchk ? video_device : video_devices[0].deviceId) : null;
        let audio_id      = audio_device !== '' && achk ? audio_device : audio_devices[0].deviceId;
        Janus.log(' :: Got Video devices: ', video_devices);
        Janus.log(' :: Got Audio devices: ', audio_devices);
        this.setState({ video_devices, audio_devices });
        this.setDevice(video_id, audio_id, video_setting);
      } else if (video) {
        alert(t('oldClient.videoNotDetected'));
        this.setState({ cammuted: true, video_device: null });
        //Try to get video fail reason
        testDevices(true, false, this.state.user, steam => {});
        // Right now if we get some problem with video device the - enumerateDevices()
        // back empty array, so we need to call this once more with video:false
        // to get audio device only
        Janus.log(' :: Trying to get audio only');
        this.initDevices(false);
      } else {
        //Try to get audio fail reason
        testDevices(false, true, this.state.user, steam => {});
        alert(t('oldClient.noInputDevices'));
        //FIXME: What we going to do in this case?
        this.setState({ audio_device: null });
      }
    }, { audio: true, video: video });
  };

  setDevice = (video_device, audio_device, video_setting) => {
    if (audio_device !== this.state.audio_device
      || video_device !== this.state.video_device
      || JSON.stringify(video_setting) !== JSON.stringify(this.state.video_setting)) {
      this.setState({ video_device, audio_device, video_setting });
      if (this.state.audio_device !== '' || this.state.video_device !== '') {
        localStorage.setItem('video_device', video_device);
        localStorage.setItem('audio_device', audio_device);
        localStorage.setItem('video_setting', JSON.stringify(video_setting));
        Janus.log(' :: Going to check Devices: ');
        getDevicesStream(audio_device, video_device, video_setting, stream => {
          Janus.log(' :: Check Devices: ', stream);
          this.setState({mystream: stream})
          let myvideo = this.refs.localVideo;
          Janus.attachMediaStream(myvideo, stream);
          if (this.state.audioContext) {
            this.state.audioContext.close();
          }
          micLevel(stream, this.refs.canvas1, audioContext => {
            this.setState({ audioContext, stream });
          });
        });
      }
    }
  };

  selfTest = () => {
    const { t } = this.props;
    this.setState({ selftest: t('oldClient.recording') + 9 });
    testMic(this.state.stream);

    let rect = 9;
    let rec  = setInterval(() => {
      rect--;
      this.setState({ selftest: t('oldClient.recording') + rect });
      if (rect <= 0) {
        clearInterval(rec);
        let playt = 11;
        let play  = setInterval(() => {
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

  selectRoom = (roomid) => {
    const { rooms } = this.state;
    const user      = Object.assign({}, this.state.user);
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

  exitRoom = (reconnect) => {
    let { videoroom, remoteFeed, protocol, room, user } = this.state;
    wkliLeave(user);
    let leave                                     = { request: 'leave' };
    if (remoteFeed) {
      remoteFeed.send({ 'message': leave });
    }
    videoroom.send({ 'message': leave });
    this.chat.exitChatRoom(room);
    let pl = { textroom: 'leave', transaction: Janus.randomString(12), 'room': PROTOCOL_ROOM };
    localStorage.setItem('question', false);
    this.setState({
      cammuted: false,
      feeds: [],
      localAudioTrack: null,
      localVideoTrack: null,
      mids: [],
      muted: false,
      question: false,
      remoteFeed: null,
      room: '',
      selected_room: (reconnect ? room : ''),
      chatMessagesCount: 0,
    });
    this.state.virtualStreamingJanus.audioElement.muted = true;
    protocol.data({
      text: JSON.stringify(pl),
      success: () => {
        this.initVideoRoom(reconnect);
      }
    });
  };

  iceState = () => {
    let count = 0;
    let chk   = setInterval(() => {
      count++;
      let { ice } = this.state;
      if (count < 11 && ice === 'connected') {
        clearInterval(chk);
      }
      if (count >= 10) {
        clearInterval(chk);
        this.exitRoom(false);
        reportToSentry("ICE State disconnected",{source: "ice"}, this.state.user);
        alert(this.props.t('oldClient.networkSettingsChanged'));
        window.location.reload();
      }
    }, 3000);
  };

  mediaState = (media) => {
    const { t } = this.props;
    // Handle video
    if (media === 'video') {
      let count = 0;
      let chk   = setInterval(() => {
        count++;
        let { video, ice } = this.state;

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
          this.exitRoom(false);
          reportToSentry("Video stopped",{source: "media"}, this.state.user);
          alert(t('oldClient.serverStoppedReceiveOurMedia'));
        }
      }, 3000);
    }

    //Handle audio
    if (media === 'audio') {
      let count = 0;
      let chk   = setInterval(() => {
        count++;
        let { audio, video, ice, question } = this.state;

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

  initVideoRoom = (reconnect) => {
    if (this.state.videoroom) {
      this.state.videoroom.detach();
    }
    if (this.state.remoteFeed) {
      this.state.remoteFeed.detach();
    }
    if (this.state.protocol) {
      this.state.protocol.detach();
    }
    this.state.janus.attach({
      plugin: 'janus.plugin.videoroom',
      opaqueId: 'videoroom_user',
      success: (videoroom) => {
        Janus.log(' :: My handle: ', videoroom);
        Janus.log('Plugin attached! (' + videoroom.getPlugin() + ', id=' + videoroom.getId() + ')');
        Janus.log('  -- This is a publisher/manager');
        const user  = Object.assign({}, this.state.user);
        user.handle = videoroom.getId();
        this.setState({
          videoroom: videoroom,
          user,
          remoteFeed: null,
          protocol: null,
          delay: false,
        });
        this.initDevices(true);
        if (reconnect) {
          setTimeout(() => {
            this.joinRoom(reconnect);
          }, 5000);
        }
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
        Janus.log('Janus reports problems ' + (uplink ? 'sending' : 'receiving') +
          ' packets on mid ' + mid + ' (' + lost + ' lost packets)');
      },
      onmessage: (msg, jsep) => {
        this.onMessage(this.state.videoroom, msg, jsep, false);
      },
      onlocaltrack: (track, on) => {
        Janus.log(' ::: Got a local track event :::');
        Janus.log('Local track ' + (on ? 'added' : 'removed') + ':', track);
        let { videoroom, women } = this.state;
        if (!women) {
          videoroom.muteAudio();
        }
        if (track.kind === 'video') {
          this.setState({localVideoTrack: track});
        }
        if (track.kind === 'audio') {
          this.setState({localAudioTrack: track});
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
    let { users } = this.state;
    const feeds   = Object.assign([], this.state.feeds);
    let rfid      = users[data.id].rfid;
    let camera    = data.camera;
    let question  = data.question;
    for (let i = 0; i < feeds.length; i++) {
      if (feeds[i] && feeds[i].id === rfid) {
        feeds[i].cammute  = !camera;
        feeds[i].question = question;
        this.setState({ feeds });
        break;
      }
    }
  };

  publishOwnFeed = (useVideo) => {
    let { videoroom, audio_device, video_device, video_setting } = this.state;
    const width                                                  = video_setting.width;
    const height                                                 = video_setting.height;
    const ideal                                                  = video_setting.fps;
    videoroom.createOffer({
      media: {
        audioRecv: false, videoRecv: false, audioSend: true, videoSend: useVideo,
        audio: {
          //autoGainControl: false, echoCancellation: false, highpassFilter: false, noiseSuppression: false,
          deviceId: { exact: audio_device }
        },
        video: {
          width, height,
          frameRate: { ideal, min: 1 },
          deviceId: { exact: video_device }
        },
        data: true
      },
      simulcast: false,
      success: (jsep) => {
        Janus.debug('Got publisher SDP!');
        Janus.debug(jsep);
        let publish = { request: 'configure', audio: true, video: useVideo, data: true };
        videoroom.send({ 'message': publish, 'jsep': jsep });
      },
      error: (error) => {
        Janus.error('WebRTC error:', error);
        if (useVideo) {
          this.publishOwnFeed(false);
        } else {
          Janus.error('WebRTC error... ' + JSON.stringify(error));
          reportToSentry(JSON.stringify(error),{source: "webrtc"}, this.state.user);
        }
      }
    });
  };

  onMessage = (videoroom, msg, jsep, initdata) => {
    const { t } = this.props;
    Janus.log(' ::: Got a message (publisher) :::');
    Janus.log(msg);
    let event = msg['videoroom'];
    if (event !== undefined && event !== null) {
      if (event === 'joined') {
        let { selected_room, protocol, video_device } = this.state;
        const user                                    = Object.assign({}, this.state.user);
        let myid                                      = msg['id'];
        let mypvtid                                   = msg['private_id'];
        user.rfid                                     = myid;
        this.setState({ user, myid, mypvtid });
        let pmsg = { type: 'enter', status: true, room: selected_room, user };
        Janus.log('Successfully joined room ' + msg['room'] + ' with ID ' + myid);
        sendProtocolMessage(protocol, user, pmsg);
        this.publishOwnFeed(video_device !== null);
        // Any new feed to attach to?
        if (msg['publishers'] !== undefined && msg['publishers'] !== null) {
          let list          = Object.assign([], msg['publishers']);
          //FIXME:  Tmp fix for black screen in room caoused by feed with video_codec = none
          let feeds         = list.sort((a, b) => JSON.parse(a.display).timestamp - JSON.parse(b.display).timestamp)
              .filter(feeder => JSON.parse(feeder.display).role.match(/^(user|guest)$/) && feeder.video_codec !== 'none');
          const feedStreams = Object.assign([], this.state.feedStreams);
          const users       = Object.assign([], this.state.users);

          Janus.log(':: Got Pulbishers list: ', feeds);
          if (feeds.length > 15) {
            alert(t('oldClient.maxUsersInRoom'));
            window.location.reload();
          }
          Janus.debug('Got a list of available publishers/feeds:');
          Janus.log(list);
          let subscription = [];
          for (let f in feeds) {
            let id           = feeds[f]['id'];
            let display      = JSON.parse(feeds[f]['display']);
            let talk         = feeds[f]['talking'];
            let streams      = feeds[f]['streams'];
            let video        = streams.filter(v => v.type === 'video').length === 0;
            feeds[f].cammute = video;
            feeds[f].display = display;
            feeds[f].talk    = talk;
            for (let i in streams) {
              let stream        = streams[i];
              stream['id']      = id;
              stream['display'] = display;
            }
            feedStreams[id]        = { id, display, streams };
            users[display.id]      = display;
            users[display.id].rfid = id;
            subscription.push({
              feed: id,  // This is mandatory
              //mid: stream.mid    // This is optional (all streams, if missing)
            });
          }
          this.setState({ feeds, feedStreams, users });
          if (subscription.length > 0) {
            this.subscribeTo(subscription);
          }
        }
      } else if (event === 'talking') {
        const feeds = Object.assign([], this.state.feeds);
        const id    = msg['id'];
        Janus.log('User: ' + id + ' - start talking');
        for (let i = 0; i < feeds.length; i++) {
          if (feeds[i] && feeds[i].id === id) {
            feeds[i].talk = true;
          }
        }
        this.setState({ feeds });
      } else if (event === 'stopped-talking') {
        const feeds = Object.assign([], this.state.feeds);
        const id    = msg['id'];
        Janus.log('User: ' + id + ' - stop talking');
        for (let i = 0; i < feeds.length; i++) {
          if (feeds[i] && feeds[i].id === id) {
            feeds[i].talk = false;
          }
        }
        this.setState({ feeds });
      } else if (event === 'destroyed') {
        // The room has been destroyed
        Janus.warn('The room has been destroyed!');
      } else if (event === 'event') {

        // Any info on our streams or a new feed to attach to?
        let { user, myid } = this.state;
        const feedStreams  = Object.assign([], this.state.feedStreams);
        if (msg['streams'] !== undefined && msg['streams'] !== null) {
          let streams = msg['streams'];
          for (let i in streams) {
            let stream        = streams[i];
            stream['id']      = myid;
            stream['display'] = user;
          }
          feedStreams[myid] = { id: myid, display: user, streams };
          this.setState({ feedStreams });
        } else if (msg['publishers'] !== undefined && msg['publishers'] !== null) {
          let feed    = Object.assign({}, msg['publishers']);
          const feeds = Object.assign([], this.state.feeds);
          const users = Object.assign([], this.state.users);
          Janus.debug('Got a list of available publishers/feeds:');
          Janus.log(feed);
          let subscription = [];
          for (let f in feed) {
            const id      = feed[f]['id'];
            const display = JSON.parse(feed[f]['display']);
            if (!display.role.match(/^(user|guest)$/)) {
              return;
            }
            let streams     = feed[f]['streams'];
            let video       = streams.filter(v => v.type === 'video').length === 0;
            feed[f].cammute = video;
            feed[f].display = display;
            for (let i in streams) {
              let stream        = streams[i];
              stream['id']      = id;
              stream['display'] = display;
            }
            feedStreams[id]        = { id, display, streams };
            users[display.id]      = display;
            users[display.id].rfid = id;
            subscription.push({
              feed: id,  // This is mandatory
              //mid: stream.mid    // This is optional (all streams, if missing)
            });
          }
          feeds.push(feed[0]);
          this.setState({ feeds, feedStreams, users });
          if (subscription.length > 0) {
            this.subscribeTo(subscription);
            // Send question event for new feed
            setTimeout(() => {
              if (this.state.question) {
                this.sendDataMessage('question', true);
              }
            }, 3000);
          }
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
          this.setState({ remoteFeed, creatingFeed: false });
          // We wait for the plugin to send us an offer
          let subscribe = {
            request: 'join',
            room: this.state.room,
            ptype: 'subscriber',
            streams: subscription
          };
          remoteFeed.send({ message: subscribe });
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
              let mindex   = msg['streams'][i]['mid'];
              //let feed_id = msg["streams"][i]["feed_id"];
              mids[mindex] = msg['streams'][i];
            }
            this.setState({ mids });
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
                  let body = { request: 'start', room: this.state.room };
                  remoteFeed.send({ message: body, jsep: jsep });
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
          let { mids }      = this.state;
          const feedStreams = Object.assign([], this.state.feedStreams);
          let feed          = mids[mid].feed_id;
          Janus.log(' >> This track is coming from feed ' + feed + ':', mid);
          // If we're here, a new track was added
          if (track.kind === 'audio' && on) {
            // New audio track: create a stream out of it, and use a hidden <audio> element
            let stream = new MediaStream();
            stream.addTrack(track.clone());
            Janus.log('Created remote audio stream:', stream);
            feedStreams[feed].audio_stream = stream;
            this.setState({ feedStreams });
            let remoteaudio = this.refs['remoteAudio' + feed];
            Janus.attachMediaStream(remoteaudio, stream);
          } else if (track.kind === 'video' && on) {
            // New video track: create a stream out of it
            let stream = new MediaStream();
            stream.addTrack(track.clone());
            Janus.log('Created remote video stream:', stream);
            feedStreams[feed].video_stream = stream;
            this.setState({ feedStreams });
            let remotevideo = this.refs['remoteVideo' + feed];
            Janus.attachMediaStream(remotevideo, stream);
          } else if (track.kind === 'data') {
            Janus.log('Created remote data channel');
          } else {
            Janus.log('-- Already active stream --');
          }
        },
        ondataopen: (label) => {
          Janus.log('Feed - DataChannel is available! (' + label + ')');
        },
        ondata: (data, label) => {
          Janus.log('Feed - Got data from the DataChannel! (' + label + ')' + data);
          let msg = JSON.parse(data);
          this.onRoomData(msg);
          Janus.log(' :: We got msg via DataChannel: ', msg);
        },
        oncleanup: () => {
          Janus.log(' ::: Got a cleanup notification (remote feed) :::');
        }
      });
  };

  subscribeTo = (subscription) => {
    // New feeds are available, do we need create a new plugin handle first?
    if (this.state.remoteFeed) {
      this.state.remoteFeed.send({
        message:
          { request: 'subscribe', streams: subscription }
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
    const { remoteFeed } = this.state;
    const feeds          = Object.assign([], this.state.feeds);
    const users          = Object.assign([], this.state.users);
    const feedStreams    = Object.assign([], this.state.feedStreams);
    for (let i = 0; i < feeds.length; i++) {
      if (feeds[i].id === id) {
        Janus.log('Feed ' + feeds[i] + ' (' + id + ') has left the room, detaching');
        //TODO: remove mids
        delete users[feeds[i].display.id];
        delete feedStreams[id];
        feeds.splice(i, 1);
        // Send an unsubscribe request
        let unsubscribe = {
          request: 'unsubscribe',
          streams: [{ feed: id }]
        };
        if (remoteFeed !== null) {
          remoteFeed.send({ message: unsubscribe });
        }
        this.setState({ feeds, users, feedStreams });
        break;
      }
    }
  };

  sendDataMessage = (key, value) => {
    const user = Object.assign({}, this.state.user);
    user[key]  = value;
    this.setState({ user });

    const { videoroom } = this.state;
    const message       = JSON.stringify(user);
    Janus.log(':: Sending message: ', message);
    videoroom.data({ text: message });
  };

  joinRoom = (reconnect) => {
    this.setState({ delay: true });
    setTimeout(() => {
      this.setState({ delay: false });
    }, 3000);
    let { janus, videoroom, selected_room, username_value, women, tested, video_device } = this.state;
    let user                                                                             = Object.assign({}, this.state.user);
    localStorage.setItem('room', selected_room);
    //This name will see other users
    user.display    = username_value || user.name;
    user.self_test  = tested;
    user.question   = false;
    user.camera     = video_device !== null;
    user.sound_test = reconnect ? JSON.parse(localStorage.getItem('sound_test')) : false;
    user.timestamp  = Date.now();
    if(video_device) {
      const {mystream} = this.state;
      takeImage(mystream, user);
    }
    this.setState({ user });
    localStorage.setItem('username', user.display);
    if(JSON.parse(localStorage.getItem("ghost")))
      user.role = "ghost";
    initGxyProtocol(janus, user, protocol => {
      this.setState({ protocol });
      // Send question event if before join it was true
      if (reconnect && JSON.parse(localStorage.getItem('question'))) {
        user.question = true;
        this.setState({ user });
        let msg = { type: 'question', status: true, room: selected_room, user };
        setTimeout(() => {
          sendProtocolMessage(protocol, user, msg);
        }, 5000);
      }
    }, ondata => {
      Janus.log('-- :: It\'s protocol public message: ', ondata);
      const { type, error_code, id, room } = ondata;
      if (type === 'error' && error_code === 420) {
        alert(this.props.t('oldClient.error') + ondata.error);
        this.state.protocol.hangup();
      } else if (type === 'joined') {
        let register = {
          'request': 'join',
          'room': selected_room,
          'ptype': 'publisher',
          'display': JSON.stringify(user)
        };
        videoroom.send({ 'message': register });
        this.setState({ user, muted: !women, room: selected_room });
        this.chat.initChatRoom(user, selected_room);
      } else if (type === 'chat-broadcast' && room === selected_room) {
        this.chat.showSupportMessage(ondata);
      } else if (type === 'client-reconnect' && user.id === id) {
        this.exitRoom(true);
      } else if (type === 'client-reload' && user.id === id) {
        window.location.reload();
      } else if (type === 'client-disconnect' && user.id === id) {
        this.exitRoom(false);
      } else if(type === "client-kicked" && user.id === id) {
        localStorage.setItem("ghost", true);
        client.signoutRedirect();
      } else if (type === 'client-question' && user.id === id) {
        this.handleQuestion();
      } else if (type === 'client-mute' && user.id === id) {
        this.micMute();
      } else if (type === 'video-mute' && user.id === id) {
        this.camMute();
      } else if (type === 'sound_test' && user.id === id) {
        user.sound_test = true;
        localStorage.setItem('sound_test', true);
        this.setState({ user });
      } else if (type === 'audio-out' && room === selected_room) {
        this.handleAudioOut(ondata);
      }
    });
  };

  handleQuestion = () => {
    //TODO: only when shidur user is online will be avelable send question event, so we need to add check
    const { protocol, room, question } = this.state;
    const user                         = Object.assign({}, this.state.user);
    localStorage.setItem('question', !question);
    user.question = !question;
    setTimeout(() => {
      this.setState({ delay: false });
    }, 3000);
    if(user.role === "ghost") return;
    let msg = { type: 'question', status: !question, room, user };
    sendProtocolMessage(protocol, user, msg);
    this.setState({ user, question: !question, delay: true });
    this.sendDataMessage('question', !question);
  };

  handleAudioOut = (data) => {
    if (data.status) {
      // remove question mark when sndman unmute our room
      if (this.state.question) {
        this.handleQuestion();
      }
    }
  };

  camMute = () => {
    let { videoroom, cammuted, protocol, room } = this.state;
    const user = Object.assign({}, this.state.user);
    cammuted ? videoroom.unmuteVideo() : videoroom.muteVideo();
    this.setState({ cammuted: !cammuted, delay: true });
    setTimeout(() => {
      this.setState({ delay: false });
    }, 3000);
    if(user.role === "ghost") return;
    this.sendDataMessage('camera', this.state.cammuted);
    user.camera = cammuted;
    // Send to protocol camera status event
    let msg = { type: 'camera', status: cammuted, room, user };
    sendProtocolMessage(protocol, user, msg);
  };

  micMute = () => {
    let { videoroom, muted } = this.state;
    muted ? videoroom.unmuteAudio() : videoroom.muteAudio();
    this.setState({ muted: !muted });
  };

  toggleShidur = () => {
    const { virtualStreamingJanus, shidur } = this.state;
    const stateUpdate = {
      shidur: !shidur,
    };
    if (shidur) {
      virtualStreamingJanus.destroy();
    } else {
      virtualStreamingJanus.init();
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
    this.setState({ chatMessagesCount: this.state.chatMessagesCount + 1 });
  };

  mapDevices = (devices) => {
    return devices.map(({ label, deviceId }, i) => {
      return ({ key: i, text: label, value: deviceId });
    });
  };

  renderLocalMedia = (width, height, index) => {
    const { username_value, user, cammuted, question, muted } = this.state;

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
          {muted ? <Icon name="microphone slash" size="small"
                         color="red" /> : ''}{username_value}
        </div>
      </div>
      <svg className={classNames('nowebcam', { 'hidden': !cammuted })} viewBox="0 0 32 18"
           preserveAspectRatio="xMidYMid meet">
        <text x="16" y="9" textAnchor="middle" alignmentBaseline="central"
              dominantBaseline="central">&#xf2bd;</text>
      </svg>
      <video
        className={classNames('mirror', { 'hidden': cammuted })}
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
    const { id, talk, question, cammute, display: { display } } = feed;

    return (<div className="video"
                 key={'v' + id}
                 ref={'video' + id}
                 id={'video' + id}>
      <div className={classNames('video__overlay', { 'talk-frame': talk })}>
        {question ? <div className="question">
          <svg viewBox="0 0 50 50">
            <text x="25" y="25" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">&#xF128;</text>
          </svg>
        </div> : ''}
        <div className="video__title">{!talk ? <Icon name="microphone slash" size="small" color="red" /> : ''}{display}</div>
      </div>
      <svg className={classNames('nowebcam', { 'hidden': !cammute })} viewBox="0 0 32 18" preserveAspectRatio="xMidYMid meet">
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
      audio_device,
      audio_devices,
      cammuted,
      chatMessagesCount,
      chatVisible,
      currentLayout,
      delay,
      feeds,
      geoinfo,
      janus,
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
      video_device,
      video_devices,
      video_setting,
      virtualStreamingJanus,
      women,
    } = this.state;

    const { t, i18n } = this.props;
    const width       = '134';
    const height      = '100';
    const layout      = (room === '' || !shidur || !attachedSource) ? 'equal' : currentLayout;

    //let iOS = ['iPad', 'iPhone', 'iPod'].indexOf(navigator.platform) >= 0;

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
      const { room, description } = data;
      return ({ key: i, text: description, value: room });
      //return ({ key: i, text: description, value: room, description: num_participants.toString() });
    });

    let adevices_list = this.mapDevices(audio_devices);
    let vdevices_list = this.mapDevices(video_devices);

    let otherFeedHasQuestion = false;
    let localPushed          = false;
    let videos = feeds.filter(feed => feed).reduce((result, feed) => {
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
      <div className="vclient__toolbar">
        <Input>
          <Select
            className = "room-selection"
            search
            disabled={audio_device === null || !!localAudioTrack}
            error={!selected_room}
            placeholder={t('oldClient.selectRoom')}
            value={selected_room}
            options={rooms_list}
            noResultsMessage={t('oldClient.noResultsFound')}
            //onClick={this.getRoomList}
            onChange={(e, { value }) => this.selectRoom(value)} />
          {localAudioTrack ? <Button attached='right' negative icon='sign-out' onClick={() => this.exitRoom(false)} /> : ''}
          {!localAudioTrack ?
            <Button attached='right' primary icon='sign-in' disabled={delay || !selected_room || !audio_device}
                    onClick={this.joinRoom} /> : ''}
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
          ]} value={numberOfVirtualUsers} onChange={(e, { value }) => {
            this.setState({ numberOfVirtualUsers: value });
            localStorage.setItem('number_of_virtual_users', value);
          }}>
          </Select>
        </Input>)}
        <Menu icon='labeled' secondary size="mini">
          <Menu.Item disabled={!localAudioTrack}
                     onClick={() => this.setState({ chatVisible: !chatVisible, chatMessagesCount: 0 })}>
            <Icon name="comments" />
            {t(chatVisible ? 'oldClient.closeChat' : 'oldClient.openChat')}
            {chatMessagesCount > 0 ? chatCountLabel : ''}
          </Menu.Item>
          <Menu.Item
            disabled={video_device === null || !geoinfo || !localAudioTrack || delay || otherFeedHasQuestion}
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
            {/* Update the icon above to current layout */}
            <Popup.Content>
              <Button.Group>
                <Button  onClick={() => this.updateLayout('double')} active={layout === 'double'} disabled={sourceLoading} icon={{className:'icon--custom layout-double'}} /> {/* Double first */}
                <Button  onClick={() => this.updateLayout('split')} active={layout === 'split'} disabled={sourceLoading} icon={{className:'icon--custom layout-split'}} /> {/* Split */}
                <Button  onClick={() => this.updateLayout('equal')} active={layout === 'equal'} disabled={sourceLoading} icon={{className:'icon--custom layout-equal'}} /> {/* Equal */}
              </Button.Group>
            </Popup.Content>
          </Popup>
        </Menu>
        <Menu icon='labeled' secondary size="mini">
          {!localAudioTrack ?
            <Menu.Item position='right'
                       disabled={audio_device === null || selftest !== t('oldClient.selfAudioTest')}
                       onClick={this.selfTest}>
              <Icon color={tested ? 'green' : 'red'} name="sound" />
              {selftest}
            </Menu.Item>
            : ''}
          <Menu.Item disabled={women || !localAudioTrack} onClick={this.micMute} className="mute-button">
            <canvas className={muted ? 'hidden' : 'vumeter'} ref="canvas1" id="canvas1" width="15"
                    height="35" />
            <Icon color={muted ? 'red' : ''} name={!muted ? 'microphone' : 'microphone slash'} />
            {t(muted ? 'oldClient.unMute' : 'oldClient.mute')}
          </Menu.Item>
          <Menu.Item disabled={video_device === null || !localAudioTrack || delay} onClick={this.camMute}>
            <Icon color={cammuted ? 'red' : ''} name={!cammuted ? 'eye' : 'eye slash'} />
            {t(cammuted ? 'oldClient.startVideo' : 'oldClient.stopVideo')}
          </Menu.Item>
          {/*<Menu.Item>*/}
          {/*  <Select*/}
          {/*    compact*/}
          {/*    value={i18n.language}*/}
          {/*    options={mapNameToLanguage(i18n.language)}*/}
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
                <Dropdown inline text={this.state.username_value}>
                  <Dropdown.Menu>
                    <Dropdown.Item content='Profile:' disabled />
                    <Dropdown.Item text='My Account' onClick={() => window.open("https://accounts.kbb1.com/auth/realms/main/account", "_blank")} />
                    <Dropdown.Item text='Sign Out' onClick={() => client.signoutRedirect()} />
                  </Dropdown.Menu>
                </Dropdown>
              </Button>
              <Select className='select_device'
                      disabled={!!localAudioTrack}
                      error={!audio_device}
                      placeholder={t('oldClient.selectDevice')}
                      value={audio_device}
                      options={adevices_list}
                      onChange={(e, { value }) => this.setDevice(video_device, value, video_setting)} />
              <Select className='select_device'
                      disabled={!!localAudioTrack}
                      error={!video_device}
                      placeholder={t('oldClient.selectDevice')}
                      value={video_device}
                      options={vdevices_list}
                      onChange={(e, { value }) => this.setDevice(value, audio_device, video_setting)} />
              <Select className='select_device'
                      disabled={!!localAudioTrack}
                      error={!video_device}
                      placeholder={t('oldClient.videoSettings')}
                      value={video_setting}
                      options={vsettings_list}
                      onChange={(e, { value }) => this.setDevice(video_device, audio_device, value)} />
              <Select className='select_device'
                      value={i18n.language}
                      options={mapNameToLanguage(i18n.language)}
                      onChange={(e, { value }) => {
                        setLanguage(value);
                        this.setState({ selftest: t('oldClient.selfAudioTest') });
                      }} />
            </Popup.Content>
          </Popup>
          <Help t={t} />
          <Monitoring monitoringData={monitoringData} />
        </Menu>
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
            ref={chat => {
              this.chat = chat;
            }}
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

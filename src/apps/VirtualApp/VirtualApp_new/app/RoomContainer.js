import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import '../../VirtualClient.scss';
import '../../VideoConteiner.scss';
import '../../CustomIcons.scss';
import 'eqcss';
import VideoRoom from './VideoRoom';
import GxyJanus from '../../../../shared/janus-utils';
import {
  checkNotification, geoInfo,
  getMedia,
  micLevel,
  reportToSentry,
  takeImage,
  wkliLeave
} from '../../../../shared/tools';
import { Janus } from '../../../../lib/janus';
import { initGxyProtocol } from '../../../../shared/protocol';
import { kc } from '../../../../components/UserManager';
import { GuaranteeDeliveryManager } from '../../../../shared/GuaranteeDelivery';
import api from '../../../../shared/Api';
import ConfigStore from '../../../../shared/ConfigStore';
import Grid from '@material-ui/core/Grid';
import VirtualStreamingJanus from '../../../../shared/VirtualStreamingJanus';
import { NO_VIDEO_OPTION_VALUE, PROTOCOL_ROOM, VIDEO_360P_OPTION_VALUE } from '../../../../shared/consts';
import RoomLayout from './RoomLayout';
import { MonitoringData } from '../../../../shared/MonitoringData';
import FeedsSubscriber from '../FeedsSubscriber';
import { ButtonActionsContext } from '../ButtonActionsContext';
import { AudioModeContext } from '../AudioModeContext';
import { GEO_IP_INFO } from '../../../../shared/env';

let gdm       = null;
let chat      = null;
let videoRoom = null;

const monitoringData = new MonitoringData();
let gxyJanus         = {};
let feedsById        = new Map();

const sortAndFilterFeeds = (feeds) => feeds
  //.filter(feed => !feed.display.role.match(/^(ghost|guest)$/))
  .sort((a, b) => a.display.timestamp - b.display.timestamp);

const userFeeds = (feeds) => feeds.filter(feed => feed.display.role === 'userProps');

let media;
let keepalive;
let creatingFeed;
let remoteFeed;
let virtualStreamingJanus;
let userInfo = {};

const RoomContainer = (props) => {
  const { room, user: userProps, setRoom } = props;

  const { t }                                   = useTranslation();
  const [delay, setDelay]                       = useState();
  const [ice, setIce]                           = useState();
  const [tState, setTState]                     = useState({ feeds: [], mids: [] });
  const [tested, setTested]                     = useState();
  const [sourceLoading, setSourceLoading]       = useState(false);
  const [localVideoTrack, setLocalVideoTrack]   = useState();
  const [localAudioTrack, setLocalAudioTrack]   = useState();
  const [connectionStatus, setConnectionStatus] = useState();
  const [shidur, setShidur]                     = useState();
  const [question, setQuestion]                 = useState(false);
  const [audio, setAudio]                       = useState();
  const [video, setVideo]                       = useState();
  const [muted, setMuted]                       = useState(false);
  const [cammuted, setCammuted]                 = useState(false);
  const [premodStatus, setPremodStatus]         = useState();
  const [myId, setMyId]                         = useState();
  const [myPvtId, setMyPvtId]                   = useState();
  const [muteOtherCams, setMuteOtherCams]       = useState();
  const [upval, setUpval]                       = useState();

  const virtualStreamingInitialized = () => setSourceLoading(false);

  useEffect(() => {
    virtualStreamingJanus = new VirtualStreamingJanus(() => virtualStreamingInitialized());
    return virtualStreamingJanus.destroy();
  }, []);

  useEffect(() => {
    if (userProps && room) {
      initClient();
    }
  }, [room, userProps]);

  useEffect(() => {
    if (!sourceLoading && room)
      virtualStreamingJanus.audioElement.muted = false;
  }, [shidur]);

  useEffect(() => {
    if (shidur && room)
      virtualStreamingJanus.audioElement.muted = false;
  }, [sourceLoading]);

  useEffect(() => {
    if (shidur && !sourceLoading)
      virtualStreamingJanus.audioElement.muted = false;
  }, [room]);

  useEffect(() => {
    monitoringData.setConnection(gxyJanus.videoroom, localAudioTrack, localVideoTrack, userProps, virtualStreamingJanus);
    monitoringData.setOnStatus((connectionStatus, msg) => setConnectionStatus(connectionStatus));
  }, [gxyJanus?.videoroom, localVideoTrack, localAudioTrack, userProps]);

  const initChat = (j) => {
  };

  const findRoom = async () => {
    const { rooms } = await api.fetchAvailableRooms({ with_num_users: true });
    return rooms.find(r => r.room === Number.parseInt(props.room));
  };

  ///////////////

  const initClient = async () => {
    gdm                                        = await initConfig();
    const { ip = '127.0.0.1', country = 'XX' } = await geoInfo(`${GEO_IP_INFO}`)
      .then(d => ({ ip: d && d.ip ? d.ip : '127.0.0.1', country: d && d.country ? d.country : 'XX' }));
    userInfo                                   = { ...userInfo, ip, country };
    await initDevices();

    const _room = await findRoom();
    if (!_room)
      return console.error('Did not find room by key', _room, props.room);
    resetLocalstorage();

    await initJanus(_room.janus);
    virtualStreamingJanus.init(ip, country);

    await gxyJanus.initVideoRoom(roomCallbacks);
    initUserInfo(_room);
    takeMyScreen();
    await gxyJanus.initGxyProtocol(userProps, onDataProtocol);
    await gxyJanus.newRemoteFeed(remoteFeedCallbacks);

  };

  const initDevices = async () => {
    media                  = await getMedia();
    const { audio, video } = media;

    if (audio.error && video.error) {
      alert(t('oldClient.noInputDevices'));
      setCammuted(true);
    } else if (audio.error) {
      alert('audio device not detected');
    } else if (video.error) {
      alert(t('oldClient.videoNotDetected'));
      setCammuted(true);
    }
  };

  const initConfig = async () => {
    const _gdm = new GuaranteeDeliveryManager(userProps.id);

    const config = await api.fetchConfig();

    ConfigStore.setGlobalConfig(config);
    GxyJanus.setGlobalConfig(config);
    return _gdm;
  };

  const resetLocalstorage = () => {
    localStorage.setItem('question', false);
    localStorage.setItem('sound_test', false);
    localStorage.setItem('uuid', userProps.id);
  };

  const initUserInfo = (_room) => {
    const { janus, description: group } = _room;
    const { video: { video_device } }   = media;

    const _userInfo = {
      ...userInfo,
      system: navigator.userAgent,
      room,
      janus,
      group,
      handle: gxyJanus.videoroom.getId(),
      self_test: tested,
      camera: !!video_device,
      sound_test: JSON.parse(localStorage.getItem('sound_test')),
      question: false,
      timestamp: Date.now()
    };
    userInfo        = { ..._userInfo };
  };

  const initJanus = async (_janus) => {
    GxyJanus.instanceConfig(_janus);
    gxyJanus = new GxyJanus(_janus);
    try {
      await gxyJanus.init();
    } catch (e) {
      Janus.error(e);
      exitRoom();
      return e;
    }
  };

  const onRoomMessageJoined = async (msg) => {
    let myid    = msg['id'];
    let mypvtid = msg['private_id'];
    Janus.log('Successfully joined room ' + msg['room'] + ' with ID ' + myid);
    setMyId(myid);
    setMyPvtId(mypvtid);
    setDelay(false);
    userInfo.rfid = myid;

    api.updateUser(userProps.id, { ...userProps, ...userInfo })
      .catch(err => console.error('[User] error updating userProps state', userProps.id, err));
    keepAlive();

    const { audio: { audio_device }, video: { video_device } } = media;
    publishOwnFeed(!!video_device, !!audio_device);

    // Any new feed to attach to?
    if (msg['publishers'] !== undefined && msg['publishers'] !== null) {
      //FIXME: display property is JSON write now, let parse it in one place
      const feeds = sortAndFilterFeeds(msg['publishers'].filter(l => l.display = (JSON.parse(l.display))));

      Janus.log(':: Got Pulbishers list: ', feeds);

      // Feeds count with userProps role
      let feeds_count = userFeeds(feeds).length;
      if (feeds_count > 25) {
        alert(t('oldClient.maxUsersInRoom'));
        exitRoom(false);
      }

      Janus.debug('Got a list of available publishers/feeds:');
      Janus.log(feeds);
      makeSubscription(feeds, /* feedsJustJoined= */ false,
        /* subscribeToVideo= */ !muteOtherCams,
        /* subscribeToAudio= */ true, /* subscribeToData= */ true);

    }
  };

  const onRoomMessage = async (msg, jsep) => {
    let event = msg['videoroom'];
    if (jsep !== undefined && jsep !== null) {
      Janus.debug('Handling SDP as well...');
      Janus.debug(jsep);
      gxyJanus.videoroom.handleRemoteJsep({ jsep: jsep });
    }

    if (event === undefined || event === null)
      return;

    const id = msg['id'];

    const { feeds, mids } = tState;

    switch (event) {
    case 'joined':
      return onRoomMessageJoined(msg);
    case 'talking':
      Janus.log('User: ' + id + ' - start talking');
      for (let i = 0; i < feeds.length; i++) {
        if (feeds[i] && feeds[i].id === id) {
          feeds[i].talking = true;
        }
      }
      setTState({ feeds, mids });
      return;
    case 'stopped-talking':
      Janus.log('User: ' + id + ' - stop talking');
      for (let i = 0; i < feeds.length; i++) {
        if (feeds[i] && feeds[i].id === id) {
          feeds[i].talking = false;
        }
      }
      setTState({ feeds, mids });
      return;
    case 'destroyed':
      return Janus.warn('The room has been destroyed!');
    case 'event':
      if (msg['configured'] === 'ok') {
        // User published own feed successfully.
        if (muteOtherCams) {
          this.setState({ videos: NO_VIDEO_OPTION_VALUE });
          virtualStreamingJanus.setVideo(NO_VIDEO_OPTION_VALUE);
          setCammuted(false);
        }
      } else if (msg['publishers'] !== undefined && msg['publishers'] !== null) {
        // User just joined the room.
        const feeds = sortAndFilterFeeds(msg['publishers'].filter(l => l.display = (JSON.parse(l.display))));
        Janus.debug('New list of available publishers/feeds:');
        Janus.debug(feeds);
        makeSubscription(feeds, /* feedsJustJoined= */ true,
          /* subscribeToVideo= */ !muteOtherCams,
          /* subscribeToAudio= */ true, /* subscribeToData= */ true);
      } else if (msg['leaving'] !== undefined && msg['leaving'] !== null) {
        // One of the publishers has gone away?
        const leaving = msg['leaving'];
        Janus.log('Publisher left: ' + leaving);
        unsubscribeFrom([leaving], /* onlyVideo= */ false);
      } else if (msg['unpublished'] !== undefined && msg['unpublished'] !== null) {
        const unpublished = msg['unpublished'];
        Janus.log('Publisher left: ' + unpublished);
        if (unpublished === 'ok') {
          // That's us
          gxyJanus.videoroom.hangup();
          return;
        }
        unsubscribeFrom([unpublished], /* onlyVideo= */ false);
      } else if (msg['error'] !== undefined && msg['error'] !== null) {
        if (msg['error_code'] === 426) {
          Janus.log('This is a no such room');
        } else {
          Janus.log(msg['error']);
        }
      }
      return;
    }
  };

  const roomCallbacks = {
    iceState: (state) => {
      setIce(state);
      monitoringData.onIceState(state);
      if (state === 'disconnected') {
        // FIXME: ICE restart does not work properly, so we will do silent reconnect
        iceState();
      }
    },
    mediaState: (media, on) => {
      media === 'video' ? setVideo(on) : setAudio(on);
      if (!on) {
        mediaState(media);
      }
    },
    slowLink: (uplink, lost, mid) => {
      const slowLinkType = uplink ? 'sending' : 'receiving';
      monitoringData.onSlowLink(slowLinkType, lost);
    },
    onmessage: onRoomMessage,
    onlocaltrack: (track, on) => {
      gxyJanus.videoroom.muteAudio();
      if (track && track.kind) {
        if (track.kind === 'video') {
          setLocalVideoTrack(track);
        }
        if (track.kind === 'audio') {
          setLocalAudioTrack(track);
        }
      }
    },
    ondata: (data, label) => {
      Janus.log('Publisher - Got data from the DataChannel! (' + label + ')' + data);
    },
    ondataerror: (error) => {
      if (gxyJanus.videoroom && error.error)
        reportToSentry(error.error, { source: 'Publisher' }, userProps);
    }
  };

  const onRemoteFeedData = (data) => {
    const { camera, question, rcmd, type, id } = data;
    if (rcmd) {
      if (gdm.checkAck(data)) {
        // Ack received, do nothing.
        return;
      }

      if (type === 'client-reconnect' && userProps.id === id) {
        exitRoom(true);
      } else if (type === 'client-reload' && userProps.id === id) {
        window.location.reload();
      } else if (type === 'client-disconnect' && userProps.id === id) {
        exitRoom(false);
      } else if (type === 'client-kicked' && userProps.id === id) {
        kc.logout();
      } else if (type === 'client-question' && userProps.id === id) {
        handleQuestion();
      } else if (type === 'client-mute' && userProps.id === id) {
        micMute();
      } else if (type === 'video-mute' && userProps.id === id) {
        camMute(cammuted);
      } else if (type === 'sound_test' && userProps.id === id) {
        userProps.sound_test = true;
        localStorage.setItem('sound_test', true);
        userInfo.sound_test = true;
      } else if (type === 'audio-out') {
        reportToSentry('event', { source: 'switch' }, userProps);
        handleAudioOut(data);
      } else if (type === 'reload-config') {
        reloadConfig();
      } else if (type === 'client-reload-all') {
        window.location.reload();
      } else if (type === 'shidur-ping') {
        gdm.accept(data, (msg) => sendDataMessage(msg)).then((data) => {
          if (data === null) {
            console.log('Message received more then once.');
          }
        }).catch((error) => {
          console.error(`Failed receiving ${data}: ${error}`);
        });
      }
    } else {

      const { feeds, mids } = tState;
      for (let i = 0; i < feeds.length; i++) {
        if (feeds[i] && feeds[i].id === data.rfid) {
          feeds[i].cammute  = !camera;
          feeds[i].question = question;
          setTState({ feeds, mids });
          break;
        }
      }
    }
  };

  const handleAudioOut = (data) => {
    gdm.accept(data, (msg) => sendDataMessage(msg)).then((data) => {
      if (data === null) {
        console.log('Message received more then once.');
        return;
      }

      reportToSentry('action', { source: 'switch' }, userProps);
      virtualStreamingJanus.streamGalaxy(data.status, 4, '');
      if (data.status) {
        // remove question mark when sndman unmute our room
        if (question) {
          handleQuestion();
        }
      }

    }).catch((error) => {
      console.error(`Failed receiving ${data}: ${error}`);
    });
  };

  const reloadConfig = () => {
    api.fetchConfig()
      .then((data) => {
        ConfigStore.setGlobalConfig(data);
        const newPremodStatus = ConfigStore.dynamicConfig(ConfigStore.PRE_MODERATION_KEY) === 'true';
        if (newPremodStatus !== premodStatus) {
          setPremodStatus(newPremodStatus);
          if (question) {
            handleQuestion();
          }
        }
      })
      .catch(err => {
        console.error('[User] error reloading config', err);
      });
  };

  const micMute = () => {
    muted ? gxyJanus.videoroom.unmuteAudio() : gxyJanus.videoroom.muteAudio();
    setMuted(!muted);
  };

  const camMute = (_cammuted) => {
    if (gxyJanus.videoroom) {
      if (userProps.role === 'ghost') return;
      makeDelay();
      api.updateUser(userProps.id, { ...userProps, ...userInfo, camera: _cammuted })
        .then(data => {
          if (data.result === 'success') {
            _cammuted ? gxyJanus.videoroom.unmuteVideo() : gxyJanus.videoroom.muteVideo();
            setCammuted(!_cammuted);
            sendDataMessage({ ...userProps, camera: _cammuted });
          }
        })
        .catch(err => console.error('[User] error updating userProps state', userProps.id, err));
    }
  };

  const publishOwnFeed = (useVideo, useAudio) => {
    const { audio: { audio_device }, video: { setting, video_device } } = media;
    let offer                                                           = {
      audioRecv: false,
      videoRecv: false,
      audioSend: useAudio,
      videoSend: useVideo,
      data: true
    };

    if (useVideo) {
      const { width, height, ideal } = setting;
      offer.video                    = {
        width,
        height,
        frameRate: { ideal, min: 1 },
        deviceId: { exact: video_device }
      };
    }

    if (useAudio) {
      offer.audio = { deviceId: { exact: audio_device } };
    }

    return new Promise((resolve, reject) => {
      gxyJanus.videoroom.createOffer({
        media: offer,
        simulcast: false,
        success: async (jsep) => {
          Janus.debug('Got publisher SDP!');
          Janus.debug(jsep);
          let publish = { request: 'configure', audio: useAudio, video: useVideo, data: true };
          const rsp   = await gxyJanus.videoroom.send({ 'message': publish, 'jsep': jsep });
          resolve(rsp);
        },
        error: (error) => {
          Janus.error('WebRTC error:', error);
          reject(error);
        }
      });
    });
  };

  const remoteFeedCallbacks = {
    onmessage: (msg, jsep) => {

      Janus.log(' ::: Got a message (subscriber) :::');
      Janus.log(msg);
      const event = msg['videoroom'];
      Janus.log('Event: ' + event);
      if (msg['error'] !== undefined && msg['error'] !== null) {
        Janus.debug('-- ERROR: ' + msg['error']);
      } else if (event !== undefined && event !== null) {
        if (event === 'attached') {
          creatingFeed = false;
          Janus.log('Successfully attached to feed in room ' + msg['room']);
        } else if (event === 'event') {
          // Check if we got an event on a simulcast-related event from this publisher
        } else {
          // What has just happened?
        }
      }
      if (msg['streams']) {
        // Update map of subscriptions by mid

        const { feeds, mids } = tState;
        for (let i in msg['streams']) {
          let mindex   = msg['streams'][i]['mid'];
          mids[mindex] = msg['streams'][i];
        }
        setTState({ feeds, mids });
      }
      if (jsep !== undefined && jsep !== null) {
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
              let body = { request: 'start', room: room };
              remoteFeed.send({ message: body, jsep: jsep });
            },
            error: (error) => {
              Janus.error('WebRTC error:', error);
              Janus.debug('WebRTC error... ' + JSON.stringify(error));
            }
          });
      }
    },
    onremotetrack: (track, mid, on) => {
      const { feeds, mids } = tState;
      Janus.log(' ::: Got a remote track event ::: (remote feed)');
      if (!mid) {
        mid = track.id.split('janus')[1];
      }
      Janus.log('Remote track (mid=' + mid + ') ' + (on ? 'added' : 'removed') + ':', track);
      // Which publisher are we getting on this mid?
      let feed = mids[mid].feed_id;
      Janus.log(' >> This track is coming from feed ' + feed + ':', mid);
      // If we're here, a new track was added
      if (track.kind === 'audio' && on) {
        // New audio track: create a stream out of it, and use a hidden <audio> element
        let stream = new MediaStream();
        stream.addTrack(track.clone());
        Janus.log('Created remote audio stream:', stream);
        feeds.find(f => f.id === mids[mid].feed_id).audio_stream = stream;
      } else if (track.kind === 'video' && on) {
        // New video track: create a stream out of it
        let stream = new MediaStream();
        stream.addTrack(track.clone());
        Janus.log('Created remote video stream:', stream);
        feeds.find(f => f.id === mids[mid].feed_id).video_stream = stream;
      }
      setTState({ feeds, mids });
    },
    ondata: (data, label) => {
      Janus.debug('Feed - Got data from the DataChannel! (' + label + ')' + data);
      let msg = JSON.parse(data);
      onRemoteFeedData(msg);
      Janus.log(' :: We got msg via DataChannel: ', msg);
    },
    ondataerror: (error) => {
      Janus.warn('Feed - DataChannel error: ' + error);
      if (remoteFeed && error.error)
        reportToSentry(error.error, { source: 'Feed' }, userProps);
    }
  };

  // Subscribe to feeds, whether already existing in the room, when I joined
  // or new feeds that join the room when I'm already in. In both cases I
  // should add those feeds to my feeds list.
  // In case of feeds just joined and |question| is set, we should notify the
  // new entering userProps by notifying everyone.
  // Subscribes selectively to different stream types |subscribeToVideo|, |subscribeToAudio|, |subscribeToData|.
  // This is required to stop and then start only the videos to save bandwidth.
  const makeSubscription = async (newFeeds, feedsJustJoined, subscribeToVideo, subscribeToAudio, subscribeToData) => {
    const { feeds, mids } = tState;
    const subscription    = [];
    newFeeds.forEach(feed => {
      const { id, streams } = feed;
      feed.video            = !!streams.find(v => v.type === 'video' && v.codec === 'h264');
      feed.audio            = !!streams.find(a => a.type === 'audio' && a.codec === 'opus');
      feed.data             = !!streams.find(d => d.type === 'data');
      feed.cammute          = !feed.video;

      streams.forEach(stream => {
        if ((subscribeToVideo && stream.type === 'video' && stream.codec === 'h264') ||
          (subscribeToAudio && stream.type === 'audio' && stream.codec === 'opus') ||
          (subscribeToData && stream.type === 'data')) {
          subscription.push({ feed: id, mid: stream.mid });
        }
      });
    });

    // Merge |newFeeds| with existing feeds.
    const feedsIds = new Set(feeds.map(feed => feed.id));
    const _feeds   = sortAndFilterFeeds([...feeds, ...newFeeds.filter(feed => !feedsIds.has(feed.id))]);
    // Add only non yet existing feeds.
    tState.feeds   = _feeds;
    setTState({ feeds: _feeds, mids: [] });

    if (subscription.length > 0) {
      await subscribeTo(subscription);
      if (feedsJustJoined) {
        // Send question event for new feed, by notifying all room.
        // FIXME: Can this be done by notifying only the joined feed?
        setTimeout(() => {
          if (question) {
            sendDataMessage(userProps);
          }
        }, 3000);
      }
    }
  };

  const subscribeTo = (subscription) => {
    // New feeds are available, do we need create a new plugin handle first?
    if (remoteFeed) {
      remoteFeed.send({
        message: { request: 'subscribe', streams: subscription }
      });
      return;
    }

    // We don't have a handle yet, but we may be creating one already
    if (creatingFeed) {
      // Still working on the handle
      setTimeout(async () => {
        subscribeTo(subscription);
      }, 500);
      return;
    }

    // We don't creating, so let's do it
    creatingFeed = true;
    gxyJanus.newRemoteFeed(remoteFeedCallbacks).then((r) => {
      remoteFeed = r;
      remoteFeed.send({
        message: {
          request: 'join',
          room: room,
          ptype: 'subscriber',
          streams: subscription
        }
      });
    }).catch(e => Janus.error('  -- Error attaching plugin...', e));
  };

  // Unsubscribe from feeds defined by |ids| (with all streams) and remove it when |onlyVideo| is false.
  // If |onlyVideo| is true, will unsubscribe only from video stream of those specific feeds, keeping those feeds.
  const unsubscribeFrom = (ids, onlyVideo) => {
    const { feeds, mids } = tState;
    const idsSet          = new Set(ids);
    const unsubscribe     = { request: 'unsubscribe', streams: [] };
    feeds.filter(feed => idsSet.has(feed.id)).forEach(feed => {
      if (onlyVideo) {
        // Unsubscribe only from one video stream (not all publisher feed).
        // Acutally expecting only one video stream, but writing more generic code.
        feed.streams.filter(stream => stream.type === 'video')
          .map(stream => ({ feed: feed.id, mid: stream.mid }))
          .forEach(stream => unsubscribe.streams.push(stream));
      } else {
        // Unsubscribe the whole feed (all it's streams).
        unsubscribe.streams.push({ feed: feed.id });
        Janus.log('Feed ' + JSON.stringify(feed) + ' (' + feed.id + ') has left the room, detaching');
      }
    });
    // Send an unsubscribe request.
    if (remoteFeed !== null && unsubscribe.streams.length > 0) {
      remoteFeed.send({ message: unsubscribe });
    }
    if (!onlyVideo) {
      setTState({ feeds: feeds.filter(feed => !idsSet.has(feed.id)), mids });
    }
  };

  const keepAlive = () => {
    // send every 2 seconds
    setInterval(sendKeepAlive, 2 * 1000);

    // after 20 seconds, increase interval from 2 to 30 seconds.
    setTimeout(() => {
      clearKeepAlive();
      setInterval(sendKeepAlive, 30 * 1000);
    }, 20 * 1000);
  };

  const clearKeepAlive = () => keepalive && clearInterval(keepalive);

  const sendKeepAlive = () => {
    if (userProps && gxyJanus.gateway?.isConnected() && userProps.session && userProps.handle) {
      api.updateUser(userProps.id, userProps)
        .then(data => {
          if (ConfigStore.isNewer(data.config_last_modified)) {
            console.info('[User] there is a newer config. Reloading ', data.config_last_modified);
            reloadConfig();
          }
        })
        .catch(err => console.error('[User] error sending keepalive', userProps.id, err));
    }
  };

  const makeDelay = () => {
    setDelay(true);
    setTimeout(() => setDelay(false), 3000);
  };

  const handleQuestion = () => {
    if (userProps.role === 'ghost') return;
    makeDelay();
    userInfo.question = !question;
    api.updateUser(userProps.id, { ...userProps, ...userInfo })
      .then(data => {
        if (data.result === 'success') {
          localStorage.setItem('question', !question);
          setQuestion(!question);
          sendDataMessage({ ...userProps, ...userInfo });
        }
      })
      .catch(err => console.error('[User] error updating userProps state', userProps.id, err));
  };

  const sendDataMessage = (data) => {
    const message = JSON.stringify(data);
    Janus.log(':: Sending message: ', message);
    gxyJanus.videoroom.data({ text: message });
  };

  const otherCamsMuteToggle = () => {
    if (!muteOtherCams) {
      // Should hide/mute now all videos.
      unsubscribeFrom(tState.feeds.map(feed => feed.id), true);
      camMute(false);
      setVideo(NO_VIDEO_OPTION_VALUE);
      virtualStreamingJanus.setVideo(NO_VIDEO_OPTION_VALUE);
    } else {
      // Should unmute/show now all videos.
      makeSubscription(tState.feeds, false, true, false, false);
      camMute(true);
      setVideo(VIDEO_360P_OPTION_VALUE);
      virtualStreamingJanus.setVideo(VIDEO_360P_OPTION_VALUE);
    }
    setMuteOtherCams(!muteOtherCams);
  };

  const mediaState = (media) => {
    // Handle video
    if (media === 'video') {
      let count = 0;
      let chk   = setInterval(() => {
        count++;
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
          alert(t('oldClient.serverStoppedReceiveOurMedia'));
        }
      }, 3000);
    }

    //Handle audio
    if (media === 'audio') {
      let count = 0;
      let chk   = setInterval(() => {
        count++;

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
            handleQuestion();
          }
          alert(t('oldClient.serverStoppedReceiveOurAudio'));
        }
      }, 3000);
    }
  };

  const iceState = () => {
    let count = 0;
    let chk   = setInterval(() => {
      count++;
      if (count < 11 && ice === 'connected') {
        clearInterval(chk);
      }
      if (count >= 10) {
        clearInterval(chk);
        exitRoom(true, () => {
          console.error('ICE Disconnected');
          initClient();
        });
      }
    }, 3000);
  };

  const exitRoom = (reconnect, callback) => {
    setDelay(true);
    if (userProps.role === 'userProps') {
      wkliLeave(userProps);
    }
    clearInterval(upval);
    clearKeepAlive();

    localStorage.setItem('question', false);

    if (remoteFeed) remoteFeed.detach();
    if (gxyJanus.videoroom) gxyJanus.videoroom.send({ 'message': { request: 'leave', room } });
    let pl = { textroom: 'leave', transaction: Janus.randomString(12), 'room': PROTOCOL_ROOM };
    if (gxyJanus.protocol) gxyJanus.protocol.data({ text: JSON.stringify(pl) });
    //gxyJanus.chatRoomLeave(room);

    setTimeout(() => {
      if (gxyJanus.videoroom) gxyJanus.videoroom.detach();
      if (gxyJanus.protocol) gxyJanus.protocol.detach();
      if (gxyJanus.gateway) gxyJanus.gateway.destroy();
      virtualStreamingJanus.audioElement.muted = !reconnect;

      setCammuted(false);
      setMuted(false);
      setQuestion(false);
      setTState({ feeds: [], mids: [] });
      setLocalAudioTrack(null);
      setLocalVideoTrack(null);
      setUpval(null);
      setDelay(reconnect);

      //room = reconnect ? room : '';
      //chatMessagesCount: 0

      if (typeof callback === 'function') callback();
    }, 2000);
  };

  const onDataProtocol = ondata => {
    Janus.log('-- :: It\'s protocol public message: ', ondata);
    if (gdm.checkAck(ondata)) {
      // Ack received, do nothing.
      return;
    }

    const { type, error_code, id, room: _room } = ondata;
    if (type === 'error' && error_code === 420) {
      exitRoom(false, () => {
        alert(t('oldClient.error') + ondata.error);
      });
    } else if (type === 'joined') {
      gxyJanus.videoRoomJoin(room, userProps)
        .then(() => gxyJanus.initChatRoom())
        .catch(e => exitRoom(false));
    } else if (type === 'chat-broadcast' && room === _room) {
      //    chat.showSupportMessage(ondata);
    } else if (type === 'client-reconnect' && userProps.id === id) {
      exitRoom(true);
    } else if (type === 'client-reload' && userProps.id === id) {
      window.location.reload();
    } else if (type === 'client-disconnect' && userProps.id === id) {
      exitRoom(false);
    } else if (type === 'client-kicked' && userProps.id === id) {
      kc.logout();
    } else if (type === 'client-question' && userProps.id === id) {
      handleQuestion();
    } else if (type === 'client-mute' && userProps.id === id) {
      micMute();
    } else if (type === 'video-mute' && userProps.id === id) {
      camMute(cammuted);
    } else if (type === 'sound_test' && userProps.id === id) {
      localStorage.setItem('sound_test', true);
      userInfo.sound_test = true;
    } else if (type === 'audio-out' && room === _room) {
      handleAudioOut(ondata);
    } else if (type === 'reload-config') {
      reloadConfig();
    } else if (type === 'client-reload-all') {
      window.location.reload();
    }
  };

  const takeMyScreen = () => {
    const { video: { video_device } } = media;

    if (video_device && userProps.role === 'userProps') {
      if (upval) {
        clearInterval(upval);
      }
      takeImage(userProps);
      const _upval = setInterval(() => {
        takeImage(userProps);
      }, 10 * 60000);
      setUpval(_upval);
    }
  };

  const handleMic = () => {
    micMute();
  };

  const handleCamera = () => {
    camMute(cammuted);
  };

  const handleLayout = () => {
    alert('layout');
  };

  const handleAudioMode = () => {
    otherCamsMuteToggle();
  };

  const handleExitRoom = () => {
    exitRoom(false, () => setRoom(null));
  };
  return (
    <ButtonActionsContext.Provider value={{
      handleCamera,
      handleExitRoom,
      handleMic,
      handleLayout,
      handleAudioMode,
      handleQuestion,
      micOn: !muted,
      cameraOn: !cammuted,
      audioModeOn: muteOtherCams,
      questionOn: question
    }}>
      <RoomLayout
        user={{ ...userProps, ...userInfo }}
        janus={gxyJanus.gateway}
        virtualStreamingJanus={virtualStreamingJanus}
        room={room}
        feeds={tState.feeds}
        mids={tState.mids} />
    </ButtonActionsContext.Provider>
  );
};

export default RoomContainer;
import React, { Component } from 'react';
import NewWindow from 'react-new-window';
import { Janus } from '../../lib/janus';
import classNames from 'classnames';
import { isMobile } from 'react-device-detect';
import { Button, Icon, Input, Label, Menu, Popup, Select } from 'semantic-ui-react';
import { checkNotification, genUUID, geoInfo, getDevicesStream, initJanus, micLevel, testDevices, testMic } from '../../shared/tools';
import './VirtualClient.scss';
import './VideoConteiner.scss';
import 'eqcss';
import VirtualChat from './VirtualChat';
import { initGxyProtocol, sendProtocolMessage } from '../../shared/protocol';
import { GEO_IP_INFO, PROTOCOL_ROOM, vsettings_list } from '../../shared/consts';
import platform from 'platform';
import { Help } from './components/Help';

class OldClient extends Component {

  state = {
    count: 0,
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
    mids: [],
    muted: false,
    cammuted: false,
    shidur: false,
    protocol: null,
    user: {
      email: null,
      id: localStorage.getItem('uuid') || genUUID(),
      role: 'user',
      name: 'user-' + Janus.randomString(4),
      username: null,
    },
    users: {},
    username_value: localStorage.getItem('username') || '',
    visible: false,
    question: false,
    geoinfo: false,
    selftest: 'Self Audio Test',
    tested: false,
    support: false,
    women: window.location.pathname === '/women/'
  };

  componentDidMount() {
    if (isMobile) {
      window.location = '/userm';
    } else {
      let { user } = this.state;
      this.initClient(user, false);
    }
  };

  initClient = (user, error) => {
    localStorage.setItem('question', false);
    localStorage.setItem('sound_test', false);
    localStorage.setItem('uuid', user.id);
    checkNotification();
    let system  = navigator.userAgent;
    let browser = platform.parse(system);
    if (/Safari|Firefox|Chrome/.test(browser.name)) {
      geoInfo(`${GEO_IP_INFO}`, data => {
        user.ip = data ? data.ip : '127.0.0.1';
        user.janus = data && data.country === "IL" ? "gxy3" : "gxy1";
        if (!data) {
          alert('Fail to get GeoInfo! Question will be disabled!');
        }
        initJanus(janus => {
          // Check if unified plan supported
          if (Janus.unifiedPlan) {
            user.session = janus.getSessionId();
            user.system  = system;
            this.setState({ janus, user, geoinfo: !!data });
            this.chat.initChat(janus);
            this.initVideoRoom(error);
          } else {
            alert('WebRTC Unified Plan is NOT supported');
            this.setState({ audio_device: null });
          }
        }, er => {
          alert(er);
          // setTimeout(() => {
          //     this.initClient(user,er);
          // }, 5000);
        }, true);
      });
    } else {
      alert('Browser not supported');
      window.location = 'https://galaxy.kli.one';
    }
  };

  initDevices = (video) => {
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
        alert('Video device not detected!');
        this.setState({ cammuted: true, video_device: null });
        //Try to get video fail reson
        testDevices(true, false, steam => {
        });
        // Right now if we get some problem with video device the - enumerateDevices()
        // back empty array, so we need to call this once more with video:false
        // to get audio device only
        Janus.log(' :: Trying to get audio only');
        this.initDevices(false);
      } else {
        //Try to get audio fail reason
        testDevices(false, true, steam => {
        });
        alert(' :: No input devices found ::');
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
    this.setState({ selftest: 'Recording... 9' });
    testMic(this.state.stream);

    let rect = 9;
    let rec  = setInterval(() => {
      rect--;
      this.setState({ selftest: 'Recording... ' + rect });
      if (rect <= 0) {
        clearInterval(rec);
        let playt = 11;
        let play  = setInterval(() => {
          playt--;
          this.setState({ selftest: 'Playing... ' + playt });
          if (playt <= 0) {
            clearInterval(play);
            this.setState({ selftest: 'Self Audio Test', tested: true });
          }
        }, 1000);
      }
    }, 1000);
  };

  getRoomList = () => {
    const { videoroom, women } = this.state;
    if (videoroom) {
      videoroom.send({
        message: { request: 'list' },
        success: (data) => {
          Janus.log(' :: Get Rooms List: ', data.list);
          let filter = data.list.filter(r => /W\./i.test(r.description) === women);
          filter.sort((a, b) => {
            // if (a.num_participants > b.num_participants) return -1;
            // if (a.num_participants < b.num_participants) return 1;
            if (a.description > b.description) {
              return 1;
            }
            if (a.description < b.description) {
              return -1;
            }
            return 0;
          });
          this.setState({ rooms: filter });
          this.getFeedsList(filter);
        }
      });
    }
  };

  getFeedsList = (rooms) => {
    let { selected_room, user } = this.state;
    if (selected_room !== '') {
      let room   = rooms.find(r => r.room === selected_room);
      let name   = room.description;
      user.room  = selected_room;
      user.group = name;
      this.setState({ user, name });
    }
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
    let chk   = setInterval(() => {
      count++;
      let { ice } = this.state;
      if (count < 11 && ice === 'connected') {
        clearInterval(chk);
      }
      if (count >= 10) {
        clearInterval(chk);
        this.exitRoom(false);
        alert('Network setting is changed!');
        window.location.reload();
      }
    }, 3000);
  };

  mediaState = (media) => {
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
          alert('Server stopped receiving our media! Check your video device.');
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
          alert('Server stopped receiving our Audio! Check your Mic');
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
        let { user, selected_room } = this.state;
        user.handle                 = videoroom.getId();
        this.setState({ videoroom, user, remoteFeed: null, protocol: null });
        this.initDevices(true);
        if (selected_room !== '') {
          this.getRoomList();
        }
        if (reconnect) {
          setTimeout(() => {
            this.joinRoom(reconnect);
          }, 5000);
        }
      },
      error: (error) => {
        Janus.log('Error attaching plugin: ' + error);
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
        if (!this.state.mystream) {
          this.setState({ mystream: track });
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
    let { feeds, users } = this.state;
    let rfid             = users[data.id].rfid;
    let camera           = data.camera;
    let question         = data.question;
    for (let i = 0; i < feeds.length; i++) {
      if (feeds[i] && feeds[i].id === rfid) {
        feeds[i].cammute = !camera;
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
        }
      }
    });
  };

  onMessage = (videoroom, msg, jsep, initdata) => {
    Janus.log(' ::: Got a message (publisher) :::');
    Janus.log(msg);
    let event = msg['videoroom'];
    if (event !== undefined && event !== null) {
      if (event === 'joined') {
        let { user, selected_room, protocol, video_device } = this.state;
        let myid                                            = msg['id'];
        let mypvtid                                         = msg['private_id'];
        user.rfid                                           = myid;
        user.timestamp                                      = Date.now();
        this.setState({ user, myid, mypvtid });
        let pmsg = { type: 'enter', status: true, room: selected_room, user };
        Janus.log('Successfully joined room ' + msg['room'] + ' with ID ' + myid);
        sendProtocolMessage(protocol, user, pmsg);
        this.publishOwnFeed(video_device !== null);
        // Any new feed to attach to?
        if (msg['publishers'] !== undefined && msg['publishers'] !== null) {
          let list                   = msg['publishers'];
          //FIXME:  Tmp fix for black screen in room caoused by feed with video_codec = none
          let feeds                  = list.filter(feeder => JSON.parse(feeder.display).role === 'user' && feeder.video_codec !== 'none');
          let { feedStreams, users } = this.state;
          Janus.log(':: Got Pulbishers list: ', feeds);
          if (feeds.length > 15) {
            alert('Max users in this room is reached');
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
              feed: id,	// This is mandatory
              //mid: stream.mid		// This is optional (all streams, if missing)
            });
          }
          this.setState({ feeds, feedStreams, users });
          if (subscription.length > 0) {
            this.subscribeTo(subscription);
          }
        }
      } else if (event === 'talking') {
        let { feeds } = this.state;
        let id        = msg['id'];
        Janus.log('User: ' + id + ' - start talking');
        for (let i = 0; i < feeds.length; i++) {
          if (feeds[i] && feeds[i].id === id) {
            feeds[i].talk = true;
          }
        }
        this.setState({ feeds });
      } else if (event === 'stopped-talking') {
        let { feeds } = this.state;
        let id        = msg['id'];
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
        let { feedStreams, user, myid } = this.state;
        if (msg['streams'] !== undefined && msg['streams'] !== null) {
          let streams = msg['streams'];
          for (let i in streams) {
            let stream        = streams[i];
            stream['id']      = myid;
            stream['display'] = user;
          }
          feedStreams[myid] = { id: myid, display: user, streams: streams };
          this.setState({ feedStreams });
        } else if (msg['publishers'] !== undefined && msg['publishers'] !== null) {
          let feed                          = msg['publishers'];
          let { feeds, feedStreams, users } = this.state;
          Janus.debug('Got a list of available publishers/feeds:');
          Janus.log(feed);
          let subscription = [];
          for (let f in feed) {
            let id      = feed[f]['id'];
            let display = JSON.parse(feed[f]['display']);
            if (display.role !== 'user') {
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
              feed: id,	// This is mandatory
              //mid: stream.mid		// This is optional (all streams, if missing)
            });
          }
          feeds.push(feed[0]);
          this.setState({ feeds, feedStreams, users });
          if (subscription.length > 0) {
            this.subscribeTo(subscription);
            // Send question event for new feed
            setTimeout(() => {
              if(this.state.question)
                this.sendDataMessage('question', true);
            }, 3000);
          }
        } else if (msg['leaving'] !== undefined && msg['leaving'] !== null) {
          // One of the publishers has gone away?
          var leaving = msg['leaving'];
          Janus.log('Publisher left: ' + leaving);
          this.unsubscribeFrom(leaving);

        } else if (msg['unpublished'] !== undefined && msg['unpublished'] !== null) {
          let unpublished = msg['unpublished'];
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
          let remoteFeed = pluginHandle;
          Janus.log('Plugin attached! (' + remoteFeed.getPlugin() + ', id=' + remoteFeed.getId() + ')');
          Janus.log('  -- This is a multistream subscriber', remoteFeed);
          this.setState({ remoteFeed, creatingFeed: false });
          // We wait for the plugin to send us an offer
          let subscribe = { request: 'join', room: this.state.room, ptype: 'subscriber', streams: subscription };
          remoteFeed.send({ message: subscribe });
        },
        error: (error) => {
          Janus.error('  -- Error attaching plugin...', error);
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
          let event = msg['videoroom'];
          Janus.log('Event: ' + event);
          let { remoteFeed } = this.state;
          if (msg['error'] !== undefined && msg['error'] !== null) {
            Janus.debug('-- ERROR: ' + msg['error']);
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
            let { mids } = this.state;
            for (let i in msg['streams']) {
              let mindex   = msg['streams'][i]['mid'];
              //let feed_id = msg["streams"][i]["feed_id"];
              mids[mindex] = msg['streams'][i];
            }
            this.setState({ mids });
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
                media: { audioSend: false, videoSend: false, data: true },	// We want recvonly audio/video
                success: (jsep) => {
                  Janus.debug('Got SDP!');
                  Janus.debug(jsep);
                  let body = { request: 'start', room: this.state.room };
                  remoteFeed.send({ message: body, jsep: jsep });
                },
                error: (error) => {
                  Janus.error('WebRTC error:', error);
                  Janus.debug('WebRTC error... ' + JSON.stringify(error));
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
          let { mids, feedStreams } = this.state;
          let feed                  = mids[mid].feed_id;
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
    let { feeds, remoteFeed, users, feedStreams } = this.state;
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
    let { videoroom, user } = this.state;
    user[key]               = value;
    var message             = JSON.stringify(user);
    Janus.log(':: Sending message: ', message);
    videoroom.data({ text: message });
  };

  joinRoom = (reconnect) => {
    this.setState({ delay: true });
    setTimeout(() => {
      this.setState({ delay: false });
    }, 3000);
    let { janus, videoroom, selected_room, user, username_value, women, tested, video_device } = this.state;
    localStorage.setItem('room', selected_room);
    //This name will see other users
    user.display    = username_value || user.name;
    user.self_test  = tested;
    user.question   = false;
    user.camera     = video_device !== null;
    user.sound_test = reconnect ? JSON.parse(localStorage.getItem('sound_test')) : false;
    localStorage.setItem('username', user.display);
    initGxyProtocol(janus, user, protocol => {
      this.setState({ protocol });
      // Send question event if before join it was true
      if (reconnect && JSON.parse(localStorage.getItem('question'))) {
        user.question = true;
        let msg       = { type: 'question', status: true, room: selected_room, user };
        setTimeout(() => {
          sendProtocolMessage(protocol, user, msg);
        }, 5000);
      }
    }, ondata => {
      Janus.log('-- :: It\'s protocol public message: ', ondata);
      const { type, error_code, id, room } = ondata;
      if (type === 'error' && error_code === 420) {
        alert(ondata.error);
        this.state.protocol.hangup();
      } else if (type === 'joined') {
        let register = { 'request': 'join', 'room': selected_room, 'ptype': 'publisher', 'display': JSON.stringify(user) };
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
      } else if (type === 'client-question' && user.id === id) {
        this.handleQuestion();
      } else if (type === 'client-mute' && user.id === id) {
        this.micMute();
      } else if (type === 'video-mute' && user.id === id) {
        this.camMute();
      } else if (type === 'sound_test' && user.id === id) {
        let { user }    = this.state;
        user.sound_test = true;
        localStorage.setItem('sound_test', true);
        this.setState({ user });
      } else if(type === "audio-out" && room === selected_room) {
        this.handleAudioOut(ondata);
      }
    });
  };

  exitRoom = (reconnect) => {
    let { videoroom, remoteFeed, protocol, room } = this.state;
    let leave                                     = { request: 'leave' };
    if (remoteFeed) {
      remoteFeed.send({ 'message': leave });
    }
    videoroom.send({ 'message': leave });
    this.chat.exitChatRoom(room);
    let pl = { textroom: 'leave', transaction: Janus.randomString(12), 'room': PROTOCOL_ROOM };
    localStorage.setItem('question', false);
    this.setState({ muted: false, cammuted: false, mystream: null, room: '', selected_room: (reconnect ? room : ''), feeds: [], mids: [], remoteFeed: null, question: false });
    protocol.data({
      text: JSON.stringify(pl),
      success: () => {
        this.initVideoRoom(reconnect);
      }
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
    this.setState({ user, selected_room: roomid, name });
  };

  handleQuestion = () => {
    //TODO: only when shidur user is online will be avelable send question event, so we need to add check
    let { protocol, user, room, question } = this.state;
    localStorage.setItem('question', !question);
    user.question = !question;
    let msg       = { type: 'question', status: !question, room, user };
    sendProtocolMessage(protocol, user, msg);
    this.setState({ question: !question, delay: true });
    setTimeout(() => {
      this.setState({ delay: false });
    }, 3000);
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
    let { videoroom, cammuted, protocol, user, room } = this.state;
    cammuted ? videoroom.unmuteVideo() : videoroom.muteVideo();
    this.setState({ cammuted: !cammuted, delay: true });
    setTimeout(() => {
      this.setState({ delay: false });
    }, 3000);
    this.sendDataMessage('camera', this.state.cammuted);
    // Send to protocol camera status event
    let msg = { type: 'camera', status: cammuted, room, user };
    sendProtocolMessage(protocol, user, msg);
  };

  micMute = () => {
    let { videoroom, muted } = this.state;
    muted ? videoroom.unmuteAudio() : videoroom.muteAudio();
    this.setState({ muted: !muted });
  };

  showShidur = () => {
    this.setState({ shidur: !this.state.shidur });
  };

  onUnload = () => {
    this.setState({ shidur: false });
  };

  onBlock = () => {
    alert('You browser is block our popup! You need allow it');
  };

  onNewMsg = (private_message) => {
    this.setState({ count: this.state.count + 1 });
  };

  render() {

    const { video_setting, audio, rooms, room, audio_devices, video_devices, video_device, audio_device, muted, cammuted, delay, mystream, selected_room, count, question, selftest, tested, women, geoinfo, myid} = this.state;
    const width                                                                                                                                                                                               = '134';
    const height                                                                                                                                                                                              = '100';
    const autoPlay                                                                                                                                                                                            = true;
    const controls                                                                                                                                                                                            = false;
    //const vmuted = true;

    //let iOS = ['iPad', 'iPhone', 'iPod'].indexOf(navigator.platform) >= 0;

    let rooms_list = rooms.map((data, i) => {
      const { room, num_participants, description } = data;
      return ({ key: i, text: description, value: room, description: num_participants.toString() });
    });

    let adevices_list = audio_devices.map((device, i) => {
      const { label, deviceId } = device;
      return ({ key: i, text: label, value: deviceId });
    });

    let vdevices_list = video_devices.map((device, i) => {
      const { label, deviceId } = device;
      return ({ key: i, text: label, value: deviceId });
    });

    let otherFeedHasQuestion = false;
    let videos = this.state.feeds.map((feed) => {
      if (feed) {
        let id           = feed.id;
        let talk         = feed.talk;
        let question     = feed.question;
        let cammute      = feed.cammute;
        //let name = feed.display.name;
        let display_name = feed.display.display;
        otherFeedHasQuestion = otherFeedHasQuestion || (question && id !== myid);
        return (<div className="video"
                     key={'v' + id}
                     ref={'video' + id}
                     id={'video' + id}>
          <div className={classNames('video__overlay', { 'talk': talk })}>
            {question ? <div className="question">
              <svg viewBox="0 0 50 50">
                <text x="25" y="25" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">&#xF128;</text>
              </svg>
            </div> : ''}
            <div className="video__title">{!talk ? <Icon name="microphone slash" size="small" color="red" /> : ''}{display_name}</div>
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
            autoPlay={autoPlay}
            controls={controls}
            muted={true}
            playsInline={true} />
          <audio
            key={'a' + id}
            ref={'remoteAudio' + id}
            id={'remoteAudio' + id}
            autoPlay={autoPlay}
            controls={controls}
            playsInline={true} />
        </div>);
      }
      return true;
    });

    let l = (<Label key='Carbon' floating size='mini' color='red'>{count}</Label>);

    let content = (<div className={classNames('vclient', { 'vclient--chat-open': this.state.visible })}>
      <div className="vclient__toolbar">
        <Input
          iconPosition='left'
          placeholder="Type your name..."
          value={this.state.username_value}
          onChange={(v, { value }) => this.setState({ username_value: value })}
          action>
          <input iconPosition='left' disabled={mystream} />
          <Icon name='user circle' />
          <Select
            search
            disabled={audio_device === null || mystream}
            error={!selected_room}
            placeholder="Select Room:"
            value={selected_room}
            options={rooms_list}
            onClick={this.getRoomList}
            onChange={(e, { value }) => this.selectRoom(value)} />
          {mystream ? <Button negative icon='sign-out' onClick={() => this.exitRoom(false)} /> : ''}
          {!mystream ? <Button primary icon='sign-in' disabled={delay || !selected_room || !audio_device}
                               onClick={this.joinRoom} /> : ''}
        </Input>
        <Menu icon='labeled' secondary size="mini">
          <Menu.Item disabled={!mystream}
                     onClick={() => this.setState({ visible: !this.state.visible, count: 0 })}>
            <Icon name="comments" />
            {this.state.visible ? 'Close' : 'Open'} Chat
            {count > 0 ? l : ''}
          </Menu.Item>
          <Menu.Item disabled={!audio || video_device === null || !geoinfo || !mystream || delay || otherFeedHasQuestion} onClick={this.handleQuestion}>
            <Icon color={question ? 'green' : ''} name='question' />
            Ask a Question
          </Menu.Item>
          <Menu.Item disabled={this.state.shidur} onClick={this.showShidur}>
            <Icon name="tv" />
            Open Broadcast
            {this.state.shidur ?
              <NewWindow
                url='https://galaxy.kli.one/gxystr'
                features={{ width: '725', height: '635', left: '200', top: '200', location: 'no' }}
                title='V4G' onUnload={this.onUnload} onBlock={this.onBlock}>
              </NewWindow> :
              null
            }
          </Menu.Item>
        </Menu>
        <Menu icon='labeled' secondary size="mini">
          {!mystream ?
            <Menu.Item position='right' disabled={audio_device === null || selftest !== 'Self Audio Test'}
                       onClick={this.selfTest}>
              <Icon color={tested ? 'green' : 'red'} name="sound" />
              {selftest}
            </Menu.Item>
            : ''}
          <Menu.Item disabled={women || !mystream} onClick={this.micMute} className="mute-button">
            <canvas className={muted ? 'hidden' : 'vumeter'} ref="canvas1" id="canvas1" width="15"
                    height="35" />
            <Icon color={muted ? 'red' : ''} name={!muted ? 'microphone' : 'microphone slash'} />
            {!muted ? 'Mute' : 'Unmute'}
          </Menu.Item>
          <Menu.Item disabled={video_device === null || !mystream || delay} onClick={this.camMute}>
            <Icon color={cammuted ? 'red' : ''} name={!cammuted ? 'eye' : 'eye slash'} />
            {!cammuted ? 'Stop Video' : 'Start Video'}
          </Menu.Item>
          <Popup
            trigger={<Menu.Item icon="setting" name="Settings" />}
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
                      onChange={(e, { value }) => this.setDevice(video_device, value, video_setting)} />
              <Select className='select_device'
                      disabled={mystream}
                      error={!video_device}
                      placeholder="Select Device:"
                      value={video_device}
                      options={vdevices_list}
                      onChange={(e, { value }) => this.setDevice(value, audio_device, video_setting)} />
              <Select className='select_device'
                      disabled={mystream}
                      error={!video_device}
                      placeholder="Video Settings:"
                      value={video_setting}
                      options={vsettings_list}
                      onChange={(e, { value }) => this.setDevice(video_device, audio_device, value)} />
            </Popup.Content>
          </Popup>
          <Help />
        </Menu>
      </div>
      <div basic className="vclient__main" onDoubleClick={() => this.setState({ visible: !this.state.visible })}>
        <div className="vclient__main-wrapper">
          <div className="videos-panel">
            <div className="videos">
              <div className="videos__wrapper">
                <div className="video">
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
                                     color="red" /> : ''}{this.state.username_value || this.state.user.name}
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
                    autoPlay={autoPlay}
                    controls={controls}
                    muted={true}
                    playsInline={true} />

                </div>
                {videos}
              </div>
            </div>
          </div>
          <VirtualChat
            ref={chat => {
              this.chat = chat;
            }}
            visible={this.state.visible}
            janus={this.state.janus}
            room={room}
            user={this.state.user}
            onNewMsg={this.onNewMsg} />
        </div>
      </div>
    </div>);

    return (
      <div>
        {isMobile ? <div> This content is unavailable on mobile </div> : content}
      </div>
    );
  }
}

export default OldClient;

import { Janus } from '../../lib/janus';
import {gxycol, trllang, NO_VIDEO_OPTION_VALUE,} from '../../shared/consts';
import GxyJanus from "../../shared/janus-utils";

export default class VirtualStreamingJanus {

  constructor(onInitialized) {
    this.janus = null;
    this.videoJanusStream = null;
    this.audioJanusStream = null;
    this.trlAudioJanusStream = null;
    this.dataJanusStream = null;
    this.videoMediaStream = null;
    this.audioMediaStream = null;
    this.trlAudioMediaStream = null;
    this.videos = Number(localStorage.getItem('vrt_video')) || 1;
    this.audios = Number(localStorage.getItem('vrt_lang')) || 2;
    this.mixvolume = null;
    this.talking = null;

    this.videoElement = null;
    this.audioElement = new Audio();
    this.audioElement.autoplay = true;
    this.audioElement.controls = false;
    this.audioElement.muted = true;
    this.audioElement.playinline = true;
    this.audioElement.volume = 0.6;  // Default volume.
    this.trlAudioElement = new Audio();
    this.trlAudioElement.autoplay = true;
    this.trlAudioElement.controls = false;
    this.trlAudioElement.muted = true;
    this.trlAudioElement.playinline = true;

    this.onInitialized = onInitialized;
    this.onTalkingCallback = null;
  }

  onInitialized_() {
    if (this.onInitialized &&
        (this.videos === NO_VIDEO_OPTION_VALUE || this.videoJanusStream) &&
        this.trlAudioJanusStream &&
        this.audioJanusStream &&
        this.dataJanusStream &&
        (this.videos === NO_VIDEO_OPTION_VALUE || this.videoMediaStream) &&
        this.trlAudioMediaStream &&
        this.audioMediaStream) {
      this.onInitialized();
    }
  }

  detachVideo_() {
    this.videoJanusStream = null;
    this.videoMediaStream = null;
  }

  detach_() {
    this.detachVideo_();
    this.audioJanusStream = null;
    this.trlAudioJanusStream = null;
    this.dataJanusStream = null;
    this.audioMediaStream = null;
    this.trlAudioMediaStream = null;
  }

  attachVideoStream(videoElement) {
    if (videoElement && videoElement !== this.videoElement) {
      this.attachVideoStream_(videoElement, this.videoElement);
      this.videoElement = videoElement;
    }
  }

  attachVideoStream_(next, prev) {
    if (next) {
      if (prev && next !== prev) {
        Janus.reattachMediaStream(next, prev);
      } else if (this.videoMediaStream) {
        Janus.attachMediaStream(next, this.videoMediaStream);
      }
    }
  }

  attachAudioStream_(next, prev) {
    if (next) {
      if (prev && next !== prev) {
        Janus.reattachMediaStream(next, prev);
      } else if (this.audioMediaStream) {
        Janus.attachMediaStream(next, this.audioMediaStream);
      }
    }
  }

  attachTrlAudioStream_(next, prev) {
    if (next) {
      if (prev && next !== prev) {
        Janus.reattachMediaStream(next, prev);
      } else if (this.trlAudioMediaStream) {
        Janus.attachMediaStream(next, this.trlAudioMediaStream);
      }
    }
  }

  onTalking(callback) {
    this.onTalkingCallback = callback;
  }

  init(ip, country) {
    localStorage.setItem('vrt_extip', ip);
    this.initJanus_(country);
  }

  destroy() {
    if (this.janus) {
      if (this.videoElement) {
        this.videoElement.srcObject = null;
      }
      if (this.audioElement) {
        this.audioElement.srcObject = null;
      }
      if (this.trlAudioElement) {
        this.trlAudioElement.srcObject = null;
      }
      if (this.janus.destroy && typeof this.janus.destroy === 'function') {
        this.janus.destroy();
      }
      this.janus = null;
      this.detach_();
    }
  }

  initJanus_(country) {
    this.destroy();

    const gateway = country === "IL" ? 'str4' : 'str3';
    const config = GxyJanus.instanceConfig(gateway);

    Janus.init({
      debug: process.env.NODE_ENV !== 'production' ? [/*'log', 'warn',*/ 'error'] : ['error'],
      callback: () => {
        this.janus = new Janus({
          server: config.url,
          iceServers: config.iceServers,
          success: () => {
            Janus.log(' :: Connected to JANUS');
            if (this.videos !== NO_VIDEO_OPTION_VALUE) {
              this.initVideoStream(this.janus);
            }
            this.initDataStream(this.janus);
            this.initAudioStream(this.janus);
            let id = trllang[localStorage.getItem('vrt_langtext')] || 301;
            this.initTranslationStream(id);
          },
          error: (err) => {
            Janus.log(JSON.stringify(err));
            setTimeout(() => {
              this.initJanus_(country);
            }, 5000);
            console.error('RELOAD ON ERROR', err);
          },
          destroyed: () => {
            Janus.log('Janus handle successfully destroyed.');
          }
        });
      }
    });
  };

  initVideoStream = (janus) => {
    janus.attach({
      plugin: 'janus.plugin.streaming',
      opaqueId: 'videostream-' + Janus.randomString(12),
      success: (videoJanusStream) => {
        this.videoJanusStream = videoJanusStream;
        videoJanusStream.send({ message: { request: 'watch', id: this.videos } });
      },
      error: (error) => {
        Janus.warn('Error attaching plugin: ' + error);
      },
      iceState: (state) => {
        Janus.warn('ICE state changed to ' + state);
      },
      webrtcState: (on) => {
        Janus.warn('Janus says our WebRTC PeerConnection is ' + (on ? 'up' : 'down') + ' now');
      },
      slowLink: (uplink, lost, mid) => {
        Janus.warn('Janus reports problems ' + (uplink ? 'sending' : 'receiving') +
          ' packets on mid ' + mid + ' (' + lost + ' lost packets)');
      },
      onmessage: (msg, jsep) => {
        this.onStreamingMessage(this.videoJanusStream, msg, jsep, false);
      },
      onremotetrack: (track, mid, on) => {
        Janus.warn(' ::: Got a remote video track event :::');
        Janus.warn('Remote video track (mid=' + mid + ') ' + (on ? 'added' : 'removed') + ':', track);
        if (!on) {
          return;
        }
        let stream = new MediaStream();
        stream.addTrack(track.clone());
        this.videoMediaStream = stream;
        Janus.warn('Created remote video stream:', stream);
        this.attachVideoStream_(this.videoElement, /* reattach= */ false);
        this.onInitialized_();
      },
      oncleanup: () => {
        Janus.warn('Got a cleanup notification');
      }
    });
  };

  initAudioStream = (janus) => {
    janus.attach({
      plugin: 'janus.plugin.streaming',
      opaqueId: 'audiostream-' + Janus.randomString(12),
      success: (audioJanusStream) => {
        this.audioJanusStream = audioJanusStream;
        audioJanusStream.send({ message: { request: 'watch', id: this.audios } });
      },
      error: (error) => {
        Janus.log('Error attaching plugin: ' + error);
      },
      iceState: (state) => {
        Janus.log('ICE state changed to ' + state);
      },
      webrtcState: (on) => {
        Janus.log('Janus says our WebRTC PeerConnection is ' + (on ? 'up' : 'down') + ' now');
      },
      slowLink: (uplink, lost, mid) => {
        Janus.log('Janus reports problems ' + (uplink ? 'sending' : 'receiving') +
          ' packets on mid ' + mid + ' (' + lost + ' lost packets)');
      },
      onmessage: (msg, jsep) => {
        this.onStreamingMessage(this.audioJanusStream, msg, jsep, false);
      },
      onremotetrack: (track, mid, on) => {
        Janus.log(' ::: Got a remote audio track event :::');
        Janus.log('Remote audio track (mid=' + mid + ') ' + (on ? 'added' : 'removed') + ':', track);
        if (!on) {
          return;
        }
        let stream = new MediaStream();
        stream.addTrack(track.clone());
        this.audioMediaStream = stream;
        Janus.log('Created remote audio stream:', stream);
        this.attachAudioStream_(this.audioElement, /* reattach= */ false);
        this.onInitialized_();
      },
      oncleanup: () => {
        Janus.log('Got a cleanup notification');
      }
    });
  };

  initDataStream(janus) {
    janus.attach({
      plugin: 'janus.plugin.streaming',
      opaqueId: 'datastream-' + Janus.randomString(12),
      success: (dataJanusStream) => {
        this.dataJanusStream = dataJanusStream;
        dataJanusStream.send({ 'message': { request: 'watch', id: 101 } });
        this.onInitialized_();
      },
      error: (error) => {
        Janus.log('Error attaching plugin: ' + error);
      },
      iceState: (state) => {
        Janus.log('ICE state changed to ' + state);
      },
      webrtcState: (on) => {
        Janus.log('Janus says our WebRTC PeerConnection is ' + (on ? 'up' : 'down') + ' now');
      },
      slowLink: (uplink, lost, mid) => {
        Janus.log('Janus reports problems ' + (uplink ? 'sending' : 'receiving') +
          ' packets on mid ' + mid + ' (' + lost + ' lost packets)');
      },
      onmessage: (msg, jsep) => {
        this.onStreamingMessage(this.dataJanusStream, msg, jsep, true);
      },
      ondataopen: () => {
        Janus.log('The DataStreamChannel is available!');
      },
      ondata: (data) => {
        let json = JSON.parse(data);
        Janus.log('We got data from the DataStreamChannel! ', json);
        this.checkData(json);
      },
      onremotestream: (stream) => {
        Janus.log('Got a remote stream!', stream);
      },
      oncleanup: () => {
        Janus.log('Got a cleanup notification');
      }
    });
  };

  initTranslationStream = (streamId) => {
    this.janus.attach({
      plugin: 'janus.plugin.streaming',
      opaqueId: 'trlstream-' + Janus.randomString(12),
      success: (trlJanusStream) => {
        this.trlAudioJanusStream = trlJanusStream;
        trlJanusStream.send({ message: { request: 'watch', id: streamId } });
      },
      error: (error) => {
        Janus.log('Error attaching plugin: ' + error);
      },
      iceState: (state) => {
        Janus.log('ICE state changed to ' + state);
      },
      webrtcState: (on) => {
        Janus.log('Janus says our WebRTC PeerConnection is ' + (on ? 'up' : 'down') + ' now');
      },
      slowLink: (uplink, lost, mid) => {
        Janus.log('Janus reports problems ' + (uplink ? 'sending' : 'receiving') +
          ' packets on mid ' + mid + ' (' + lost + ' lost packets)');
      },
      onmessage: (msg, jsep) => {
        this.onStreamingMessage(this.trlAudioJanusStream, msg, jsep, false);
      },
      onremotetrack: (track, mid, on) => {
        Janus.log(' ::: Got a remote audio translation track event :::');
        Janus.log('Remote audio track (mid=' + mid + ') ' + (on ? 'added' : 'removed') + ':', track);
        if (!on) {
          return;
        }
        let stream = new MediaStream();
        stream.addTrack(track.clone());
        this.trlAudioMediaStream = stream;
        Janus.log('Created remote audio stream:', stream);
        this.attachTrlAudioStream_(this.trlAudioElement, /* reattach= */ false);
        this.onInitialized_();
      },
      oncleanup: () => {
        Janus.log('Got a cleanup notification');
      }
    });
  };

  onStreamingMessage = (handle, msg, jsep, initdata) => {
    Janus.log('Got a message', msg);

    if (jsep !== undefined && jsep !== null) {
      Janus.log('Handling SDP as well...', jsep);

      // Answer
      handle.createAnswer({
        jsep: jsep,
        media: { audioSend: false, videoSend: false, data: initdata },
        success: (jsep) => {
          Janus.log('Got SDP!', jsep);
          handle.send({ message: { request: 'start' }, jsep: jsep });
        },
        customizeSdp: (jsep) => {
          Janus.log(':: Modify original SDP: ', jsep);
          jsep.sdp = jsep.sdp.replace(/a=fmtp:111 minptime=10;useinbandfec=1\r\n/g, 'a=fmtp:111 minptime=10;useinbandfec=1;stereo=1;sprop-stereo=1\r\n');
        },
        error: (error) => {
          Janus.log('WebRTC error: ' + error);
        }
      });
    }
  };

  checkData = (json) => {
    let { talk, col, name, ip } = json;
    if (localStorage.getItem('vrt_extip') === ip) {
      this.streamGalaxy(talk, col, name);
    }
  };

  streamGalaxy = (talk, col, name) => {
    if (talk) {
      this.mixvolume = this.audioElement.volume;
      this.talking = true;
      this.trlAudioElement.volume = this.mixvolume;
      this.trlAudioElement.muted = false;
      console.log(' :: Switch STR Stream: ', gxycol[col]);
      this.audioJanusStream.send({'message': { 'request': 'switch', 'id': gxycol[col]}});
      const id = trllang[localStorage.getItem('vrt_langtext')];
      console.log('AAAA', localStorage.getItem('vrt_langtext'), id);
      if (name.match(/^(New York|Toronto)$/) || !id) {
        console.log(' :: Not TRL Stream attach');
      } else {
        this.trlAudioJanusStream.send({'message': { 'request': 'switch', 'id': id }});
        this.talking = setInterval(this.ducerMixaudio, 200);
        console.log(' :: Init TRL Stream: ', localStorage.getItem('vrt_langtext'), id);
      }
      Janus.log('You now talking');
    } else if (this.talking) {
      Janus.log('Stop talking');
      clearInterval(this.talking);
      this.audioElement.volume = this.mixvolume;
      const id = Number(localStorage.getItem('vrt_lang')) || 15;
      console.log(' :: Switch STR Stream: ', localStorage.getItem('vrt_lang'), id);
      this.audioJanusStream.send({'message': { 'request': 'switch', 'id': id }});
      console.log(' :: Stop TRL Stream: ');
      this.trlAudioElement.muted = true;
      this.talking = null;
      this.mixvolume = null;
    }
    if (this.onTalkingCallback) {
      this.onTalkingCallback(this.talking);
    }
  };

  ducerMixaudio = () => {
    if(this.trlAudioJanusStream) {
      this.trlAudioJanusStream.getVolume(null, volume => {
        let audio      = this.audioElement;
        let trl_volume = this.mixvolume * 0.05;
        if (volume > 0.05) {
          audio.volume = trl_volume;
        } else if (audio.volume + 0.01 <= this.mixvolume) {
          audio.volume = audio.volume + 0.01;
        }
      });
    }
  };

  setVideo = (videos) => {
    this.videos = videos;
    if (videos === NO_VIDEO_OPTION_VALUE) {
      this.videoJanusStream.detach();
      this.detachVideo_();
    } else {
      if (this.videoJanusStream) {
        this.videoJanusStream.send({ message: { request: 'switch', id: videos } });
      } else {
        this.initVideoStream(this.janus);
      }
    }
    localStorage.setItem('vrt_video', videos);
  };

  setAudio = (audios, text) => {
    this.audios = audios;
    if (this.audioJanusStream) {
      this.audioJanusStream.send({ message: { request: 'switch', id: audios } });
    }
    localStorage.setItem('vrt_lang', audios);
    localStorage.setItem('vrt_langtext', text);
  };
};

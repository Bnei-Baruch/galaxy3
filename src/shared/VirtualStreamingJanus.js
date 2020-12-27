import { Janus } from '../lib/janus';
import {gxycol, trllang, NO_VIDEO_OPTION_VALUE,} from './consts';
import GxyJanus from "./janus-utils";

export default class VirtualStreamingJanus {

  constructor(onInitialized) {
    this.janus = null;

    // Streaming plugin for video.
    this.videoJanusStream = null;
    this.videoMediaStream = null;
    // Array of callbacks for cleanup.
    this.videoJanusStreamCleanup = [];

    // Streaming plugin for audio.
    this.audioJanusStream = null;
    this.audioMediaStream = null;
    // Array of callbacks for cleanup.
    this.audioJanusStreamCleanup = [];

    // Streaing plugin for trlAudio
    this.trlAudioJanusStream = null;
    this.trlAudioMediaStream = null;
    // Array of callbacks for cleanup.
    this.trlAudioJanusStreamCleanup = [];

    this.videos = Number(localStorage.getItem('vrt_video')) || 1;
    this.audios = Number(localStorage.getItem('vrt_lang')) || 2;
    this.mixvolume = null;
    this.talking = null;
    this.streamingGateway = '';

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

  isInitialized_() {
    return (this.videos === NO_VIDEO_OPTION_VALUE || this.videoJanusStream) &&
      this.trlAudioJanusStream &&
      this.audioJanusStream &&
      (this.videos === NO_VIDEO_OPTION_VALUE || this.videoMediaStream) &&
      this.trlAudioMediaStream &&
      this.audioMediaStream;
  }

  onInitialized_() {
    if (this.onInitialized && this.isInitialized_()) {
      this.onInitialized();
    }
  }

  /**
   * Detaches video. |callbacks| may be undefined.
   * @param {{success: function, error: function}} callbacks
   */
  detachVideo_(callbacks) {
    this.videoJanusStreamCleanup.push(() => {
      this.videoJanusStream.detach({
        success: () => {
          this.videoJanusStream = null;
          this.videoMediaStream = null;
          if (callbacks?.success) {
            callbacks.success();
          }
        },
        error: (error) => {
          this.videoJanusStream = null;
          this.videoMediaStream = null;
          if (callbacks?.error) {
            callbacks.error(error);
          }
        },
      });
    });
    if (!this.videoJanusStream) {
      if (callbacks?.success) {
        callbacks.success();
      }
      return;
    }
    this.videoJanusStream.hangup();
  }

  /**
   * Detaches audio.
   * @param {{success: function, error: function}} callbacks
   */
  detachAudio_(callbacks) {
    this.audioJanusStreamCleanup.push(() => {
      this.audioJanusStream.detach({
        success: () => {
          this.audioJanusStream = null;
          this.audioMediaStream = null;
          callbacks.success();
        },
        error: (error) => {
          this.audioJanusStream = null;
          this.audioMediaStream = null;
          callbacks.error(error);
        },
      });
    });
    if (!this.audioJanusStream) {
      if (callbacks?.success) {
        callbacks.success();
      }
      return;
    }
    this.audioJanusStream.hangup();
  }

  /**
   * Detaches translation audio.
   * @param {{success: function, error: function}} callbacks
   */
  detachTrlAudio_(callbacks) {
    this.trlAudioJanusStreamCleanup.push(() => {
      this.trlAudioJanusStream.detach({
        success: () => {
          this.trlAudioJanusStream = null;
          this.trlAudioMediaStream = null;
          callbacks.success();
        },
        error: (error) => {
          this.trlAudioJanusStream = null;
          this.trlAudioMediaStream = null;
          callbacks.error(error);
        },
      });
    });
    if (!this.trlAudioJanusStream) {
      callbacks.success();
      return;
    }
    this.trlAudioJanusStream.hangup();
  }

  detach_(callbacks) {
    let success = 0;
    const threeCallbacks = {
      success: () => {
        success++;
        if (success === 3) {
          callbacks.success();
        }
      },
      error: (error) => {
        callbacks.error(error);
      },
    };
    this.detachVideo_(threeCallbacks);
    this.detachAudio_(threeCallbacks);
    this.detachTrlAudio_(threeCallbacks);
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
    this.destroyAndInitJanus_(country);
  }

  destroy(callbacks) {
    if (this.talking) {
      clearInterval(this.talking);
      this.talking = null;
    }
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
      const destroy = () => {
        if (this.janus && this.janus.destroy && typeof this.janus.destroy === 'function') {
          this.janus.destroy(callbacks);
        } else {
          callbacks.success();
        }
        this.janus = null;
      };
      this.detach_({
        success: () => {
          destroy();
        },
        error: (error) => {
          callbacks.error(error);
          destroy();
        },
      });
    } else {
      callbacks.success();
    }
  }

  destroyAndInitJanus_(country) {
    console.log('Trying to destroy and init!');
    this.destroy({
      error: (error) => {
        console.log('JanusVirtualStreaming error destroying before init', error);
        // Still we are trying to init.
        this.initJanus_(country);
      },
      success: () => {
        console.log('JanusVirtualStreaming destroy success, now init.');
        this.initJanus_(country);
      },
    });
  };

  initJanus_(country) {
    // const gateway = country === "IL" ? 'str4' : 'str3';
    const streamingGateways = GxyJanus.gatewayNames("streaming");
    this.streamingGateway = streamingGateways[Math.floor(Math.random() * streamingGateways.length)];
    const config = GxyJanus.instanceConfig(this.streamingGateway);

    Janus.init({
      debug: process.env.NODE_ENV !== 'production' ? ['log', 'error'] : ['log', 'error'],
      callback: () => {
        this.janus = new Janus({
          server: config.url,
          iceServers: config.iceServers,
          success: () => {
            Janus.log(' :: Connected to JANUS');
            if (this.videos !== NO_VIDEO_OPTION_VALUE) {
              this.initVideoStream(this.janus);
            }
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
  }

  iceRestart = () => {
    let id = trllang[localStorage.getItem('vrt_langtext')] || 301;
    if(this.videoJanusStream)
      this.videoJanusStream.send({ message: { request: 'watch', id: this.videos, restart: true } });
    if(this.audioJanusStream)
      this.audioJanusStream.send({ message: { request: 'watch', id: this.audios, restart: true } });
    if(this.trlAudioJanusStream)
      this.trlAudioJanusStream.send({ message: { request: 'watch', id, restart: true } });
  }

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
        Janus.warn('Got a cleanup notification - videostream.');
        const callbacks = [...this.videoJanusStreamCleanup];
        this.videoJanusStreamCleanup.length = 0;
        callbacks.forEach(callback => callback());
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
        Janus.log('Got a cleanup notification - audiostream.');
        const callbacks = [...this.audioJanusStreamCleanup];
        this.audioJanusStreamCleanup.length = 0;
        callbacks.forEach(callback => callback());
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
        Janus.log('Got a cleanup notification - trlstream.');
        const callbacks = [...this.trlAudioJanusStreamCleanup];
        this.trlAudioJanusStreamCleanup.length = 0;
        callbacks.forEach(callback => callback());
      }
    });
  };

  onStreamingMessage = (handle, msg, jsep, initdata) => {
    Janus.log(`Got a message ${JSON.stringify(msg)}`);

    if (handle !== null && jsep !== undefined && jsep !== null) {
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

  streamGalaxy = (talk, col, name) => {
    console.log('streamGalaxy', talk, col, name);
    if (!this.isInitialized_()) {
      return;
    }
    if (talk) {
      this.mixvolume = this.audioElement.volume;
      this.talking = true;
      this.trlAudioElement.volume = this.mixvolume;
      this.trlAudioElement.muted = false;

      this.prevAudioVolume = this.audioElement.volume;
      this.prevMuted = this.audioElement.muted;

      console.log(' :: Switch STR Stream: ', gxycol[col]);
      this.audioJanusStream.send({'message': { 'request': 'switch', 'id': gxycol[col]}});
      const id = trllang[localStorage.getItem('vrt_langtext')];
      console.log(':: Select TRL: ', localStorage.getItem('vrt_langtext'), id);
      if (!id) {
        console.log(' :: Not TRL Stream attach');
      } else {
        this.trlAudioJanusStream.send({'message': { 'request': 'switch', 'id': id }});
        this.talking = setInterval(this.ducerMixaudio, 200);
        console.log(' :: Init TRL Stream: ', localStorage.getItem('vrt_langtext'), id);
      }
      Janus.log('You now talking');
    } else if (this.talking) {
      Janus.log('Stop talking');
      if (this.talking) {
        clearInterval(this.talking);
      }
      this.audioElement.volume = this.mixvolume;
      const id = Number(localStorage.getItem('vrt_lang')) || 2;
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
    if(this.isInitialized_()) {
      // Get remote volume of translator stream (FYI in case of Hebrew, this will be 0 - no translation).
      this.trlAudioJanusStream.getVolume(null, volume => {
        if (this.prevAudioVolume !== this.audioElement.volume || this.prevMuted !== this.audioElement.muted) {
          // This happens only when user changes audio, update mixvolume.
          this.mixvolume = this.audioElement.muted ? 0 : this.audioElement.volume;
          this.trlAudioElement.volume = this.mixvolume;
        }
        if (volume > 0.05) {
          // If translator is talking (remote volume > 0.05) we want to reduce Rav to 5%.
          this.audioElement.volume = this.mixvolume * 0.05;
        } else if (this.audioElement.volume + 0.01 <= this.mixvolume) {
          // If translator is not talking or no translation (Hebrew) we want to slowly raise
          // sound levels of original source up to original this.mixvolume.
          this.audioElement.volume = this.audioElement.volume + 0.01;
        }
        // Store volume and mute values to be able to detect user volume change.
        this.prevAudioVolume = this.audioElement.volume;
        this.prevMuted = this.audioElement.muted;
      });
    }
  };

  setVideo = (videos) => {
    this.videos = videos;
    if (this.janus) {
      if (videos === NO_VIDEO_OPTION_VALUE) {
        if (this.videoJanusStream !== null) {
          this.videoJanusStream.detach();
        }
        this.detachVideo_();
      } else {
        if (this.videoJanusStream) {
          this.videoJanusStream.send({ message: { request: 'switch', id: videos } });
        } else {
          this.initVideoStream(this.janus);
        }
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

  unmuteAudioElement = () => {
    this.audioElement.muted = false;
  }

  muteAudioElement = () => {
    this.audioElement.muted = true;
  }
};

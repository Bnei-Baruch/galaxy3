import { Janus } from '../../lib/janus';
import {
  GEO_IP_INFO,
  JANUS_SRV_STR3,
  JANUS_SRV_STR4,
  STUN_SRV_STR,
  gxycol,
  trllang,
} from '../../shared/consts';

export default class VirtualStreamingJanus {

  constructor(onSuccess) {
    this.janus = null;
    this.videoJanusStream = null;
    this.audioJanusStream = null;
    this.trlAudioJanusStream = null;
    this.dataJanusStream = null;
    this.videoMediaStream = null;
    this.audioMediaStream = null;
    this.trlAudioMediaStream = null;
    this.videos = Number(localStorage.getItem('vrt_video')) || 1;
    this.audios = Number(localStorage.getItem('vrt_lang')) || 15;
    this.mixvolume = null;
    this.talking = null;

    this.audioElement = null;
    this.videoElement = null;
    this.trlAudioElement = null;

    this.onSuccess = onSuccess;
  }

  onSuccess_() {
    this.attach_();
    if (this.videoJanusStream && this.audioJanusStream && this.dataJanusStream && this.trlAudioJanusStream &&
      this.videoMediaStream && this.trlAudioMediaStream && this.audioMediaStream) {
      if (this.onSuccess()) {
        this.onSuccess();
      }
    }
  }

  attach_() {
    if (this.videoJanusStream && this.audioJanusStream && this.dataJanusStream && this.trlAudioJanusStream &&
      this.videoMediaStream && this.trlAudioMediaStream && this.audioMediaStream &&
      this.videoElement && this.trlAudioElement && this.audioElement) {
    Janus.attachMediaStream(this.videoElement, this.videoMediaStream);
    Janus.attachMediaStream(this.trlAudioElement, this.trlAudioMediaStream);
    Janus.attachMediaStream(this.audioElement, this.audioMediaStream);
    }
  }

  detach_() {
    this.videoJanusStream = null;
    this.audioJanusStream = null;
    this.trlAudioJanusStream = null;
    this.dataJanusStream = null;
    this.videoMediaStream = null;
    this.audioMediaStream = null;
    this.trlAudioMediaStream = null;
  }

  reAttachAudioStream(audioElement) {
    Janus.reattachMediaStream(audioElement, this.audioElement);
    this.audioElement = audioElement;
  }

  reAttachTrlStream(trlAudioElement) {
    Janus.reattachMediaStream(trlAudioElement, this.trlAudioElement);
    this.videoElement = trlAudioElement;
  }

  reAttachVideoStream(videoElement) {
    Janus.reattachMediaStream(videoElement, this.videoElement);
    this.videoElement = videoElement;
  }

  attachVideoStream(videoElement) {
    this.videoElement = videoElement;
    return this.attach_();
  }

  attachAudioStream(audioElement) {
    this.audioElement = audioElement;
    return this.attach_();
  }

  attachTrlAudioStream(trlAudioElement) {
    this.trlAudioElement = trlAudioElement;
    return this.attach_();
  }

  init() {
    return fetch(`${GEO_IP_INFO}`).then((response) => {
      if (response.ok) {
        return response.json().then(info => {
          localStorage.setItem('vrt_extip', info.ip);
          let server = info && info.country === "IL" ? `${JANUS_SRV_STR4}` : `${JANUS_SRV_STR3}`;
          this.initJanus_(server);
        });
      }
    })
    .catch(e => {
      console.log('Failed geting geoInfo', e);
      return Promise.reject(`Cannotinitialize Janus, failed getting geoInfo: ${e}`);
    });
  }

  destroy() {
    if (this.janus) {
      this.videoElement.srcObject = null;
      this.audioElement.srcObject = null;
      this.trlAudioElement.srcObject = null;
      this.janus.destroy();
      this.janus = null;
      this.detach_();
    }
  }

  initJanus_(server) {
    this.destroy();
    Janus.init({
      debug: process.env.NODE_ENV !== 'production' ? ['log', 'error'] : ['error'],
      callback: () => {
        this.janus = new Janus({
          server: server,
          iceServers: [{ urls: STUN_SRV_STR }],
          success: () => {
            Janus.log(' :: Connected to JANUS');
            this.initVideoStream(this.janus);
            this.initDataStream(this.janus);
            this.initAudioStream(this.janus);
            let id = trllang[localStorage.getItem('vrt_langtext')] || 301;
            this.initTranslationStream(id);
          },
          error: (error) => {
            Janus.log(JSON.stringify(error));
            setTimeout(() => {
              this.initJanus_();
            }, 5000);
            console.log('RELOAD ON ERROR', error);
          },
          destroyed: () => {
            Janus.log('Janus handle successfully destroyed.');
          }
        });
      }
    });
  };

  initVideoStream = (janus) => {
    //let { videos } = this.state;
    janus.attach({
      plugin: 'janus.plugin.streaming',
      opaqueId: 'videostream-' + Janus.randomString(12),
      success: (videoJanusStream) => {
        Janus.log(videoJanusStream);
        // this.setState({ videostream });
        this.videoJanusStream = videoJanusStream;
        videoJanusStream.send({ message: { request: 'watch', id: this.videos } });
        this.onSuccess_();
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
        this.onStreamingMessage(this.videoJanusStream, msg, jsep, false);
      },
      onremotetrack: (track, mid, on) => {
        Janus.debug(' ::: Got a remote video track event :::');
        Janus.debug('Remote video track (mid=' + mid + ') ' + (on ? 'added' : 'removed') + ':', track);
        if (!on) {
          return;
        }
        let stream = new MediaStream();
        stream.addTrack(track.clone());
        //this.setState({ video_stream: stream });
        this.videoMediaStream = stream;
        Janus.log('Created remote video stream:', stream);
        //let video = this.refs.remoteVideo;
        //Janus.attachMediaStream(video, stream);
        this.onSuccess_();
      },
      oncleanup: () => {
        Janus.log('Got a cleanup notification');
      }
    });
  };

  initAudioStream = (janus) => {
    janus.attach({
      plugin: 'janus.plugin.streaming',
      opaqueId: 'audiostream-' + Janus.randomString(12),
      success: (audioJanusStream) => {
        Janus.log(audioJanusStream);
        this.audioJanusStream = audioJanusStream;
        audioJanusStream.send({ message: { request: 'watch', id: this.audios } });
        this.onSuccess_();
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
        Janus.debug(' ::: Got a remote audio track event :::');
        Janus.debug('Remote audio track (mid=' + mid + ') ' + (on ? 'added' : 'removed') + ':', track);
        if (!on) {
          return;
        }
        let stream = new MediaStream();
        stream.addTrack(track.clone());
        //this.setState({ audio_stream: stream });
        this.audioMediaStream = stream;
        Janus.log('Created remote audio stream:', stream);
        //let audio = this.refs.remoteAudio;
        //Janus.attachMediaStream(audio, stream);
        this.onSuccess_();
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
        Janus.log(dataJanusStream);
        this.dataJanusStream = dataJanusStream;
        dataJanusStream.send({ 'message': { request: 'watch', id: 101 } });
        this.onSuccess_();
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
        Janus.log(trlJanusStream);
        this.trlAudioJanusStream = trlJanusStream;
        trlJanusStream.send({ message: { request: 'watch', id: streamId } });
        this.onSuccess_();
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
        Janus.debug(' ::: Got a remote audio track event :::');
        Janus.debug('Remote audio track (mid=' + mid + ') ' + (on ? 'added' : 'removed') + ':', track);
        if (!on) {
          return;
        }
        let stream = new MediaStream();
        stream.addTrack(track.clone());
        //this.setState({ trlAudio_stream: stream });
        this.trlAudioMediaStream = stream;
        Janus.log('Created remote audio stream:', stream);
        //let audio = this.refs.trlAudio;
        //Janus.attachMediaStream(audio, stream);
        this.onSuccess_();
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
          let body = { request: 'start' };
          handle.send({ message: body, jsep: jsep });
        },
        customizeSdp: (jsep) => {
          Janus.debug(':: Modify original SDP: ', jsep);
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
      this.trlAudioElement.volume = this.mixvolume;
      this.trlAudioElement.muted = false;
      let body = { 'request': 'switch', 'id': gxycol[col] };
      console.log(' :: Switch STR Stream: ', gxycol[col]);
      this.audioJanusStream.send({ 'message': body });
      let id = trllang[localStorage.getItem('vrt_langtext')];
      if (name.match(/^(New York|Toronto)$/) || !id) {
        console.log(' :: Not TRL Stream attach');
      } else {
        let body = { 'request': 'switch', 'id': id };
        this.trlAudioJanusStream.send({ 'message': body });
        this.talking = setInterval(this.ducerMixaudio, 200);
        console.log(' :: Init TRL Stream: ', localStorage.getItem('vrt_langtext'), id);
      }
      Janus.log('You now talking');
    } else if (this.talking) {
      Janus.log('Stop talking');
      clearInterval(this.talking);
      this.audioElement.volume = this.mixvolume;
      let id = Number(localStorage.getItem('vrt_lang')) || 15;
      let abody = { 'request': 'switch', 'id': id };
      console.log(' :: Switch STR Stream: ', localStorage.getItem('vrt_lang'), id);
      this.audioJanusStream.send({ 'message': abody });
      console.log(' :: Stop TRL Stream: ');
      this.trlAudioElement.muted = true;
      this.talking = null;
    }
  };

  ducerMixaudio = () => {
    this.trlAudioJanusStream.getVolume(null, volume => {
      let audio      = this.audioElement;
      let trl_volume = this.mixvolume * 0.05;
      if (volume > 0.05) {
        audio.volume = trl_volume;
      } else if (audio.volume + 0.01 <= this.mixvolume) {
        audio.volume = audio.volume + 0.01;
      }
    });
  };

  setVideo = (videos) => {
    this.videos = videos;
    this.videoJanusStream.send({ message: { request: 'switch', id: videos } });
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

  audioMute = (mute) => {
    if (this.audioJanusStream) {
      mute ? this.audioJanusStream.muteAudio() : this.audioJanusStream.unmuteAudio();
    }
  };
};

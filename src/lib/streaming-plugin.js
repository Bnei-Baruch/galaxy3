import {randomString} from "../shared/tools";
import {EventEmitter} from "events";
import log from "loglevel";
import mqtt from "../shared/mqtt";
import {STUN_SRV_GXY} from "../shared/env";

export class StreamingPlugin extends EventEmitter {
  constructor (list = [{urls: STUN_SRV_GXY}]) {
    super()
    this.id = randomString(12)
    this.janus = undefined
    this.janusHandleId = undefined
    this.iceState = null
    this.streamId = null
    this.candidates = []
    this.onStatus = null
    this.pluginName = 'janus.plugin.streaming'
    this.pc = new RTCPeerConnection({
      iceServers: list
    })
  }

  getPluginName () {
    return this.pluginName
  }

  transaction (message, additionalFields, replyType) {
    const payload = Object.assign({}, additionalFields, { handle_id: this.janusHandleId })

    if (!this.janus) {
      const error = new Error('[streaming] JanusPlugin is not connected');
      return Promise.reject(error)
    }

    return this.janus.transaction(message, payload, replyType)
  }

  watch (id, restart = false) {
    this.streamId = id
    const body = { request: 'watch', id, restart}
    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'event').then((param) => {
        log.info("[streaming] watch: ", param)
        const {session_id, json } = param

        let audioTransceiver = null, videoTransceiver = null;
        let transceivers = this.pc.getTransceivers();
        if(transceivers && transceivers.length > 0) {
          for(let t of transceivers) {
            if(t?.receiver?.track?.kind === "audio") {
              if (audioTransceiver?.setDirection) {
                audioTransceiver.setDirection("recvonly");
              }
              continue;
            }
            if(t?.receiver?.track?.kind === "video") {
              if (videoTransceiver?.setDirection) {
                videoTransceiver.setDirection("recvonly");
              }
              continue;
            }
          }
        }

        if (json?.jsep) {
          log.info('[streaming] sdp: ', json);
          this.sdpExchange(json.jsep)
        }

        if(restart) return

        this.initPcEvents(resolve)

      }).catch((error) => {
        log.error('[streaming] StreamingJanusPlugin, cannot watch stream', error)
        reject(error)
      })
    })
  }

  sdpExchange(jsep) {
    if (!this.pc) return;
    this.pc.setRemoteDescription(jsep).catch(error => {
      log.warn('[streaming] SDP Exchange setRemoteDescription:', error && error.message)
    });
    this.pc.createAnswer().then((desc) => {
      if (!this.pc) return;
      desc.sdp = desc.sdp.replace(/a=fmtp:111 minptime=10;useinbandfec=1\r\n/g, 'a=fmtp:111 minptime=10;useinbandfec=1;stereo=1;sprop-stereo=1\r\n');
      this.pc.setLocalDescription(desc).catch(error => {
        log.warn('[streaming] SDP Exchange setLocalDescription:', error && error.message)
      });
      const sp = this.start(desc);
      if (sp && typeof sp.catch === "function") {
        sp.catch((err) => log.debug('[streaming] start() failed:', err && err.message));
      }
    }, error => {
      log.warn('[streaming] SDP Exchange createAnswer:', error && error.message)
    });
  }

  start(jsep) {
    const body = { request: 'start' }
    const message = { body }
    if (jsep) {
      message.jsep = jsep
    }

    return this.transaction('message', message, 'event').then(({ data, json }) => {
      return { data, json }
    }).catch((error) => {
      log.warn('[streaming] cannot start stream:', error && error.message)
    })
  }

  switch (id) {
    const body = { request: 'switch', id }

    return this.transaction('message', { body }, 'event').catch((error) => {
      log.warn('[streaming] cannot switch stream:', error && error.message)
    })
  }

  getVolume(mid, result) {
    if (!this.pc) return;
    let transceiver;
    try {
      transceiver = this.pc.getTransceivers().find(t => t?.receiver?.track?.kind === "audio");
    } catch (_) { return; }
    if (!transceiver || !transceiver.receiver) return;
    transceiver.receiver.getStats().then(stats => {
      stats.forEach(res => {
        if(!res || res.kind !== "audio") return;
        result(res.audioLevel ? res.audioLevel : 0);
      });
    }).catch(() => { /* getStats not available / track gone */ });
  }

  initPcEvents(resolve) {
    this.pc.onicecandidate = (e) => {
      const p = this.transaction('trickle', { candidate: e.candidate });
      if (p && typeof p.catch === "function") {
        p.catch((err) => log.debug("[streaming] trickle failed:", err && err.message));
      }
    };

    this.pc.onconnectionstatechange = (e) => {
      log.info("[streaming] ICE State: ", e.target.connectionState)
      this.iceState = e.target.connectionState
      if(this.iceState === "disconnected") {
        this.iceRestart()
        this._iceRecoveryTimeout = setTimeout(() => {
          if (this.iceState !== "connected") {
            log.warn("[streaming] ICE not recovered in 10s, triggering reconnect");
            if (typeof this.onStatus === "function") this.onStatus(this.iceState)
          }
        }, 10000);
      }

      if(this.iceState === "connected" && this._iceRecoveryTimeout) {
        clearTimeout(this._iceRecoveryTimeout);
        this._iceRecoveryTimeout = null;
      }

      if(this.iceState === "failed") {
        if (this._iceRecoveryTimeout) {
          clearTimeout(this._iceRecoveryTimeout);
          this._iceRecoveryTimeout = null;
        }
        if (typeof this.onStatus === "function") this.onStatus(this.iceState)
      }
    };

    this.pc.ontrack = (e) => {
      log.info("[streaming] Got track: ", e)
      let stream = new MediaStream([e.track]);
      resolve(stream);
    };
  }

  iceRestart() {
    setTimeout(() => {
      let count = 0;
      let chk = setInterval(() => {
        count++;
        if (count < 10 && this.iceState !== "disconnected" || !this.janus?.isConnected) {
          clearInterval(chk);
        } else if (mqtt.mq.connected) {
          log.debug("[streaming] - Trigger ICE Restart - ");
          const p = this.watch(this.streamId, true);
          if (p && typeof p.catch === "function") {
            p.catch((err) => log.debug("[streaming] watch(restart) failed:", err && err.message));
          }
          clearInterval(chk);
        } else if (count >= 10) {
          clearInterval(chk);
          if (typeof this.onStatus === "function") this.onStatus(this.iceState)
        } else {
          log.debug("[streaming] ICE Restart try: " + count)
        }
      }, 1000);
    }, 1000)
  }

  success (janus, janusHandleId) {
    this.janus = janus
    this.janusHandleId = janusHandleId
  }

  error (cause) {
  }

  onmessage (data) {
    log.info('[streaming] onmessage: ', data)
  }

  oncleanup () {
    // PeerConnection with the plugin closed, clean the UI
    // The plugin handle is still valid so we can create a new one
  }

  detached () {
    // Connection with the plugin closed, get rid of its features
    // The plugin handle is not valid anymore
  }

  hangup () {
    //this.emit('hangup')
  }

  slowLink (uplink, lost, mid) {
    const direction = uplink ? "sending" : "receiving";
    log.info("[streaming] slowLink on " + direction + " packets on mid " + mid + " (" + lost + " lost packets)");
    //this.emit('slowlink')
  }

  mediaState (media, on) {
    log.info('[streaming] mediaState: Janus ' + (on ? "start" : "stop") + " receiving our " + media)
    //this.emit('mediaState', medium, on)
  }

  webrtcState (isReady) {
    log.info('[streaming] webrtcState: RTCPeerConnection is: ' + (isReady ? "up" : "down"))
    //this.emit('webrtcState', isReady, cause)
  }

  detach () {
    if (this._iceRecoveryTimeout) {
      clearTimeout(this._iceRecoveryTimeout);
      this._iceRecoveryTimeout = null;
    }
    if (this.pc) {
      try { this.pc.close() } catch (_) { /* already closed */ }
      this.pc = null;
    }
    this.removeAllListeners()
    this.janus = null
  }
}

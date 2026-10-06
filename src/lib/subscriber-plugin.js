import {randomString} from "../shared/tools";
import {EventEmitter} from "events";
import log from "loglevel";
import mqtt from "../shared/mqtt";
import {STUN_SRV_GXY} from "../shared/env";

export class SubscriberPlugin extends EventEmitter {
  constructor (list = [{urls: STUN_SRV_GXY}]) {
    super()
    this.id = randomString(12)
    this.janus = undefined
    this.janusHandleId = undefined
    this.pluginName = 'janus.plugin.videoroom'
    this.roomId = null
    this.onTrack = null
    this.onUpdate = null
    this.iceState = null
    this.iceFailed = null
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
      const error = new Error('JanusPlugin is not connected');
      return Promise.reject(error)
    }
    return this.janus.transaction(message, payload, replyType)
  }

  sub(subscription) {
    const body = {request: "subscribe", streams: subscription}
    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'event').then((param) => {
        log.info("[subscriber] Subscribe to: ", param)
        const {data, json} = param

        if(data?.videoroom === "updated") {
          log.info('[subscriber] Streams updated: ', data.streams)
          this.onUpdate(data.streams)
        }

        if(json?.jsep) {
          log.debug('[subscriber] Got jsep: ', json.jsep)
          this.handleJsep(json.jsep)
        }

        if(data)
          resolve(data);

      }).catch((error) => {
        log.error('[subscriber] Subscribe to: ', error)
        reject(error)
      })
    })
  };

  unsub(streams) {
    const body = {request: "unsubscribe", streams};
    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'event').then((param) => {
        log.info("[subscriber] Unsubscribe from: ", param)
        const {data, json} = param;

        if(data?.videoroom === "updated") {
          log.info('[subscriber] Streams updated: ', data.streams)
          this.onUpdate(data.streams)
        }

        if(json?.jsep) {
          log.debug('[subscriber] Got jsep: ', json.jsep)
          this.handleJsep(json.jsep)
        }

        if(data)
          resolve(data);

      }).catch((error) => {
        log.error('[subscriber] Unsubscribe from: ', error)
        reject(error)
      })
    })
  };

  join(subscription, roomId) {
    this.roomId = roomId
    const body = {request: "join", use_msid: true, room: roomId, ptype: "subscriber", streams: subscription};
    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'event').then((param) => {
        log.info("[subscriber] join: ", param)
        const {data, json} = param

        if(data) {
          resolve(data);
          this.initPcEvents();
        }

        if(json?.jsep) {
          log.debug('[subscriber] Got jsep: ', json.jsep)
          this.handleJsep(json.jsep)
        }

      }).catch((error) => {
        log.error('[subscriber] join: ', error)
        reject(error)
      })
    })
  }

  configure() {
    const body = {request: 'configure', restart: true}
    return this.transaction('message', { body }, 'event').then((param) => {
      log.info('[subscriber] iceRestart: ', param)
      const { json } = param || {}
      if(json?.jsep) {
        log.debug('[subscriber] Got jsep: ', json.jsep)
        this.handleJsep(json.jsep)
      }
    }).catch((error) => log.debug("[subscriber] configure failed:", error && error.message))
  }

  handleJsep(jsep) {
    if (!this.pc) {
      log.warn("[subscriber] handleJsep: no peer connection");
      return;
    }
    this.pc.setRemoteDescription(new RTCSessionDescription(jsep)).then(() => {
      if (!this.pc) return;
      return this.pc.createAnswer()
    }).then(answer => {
      if (!answer || !this.pc) return;
      log.debug('[subscriber] Answer created', answer)
      this.pc.setLocalDescription(answer).then(data => {
        log.debug('[subscriber] setLocalDescription', data)
      }).catch(error => {
        log.warn("[subscriber] setLocalDescription failed:", error && error.message);
      })
      this.start(answer)
    }).catch((error) => log.debug("[subscriber] handleJsep failed:", error && error.message))
  }

  start(answer) {
    const body = { request: 'start', room: this.roomId }
    return new Promise((resolve, reject) => {
      const jsep = answer
      this.transaction('message', { body, jsep }, 'event').then((param) => {
        const { data, json } = param || {}
        log.info("[subscriber] start: ", param)
        resolve()
      }).catch((error) => {
        log.error('[subscriber] start', error, jsep)
        reject(error)
      })
    })
  }

  initPcEvents() {
    if(this.pc) {
      this.pc.onicecandidate = (e) => {
        log.debug('[subscriber] onicecandidate set', e.candidate)
        let candidate = {completed: true}
        if (!e.candidate || e.candidate.candidate.indexOf('endOfCandidates') > 0) {
          log.debug("[subscriber] End of candidates")
        } else {
          candidate = {
            "candidate": e.candidate.candidate,
            "sdpMid": e.candidate.sdpMid,
            "sdpMLineIndex": e.candidate.sdpMLineIndex
          };
        }
        if(candidate) {
          const p = this.transaction('trickle', { candidate });
          if (p && typeof p.catch === "function") {
            p.catch((err) => log.debug("[subscriber] trickle failed:", err && err.message));
          }
        }
      };

      this.pc.onconnectionstatechange = (e) => {
        log.debug("[subscriber] ICE State: ", e.target.connectionState)
        this.iceState = e.target.connectionState
        if(this.iceState === "disconnected") {
          this.iceRestart()
          this._iceRecoveryTimeout = setTimeout(() => {
            if (this.iceState !== "connected") {
              log.warn("[subscriber] ICE not recovered in 10s, triggering reconnect");
              this.iceFailed("subscriber")
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
          this.iceFailed("subscriber")
        }
      };

      this.pc.ontrack = (e) => {
        log.debug("[subscriber] Got track: ", e)
        if (typeof this.onTrack === "function" && e.streams && e.streams[0]) {
          this.onTrack(e.track, e.streams[0], true)
        }

        if (e.track) {
          e.track.onmute = (ev) => log.debug("[subscriber] onmute event: ", ev)
          e.track.onunmute = (ev) => log.debug("[subscriber] onunmute event: ", ev)
          e.track.onended = (ev) => log.debug("[subscriber] onended event: ", ev)
        }
      };
    }
  }

  iceRestart() {
    setTimeout(() => {
      let count = 0;
      let chk = setInterval(() => {
        count++;
        if (count < 10 && this.iceState !== "disconnected" || !this.janus?.isConnected) {
          clearInterval(chk);
        } else if (mqtt.mq.connected) {
          log.debug("[subscriber] - Trigger ICE Restart - ");
          this.configure()
          clearInterval(chk);
        } else if (count >= 10) {
          clearInterval(chk);
          log.error("[subscriber] - ICE Restart failed - ");
          this.iceFailed("subscriber")
        } else {
          log.debug("[subscriber] ICE Restart try: " + count)
        }
      }, 1000);
    }, 1000)
  }

  success (janus, janusHandleId) {
    this.janus = janus
    this.janusHandleId = janusHandleId

    return this
  }

  error (cause) {
  }

  onmessage (data, json) {
    log.info('[subscriber] onmessage: ', data, json)
    if(data?.videoroom === "updated" && typeof this.onUpdate === "function") {
      log.info('[subscriber] Streams updated: ', data.streams)
      this.onUpdate(data.streams)
    }

    if(json?.jsep) {
      log.debug('[subscriber] Handle jsep: ', json.jsep)
      this.handleJsep(json.jsep)
    }
  }

  oncleanup () {
    log.info('[subscriber] - oncleanup - ')
    // PeerConnection with the plugin closed, clean the UI
    // The plugin handle is still valid so we can create a new one
  }

  detached () {
    log.info('[subscriber] - detached - ')
    // Connection with the plugin closed, get rid of its features
    // The plugin handle is not valid anymore
  }

  hangup() {
    log.info('[subscriber] - hangup - ', this)
    if(this.janus) {
      this.janus.detach(this)
    }
  }

  slowLink (uplink, lost, mid) {
    const direction = uplink ? "sending" : "receiving";
    log.info("[subscriber] slowLink on " + direction + " packets on mid " + mid + " (" + lost + " lost packets)");
    //this.emit('slowlink')
  }

  mediaState (media, on) {
    log.info('[subscriber] mediaState: Janus ' + (on ? "start" : "stop") + " receiving our " + media)
    //this.emit('mediaState', medium, on)
  }

  webrtcState (isReady) {
    log.info('[subscriber] webrtcState: RTCPeerConnection is: ' + (isReady ? "up" : "down"))
    if(!isReady && typeof this.iceFailed === "function") this.iceFailed("subscriber")
  }

  detach() {
    if (this._iceRecoveryTimeout) {
      clearTimeout(this._iceRecoveryTimeout);
      this._iceRecoveryTimeout = null;
    }
    if(this.pc) {
      try {
        this.pc.getTransceivers().forEach((transceiver) => {
          if (!transceiver) return;
          try {
            if (transceiver.receiver && transceiver.receiver.track) {
              transceiver.receiver.track.stop();
            }
          } catch (_) { /* track already stopped */ }
          try { transceiver.stop(); }
          catch (_) { /* transceiver already stopped */ }
        });
      } catch (_) { /* getTransceivers on closed PC */ }
      try { this.pc.close() } catch (_) { /* already closed */ }
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.onremovetrack = null;
      this.pc.onicecandidate = null;
      this.pc.onsignalingstatechange = null;
      this.removeAllListeners()
      this.pc = null
      this.janus = null
    }
  }
}

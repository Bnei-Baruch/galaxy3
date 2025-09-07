import {randomString} from "../shared/tools";
import {EventEmitter} from "events";
import log from "loglevel";
import mqtt from "../shared/mqtt";
import {STUN_SRV_GXY} from "../shared/env";
import { captureException } from "../shared/sentry";

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
      captureException(error, { message, additionalFields });
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
        captureException(error, { context: 'SubscriberPlugin.sub', subscription });
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
        captureException(error, { context: 'SubscriberPlugin.unsub', streams });
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
        captureException(error, { context: 'SubscriberPlugin.join', roomId, subscription });
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
    }).catch(error => {
      captureException(error, { context: 'SubscriberPlugin.configure' });
      throw error;
    })
  }

  handleJsep(jsep) {
    this.pc.setRemoteDescription(new RTCSessionDescription(jsep)).then(() => {
      return this.pc.createAnswer()
    }).then(answer => {
      log.debug('[subscriber] Answer created', answer)
      this.pc.setLocalDescription(answer).then(data => {
        log.debug('[subscriber] setLocalDescription', data)
      }).catch(error => {
        log.error(error, answer)
        captureException(error, { context: 'SubscriberPlugin.handleJsep.setLocalDescription', answer });
      })
      this.start(answer)
    }).catch(error => {
      captureException(error, { context: 'SubscriberPlugin.handleJsep', jsep });
      throw error;
    })
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
        captureException(error, { context: 'SubscriberPlugin.start', roomId: this.roomId, jsep });
        reject(error)
      })
    })
  }

  initPcEvents() {
    if(this.pc) {
      this.pc.onicecandidate = (e) => {
        try {
          log.debug('[subscriber] onicecandidate set', e.candidate)
          let candidate = {completed: true}
          if (!e.candidate || e.candidate.candidate.indexOf('endOfCandidates') > 0) {
            log.debug("[subscriber] End of candidates")
          } else {
          // JSON.stringify doesn't work on some WebRTC objects anymore
          // See https://code.google.com/p/chromium/issues/detail?id=467366
            candidate = {
              "candidate": e.candidate.candidate,
              "sdpMid": e.candidate.sdpMid,
              "sdpMLineIndex": e.candidate.sdpMLineIndex
            };
          }
          if(candidate) {
            return this.transaction('trickle', { candidate })
          }
        } catch (error) {
          captureException(error, { context: 'SubscriberPlugin.initPcEvents.onicecandidate' });
          throw error;
        }
      };

      this.pc.onconnectionstatechange = (e) => {
        try {
          log.debug("[subscriber] ICE State: ", e.target.connectionState)
          this.iceState = e.target.connectionState
          if(this.iceState === "disconnected") {
            this.iceRestart()
          }
        // ICE restart does not help here, peer connection will be down
          if(this.iceState === "failed") {
            const error = new Error('ICE connection failed');
            captureException(error, { context: 'SubscriberPlugin.initPcEvents.onconnectionstatechange', iceState: this.iceState });
          }
        } catch (error) {
          captureException(error, { context: 'SubscriberPlugin.initPcEvents.onconnectionstatechange', iceState: this.iceState });
          throw error;
        }
      };

      this.pc.ontrack = (e) => {
        try {
          log.debug("[subscriber] Got track: ", e)
          this.onTrack(e.track, e.streams[0], true)

          e.track.onmute = (ev) => {
            log.debug("[subscriber] onmute event: ", ev)
          }

          e.track.onunmute = (ev) => {
            log.debug("[subscriber] onunmute event: ", ev)
          }

          e.track.onended = (ev) => {
            log.debug("[subscriber] onended event: ", ev)
          }
        } catch (error) {
          captureException(error, { context: 'SubscriberPlugin.initPcEvents.ontrack' });
          throw error;
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
    const error = new Error('[subscriber] Plugin error');
    captureException(error, { cause });
  }

  onmessage (data, json) {
    try {
      log.info('[subscriber] onmessage: ', data, json)
      if(data?.videoroom === "updated") {
        log.info('[subscriber] Streams updated: ', data.streams)
        this.onUpdate(data.streams)
      }

      if(json?.jsep) {
        log.debug('[subscriber] Handle jsep: ', json.jsep)
        this.handleJsep(json.jsep)
      }
    } catch (error) {
      captureException(error, { context: 'SubscriberPlugin.onmessage', data, json });
      throw error;
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
    if(this.pc) {
      this.pc.getTransceivers().forEach((transceiver) => {
        if(transceiver) {
          if(transceiver.receiver && transceiver.receiver.track)
            transceiver.receiver.track.stop();
          transceiver.stop();
        }
      });
      this.pc.close()
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

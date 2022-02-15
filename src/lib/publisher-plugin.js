import {randomString} from "../shared/tools";
import {EventEmitter} from "events";
import log from "loglevel";
import platform from "platform";
import mqtt from "../shared/mqtt";

export class PublisherPlugin extends EventEmitter {
  constructor (logger) {
    super()
    this.id = randomString(12)
    this.janus = undefined
    this.janusHandleId = undefined
    this.pluginName = 'janus.plugin.videoroom'
    this.roomId = null
    this.subTo = null
    this.unsubFrom = null
    this.talkEvent = null
    this.iceState = null
    this.pc = new RTCPeerConnection({
      iceServers: [{urls: "stun:icesrv.kab.sh:3478"}]
    })
  }

  getPluginName () {
    return this.pluginName
  }

  transaction (message, additionalFields, replyType) {
    const payload = Object.assign({}, additionalFields, { handle_id: this.janusHandleId })

    if (!this.janus) {
      return Promise.reject(new Error('[publisher] JanusPlugin is not connected'))
    }
    return this.janus.transaction(message, payload, replyType)
  }

  join (roomId, user) {
    this.roomId = roomId
    const body = {request: "join", room: roomId, ptype: "publisher", display: JSON.stringify(user)};
    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'event').then((param) => {
        log.info("[publisher] join: ", param)
        const {data, json } = param

        if(data)
          resolve(data);

      }).catch((err) => {
        log.error('[publisher] error join room', err)
        reject(err)
      })
    })
  }

  leave () {
    const body = {request: "leave", room: this.roomId};
    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'event').then((param) => {
        log.info("[publisher] leave: ", param)
        const {data, json } = param

        if(data)
          resolve(data);

      }).catch((err) => {
        log.error('[publisher] error leave room', err)
        reject(err)
      })
    })
  }

  publish(video, audio) {

    if(video) this.pc.addTrack(video.getVideoTracks()[0], video);
    if(audio) this.pc.addTrack(audio.getAudioTracks()[0], audio);

    let videoTransceiver = null;
    let audioTransceiver = null;
    let tr = this.pc.getTransceivers();
    if(tr && tr.length > 0) {
      for (let t of tr) {
        if (t.sender && t.sender.track && t.sender.track.kind === "video") {
          videoTransceiver = t;
          if (videoTransceiver.setDirection) {
            videoTransceiver.setDirection("sendonly");
          } else {
            videoTransceiver.direction = "sendonly";
          }
          break;
        }
        if(t.sender && t.sender.track && t.sender.track.kind === "audio") {
          audioTransceiver = t;
          if (audioTransceiver.setDirection) {
            audioTransceiver.setDirection("sendonly");
          } else {
            audioTransceiver.direction = "sendonly";
          }
          break;
        }
      }
    }

    this.pc.onicecandidate = (e) => {
      let candidate = {completed: true}
      if (!e.candidate || e.candidate.candidate.indexOf('endOfCandidates') > 0) {
        log.debug("[publisher] End of candidates")
      } else {
        // JSON.stringify doesn't work on some WebRTC objects anymore
        // See https://code.google.com/p/chromium/issues/detail?id=467366
        candidate = {
          "candidate": e.candidate.candidate,
          "sdpMid": e.candidate.sdpMid,
          "sdpMLineIndex": e.candidate.sdpMLineIndex
        };
      }

      return this.transaction('trickle', { candidate })
    };

    this.pc.ontrack = (e) => {
      log.info("[publisher] Got track: ", e)
    };

    this.pc.onconnectionstatechange = (e) => {
      log.warn("[publisher] ICE State: ", e.target.connectionState)
      this.iceState = e.target.connectionState
      if(this.iceState === "disconnected") {
        let count = 0;
        let chk = setInterval(() => {
          count++;
          log.debug("ICE counter: ", count, mqtt.mq.connected);
          if (count < 60 && this.iceState.match(/^(connected|completed)$/)) {
            clearInterval(chk);
          }
          if (mqtt.mq.connected) {
            log.debug(" :: ICE Restart :: ", mqtt.mq.connected);
            this.pc.restartIce();
            clearInterval(chk);
          }
          if (count >= 60) {
            clearInterval(chk);
            log.error(" :: ICE Filed: Reconnecting... ");
          }
        }, 1000);
        //this.pc.restartIce();
      }
    };

    this.pc.onnegotiationneeded = (e) => {
      log.warn("[publisher] Negotiation Needed: ", e)
      if(this.iceState === "disconnected") {
        this.iceRestart()
      }
    }

    this.pc.createOffer().then((offer) => {
      this.pc.setLocalDescription(offer)
        const jsep = { type: offer.type, sdp: offer.sdp }
        const body = { request: 'configure', video: !!video, audio: !!audio }
        return this.transaction('message', { body, jsep }, 'event').then((param) => {
          const { json } = param || {}
          const jsep = json.jsep
          log.info('[publisher] Configure respond: ', jsep)
          this.pc.setRemoteDescription(jsep).then(() => {
            log.info('[publisher] remoteDescription set')
          })
        })

    })
  };

  mute(video, stream) {

    let videoTransceiver = null;
    let tr = this.pc.getTransceivers();
    if(tr && tr.length > 0) {
      for(let t of tr) {
        if(t?.sender?.track?.kind === "video") {
          videoTransceiver = t;
          break;
        }
      }
    }

    let d = video ? "inactive" : "sendonly"

    if (videoTransceiver?.setDirection) {
      videoTransceiver.setDirection(d);
    } else {
      videoTransceiver.direction = d;
    }

    if(!video) videoTransceiver.sender.replaceTrack(stream.getVideoTracks()[0])
    this.configure()

  }

  audio(stream) {
    let audioTransceiver = null;
    let tr = this.pc.getTransceivers();
    if(tr && tr.length > 0) {
      for(let t of tr) {
        if(t?.sender?.track?.kind === "audio") {
          audioTransceiver = t;
          break;
        }
      }
    }

    if (audioTransceiver?.setDirection) {
      audioTransceiver.setDirection("sendonly");
    } else {
      audioTransceiver.direction = "sendonly";
    }

    audioTransceiver.sender.replaceTrack(stream.getAudioTracks()[0])
    this.configure()
  }

  ice() {
    let count = 0;
    let chk = setInterval(() => {
      count++;
      log.debug("ICE counter: ", count);
      if (count < 60 && this.iceState.match(/^(connected|completed)$/)) {
        clearInterval(chk);
      }
      if (mqtt.mq.isConnected) {
        log.debug(" :: ICE Restart :: ");
      }
      if (count >= 60) {
        clearInterval(chk);
        log.error(" :: ICE Filed: Reconnecting... ");
      }
    }, 1000);
  };

  iceRestart() {
    this.pc.createOffer().then((offer) => {
      this.pc.setLocalDescription(offer).catch(error => log.error("[publisher] setLocalDescription: ", error))
      const body = {request: 'configure', restart: true}
      return this.transaction('message', { body, jsep: offer }, 'event').then((param) => {
        const { json } = param || {}
        const jsep = json.jsep
        log.info('[publisher] iceRestart: ', param)
        this.pc.setRemoteDescription(jsep).then(() => {
          log.info('[publisher] iceRestart remoteDescription set')
        })
      })

    })
  }

  configure() {
    this.pc.createOffer().then((offer) => {
      this.pc.setLocalDescription(offer).catch(error => log.error("[publisher] setLocalDescription: ", error))
      const body = {request: 'configure'}
      return this.transaction('message', { body, jsep: offer }, 'event').then((param) => {
        const { json } = param || {}
        const jsep = json.jsep
        //log.info('[publisher] Video is - ' + (video ? 'Muted' : 'Unmuted'), param)
        this.pc.setRemoteDescription(jsep).then(() => {
          log.info('[publisher] remoteDescription set')
        })
      })

    })
  }

  success (janus, janusHandleId) {
    this.janus = janus
    this.janusHandleId = janusHandleId

    return this
  }

  error (cause) {
    // Couldn't attach to the plugin
  }

  onmessage (data, jsep) {
    log.info('[publisher] onmessage: ', data, jsep)
    if(data?.publishers) {
      log.info('[publisher] New feed enter: ', data.publishers[0])
      this.subTo(data.publishers)
    }

    if(data?.unpublished) {
      log.info('[publisher] Feed leave: ', data.unpublished)
      if (data?.unpublished === "ok") {
        // That's us
        this.janus.detach(this)
        return;
      }
      this.unsubFrom([data.unpublished], false)
    }

    if(data?.leaving) {
      log.info('[publisher] Feed leave: ', data.leaving)
      this.unsubFrom([data.leaving], false)
    }

    if(data?.videoroom === "talking") {
      log.info('[publisher] talking: ', data.id)
      this.talkEvent(data.id, true)
    }

    if(data?.videoroom === "stopped-talking") {
      log.info('[publisher] stopped talking: ', data.id)
      this.talkEvent(data.id, false)
    }

    if(jsep) {
      log.debug('[publisher] Got JSEP?: ', jsep)
    }
  }

  oncleanup () {
    log.info('[publisher] - oncleanup - ')
    // PeerConnection with the plugin closed, clean the UI
    // The plugin handle is still valid so we can create a new one
  }

  detached () {
    log.info('[publisher] - detached - ')
    // Connection with the plugin closed, get rid of its features
    // The plugin handle is not valid anymore
  }

  hangup () {
    log.info('[publisher] - hangup - ')
    //this.emit('hangup')
  }

  slowLink (uplink, lost) {
    log.info('[publisher] slowLink: ', uplink, lost)
    //this.emit('slowlink')
  }

  mediaState (medium, on) {
    log.info('[publisher] mediaState: ', medium, on)
    //this.emit('mediaState', medium, on)
  }

  webrtcState (isReady, cause) {
    log.info('[publisher] webrtcState: ', isReady, cause)
    //this.emit('webrtcState', isReady, cause)
  }

  detach () {
    this.pc.close()
    this.removeAllListeners()
    this.janus = null
  }
}

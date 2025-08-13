import {randomString} from "../shared/tools";
import {EventEmitter} from "events";
import log from "loglevel";
import mqtt from "../shared/mqtt";
import {STUN_SRV_GXY} from "../shared/env";
import { captureException } from "../shared/sentry";

export class PublisherPlugin extends EventEmitter {
  constructor (list = [{urls: STUN_SRV_GXY}]) {
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
    this.iceFailed = null
    this.pc = new RTCPeerConnection({
      iceServers: list
    })
  }

  getPluginName() {
    return this.pluginName
  }

  transaction (message, additionalFields, replyType) {
    const payload = Object.assign({}, additionalFields, { handle_id: this.janusHandleId })

    if (!this.janus) {
      const error = new Error('[publisher] JanusPlugin is not connected');
      captureException(error, { message, additionalFields });
      return Promise.reject(error)
    }
    return this.janus.transaction(message, payload, replyType)
  }

  join(roomId, user, metadata) {
    this.roomId = roomId
    const body = {request: "join", room: roomId, ptype: "publisher", display: JSON.stringify(user), metadata};
    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'event').then((param) => {
        log.info("[publisher] join: ", param)
        const {data, json } = param

        if(data)
          resolve(data);

      }).catch((error) => {
        log.error('[publisher] error join room', error)
        captureException(error, { context: 'PublisherPlugin.join', roomId, user });
        reject(error)
      })
    })
  }

  leave() {
    if(this.roomId) {
      const body = {request: "leave", room: this.roomId};
      return new Promise((resolve, reject) => {
        this.transaction('message', { body }, 'event').then((param) => {
          log.info("[publisher] leave: ", param)
          const {data, json } = param

          if(data)
            resolve(data);

        }).catch((error) => {
          log.debug('[publisher] error leave room', error)
          captureException(error, { context: 'PublisherPlugin.leave', roomId: this.roomId });
          reject(error)
        })
      })
    }
  }

  publish(video, audio) {
    return new Promise((resolve, reject) => {
      try {
        if (video) this.pc.addTrack(video.getVideoTracks()[0], video);
        if (audio) this.pc.addTrack(audio.getAudioTracks()[0], audio);

        let videoTransceiver = null;
        let audioTransceiver = null;

        let tr = this.pc.getTransceivers();
        if (tr && tr.length > 0) {
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
            if (t.sender && t.sender.track && t.sender.track.kind === "audio") {
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

        this.initPcEvents()

        this.pc.createOffer().then((offer) => {
          this.pc.setLocalDescription(offer)
          const jsep = {type: offer.type, sdp: offer.sdp}
          const body = {request: 'configure', video: !!video, audio: !!audio}
          return this.transaction('message', {body, jsep}, 'event').then((param) => {
            const {data, json} = param || {}
            const jsep = json.jsep
            log.info('[publisher] Configure respond: ', param)
            resolve(data)
            this.pc.setRemoteDescription(jsep)
          }).catch(error => {
            captureException(error, { context: 'PublisherPlugin.publish.configure', video: !!video, audio: !!audio });
            reject(error)
          })
        }).catch(error => {
          captureException(error, { context: 'PublisherPlugin.publish.createOffer' });
          reject(error)
        })
      } catch (error) {
        captureException(error, { context: 'PublisherPlugin.publish', video: !!video, audio: !!audio });
        reject(error)
      }
    })
  };

  mute(video, stream) {
    try {
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
      if(stream) this.configure()
    } catch (error) {
      captureException(error, { context: 'PublisherPlugin.mute', video: !!video, hasStream: !!stream });
      throw error;
    }
  }

  setBitrate(bitrate) {
    const body = {request: "configure", bitrate};
    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'event').then((param) => {
        log.info("[publisher] set bitrate: ", param)
        const {data, json } = param

        if(data)
          resolve(data);

      }).catch((error) => {
        log.debug('[publisher] error set bitrate', error)
        captureException(error, { context: 'PublisherPlugin.setBitrate', bitrate });
        reject(error)
      })
    })
  }

  audio(stream) {
    try {
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
    } catch (error) {
      captureException(error, { context: 'PublisherPlugin.audio', hasStream: !!stream });
      throw error;
    }
  }

  configure(restart) {
    this.pc.createOffer().then((offer) => {
      this.pc.setLocalDescription(offer).catch(error => {
        log.error("[publisher] setLocalDescription: ", error)
        captureException(error, { context: 'PublisherPlugin.configure.setLocalDescription', restart });
      })
      const body = {request: 'configure', restart}
      return this.transaction('message', {body, jsep: offer}, 'event').then((param) => {
        const {data, json} = param || {}
        const jsep = json.jsep
        log.info('[publisher] Configure respond: ', param)
        this.pc.setRemoteDescription(jsep).then(e => log.info(e)).catch(error => {
          log.error(error)
          captureException(error, { context: 'PublisherPlugin.configure.setRemoteDescription', restart });
        })
      }).catch(error => {
        captureException(error, { context: 'PublisherPlugin.configure', restart });
        throw error;
      })
    }).catch(error => {
      captureException(error, { context: 'PublisherPlugin.configure.createOffer', restart });
      throw error;
    })
  }

  initPcEvents() {
    this.pc.onicecandidate = (e) => {
      try {
        let candidate = {completed: true}
        if (!e.candidate || e.candidate.candidate.indexOf('endOfCandidates') > 0) {
          log.debug("[publisher] End of candidates")
        } else {
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
        captureException(error, { context: 'PublisherPlugin.initPcEvents.onicecandidate' });
        throw error;
      }
    };

    this.pc.ontrack = (e) => {
      log.info("[publisher] Got track: ", e)
    };

    this.pc.onconnectionstatechange = (e) => {
      try {
        log.info("[publisher] ICE State: ", e.target.connectionState)
        this.iceState = e.target.connectionState

        if(this.iceState === "disconnected") {
          this.iceRestart()
        }

      // ICE restart does not help here, peer connection will be down
        if(this.iceState === "failed") {
          const error = new Error('ICE connection failed');
          captureException(error, { context: 'PublisherPlugin.initPcEvents.onconnectionstatechange', iceState: this.iceState });
        }
      } catch (error) {
        captureException(error, { context: 'PublisherPlugin.initPcEvents.onconnectionstatechange', iceState: this.iceState });
        throw error;
      }
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
          log.debug("[publisher] - Trigger ICE Restart - ");
          this.pc.restartIce();
          this.configure(true)
          clearInterval(chk);
        } else if (count >= 10) {
          clearInterval(chk);
          log.error("[publisher] - ICE Restart failed - ");
          this.iceFailed("publisher")
        } else {
          log.debug("[publisher] ICE Restart try: " + count)
        }
      }, 1000);
    },3000)
  }

  success(janus, janusHandleId) {
    this.janus = janus
    this.janusHandleId = janusHandleId

    return this
  }

  error (cause) {
    const error = new Error('[publisher] Plugin error');
    captureException(error, { cause });
  }

  onmessage(data) {
    log.debug('[publisher] onmessage: ', data)
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
      log.debug('[publisher] talking: ', data.id)
      this.talkEvent(data.id, true)
        }

    if(data?.videoroom === "stopped-talking") {
      log.debug('[publisher] stopped talking: ', data.id)
      this.talkEvent(data.id, false)
    }
  }

  oncleanup() {
    log.info('[publisher] - oncleanup - ')
    // PeerConnection with the plugin closed, clean the UI
    // The plugin handle is still valid so we can create a new one
  }

  detached() {
    log.info('[publisher] - detached - ')
    // Connection with the plugin closed, get rid of its features
    // The plugin handle is not valid anymore
  }

  hangup() {
    log.info('[publisher] - hangup - ', this.janus)
    this.detach()
  }

  slowLink(uplink, lost, mid) {
    const direction = uplink ? "sending" : "receiving";
    log.info("[publisher] slowLink on " + direction + " packets on mid " + mid + " (" + lost + " lost packets)");
    //this.emit('slowlink')
  }

  mediaState(media, on) {
    log.info('[publisher] mediaState: Janus ' + (on ? "start" : "stop") + " receiving our " + media)
    //this.emit('mediaState', medium, on)
  }

  webrtcState(isReady) {
    log.info('[publisher] webrtcState: RTCPeerConnection is: ' + (isReady ? "up" : "down"))
    if(!isReady && typeof this.iceFailed === "function") this.iceFailed("publisher")
  }

  detach() {
    if(this.pc) {
      this.pc.getTransceivers().forEach((transceiver) => {
        if(transceiver) {
          this.pc.removeTrack(transceiver.sender);
          transceiver.stop();
        }
      });
      this.pc.close()
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.oniceconnectionstatechange = null;
      this.removeAllListeners()
      this.pc = null
      this.janus = null
    }
  }
}

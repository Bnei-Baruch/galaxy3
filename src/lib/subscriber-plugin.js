import {randomString} from "../shared/tools";
import {EventEmitter} from "events";

export class SubscriberPlugin extends EventEmitter {
  constructor (logger) {
    super()
    this.id = randomString(12)
    this.janus = undefined
    this.janusHandleId = undefined
    this.pluginName = 'janus.plugin.videoroom'
    this.roomId = null
    this.onTrack = null
    this.onUpdate = null
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
      return Promise.reject(new Error('JanusPlugin is not connected'))
    }
    return this.janus.transaction(message, payload, replyType)
  }

  sub(subscription) {
    const body = {request: "subscribe", streams: subscription}
    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'event').then((param) => {
        console.log("[subscriber] Subscribe to: ", param)
        const {data, json} = param

        if(data?.videoroom === "updated") {
          console.log('[subscriber] Streams updated: ', data.streams)
          this.onUpdate(data.streams)
        }

        if(json?.jsep) {
          this.pc.setRemoteDescription(new RTCSessionDescription(json.jsep)).then(() => {
            return this.pc.createAnswer()
          }).then(answer => {
            console.log('[subscriber] answerCreated')
            this.pc.setLocalDescription(answer)
            this.answer(answer)
          })
        }

        if(data)
          resolve(data);

      }).catch((err) => {
        console.error('[subscriber] Subscribe to: ', err)
        reject(err)
      })
    })
  };

  unsub(streams) {
    const body = {request: "unsubscribe", streams};
    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'event').then((param) => {
        console.log("[subscriber] Unsubscribe from: ", param)
        const {data, json } = param

        if(data)
          resolve(data);

      }).catch((err) => {
        console.error('[subscriber] Unsubscribe from: ', err)
        reject(err)
      })
    })
  };

  join (subscription, roomId) {
    this.roomId = roomId
    const body = {request: "join", room: roomId, ptype: "subscriber", streams: subscription};
    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'event').then((param) => {
        console.log("[subscriber] join: ", param)
        const {data, json } = param

        if(data)
          resolve(data);

        this.pc.onicecandidate = (e) => {
          console.log('[subscriber] onicecandidate set', e.candidate)
          let candidate = {completed: true}
          if (!e.candidate || e.candidate.candidate.indexOf('endOfCandidates') > 0) {
            console.debug("[subscriber] End of candidates")
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

        this.pc.onconnectionstatechange = (e) => {
          console.log("[subscriber] ICE State: ", e.target.connectionState)
        }

        this.pc.ontrack = (e) => {
          console.log("[subscriber] Got track: ", e)
          this.onTrack(e.track, null, true)
        };

        if(json?.jsep) {
          console.debug('[subscriber] Got JSEP: ', json.jsep)
          this.pc.setRemoteDescription(new RTCSessionDescription(json.jsep)).then(() => {
            return this.pc.createAnswer()
          }).then(answer => {
            console.log('[subscriber] answerCreated')
            this.pc.setLocalDescription(answer)
            this.answer(answer)
          })
        }

      }).catch((err) => {
        console.error('[subscriber] join: ', err)
        reject(err)
      })
    })
  }

  answer (answer) {
    const body = { request: 'start', room: this.roomId }
    return new Promise((resolve, reject) => {
      const jsep = answer
      this.transaction('message', { body, jsep }, 'event').then((param) => {
        const { data, json } = param || {}
        console.log("[subscriber] answer: ", param)
        resolve()
      }).catch((err) => {
        console.error('[subscriber] answer', err, answer)
        reject(err)
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

  onmessage (data, json) {
    console.log('[subscriber] onmessage: ', data, json)
    if(data?.videoroom === "updated") {
      console.log('[subscriber] Streams updated: ', data.streams)
      this.onUpdate(data.streams)
    }

    if(json?.jsep) {
      console.debug('[subscriber] Got JSEP: ', json.jsep)
      this.pc.setRemoteDescription(new RTCSessionDescription(json.jsep)).then(() => {
        return this.pc.createAnswer()
      }).then(answer => {
        console.log('[subscriber] answerCreated')
        this.pc.setLocalDescription(answer)
        this.answer(answer)
      })
    }
  }

  oncleanup () {
    console.log('[subscriber] - oncleanup - ')
    // PeerConnection with the plugin closed, clean the UI
    // The plugin handle is still valid so we can create a new one
  }

  detached () {
    console.log('[subscriber] - detached - ')
    // Connection with the plugin closed, get rid of its features
    // The plugin handle is not valid anymore
  }

  hangup () {
    console.log('[subscriber] - hangup - ')
    this.janus.destroyPlugin(this).catch((err) => {
      console.error('[subscriber] error in hangup', err)
    })
  }

  slowLink (uplink, lost) {
    console.log('[subscriber] slowLink: ', uplink, lost)
    //this.emit('slowlink')
  }

  mediaState (medium, on) {
    console.log('[subscriber] mediaState: ', medium, on)
    //this.emit('mediaState', medium, on)
  }

  webrtcState (isReady, cause) {
    console.log('[subscriber] webrtcState: ', isReady, cause)
    //this.emit('webrtcState', isReady, cause)
  }

  detach () {
    this.removeAllListeners()
    this.janus = null
  }
}

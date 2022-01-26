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
        const {data, json } = param

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

  join (body, roomId) {
    this.roomId = roomId
    //const body = { request: 'join', id }
    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'event').then((param) => {
        console.log("[subscriber] join: ", param)
        const {data, json } = param

        if(data)
          resolve(data);

        this.pc.onicecandidate = (e) => {
          console.log('[subscriber] onicecandidate set', e.candidate)
          return this.transaction('trickle', { candidate: e.candidate })
        };

        this.pc.ontrack = (e) => {
          console.log("[subscriber] Got track: ", e)
          // let stream = new MediaStream();
          // stream.addTrack(e.track.clone());
          this.onTrack(e.track, null, true)
          //resolve(stream);
        };

        if(json?.jsep) {
          this.pc.setRemoteDescription(new RTCSessionDescription(json.jsep)).then(() => {
            console.log('[subscriber] remoteDescription set', this.filterDirectCandidates)
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
    this.emit('hangup')
  }

  slowLink () {
    this.emit('slowlink')
  }

  mediaState (medium, on) {
    this.emit('mediaState', medium, on)
  }

  webrtcState (isReady, cause) {
    this.emit('webrtcState', isReady, cause)
  }

  detach () {
    this.removeAllListeners()
    this.janus = null
  }
}

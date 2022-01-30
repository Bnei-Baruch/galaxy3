import {randomString} from "../shared/tools";
import {EventEmitter} from "events";

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
        console.log("[publisher] join: ", param)
        const {data, json } = param

        if(data)
          resolve(data);

      }).catch((err) => {
        console.error('[publisher] error join room', err)
        reject(err)
      })
    })
  }

  leave () {
    const body = {request: "leave", room: this.roomId};
    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'event').then((param) => {
        console.log("[publisher] leave: ", param)
        const {data, json } = param

        if(data)
          resolve(data);

      }).catch((err) => {
        console.error('[publisher] error leave room', err)
        reject(err)
      })
    })
  }

  offer(video, audio) {
    this.pc.addTransceiver('audio')
    this.pc.addTransceiver('video')

    this.pc.addTrack(video.getVideoTracks()[0], video);
    this.pc.addTrack(audio.getAudioTracks()[0], audio);

    this.pc.onicecandidate = (e) => {
      let candidate = {completed: true}
      if (!e.candidate || e.candidate.candidate.indexOf('endOfCandidates') > 0) {
        console.debug("[publisher] End of candidates")
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
      console.log("[publisher] Got track: ", e)
    };

    let transceivers = this.pc.getTransceivers();
    console.log("[publisher] transceivers: ", transceivers)
    this.pc.createOffer().then((offer) => {
      this.pc.setLocalDescription(offer).then(() => {
        const jsep = { type: offer.type, sdp: offer.sdp }
        const body = { request: 'configure', audio: true, video: true }
        return this.transaction('message', { body, jsep }, 'event').then((param) => {
          const { json } = param || {}
          const jsep = json.jsep
          console.log('[publisher] Configure respond: ', jsep)
          this.pc.setRemoteDescription(new RTCSessionDescription(jsep)).then(() => {
            console.log('[publisher] remoteDescription set')
          })
        })
      })
    })
  };

  success (janus, janusHandleId) {
    this.janus = janus
    this.janusHandleId = janusHandleId

    return this
  }

  error (cause) {
    // Couldn't attach to the plugin
  }

  onmessage (data, jsep) {
    console.log('[publisher] onmessage: ', data, jsep)
    if(data?.publishers) {
      const feeds = data.publishers.filter((l) => (l.display = JSON.parse(l.display)));
      console.log('[publisher] New feed enter: ', feeds[0])
      this.subTo(feeds)
    }

    if(data?.unpublished) {
      console.log('[publisher] Feed leave: ', data.unpublished)
      this.unsubFrom([data.unpublished], false)
    }

    if(data?.videoroom === "talking") {
      console.log('[publisher] talking: ', data.id)
      this.talkEvent(data.id, true)
    }

    if(data?.videoroom === "stopped-talking") {
      console.log('[publisher] stopped talking: ', data.id)
      this.talkEvent(data.id, false)
    }

    if(jsep) {
      console.debug('[publisher] Got JSEP?: ', jsep)
    }
  }

  oncleanup () {
    console.log('[publisher] - oncleanup - ')
    // PeerConnection with the plugin closed, clean the UI
    // The plugin handle is still valid so we can create a new one
  }

  detached () {
    console.log('[publisher] - detached - ')
    // Connection with the plugin closed, get rid of its features
    // The plugin handle is not valid anymore
  }

  hangup () {
    console.log('[publisher] - hangup - ')
    //this.emit('hangup')
  }

  slowLink (uplink, lost) {
    console.log('[publisher] slowLink: ', uplink, lost)
    //this.emit('slowlink')
  }

  mediaState (medium, on) {
    console.log('[publisher] mediaState: ', medium, on)
    //this.emit('mediaState', medium, on)
  }

  webrtcState (isReady, cause) {
    console.log('[publisher] webrtcState: ', isReady, cause)
    //this.emit('webrtcState', isReady, cause)
  }

  detach () {
    this.removeAllListeners()
    this.janus = null
  }
}

import {randomString} from "../shared/tools";
import {EventEmitter} from "events";

export class PublisherPlugin extends EventEmitter {
  constructor (logger) {
    super()
    this.id = randomString(12)
    this.janus = undefined
    this.janusHandleId = undefined
    this.pluginName = 'janus.plugin.videoroom'
    this.subTo = null
    this.unsubFrom = null
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

  join (body) {
    //const body = { request: 'join', id }
    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'event').then((param) => {
        console.log("[publisher] join: ", param)
        const {data, json } = param

        if(data)
          resolve(data);

      }).catch((err) => {
        if (err && err.error_code === 426) { // JANUS_VIDEOROOM_ERROR_NO_SUCH_ROOM = 426
          console.error('VideoRoomPublisherJanusPlugin, JANUS_VIDEOROOM_ERROR_NO_SUCH_ROOM', err)
          reject(err)
        } else {
          console.error('VideoRoomPublisherJanusPlugin, unknown error connecting to room', err)
          reject(err)
        }
      })
    })
  }

  offer(video, audio) {
    this.pc.addTransceiver('audio')
    this.pc.addTransceiver('video')

    this.pc.addTrack(video.getVideoTracks()[0], video);
    this.pc.addTrack(audio.getAudioTracks()[0], audio);

    this.pc.onicecandidate = (e) => {
      return this.transaction('trickle', { candidate: e.candidate })
    };

    this.pc.ontrack = (e) => {
      console.log("[publisher] Got track: ", e)
      let stream = new MediaStream();
      stream.addTrack(e.track.clone());
      //resolve(stream);
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
          console.log('[publisher] CONFIGURE', jsep)
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

  onmessage (data, json) {
    console.log('[publisher] onmessage: ', data, json)
    if(data?.publishers) {
      const feeds = data.publishers.filter((l) => (l.display = JSON.parse(l.display)));
      console.log('[publisher] New feed enter: ', feeds[0])
      this.subTo(feeds)
    }

    if(data?.unpublished) {
      console.log('[publisher] Feed leave: ', data.unpublished)
      this.unsubFrom([data.unpublished], false)
    }
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

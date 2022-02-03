import {randomString} from "../shared/tools";
import {EventEmitter} from "events";

export class StreamingPlugin extends EventEmitter {
  constructor (logger) {
    super()
    this.id = randomString(12)
    this.janus = undefined
    this.janusHandleId = undefined
    this.pluginName = 'janus.plugin.streaming'
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
      return Promise.reject(new Error('[streaming] JanusPlugin is not connected'))
    }

    return this.janus.transaction(message, payload, replyType)
  }

  watch (id) {
    const body = { request: 'watch', id }
    return new Promise((resolve, reject) => {
      this.transaction('message', { body }, 'event').then((param) => {
        console.log("[streaming] watch: ", param)
        const {session_id, json } = param

        let audioTransceiver = null, videoTransceiver = null;
        let transceivers = this.pc.getTransceivers();
        if(transceivers && transceivers.length > 0) {
          for(let t of transceivers) {
            if(t?.receiver?.track?.kind === "audio") {
              if (audioTransceiver.setDirection) {
                audioTransceiver.setDirection("recvonly");
              } else {
                audioTransceiver.direction = "recvonly";
              }
              continue;
            }
            if(t?.receiver?.track?.kind === "video") {
              if (videoTransceiver.setDirection) {
                videoTransceiver.setDirection("sendonly");
              } else {
                videoTransceiver.direction = "sendonly";
              }
              continue;
            }
          }
        }

        if (json?.jsep) {
          console.log('[streaming] sdp: ', json)
          this.sdpExchange(json.jsep)
        }

        this.pc.onicecandidate = (e) => {
          return this.transaction('trickle', { candidate: e.candidate })
        };

        this.pc.onconnectionstatechange = (e) => {
          console.log("[streaming] ICE State: ", e.target.connectionState)
        };

        this.pc.ontrack = (e) => {
          console.log("[streaming] Got track: ", e)
          let stream = new MediaStream();
          stream.addTrack(e.track.clone());
          resolve(stream);
        };

      }).catch((err) => {
        console.error('[streaming] StreamingJanusPlugin, cannot watch stream', err)
        reject(err)
      })
    })
  }

  sdpExchange(jsep) {
    this.pc.setRemoteDescription(jsep);
    this.pc.createAnswer().then((desc) => {
      this.pc.setLocalDescription(desc);
      this.start(desc)
    }, error => console.error(error));
  }

  start(jsep) {
    const body = { request: 'start' }
    const message = { body }
    if (jsep) {
      message.jsep = jsep
    }

    return this.transaction('message', message, 'event').then(({ data, json }) => {
      return { data, json }
    }).catch((err) => {
      console.error('[streaming] StreamingJanusPlugin, cannot start stream', err)
      throw err
    })
  }

  switch (id) {
    const body = { request: 'switch', id }

    return this.transaction('message', { body }, 'event').catch((err) => {
      console.error('[streaming] StreamingJanusPlugin, cannot start stream', err)
      throw err
    })
  }

  getVolume(mid, result) {
    let transceiver = this.pc.getTransceivers().find(t => t.receiver.track.kind === "audio");
    transceiver.receiver.getStats().then(stats =>  {
      stats.forEach(res => {
        if(!res || res.kind !== "audio")
          return;
        result(res.audioLevel ? res.audioLevel : 0);
      });
    });
    //return config.volume[stream].value;
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
    console.log('[streaming] onmessage: ', data, json)
    if (json?.jsep) {
      console.log('[streaming] sdp: ', data, json)
      this.sdpExchange(json.jsep)
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
    this.pc.close()
    this.removeAllListeners()
    this.janus = null
  }
}

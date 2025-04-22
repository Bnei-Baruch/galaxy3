import {randomString} from "../shared/tools";
import {EventEmitter} from "events";
import log from "loglevel";
import mqtt from "../shared/mqtt";
import {STUN_SRV_GXY} from "../shared/env";
import { captureException } from "../shared/sentry";

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
      captureException(error, { message, additionalFields });
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
        captureException(error, { context: 'StreamingPlugin.watch', id, restart });
        reject(error)
      })
    })
  }

  sdpExchange(jsep) {
    this.pc.setRemoteDescription(jsep).catch(error => {
      log.error('[streaming] SDP Exchange setRemoteDescription', error)
      captureException(error, { context: 'StreamingPlugin.sdpExchange.setRemoteDescription', jsep });
    });
    this.pc.createAnswer().then((desc) => {
      desc.sdp = desc.sdp.replace(/a=fmtp:111 minptime=10;useinbandfec=1\r\n/g, 'a=fmtp:111 minptime=10;useinbandfec=1;stereo=1;sprop-stereo=1\r\n');
      this.pc.setLocalDescription(desc).catch(error => {
        log.error('[streaming] SDP Exchange setLocalDescription', error)
        captureException(error, { context: 'StreamingPlugin.sdpExchange.setLocalDescription', desc });
      });
      this.start(desc)
    }, error => {
      log.error('[streaming] SDP Exchange createAnswer', error)
      captureException(error, { context: 'StreamingPlugin.sdpExchange.createAnswer', jsep });
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
      log.error('[streaming] StreamingJanusPlugin, cannot start stream', error)
      captureException(error, { context: 'StreamingPlugin.start', jsep });
      throw error
    })
  }

  switch (id) {
    const body = { request: 'switch', id }

    return this.transaction('message', { body }, 'event').catch((error) => {
      log.error('[streaming] StreamingJanusPlugin, cannot switch stream', error)
      captureException(error, { context: 'StreamingPlugin.switch', id });
      throw error
    })
  }

  getVolume(mid, result) {
    try {
      let transceiver = this.pc.getTransceivers().find(t => t.receiver.track.kind === "audio");
      transceiver.receiver.getStats().then(stats =>  {
        stats.forEach(res => {
          if(!res || res.kind !== "audio")
            return;
          result(res.audioLevel ? res.audioLevel : 0);
        });
      }).catch(error => {
        captureException(error, { context: 'StreamingPlugin.getVolume.getStats', mid });
      });
    } catch (error) {
      captureException(error, { context: 'StreamingPlugin.getVolume', mid });
      throw error;
    }
  }

  initPcEvents(resolve) {
    this.pc.onicecandidate = (e) => {
      try {
        return this.transaction('trickle', { candidate: e.candidate })
      } catch (error) {
        captureException(error, { context: 'StreamingPlugin.initPcEvents.onicecandidate' });
        throw error;
      }
    };

    this.pc.onconnectionstatechange = (e) => {
      try {
        log.info("[streaming] ICE State: ", e.target.connectionState)
        this.iceState = e.target.connectionState
        if(this.iceState === "disconnected") {
          this.iceRestart()
        }

        if(this.iceState === "failed") {
          const error = new Error('ICE connection failed');
          captureException(error, { context: 'StreamingPlugin.initPcEvents.onconnectionstatechange', iceState: this.iceState });
          this.onStatus(this.iceState)
        }
      } catch (error) {
        captureException(error, { context: 'StreamingPlugin.initPcEvents.onconnectionstatechange', iceState: this.iceState });
        throw error;
      }
    };

    this.pc.ontrack = (e) => {
      try {
        log.info("[streaming] Got track: ", e)
        let stream = new MediaStream([e.track]);
        resolve(stream);
      } catch (error) {
        captureException(error, { context: 'StreamingPlugin.initPcEvents.ontrack' });
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
          log.debug("[streaming] - Trigger ICE Restart - ");
          try {
            this.watch(this.streamId, true);
          } catch (error) {
            captureException(error, { context: 'StreamingPlugin.iceRestart', count });
            throw error;
          }
          clearInterval(chk);
        } else if (count >= 10) {
          clearInterval(chk);
          const error = new Error("[streaming] - ICE Restart failed - ");
          captureException(error, { context: 'StreamingPlugin.iceRestart', count });
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
    const error = new Error('[streaming] Plugin error');
    captureException(error, { cause });
  }

  onmessage (data) {
    try {
      log.info('[streaming] onmessage: ', data)
    } catch (error) {
      captureException(error, { context: 'StreamingPlugin.onmessage', data });
      throw error;
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
    try {
      this.pc.close()
      this.removeAllListeners()
      this.janus = null
    } catch (error) {
      captureException(error, { context: 'StreamingPlugin.detach' });
      throw error;
    }
  }
}

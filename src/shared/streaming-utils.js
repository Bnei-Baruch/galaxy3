import {gxycol, trllang, NO_VIDEO_OPTION_VALUE} from "./consts";
import {JanusMqtt} from "../lib/janus-mqtt";
import {StreamingPlugin} from "../lib/streaming-plugin";
import log from "loglevel";
import GxyJanus from "./janus-utils";
import {captureMessage} from "./sentry";

class JanusStream {
  constructor() {
    this.janus = null;
    this.user = null;

    this.videoQuadStream = null;
    // Streaming plugin for video.
    this.videoJanusStream = null;
    this.videoMediaStream = null;

    // Streaming plugin for audio.
    this.audioJanusStream = null;
    this.audioMediaStream = null;

    // Streaing plugin for trlAudio
    this.trlAudioJanusStream = null;
    this.trlAudioMediaStream = null;

    this.videos = Number(localStorage.getItem("vrt_video")) || 1;
    this.audios = Number(localStorage.getItem("vrt_lang")) || 2;
    this.mixvolume = null;
    this.talking = null;
    this.config = null;

    this.videoElement = null;
    this.audioElement = new Audio();
    this.audioElement.autoplay = true;
    this.audioElement.controls = true;
    this.audioElement.muted = false;
    //this.audioElement.playinline = true;
    this.audioElement.volume = 0.6; // Default volume.
    this.trlAudioElement = new Audio();
    this.trlAudioElement.autoplay = true;
    this.trlAudioElement.controls = false;
    this.trlAudioElement.muted = true;
    this.trlAudioElement.playinline = true;

    this.showOn = null;
  }

  setUser = (user) => {
    this.user = user;
  };

  initStreaming = (srv) => {
    this.clean();
    this.initJanus(srv, () => {
      if (!this.videoJanusStream) {
        this.initVideoStream()
      }
      if(!this.audioJanusStream) {
        this.initAudioStream();
      }
      if(!this.trlAudioJanusStream) {
        let id = trllang[localStorage.getItem("vrt_langtext")] || 301;
        this.initTranslationStream(id);
      }
    })
  };

  initJanus = (srv, cb) => {
    if(this.janus) {
      if (typeof cb === "function") cb();
      return
    }

    let str = srv;

    if(!srv) {
      const gw_list = GxyJanus.gatewayNames("streaming");
      let inst = gw_list[Math.floor(Math.random() * gw_list.length)];
      this.config = GxyJanus.instanceConfig(inst);
      str = this.config.name
    }

    let janus = new JanusMqtt(this.user, str)

    janus.onStatus = (srv, status) => {
      if(status !== "online") {
        log.warn("[shidur] janus status: ", status)
        if(this.janus) this.janus.destroy();
        this.janus = null;
        setTimeout(() => {
          this.initJanus();
        }, 7000);
      }
    }

    janus.init().then(data => {
      log.debug("[shidur] init: ", data);
      this.janus = janus;
      if (typeof cb === "function") cb();
    })
  }

  initVideoStream = () => {
    if(this.videos === NO_VIDEO_OPTION_VALUE) return;
    this.videoJanusStream = new StreamingPlugin(this.config?.iceServers);
    this.videoJanusStream.onStatus = () => {
      if(this.janus) this.initVideoStream();
    }
    this.janus.attach(this.videoJanusStream).then(data => {
      log.debug("[shidur] attach video", data)
      this.videoJanusStream.watch(this.videos).then(stream => {
        this.videoMediaStream = stream;
        this.attachVideoStream_(this.videoElement, /* reattach= */ false);
      })
    })
  };

  initAudioStream = () => {
    this.audioJanusStream = new StreamingPlugin(this.config?.iceServers);
    this.audioJanusStream.onStatus = () => {
      if(this.janus) this.initAudioStream();
    }
    this.janus.attach(this.audioJanusStream).then(data => {
      log.debug("[shidur] attach audio", data)
      this.audioJanusStream.watch(this.audios).then(stream => {
        this.audioMediaStream = stream;
        this.attachAudioStream_(this.audioElement, /* reattach= */ false);
      })
    })
  };

  initTranslationStream = (streamId) => {
    this.trlAudioJanusStream = new StreamingPlugin(this.config?.iceServers);
    this.trlAudioJanusStream.onStatus = () => {
      if(this.janus) this.initTranslationStream(streamId);
    }
    this.janus.attach(this.trlAudioJanusStream).then(data => {
      log.debug("[shidur] attach translation", data)
      this.trlAudioJanusStream.watch(streamId).then(stream => {
        this.trlAudioMediaStream = stream;
        this.attachTrlAudioStream_(this.trlAudioElement, /* reattach= */ false);
      })
    })
  };

  initQuadStream = (callback) => {
    this.initJanus(null,() => {
      this.videoQuadStream = new StreamingPlugin(this.config?.iceServers);
      this.videoQuadStream.onStatus = () => {
        if(this.janus) this.initQuadStream(callback);
      }
      this.janus.attach(this.videoQuadStream).then(data => {
        log.debug("[shidur] attach quad", data)
        this.videoQuadStream.watch(102).then(stream => {
          callback(stream)
        })
      })
    })
  };

  clean() {
    if (this.talking) {
      clearInterval(this.talking);
      this.talking = null;
    }
    if (this.janus) {
      if (this.videoElement) {
        this.videoElement.srcObject = null;
      }
      if (this.audioElement) {
        this.audioElement.srcObject = null;
      }
      if (this.trlAudioElement) {
        this.trlAudioElement.srcObject = null;
      }

      this.videoJanusStream = null;
      this.videoMediaStream = null;

      this.audioJanusStream = null;
      this.audioMediaStream = null;

      this.trlAudioJanusStream = null;
      this.trlAudioMediaStream = null;
    }
  };

  toggle(plugin) {
    if(plugin === "shidur") {
      if(this.janus) {
        this.janus.detach(this.videoJanusStream);
        this.videoJanusStream = null;
        this.janus.detach(this.audioJanusStream);
        this.audioJanusStream = null;
        this.janus.detach(this.trlAudioJanusStream);
        this.trlAudioJanusStream = null;
      }
    }
    if(plugin === "quad") {
      if(this.janus) {
        this.janus.detach(this.videoQuadStream)
        this.videoQuadStream = null
      }
    }
  }

  destroy() {
      this.clean();
      if(this.janus) this.janus.destroy();
      this.janus = null;
  }

  streamGalaxy = (talk, col, name) => {
    log.debug("[shidur] got talk event: ", talk, col, name);
    if (!this.trlAudioJanusStream) {
      log.debug("[shidur] look like we got talk event before stream init finished");
      captureMessage("ON", talk, "info");
      setTimeout(() => {
        this.streamGalaxy(talk, col, name)
      }, 1000)
      return;
    }
    if (talk) {
      this.mixvolume = this.audioElement.volume;
      this.talking = true;
      this.trlAudioElement.volume = this.mixvolume;
      this.trlAudioElement.muted = false;

      this.prevAudioVolume = this.audioElement.volume;
      this.prevMuted = this.audioElement.muted;

      log.debug("[shidur] Switch audio stream: ", gxycol[col]);
      this.audioJanusStream.switch(gxycol[col]);
      const id = trllang[localStorage.getItem("vrt_langtext")];
      log.debug("[shidur] get id from local storage:  ", localStorage.getItem("vrt_langtext"), id);
      if (!id) {
        log.debug("[shidur] no id in local storage");
      } else {
        this.trlAudioJanusStream.switch(id);
        this.talking = setInterval(this.ducerMixaudio, 200);
        log.debug("[shidur] Switch trl stream: ", localStorage.getItem("vrt_langtext"), id);
      }
      log.debug("[shidur] You now talking");
    } else if (this.talking) {
      log.debug("[shidur] Stop talking");
      if (this.talking) {
        clearInterval(this.talking);
      }
      this.audioElement.volume = this.mixvolume;
      const id = Number(localStorage.getItem("vrt_lang")) || 2;
      log.debug("[shidur] get stream back id: ", localStorage.getItem("vrt_lang"), id);
      this.audioJanusStream.switch(id);
      log.debug("[shidur] Switch audio stream back");
      this.trlAudioElement.muted = true;
      this.talking = null;
      this.mixvolume = null;
    }
    if (this.showOn) {
      this.showOn(this.talking);
    }
  };

  ducerMixaudio = () => {
    if (this.trlAudioJanusStream) {
      // Get remote volume of translator stream (FYI in case of Hebrew, this will be 0 - no translation).
      this.trlAudioJanusStream.getVolume(null, (volume) => {
        log.trace("[shidur] ducer volume level: ", volume)
        if (volume === -1) {
          if (this.talking) {
            clearInterval(this.talking);
            return;
          }
        }
        if (this.prevAudioVolume !== this.audioElement.volume || this.prevMuted !== this.audioElement.muted) {
          // This happens only when user changes audio, update mixvolume.
          this.mixvolume = this.audioElement.muted ? 0 : this.audioElement.volume;
          this.trlAudioElement.volume = this.mixvolume;
        }
        if (volume > 0.05) {
          // If translator is talking (remote volume > 0.05) we want to reduce Rav to 5%.
          this.audioElement.volume = this.mixvolume * 0.05;
        } else if (this.audioElement.volume + 0.01 <= this.mixvolume) {
          // If translator is not talking or no translation (Hebrew) we want to slowly raise
          // sound levels of original source up to original this.mixvolume.
          this.audioElement.volume = this.audioElement.volume + 0.01;
        }
        // Store volume and mute values to be able to detect user volume change.
        this.prevAudioVolume = this.audioElement.volume;
        this.prevMuted = this.audioElement.muted;
      });
    }
  };

  setVideo = (videos) => {
    this.videos = videos;
    if (this.janus) {
      if (videos === NO_VIDEO_OPTION_VALUE) {
        if (this.videoJanusStream !== null) {
          this.janus.detach(this.videoJanusStream)
          this.videoJanusStream = null
        }
      } else {
        if (this.videoJanusStream) {
          this.videoJanusStream.switch(videos);
        } else {
          this.initVideoStream();
        }
      }
    }
    localStorage.setItem("vrt_video", videos);
  };

  setAudio = (audios, text) => {
    this.audios = audios;
    if (this.audioJanusStream) {
      this.audioJanusStream.switch(audios);
    }
    localStorage.setItem("vrt_lang", audios);
    localStorage.setItem("vrt_langtext", text);
  };

  attachVideoStream(videoElement) {
    if (videoElement && videoElement !== this.videoElement) {
      this.attachVideoStream_(videoElement, this.videoElement);
      this.videoElement = videoElement;
    }
  }

  attachVideoStream_(next, prev) {
    if (next) {
      if (prev && next !== prev) {
        this.reattachMediaStream(next, prev);
      } else if (this.videoMediaStream) {
        this.attachMediaStream(next, this.videoMediaStream);
      }
    }
  }

  attachAudioStream_(next, prev) {
    if (next) {
      if (prev && next !== prev) {
        this.reattachMediaStream(next, prev);
      } else if (this.audioMediaStream) {
        this.attachMediaStream(next, this.audioMediaStream);
      }
    }
  }

  attachTrlAudioStream_(next, prev) {
    if (next) {
      if (prev && next !== prev) {
        this.reattachMediaStream(next, prev);
      } else if (this.trlAudioMediaStream) {
        this.attachMediaStream(next, this.trlAudioMediaStream);
      }
    }
  }

  attachMediaStream(element, stream) {
    try {
      element.srcObject = stream;
    } catch (e) {
      try {
        element.src = URL.createObjectURL(stream);
      } catch (e) {
        console.error("Error attaching stream to element");
      }
    }
  }

  reattachMediaStream(to, from) {
    try {
      to.srcObject = from.srcObject;
    } catch (e) {
      try {
        to.src = from.src;
      } catch (e) {
        console.error("Error reattaching stream to element");
      }
    }
  };

  onTalking(callback) {
    this.showOn = callback;
  }
}


const defaultJanusStream = new JanusStream();

export default defaultJanusStream;

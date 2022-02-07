import {gxycol, trllang, NO_VIDEO_OPTION_VALUE} from "./consts";
import {JanusMqtt} from "../lib/janus-mqtt";
import {StreamingPlugin} from "../lib/streaming-plugin";
import log from "loglevel";

export default class JanusStream {
  constructor(onInitialized) {
    this.janus = null;

    this.videoQuadStream = null;
    // Streaming plugin for video.
    this.videoJanusStream = null;
    this.videoMediaStream = null;
    // Array of callbacks for cleanup.
    this.videoJanusStreamCleanup = [];

    // Streaming plugin for audio.
    this.audioJanusStream = null;
    this.audioMediaStream = null;
    // Array of callbacks for cleanup.
    this.audioJanusStreamCleanup = [];

    // Streaing plugin for trlAudio
    this.trlAudioJanusStream = null;
    this.trlAudioMediaStream = null;
    // Array of callbacks for cleanup.
    this.trlAudioJanusStreamCleanup = [];

    this.videos = Number(localStorage.getItem("vrt_video")) || 1;
    this.audios = Number(localStorage.getItem("vrt_lang")) || 2;
    this.mixvolume = null;
    this.talking = null;
    this.streamingGateway = "";

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

    this.onInitialized = onInitialized;
    this.onTalkingCallback = null;
  }

  isInitialized_() {
    return (
      (this.videos === NO_VIDEO_OPTION_VALUE || this.videoJanusStream) &&
      this.trlAudioJanusStream &&
      this.audioJanusStream &&
      (this.videos === NO_VIDEO_OPTION_VALUE || this.videoMediaStream) &&
      this.trlAudioMediaStream &&
      this.audioMediaStream
    );
  }

  onInitialized_() {
    if (this.onInitialized && this.isInitialized_()) {
      this.onInitialized();
    }
  }

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
    this.onTalkingCallback = callback;
  }

  init(user) {
    this.destroyAndInitJanus_(user);
  }

  destroy(callbacks) {
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
      this.janus.destroy()
      this.janus = null;

      this.videoJanusStream = null;
      this.videoMediaStream = null;

      this.audioJanusStream = null;
      this.audioMediaStream = null;

      this.trlAudioJanusStream = null;
      this.trlAudioMediaStream = null;

      callbacks.success();
    } else {
      callbacks.success();
    }
  }

  destroyAndInitJanus_(user) {
    log.debug("Trying to destroy and init!");
    this.destroy({
      error: (error) => {
        log.debug("JanusVirtualStreaming error destroying before init", error);
        // Still we are trying to init.
        this.initJanus_(user);
      },
      success: () => {
        log.debug("JanusVirtualStreaming destroy success, now init.");
        this.initJanus_(user);
      },
    });
  }

  initJanus_(user) {
    const str = 'str' + (Math.floor(Math.random() * 8) + 2)
    this.janus = new JanusMqtt(user, str, "MqttStream")

    this.janus.init().then(data => {
      log.debug(data)
      if (this.videos !== NO_VIDEO_OPTION_VALUE) {
        this.initVideoStream(this.janus)
      }
      this.initAudioStream(this.janus);
      let id = trllang[localStorage.getItem("vrt_langtext")] || 301;
      this.initTranslationStream(id);
    }).catch(err => {
      setTimeout(() => {
        this.initJanus_(user);
      }, 5000);
      console.error("RELOAD ON ERROR", err);
    })
  }

  // iceRestart = () => {
  //   let id = trllang[localStorage.getItem("vrt_langtext")] || 301;
  //   if (this.videoJanusStream)
  //     this.videoJanusStream.send({message: {request: "watch", id: this.videos, restart: true}});
  //   if (this.audioJanusStream)
  //     this.audioJanusStream.send({message: {request: "watch", id: this.audios, restart: true}});
  //   if (this.trlAudioJanusStream) this.trlAudioJanusStream.send({message: {request: "watch", id, restart: true}});
  // };

  initVideoStream = (janus) => {
    this.videoJanusStream = new StreamingPlugin();
    janus.attach(this.videoJanusStream).then(data => {
      log.debug(data)
      this.videoJanusStream.watch(this.videos).then(stream => {
        this.videoMediaStream = stream;
        this.attachVideoStream_(this.videoElement, /* reattach= */ false);
        this.onInitialized_();
      })
    })
  };

  initQuadStream = (callback) => {
    if(!this.janus) return
    this.videoQuadStream = new StreamingPlugin();
    this.janus.attach(this.videoQuadStream).then(data => {
      log.debug(data)
      this.videoQuadStream.watch(102).then(stream => {
        callback(stream)
      })
    })
  };

  detachQuadStream = () => {
    if(this.janus) {
      this.janus.detach(this.videoQuadStream)
      this.videoQuadStream = null
    }
  }

  initAudioStream = (janus) => {
    this.audioJanusStream = new StreamingPlugin();
    janus.attach(this.audioJanusStream).then(data => {
      log.debug(data)
      this.audioJanusStream.watch(this.audios).then(stream => {
        this.audioMediaStream = stream;
        setTimeout(() => {
          this.attachAudioStream_(this.audioElement, /* reattach= */ false);
          this.onInitialized_();
        },3000)
      })
    })
  };

  initTranslationStream = (streamId) => {
    this.trlAudioJanusStream = new StreamingPlugin();
    this.janus.attach(this.trlAudioJanusStream).then(data => {
      log.debug(data)
      this.trlAudioJanusStream.watch(streamId).then(stream => {
        this.trlAudioMediaStream = stream;
        setTimeout(() => {
          this.attachTrlAudioStream_(this.trlAudioElement, /* reattach= */ false);
          this.onInitialized_();
        },3000)
      })
    })
  };

  streamGalaxy = (talk, col, name) => {
    log.debug("streamGalaxy", talk, col, name);
    if (!this.isInitialized_()) {
      return;
    }
    if (talk) {
      this.mixvolume = this.audioElement.volume;
      this.talking = true;
      this.trlAudioElement.volume = this.mixvolume;
      this.trlAudioElement.muted = false;

      this.prevAudioVolume = this.audioElement.volume;
      this.prevMuted = this.audioElement.muted;

      log.debug(" :: Switch STR Stream: ", gxycol[col]);
      this.audioJanusStream.switch(gxycol[col]);
      const id = trllang[localStorage.getItem("vrt_langtext")];
      log.debug(":: Select TRL: ", localStorage.getItem("vrt_langtext"), id);
      if (!id) {
        log.debug(" :: Not TRL Stream attach");
      } else {
        //this.trlAudioJanusStream.send({message: {request: "switch", id: id}});
        this.trlAudioJanusStream.switch(id);
        this.talking = setInterval(this.ducerMixaudio, 200);
        log.debug(" :: Init TRL Stream: ", localStorage.getItem("vrt_langtext"), id);
      }
      log.debug("You now talking");
    } else if (this.talking) {
      log.debug("Stop talking");
      if (this.talking) {
        clearInterval(this.talking);
      }
      this.audioElement.volume = this.mixvolume;
      const id = Number(localStorage.getItem("vrt_lang")) || 2;
      log.debug(" :: Switch STR Stream: ", localStorage.getItem("vrt_lang"), id);
      //this.audioJanusStream.send({message: {request: "switch", id: id}});
      this.audioJanusStream.switch(id);
      log.debug(" :: Stop TRL Stream: ");
      this.trlAudioElement.muted = true;
      this.talking = null;
      this.mixvolume = null;
    }
    if (this.onTalkingCallback) {
      this.onTalkingCallback(this.talking);
    }
  };

  ducerMixaudio = () => {
    if (this.isInitialized_()) {
      // Get remote volume of translator stream (FYI in case of Hebrew, this will be 0 - no translation).
      this.trlAudioJanusStream.getVolume(null, (volume) => {
        //log.debug(volume)
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
          this.initVideoStream(this.janus);
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

  unmuteAudioElement = () => {
    this.audioElement.muted = false;
  };

  muteAudioElement = () => {
    this.audioElement.muted = true;
  };
}

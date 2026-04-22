import {audiog_options2, gxycol, NO_VIDEO_OPTION_VALUE, NOTRL_STREAM_ID, trllang} from "./consts";
import {JanusMqtt} from "../lib/janus-mqtt";
import {StreamingPlugin} from "../lib/streaming-plugin";
import log from "loglevel";
import GxyJanus from "./janus-utils";
import {getVideosFromLocalstorage} from "./tools";
import api from "./Api";
import mqtt from "./mqtt";

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

    this.videos = getVideosFromLocalstorage()
    this.audios = Number(localStorage.getItem("vrt_lang")) || 2;
    this.mixvolume = null;
    this.talking = null;
    this.config = null;
    this.reconnectAttempts = 0;
    this.onReconnectExhausted = null;
    this.quadCallback = null;
    this.onReconnecting = null;
    this.onReconnectSuccess = null;

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
    this.reconnectAttempts = 0;
    this.initStrServer(srv, () => {
      if (!this.videoJanusStream) {
        this.initVideoStream();
      }
      if (!this.audioJanusStream) {
        this.initAudioStream();
      }
      if (!this.trlAudioJanusStream) {
        let id = trllang[localStorage.getItem("vrt_langtext")] || 401;
        this.initTranslationStream(id);
      }
    });
  };

  initStrServer = (srv, cb) => {
    if (this.janus) {
      if (typeof cb === "function") cb();
      return;
    }

    if (srv) {
      this.initJanus(srv, cb)
      return;
    }

    api.fetchStrServer(this.user).then((data) => {
      this.initJanus(data.server, cb)
    }).catch((err) => {
      log.error("[shidur] strdb server error: ", err);
      const gw_list = GxyJanus.gatewayNames("streaming");
      let inst = gw_list[Math.floor(Math.random() * gw_list.length)];
      this.config = GxyJanus.instanceConfig(inst);
      this.initJanus(this.config.name, cb)
    })
  };

  _handleStreamReconnect = (streamName, reinitFn) => {
    this.reconnectAttempts++;
    log.warn("[shidur] " + streamName + " failed, reconnect attempt: " + this.reconnectAttempts + "/30");
    if (this.reconnectAttempts === 1 && typeof this.onReconnecting === "function") {
      this.onReconnecting();
    }
    if (this.reconnectAttempts >= 30) {
      log.error("[shidur] broadcast reconnect exhausted after 30 attempts");
      this.reconnectAttempts = 0;
      if (typeof this.onReconnectExhausted === "function") {
        this.onReconnectExhausted();
      }
    } else if (this.janus) {
      reinitFn();
    }
  };

  initJanus = (str, cb) => {
    let janus = new JanusMqtt(this.user, str, mqtt.clientId);

    janus.onStatus = (srv, status) => {
      if (status !== "online") {
        this.reconnectAttempts++;
        log.warn("[shidur] janus status: " + status + ", reconnect attempt: " + this.reconnectAttempts + "/30");
        if (this.reconnectAttempts === 1 && typeof this.onReconnecting === "function") {
          this.onReconnecting();
        }
        if (this.janus) this.janus.destroy();
        this.janus = null;
        const hadQuad = !!this.videoQuadStream;
        this.videoJanusStream = null;
        this.videoMediaStream = null;
        this.audioJanusStream = null;
        this.audioMediaStream = null;
        this.trlAudioJanusStream = null;
        this.trlAudioMediaStream = null;
        this.videoQuadStream = null;
        if (this.reconnectAttempts >= 30) {
          log.error("[shidur] broadcast reconnect exhausted after 30 attempts");
          this.reconnectAttempts = 0;
          if (typeof this.onReconnectExhausted === "function") {
            this.onReconnectExhausted();
          }
        } else {
          setTimeout(() => {
            this.initStrServer(null, () => {
              this.initVideoStream();
              this.initAudioStream();
              let id = trllang[localStorage.getItem("vrt_langtext")] || 401;
              this.initTranslationStream(id);
              if (hadQuad && this.quadCallback) {
                this.initQuadStream(this.quadCallback);
              }
            });
          }, 7000);
        }
      }
    };

    janus.init().then((data) => {
      log.debug("[shidur] init: ", data);
      this.janus = janus;
      if (this.reconnectAttempts > 0 && typeof this.onReconnectSuccess === "function") {
        this.onReconnectSuccess();
      }
      this.reconnectAttempts = 0;
      if (typeof cb === "function") cb();
    }).catch((err) => log.debug("[shidur] janus init failed (will be retried via onStatus):", err && err.message));
  }

  initVideoStream = () => {
    if (this.videos === NO_VIDEO_OPTION_VALUE) return;
    this.videoJanusStream = new StreamingPlugin(this.config?.iceServers);
    this.videoJanusStream.onStatus = () => {
      this._handleStreamReconnect("video", () => this.initVideoStream());
    };
    this.janus.attach(this.videoJanusStream).then((data) => {
      log.debug("[shidur] attach video", data);
      this.videoJanusStream.watch(this.videos).then((stream) => {
        this.videoMediaStream = stream;
        this.attachVideoStream_(this.videoElement, /* reattach= */ false);
        if (this.reconnectAttempts > 0 && typeof this.onReconnectSuccess === "function") {
          this.onReconnectSuccess();
        }
      }).catch((err) => log.debug("[shidur] video watch failed:", err && err.message));
    }).catch((err) => log.debug("[shidur] video attach failed:", err && err.message));
  };

  initAudioStream = () => {
    this.audioJanusStream = new StreamingPlugin(this.config?.iceServers);
    this.audioJanusStream.onStatus = () => {
      this._handleStreamReconnect("audio", () => this.initAudioStream());
    };
    this.janus.attach(this.audioJanusStream).then((data) => {
      log.debug("[shidur] attach audio", data);
      this.audioJanusStream.watch(this.audios).then((stream) => {
        this.audioMediaStream = stream;
        this.attachAudioStream_(this.audioElement, /* reattach= */ false);
      }).catch((err) => log.debug("[shidur] audio watch failed:", err && err.message));
    }).catch((err) => log.debug("[shidur] audio attach failed:", err && err.message));
  };

  initTranslationStream = (streamId) => {
    this.trlAudioJanusStream = new StreamingPlugin(this.config?.iceServers);
    this.trlAudioJanusStream.onStatus = () => {
      this._handleStreamReconnect("translation", () => this.initTranslationStream(streamId));
    };
    this.janus.attach(this.trlAudioJanusStream).then((data) => {
      log.debug("[shidur] attach translation", data);
      this.trlAudioJanusStream.watch(streamId).then((stream) => {
        this.trlAudioMediaStream = stream;
        this.attachTrlAudioStream_(this.trlAudioElement, /* reattach= */ false);
      }).catch((err) => log.debug("[shidur] translation watch failed:", err && err.message));
    }).catch((err) => log.debug("[shidur] translation attach failed:", err && err.message));
  };

  initQuadStream = (callback) => {
    if (callback) this.quadCallback = callback;
    if (!this.janus) {
      setTimeout(() => {
        this.initQuadStream(this.quadCallback);
      }, 1000);
      return;
    }
    this.initStrServer(null, () => {
      this.videoQuadStream = new StreamingPlugin(this.config?.iceServers);
      this.videoQuadStream.onStatus = () => {
        this._handleStreamReconnect("quad", () => this.initQuadStream(callback));
      };
      this.janus.attach(this.videoQuadStream).then((data) => {
        log.debug("[shidur] attach quad", data);
        this.videoQuadStream.watch(102).then((stream) => {
          callback(stream);
        }).catch((err) => log.debug("[shidur] quad watch failed:", err && err.message));
      }).catch((err) => log.debug("[shidur] quad attach failed:", err && err.message));
    });
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
  }

  toggle(plugin) {
    if (plugin === "shidur") {
      if (this.janus) {
        this._safeDetach(this.videoJanusStream, "video");
        this.videoJanusStream = null;
        this._safeDetach(this.audioJanusStream, "audio");
        this.audioJanusStream = null;
        this._safeDetach(this.trlAudioJanusStream, "translation");
        this.trlAudioJanusStream = null;
      }
    }
    if (plugin === "quad") {
      if (this.janus) {
        this._safeDetach(this.videoQuadStream, "quad");
        this.videoQuadStream = null;
      }
    }
  }

  // Detach is fire-and-forget across this module; janus hangup may time out
  // or fire on an already-cleaned-up plugin. Swallow rejections so they do
  // not surface as unhandled promise rejections in Sentry.
  _safeDetach = (plugin, label) => {
    if (!this.janus || !plugin) return;
    try {
      const p = this.janus.detach(plugin);
      if (p && typeof p.catch === "function") {
        p.catch((err) => log.debug("[shidur] detach " + label + " failed:", err && err.message));
      }
    } catch (err) {
      log.debug("[shidur] detach " + label + " threw:", err && err.message);
    }
  };

  destroy() {
    this.clean();
    if (this.janus) {
      try {
        const p = this.janus.destroy();
        if (p && typeof p.catch === "function") {
          p.catch((err) => log.debug("[shidur] janus destroy failed:", err && err.message));
        }
      } catch (err) {
        log.debug("[shidur] janus destroy threw:", err && err.message);
      }
    }
    this.janus = null;
  }

  streamGalaxy = (talk, col, name) => {
    log.debug("[shidur] got talk event: ", talk, col, name);
    if (!this.trlAudioJanusStream) {
      log.debug("[shidur] look like we got talk event before stream init finished");
      //captureMessage("ON", talk, "info");
      setTimeout(() => {
        this.streamGalaxy(talk, col, name);
      }, 1000);
      return;
    }
    if (talk) {
      this.mixvolume = this.audioElement.volume;
      this.talking = true;
      this.trlAudioElement.volume = this.mixvolume;
      this.trlAudioElement.muted = false;

      this.prevAudioVolume = this.audioElement.volume;
      this.prevMuted = this.audioElement.muted;

      // Switch to -1 stream
      log.debug("[shidur] Switch audio stream: ", gxycol[col]);
      this._safeSwitch(this.audioJanusStream, gxycol[col], "audio");

      const id = trllang[localStorage.getItem("vrt_langtext")];
      // Don't bring translation on toggle trl stream
      if (!id) {
        log.debug("[shidur] no id in local storage or client use togle stream");
      } else {
        log.debug("[shidur] get id from local storage:  ", localStorage.getItem("vrt_langtext"), id);
        this._safeSwitch(this.trlAudioJanusStream, id, "translation");
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
      // Bring back source if was choosen before
      const id = Number(localStorage.getItem("vrt_lang")) || 2;
      log.debug("[shidur] get stream back id: ", localStorage.getItem("vrt_lang"), id);
      this._safeSwitch(this.audioJanusStream, id, "audio");
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
        log.trace("[shidur] ducer volume level: ", volume);
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
          this._safeDetach(this.videoJanusStream, "video");
          this.videoJanusStream = null;
        }
      } else {
        if (this.videoJanusStream) {
          this._safeSwitch(this.videoJanusStream, videos, "video");
        } else {
          this.initVideoStream();
        }
      }
    }
    localStorage.setItem("vrt_video", videos);
  };

  setAudio = (audios, text) => {
    this.audios = audios;
    if(this.talking) {
      const audio_option = audiog_options2.find((option) => option.value === audios);
      const id = trllang[audio_option.eng_text];
      if(id) {
        this._safeSwitch(this.trlAudioJanusStream, id, "translation");
      }
    } else {
      if (this.audioJanusStream) {
        this._safeSwitch(this.audioJanusStream, audios, "audio");
      }
    }
    localStorage.setItem("vrt_lang", audios);
    if(audios !== NOTRL_STREAM_ID)
      localStorage.setItem("trl_lang", audios);
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
  }

  onTalking(callback) {
    this.showOn = callback;
  }

  toggleAv1(videos) {
    this.videos = videos
    if (!this.janus)
      return
    this._safeDetach(this.videoJanusStream, "video");
    this.videoJanusStream = null;
    this.initVideoStream()
  }

  // Same idea as _safeDetach: switch() returns a transaction promise that
  // can reject (timeout / no janus). Swallow with a debug log instead of
  // letting it bubble up as an unhandled rejection.
  _safeSwitch = (plugin, id, label) => {
    if (!plugin || typeof plugin.switch !== "function") return;
    try {
      const p = plugin.switch(id);
      if (p && typeof p.catch === "function") {
        p.catch((err) => log.debug("[shidur] switch " + label + " failed:", err && err.message));
      }
    } catch (err) {
      log.debug("[shidur] switch " + label + " threw:", err && err.message);
    }
  };
}

const defaultJanusStream = new JanusStream();

export default defaultJanusStream;

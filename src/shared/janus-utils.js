import {Janus} from "../lib/janus";
import {DATA_PORT, PROTOCOL_ROOM, SDIOUT_ID, SERVICE_ROOM, SHIDUR_ID, SNDMAN_ID, STORAN_ID} from "./consts";
import {SECRET} from "./env";
import {getDateString} from "./tools";

class GxyJanus extends EventTarget {
  static globalConfig = {};

  constructor(name) {
    super();
    this.name = name;
    this.reset();
  }

  reset = () => {
    this.gateway = null;
    this.chatroom = null;
    this.protocol = null;
    this.serviceProtocol = null;
    this.videoroom = null;
    this.remoteFeed = null;
    this.forward = null;
    this.forwardPublisherID = null;
    this.stopReinit = false;
  };

  static setGlobalConfig = (config) => {
    GxyJanus.globalConfig = config;
  };

  static instanceConfig = (name) => {
    let gateway = null;
    Object.entries(GxyJanus.globalConfig.gateways).forEach(([type, gateways]) => {
      if (!gateway) {
        gateway = gateways[name];
      }
    });

    if (!gateway) {
      throw new Error(`unknown gateway ${name}`);
    }

    return {
      ...gateway,
      iceServers: GxyJanus.globalConfig.ice_servers[gateway.type].map((url) => ({urls: url})),
    };
  };

  static gatewayNames = (type = "rooms") => Object.keys(GxyJanus.globalConfig.gateways[type]);

  static makeGateways = (type = "rooms") =>
    GxyJanus.gatewayNames(type).reduce((obj, name) => {
      obj[name] = new GxyJanus(name);
      return obj;
    }, {});

  static protocolRoom = (name) => {
    return name === "protocol" ? PROTOCOL_ROOM : SERVICE_ROOM;
  };

  init = () => {
    return new Promise((resolve, reject) => {
      Janus.init({
        debug: process.env.NODE_ENV !== "production" ? ["error"] : ["error"],
        callback: () => {
          const config = this.getConfig();
          this.gateway = new Janus({
            server: config.url,
            iceServers: config.iceServers,
            token: config.token,
            success: () => {
              this.log("Connected to JANUS");
              resolve();
            },
            error: (err) => {
              this.error("Janus.init error", err);
              this.dispatchEvent(new CustomEvent("net-lost", {detail: err}));
              resolve();
              this.reconnect();
            },
            destroyed: () => {
              this.error(":: Janus destroyed ::");
            },
          });
        },
      });
    });
  };

  destroy = () => {
    [this.chatroom, this.protocol, this.serviceProtocol, this.videoroom, this.remoteFeed, this.forward].forEach(
      (handle) => {
        if (!!handle) {
          handle.hangup();
        }
      }
    );
    if (!!this.gateway) {
      this.gateway.destroy();
    }
    this.reset();
  };

  // default value for attempts here should be the same as the gateway session reclaim interval
  reconnect = (attempts = 5) => {
    if (attempts > 0) {
      this.info("reconnecting", attempts);
      this.gateway.reconnect({
        success: () => {
          this.info("reconnect success");
          this.dispatchEvent(new Event("reconnect"));
        },
        error: (err) => {
          this.error("reconnect error", err);
          setTimeout(() => this.reconnect(attempts - 1), 1000);
        },
      });
    } else {
      this.dispatchEvent(new Event("reconnect_failure"));
      this.reinit();
    }
  };

  // this will try to reconnect forever. Use stopReInit() to stop.
  // user is expected to reload window after some time.
  reinit = (attempt = 1) => {
    this.info("re-init", attempt);
    this.reset();
    this.init()
      .then(() => this.dispatchEvent(new Event("reinit")))
      .catch((err) => {
        this.error("re-init error", err);
        this.dispatchEvent(new CustomEvent("reinit_failure", {detail: attempt}));
        if (this.stopReinit) {
          this.info("reinit was stopped", attempt);
        } else {
          setTimeout(() => this.reinit(attempt + 1), 1000 * attempt);
        }
      });
  };

  stopReInit = () => {
    this.stopReinit = true;
  };

  debug = (...args) => {
    console.debug(`[${this.name}]`, ...args);
  };
  log = (...args) => {
    console.log(`[${this.name}]`, ...args);
  };
  info = (...args) => {
    console.info(`[${this.name}]`, ...args);
  };
  warn = (...args) => {
    console.warn(`[${this.name}]`, ...args);
  };
  error = (...args) => {
    console.error(`[${this.name}]`, ...args);
  };

  getConfig = () => GxyJanus.instanceConfig(this.name);

  initVideoRoom = (callbacks) => {
    return new Promise((resolve, reject) => {
      this.gateway.attach({
        plugin: "janus.plugin.videoroom",
        opaqueId: "videoroom_user",
        success: (handle) => {
          this.videoroom = handle;
          this.log("[videoroom] attached success", this.videoroom.getId());
          resolve(handle);
        },
        error: (err) => {
          this.error("[videoroom] attach error", err);
          reject(err);
        },
        consentDialog: (on) => {
          this.debug("[videoroom] Consent dialog should be " + (on ? "on" : "off") + " now");
          if (callbacks.consentDialog) callbacks.consentDialog(on);
        },
        mediaState: (medium, on) => {
          this.log("[videoroom] Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
          if (callbacks.mediaState) callbacks.mediaState(medium, on);
        },
        webrtcState: (on) => {
          this.log("[videoroom] Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
          if (callbacks.webrtcState) callbacks.webrtcState(on);
        },
        slowLink: (uplink, lost, mid) => {
          this.warn(
            "[videoroom] Janus reports problems " +
              (uplink ? "sending" : "receiving") +
              " packets on mid " +
              mid +
              " (" +
              lost +
              " lost packets)"
          );
          if (callbacks.slowLink) callbacks.slowLink(uplink, lost, mid);
        },
        onlocalstream: (mystream) => {
          this.debug("[videoroom] ::: Got a local stream :::");
          if (callbacks.onlocalstream) callbacks.onlocalstream(mystream);
        },
        onremotestream: (stream) => {
          // The publisher stream is sendonly, we don't expect anything here
          this.warn("[videoroom] ::: unexpected remote stream :::", stream);
        },
        ondataopen: () => {
          this.log("[videoroom] The DataChannel is available!");
          if (callbacks.ondataopen) callbacks.ondataopen();
        },
        ondata: (data) => {
          this.log("[videoroom] data (publisher) ", data);
          if (callbacks.ondata) callbacks.ondata(data);
        },
        ondataerror: (error) => {
          this.warn("[videoroom] data (publisher) ", error);
          if (callbacks.ondataerror) callbacks.ondataerror(error);
        },
        onmessage: (msg, jsep) => {
          //this.log("[videoroom] message", msg);
          if (callbacks.onmessage) callbacks.onmessage(msg, jsep);
        },
        oncleanup: () => {
          this.log("[videoroom] cleanup");
          if (callbacks.oncleanup) callbacks.oncleanup();
        },
      });
    });
  };

  detachVideoRoom = (noRequest = true) => {
    return new Promise((resolve, reject) => {
      if (this.videoroom) {
        this.log("[videoroom] detach");
        this.videoroom.detach({
          noRequest,
          success: () => {
            this.debug("[videoroom] detach success");
            resolve();
          },
          error: (err) => {
            this.error("[videoroom] detach error", err);
            reject(err);
          },
        });
      } else {
        resolve();
      }
    });
  };

  videoRoomJoin = (room, user, ptype = "publisher") => {
    return this.send("videoroom", "join room", this.videoroom, {
      request: "join",
      room,
      ptype,
      display: JSON.stringify(user),
    });
  };

  videoRoomLeave = (room) => {
    return this.send("videoroom", "leave room", this.videoroom, {
      request: "leave",
      room,
    });
  };

  newRemoteFeed = (callbacks) => {
    return new Promise((resolve, reject) => {
      this.gateway.attach({
        plugin: "janus.plugin.videoroom",
        opaqueId: "remotefeed_user",
        success: (handle) => {
          this.remoteFeed = handle;
          this.log("[remoteFeed] attach success", this.remoteFeed.getId());
          resolve(handle);
        },
        error: (err) => {
          this.error("[remoteFeed] attach error", err);
          reject(err);
        },
        iceState: (state) => {
          this.log("[remoteFeed] ICE state (remote feed) changed to ", state);
          if (callbacks.iceState) callbacks.iceState(state);
        },
        webrtcState: (on) => {
          this.log(
            "[remoteFeed] Janus says this WebRTC PeerConnection (remote feed) is " + (on ? "up" : "down") + " now"
          );
          if (callbacks.webrtcState) callbacks.webrtcState(on);
        },
        slowLink: (uplink, lost, mid) => {
          this.warn(
            "[remoteFeed] Janus reports problems " +
              (uplink ? "sending" : "receiving") +
              " packets on mid " +
              mid +
              " (" +
              lost +
              " lost packets)"
          );
          if (callbacks.slowLink) callbacks.slowLink(uplink, lost, mid);
        },
        onmessage: (msg, jsep) => {
          this.log("[remoteFeed] message", msg);
          if (callbacks.onmessage) callbacks.onmessage(msg, jsep);
        },
        onlocaltrack: (track, on) => {
          // The subscriber stream is recvonly, we don't expect anything here
          this.warn("[remoteFeed] ::: unexpected local track ::: ");
        },
        onremotetrack: (track, mid, on) => {
          if (!mid) {
            mid = track.id.split("janus")[1];
          }
          //this.log("[remoteFeed] Remote track (mid=" + mid + ") " + (on ? "added" : "removed") + ":", track);
          if (callbacks.onremotetrack) callbacks.onremotetrack(track, mid, on);
        },
        ondataopen: (label) => {
          this.log("[remoteFeed] The DataChannel is available!");
          if (callbacks.ondataopen) callbacks.ondataopen(label);
        },
        ondata: (data, label) => {
          this.log("[remoteFeed] data", data);
          if (callbacks.ondata) callbacks.ondata(data, label);
        },
        ondataerror: (error) => {
          this.warn("[remoteFeed] data (subscriber) ", error);
          if (callbacks.ondataerror) callbacks.ondataerror(error);
        },
        oncleanup: () => {
          this.log("[remoteFeed] cleanup");
          if (callbacks.oncleanup) callbacks.oncleanup();
        },
      });
    });
  };

  detachRemoteFeed = () => {
    return new Promise((resolve, reject) => {
      if (this.remoteFeed) {
        this.log("[remoteFeed] detach");
        this.remoteFeed.detach({
          success: () => {
            this.debug("[remoteFeed] detach success");
            resolve();
          },
          error: (err) => {
            this.error("[remoteFeed] detach error", err);
            reject(err);
          },
        });
      } else {
        resolve();
      }
    });
  };

  send = (component, action, handle, message, extraParams = {}) => {
    return new Promise((resolve, reject) => {
      if (handle) {
        this.log(`[${component}] ${action}`, message);
        handle.send({
          message,
          ...extraParams,
          success: (...resp) => {
            this.debug(`[${component}] ${action} success`, message);
            resolve(...resp);
          },
          error: (err) => {
            this.error(`[${component}] ${action} error`, message, err);
            reject(err);
          },
        });
      } else {
        this.error("can't send to an uninitialized handle", component, action);
        reject(new Error(`${component} not initialized`));
      }
    });
  };

}

export default GxyJanus;

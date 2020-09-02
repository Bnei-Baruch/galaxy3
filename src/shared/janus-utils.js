import {Janus} from "../lib/janus";
import {DATA_PORT, PROTOCOL_ROOM, SDIOUT_ID, SERVICE_ROOM, SHIDUR_ID, SNDMAN_ID, STORAN_ID,} from "./consts";
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
    }

    static setGlobalConfig = (config) => {
        GxyJanus.globalConfig = config;
    }

    static instanceConfig = (name) => {
        let gateway = null;
        Object.entries(GxyJanus.globalConfig.gateways).forEach(([type, gateways]) => {
            if (!gateway) {
                gateway = gateways[name];
            }
        })

        if (!gateway) {
            throw new Error(`unknown gateway ${name}`);
        }

        return {
            ...gateway,
            iceServers: GxyJanus.globalConfig.ice_servers[gateway.type].map(url => ({urls: url})),
        }
    };

    static gatewayNames = (type = "rooms") => (
        Object.keys(GxyJanus.globalConfig.gateways[type])
    );

    static makeGateways = (type = "rooms") => (
        GxyJanus.gatewayNames(type).reduce((obj, name) => {
            obj[name] = new GxyJanus(name);
            return obj;
        }, {})
    );

    static protocolRoom = (name) => {
        return name === "protocol" ? PROTOCOL_ROOM : SERVICE_ROOM;
    };

    init = () => {
        return new Promise((resolve, reject) => {
            Janus.init({
                debug: process.env.NODE_ENV !== 'production' ? ["log", "warn", "error"] : ["warn", "error"],
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
                            reject(err);
                            if (this.gateway.getSessionId()) {
                                this.reconnect();
                            }
                        },
                        destroyed: () => {
                            this.error(":: Janus destroyed ::");
                        }
                    });
                }
            })
        });
    };

    destroy = () => {
        [
            this.chatroom,
            this.protocol,
            this.serviceProtocol,
            this.videoroom,
            this.remoteFeed,
            this.forward
        ].forEach(handle => {
            if (!!handle) {
                handle.hangup();
            }
        })
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
                    this.dispatchEvent(new Event('reconnect'));
                },
                error: (err) => {
                    this.error("reconnect error", err);
                    setTimeout(() => this.reconnect(attempts - 1), 1000);
                },
            });
        } else {
            this.dispatchEvent(new Event('reconnect_failure'));
            this.reinit();
        }
    }

    // this will try to reconnect forever. Use stopReInit() to stop.
    // user is expected to reload window after some time.
    reinit = (attempt = 1) => {
        this.info("re-init", attempt);
        this.reset();
        this.init()
            .then(() => this.dispatchEvent(new Event('reinit')))
            .catch((err) => {
                this.error("re-init error", err);
                this.dispatchEvent(new CustomEvent('reinit_failure', {detail: attempt}));
                if (this.stopReinit) {
                    this.info("reinit was stopped", attempt);
                } else {
                    setTimeout(() => this.reinit(attempt + 1), 1000 * attempt);
                }
            })
    }

    stopReInit = () => {
        this.stopReinit = true;
    }

    debug = (...args) => {
        //console.debug(`[${this.name}]`, ...args)
    };
    log = (...args) => {
        console.log(`[${this.name}]`, ...args)
    };
    info = (...args) => {
        console.info(`[${this.name}]`, ...args)
    };
    warn = (...args) => {
        console.warn(`[${this.name}]`, ...args)
    };
    error = (...args) => {
        console.error(`[${this.name}]`, ...args)
    };

    getConfig = () => (GxyJanus.instanceConfig(this.name));

    initChatRoom = (ondata) => {
        return new Promise((resolve, reject) => {
            this.gateway.attach(
                {
                    plugin: "janus.plugin.textroom",
                    opaqueId: "chatroom_user",
                    success: (pluginHandle) => {
                        this.chatroom = pluginHandle;
                        this.log("[chatroom] attach success", this.chatroom.getId());
                        this.send("chatroom", "setup", this.chatroom, {request: "setup"})
                            .then(resolve)
                            .catch(reject);
                    },
                    error: (err) => {
                        this.error("[chatroom] Error attaching plugin", err);
                        reject(err);
                    },
                    webrtcState: (on) => {
                        this.log("[chatroom] Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
                    },
                    onmessage: (msg, jsep) => {
                        this.debug("[chatroom] message", msg);

                        if (msg["error"] !== undefined && msg["error"] !== null) {
                            this.error("[chatroom] message error", msg);
                            alert("chatroom message error: " + msg["error"]);
                        }

                        if (jsep !== undefined && jsep !== null) {
                            // Answer
                            this.chatroom.createAnswer(
                                {
                                    jsep: jsep,
                                    media: {audio: false, video: false, data: true},  // We only use datachannels
                                    success: (jsep) => {
                                        this.debug("[chatroom] Got SDP!", jsep);
                                        this.send("chatroom", "ack jsep", this.chatroom, {request: "ack"}, {jsep});
                                    },
                                    error: (err) => {
                                        this.error("[chatroom] createAnswer error", err);
                                        alert("chatroom WebRTC createAnswer error: " + JSON.stringify(err));
                                    }
                                }
                            );
                        }
                    },
                    ondataopen: () => {
                        this.log("[chatroom] DataChannel is available!");
                    },
                    ondata: (data) => {
                        this.debug("[chatroom] data", data);
                        ondata(data);
                    },
                    oncleanup: () => {
                        this.log("[chatroom] cleanup");
                    }
                }
            );
        });
    };

    detachChatRoom = () => {
        return new Promise((resolve, reject) => {
            if (this.chatroom) {
                this.log('[chatroom] detach');
                this.chatroom.detach({
                    success: () => {
                        this.debug("[chatroom] detach success");
                        resolve();
                    },
                    error: (err) => {
                        this.error("[chatroom] detach error", err);
                        reject(err);
                    }
                });
            } else {
                resolve();
            }
        });
    };

    chatRoomJoin = (room, user) => {
        return this.data("chatroom", this.chatroom, {
            textroom: "join",
            transaction: Janus.randomString(12),
            room,
            username: user.id,
            display: user.display
        });
    };

    chatRoomLeave = (room) => {
        return this.data("chatroom", this.chatroom, {
            textroom: "leave",
            transaction: Janus.randomString(12),
            room
        });
    };

    initGxyProtocol = (user, ondata) => {
        return this.initProtocol("protocol", user, ondata, (handle) => {
            this.protocol = handle;
        });
    };

    initServiceProtocol = (user, ondata) => {
        return this.initProtocol("service", user, ondata, (handle) => {
            this.serviceProtocol = handle;
        });
    };

    protocolHandle = (name) => {
        return name === "protocol" ? this.protocol : this.serviceProtocol;
    };

    initProtocol = (name, user, ondata, onSuccess) => {
        return new Promise((resolve, reject) => {
            this.gateway.attach(
                {
                    plugin: "janus.plugin.textroom",
                    opaqueId: `gxy_${name}`,
                    success: (handle) => {
                        onSuccess(handle);
                        this.log(`[${name}] attach success`, handle.getId());
                        this.send(name, "setup", handle, {request: "setup"})
                            .then(resolve)
                            .catch(reject);
                    },
                    error: (err) => {
                        this.error(`[${name}] attach error`, err);
                        reject(err);
                    },
                    webrtcState: (on) => {
                        this.log(`[${name}] Janus says our WebRTC PeerConnection is ${on ? "up" : "down"} now`);
                    },
                    onmessage: (msg, jsep) => {
                        this.debug(`[${name}] message`, msg);
                        if (msg["error"] !== undefined && msg["error"] !== null) {
                            this.error(`[${name}] message error`, msg);
                            alert(`[${name}] message error: ${msg["error"]}`);
                        }
                        if (jsep !== undefined && jsep !== null) {
                            // Answer
                            const handle = this.protocolHandle(name);
                            handle.createAnswer({
                                jsep: jsep,
                                media: {audio: false, video: false, data: true},  // We only use datachannels
                                success: (jsep) => {
                                    this.debug(`[${name}] Got SDP!`, jsep);
                                    this.send(name, "ack jsep", handle, {request: "ack"}, {jsep});
                                },
                                error: (err) => {
                                    this.error(`[${name}] createAnswer error`, err);
                                    alert(`[${name}] WebRTC createAnswer error: ${JSON.stringify(err)}`);
                                }
                            });
                        }
                    },
                    ondataopen: () => {
                        this.log(`[${name}] DataChannel is available. Joining in`);
                        this.data(name, this.protocolHandle(name), {
                            textroom: "join",
                            transaction: Janus.randomString(12),
                            room: GxyJanus.protocolRoom(name),
                            username: user.id || user.sub,
                            display: user.display
                        });
                    },
                    ondata: (data) => {
                        this.debug(`[${name}] data `, data);
                        this.onProtocolData(name, user, data, ondata);
                    },
                    oncleanup: () => {
                        this.warn(`[${name}] ::: Got a cleanup notification :::`);
                    }
                }
            );
        });
    };

    onProtocolData = (name, user, data, ondata) => {
        let json = JSON.parse(data);
        let what = json["textroom"];
        if (what === "message") {
            // Incoming message: public or private?
            let msg = json["text"];
            msg = msg.replace(new RegExp('<', 'g'), '&lt');
            msg = msg.replace(new RegExp('>', 'g'), '&gt');
            let from = json["from"];
            let dateString = getDateString(json["date"]);
            let whisper = json["whisper"];
            if (whisper === true) {
                // Private message
                this.log(`[${name}] private message`, dateString, from, msg)
            } else {
                // Public message
                let message = JSON.parse(msg);
                message.time = dateString;
                ondata(message)
            }
        } else if (what === "success") {
            if (json.participants) {
                this.log(`[${name}] Got Users: `, json, user);
                let shidur = json.participants.find(c => c.username === SHIDUR_ID);
                let storan = json.participants.find(c => c.username === STORAN_ID);
                let sndman = json.participants.find(c => c.username === SNDMAN_ID);
                let sdiout = json.participants.find(c => c.username === SDIOUT_ID);

                if (shidur) {
                    this.log(`[${name}] :: Support Online ::`);
                } else {
                    this.log(`[${name}] :: Support Offline ::`);
                }

                if (storan && (user.id === SDIOUT_ID || user.id === SNDMAN_ID)) {
                    this.log(`[${name}] :: Shidur ${storan ? "Online" : "Offline"} ::`);
                    ondata({type: "event", shidur: storan.username === STORAN_ID})
                }

                if (sndman && user.id === STORAN_ID) {
                    this.log(`[${name}] :: SoundMan ${sndman ? "Online" : "Offline"} ::`);
                    ondata({type: "event", sndman: sndman.username === SNDMAN_ID})
                }

                if (sdiout && user.id === STORAN_ID) {
                    this.log(`[${name}] :: SDIOut ${sdiout ? "Online" : "Offline"} ::`);
                    ondata({type: "event", sdiout: sdiout.username === SDIOUT_ID})
                }
            }
        } else if (what === "join") {
            // Somebody joined
            let username = json["username"];
            let display = json["display"];
            this.log(`[${name}] Somebody joined - username: ${username} display: ${display}`);
            if (username === SHIDUR_ID) {
                this.log(`[${name}] :: Support Enter ::`);
            }

            if (username === SNDMAN_ID && user.id === STORAN_ID) {
                this.log(`[${name}] :: SoundMan Enter ::`);
                ondata({type: "event", sndman: true})
            }

            if (username === SDIOUT_ID && user.id === STORAN_ID) {
                this.log(`[${name}] :: SdiOut Enter ::`);
                ondata({type: "event", sdiout: true})
            }

            if (username === user.id) {
                this.log(`[${name}] :: IT's me ::`);
                ondata({type: "joined"})
            }
        } else if (what === "leave") {
            // Somebody left
            let username = json["username"];
            //var when = new Date();
            this.log(`[${name}] Somebody left - username: ${username} Time: ${getDateString()}`);
            ondata({type: "leave", id: username});

            if (username === SHIDUR_ID) {
                this.log(`[${name}] :: Support Left ::`);
            }

            if (username === SNDMAN_ID && user.id === STORAN_ID) {
                this.log(`[${name}] :: SoundMan Left ::`);
                ondata({type: "event", sndman: false})
            }

            if (username === SDIOUT_ID && user.id === STORAN_ID) {
                this.log(`[${name}] :: SdiOut Left ::`);
                ondata({type: "event", sdiout: false})
            }
        } else if (what === "kicked") {
            // Somebody was kicked
            // var username = json["username"];
        } else if (what === "destroyed") {
            let room = json["room"];
            this.warn(`[${name}] room destroyed`, room)
        } else if (what === "error") {
            this.error(`[${name}] error`, json);
            let error = json["error"];
            let error_code = json["error_code"];
            ondata({type: "error", error, error_code})
        }
    };

    sendProtocolMessage = (msg) => {
        return this.data("protocol", this.protocol, {
            ack: false,
            textroom: "message",
            transaction: Janus.randomString(12),
            room: PROTOCOL_ROOM,
            text: JSON.stringify(msg),
        });
    };

    sendServiceMessage = (msg) => {
        return this.data("service", this.serviceProtocol, {
            ack: false,
            textroom: "message",
            transaction: Janus.randomString(12),
            room: SERVICE_ROOM,
            text: JSON.stringify(msg),
        });
    };

    sendCmdMessage = (msg, room) => {
        return this.data("command", this.chatroom, {
            ack: false,
            textroom: "message",
            transaction: Janus.randomString(12),
            room,
            text: JSON.stringify(msg),
        });
    };

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
                    this.warn("[videoroom] Janus reports problems " + (uplink ? "sending" : "receiving") +
                        " packets on mid " + mid + " (" + lost + " lost packets)");
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
                    this.log("[videoroom] message", msg);
                    if (callbacks.onmessage) callbacks.onmessage(msg, jsep);
                },
                oncleanup: () => {
                    this.log("[videoroom] cleanup");
                    if (callbacks.oncleanup) callbacks.oncleanup();
                }
            });
        });
    };

    detachVideoRoom = (noRequest = true) => {
        return new Promise((resolve, reject) => {
            if (this.videoroom) {
                this.log('[videoroom] detach');
                this.videoroom.detach({
                    noRequest,
                    success: () => {
                        this.debug("[videoroom] detach success");
                        resolve();
                    },
                    error: (err) => {
                        this.error("[videoroom] detach error", err);
                        reject(err);
                    }
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
            display: JSON.stringify(user)
        });
    };

    videoRoomLeave = (room) => {
        return this.send("videoroom", "leave room", this.videoroom, {
            request: "leave",
            room
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
                    this.log("[remoteFeed] Janus says this WebRTC PeerConnection (remote feed) is " + (on ? "up" : "down") + " now");
                    if (callbacks.webrtcState) callbacks.webrtcState(on);
                },
                slowLink: (uplink, lost, mid) => {
                    this.warn("[remoteFeed] Janus reports problems " + (uplink ? "sending" : "receiving") +
                        " packets on mid " + mid + " (" + lost + " lost packets)");
                    if (callbacks.slowLink) callbacks.slowLink(uplink, lost, mid);
                },
                onmessage: (msg, jsep) => {
                    this.log("[remoteFeed] message", msg);
                    if (callbacks.onmessage) callbacks.onmessage(msg, jsep);
                },
                onlocaltrack: (track, on) => {
                    // The subscriber stream is recvonly, we don't expect anything here
                    this.warn("[remoteFeed] ::: unexpected local track ::: ")
                },
                onremotetrack: (track, mid, on) => {
                    if (!mid) {
                        mid = track.id.split("janus")[1];
                    }
                    this.log("[remoteFeed] Remote track (mid=" + mid + ") " + (on ? "added" : "removed") + ":", track);
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
                }
            });
        });
    };

    detachRemoteFeed = () => {
        return new Promise((resolve, reject) => {
            if (this.remoteFeed) {
                this.log('[remoteFeed] detach');
                this.remoteFeed.detach({
                    success: () => {
                        this.debug("[remoteFeed] detach success");
                        resolve();
                    },
                    error: (err) => {
                        this.error("[remoteFeed] detach error", err);
                        reject(err);
                    }
                });
            } else {
                resolve();
            }
        });
    };

    initForward = () => {
        return new Promise((resolve, reject) => {
            this.gateway.attach({
                plugin: "janus.plugin.videoroom",
                opaqueId: "forward",
                success: (handle) => {
                    this.forward = handle;
                    this.log("[forward] attached success", this.forward.getId());

                    this.send("forward", "join", this.forward, {
                        request: "join",
                        room: 1000,
                        ptype: "publisher",
                        display: JSON.stringify({
                            id: "forward",
                            display: "forward",
                            room: 1000,
                            session: this.gateway.getSessionId(),
                            handle: this.forward.getId(),
                        })
                    })
                        .then(resolve)
                        .catch(reject);
                },
                error: (err) => {
                    this.error("[forward] attach error", err);
                    reject(err);
                },
                consentDialog: (on) => {
                    this.debug("[forward] Consent dialog should be " + (on ? "on" : "off") + " now");
                },
                mediaState: (medium, on) => {
                    this.log("[forward] Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
                },
                webrtcState: (on) => {
                    this.log("[forward] Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
                    GxyJanus.gatewayNames("streaming").forEach((name) => {
                        const url = new URL(GxyJanus.instanceConfig(name).url);
                        this.send("forward", `rtp_forward to [${name}]`, this.forward, {
                            request: "rtp_forward",
                            host: url.host,
                            publisher_id: this.forwardPublisherID,
                            room: 1000,
                            secret: SECRET,
                            "data_port": DATA_PORT
                        });
                    });
                },
                onmessage: (msg, jsep) => {
                    this.debug("[forward] message", msg);
                    const event = msg["videoroom"];
                    if (event !== undefined && event !== null) {
                        if (event === "joined") {
                            this.forwardPublisherID = msg["id"]
                            this.log(`[forward] Successfully joined room ${msg["room"]} with ID ${this.forwardPublisherID}`);
                            this.forward.createOffer({
                                media: {audio: false, video: false, data: true},
                                simulcast: false,
                                success: (jsep) => {
                                    this.send("forward", "configure", this.forward, {
                                        request: "configure",
                                        audio: false,
                                        video: false,
                                        data: true
                                    }, {jsep});
                                },
                                error: (err) => {
                                    this.error("[forward] WebRTC error", err);
                                }
                            });
                        } else if (msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                            const unpublished = msg["unpublished"];
                            this.log("[forward] publisher left", unpublished);
                            if (unpublished === 'ok') {
                                this.forward.hangup();
                            }
                        } else if (msg["error"] !== undefined && msg["error"] !== null) {
                            this.error("[forward] message error", msg["error"]);
                            alert(`[forward] message error: ${msg["error"]}`);
                        }
                    }
                    if (jsep !== undefined && jsep !== null) {
                        this.debug("[forward] Handling SDP as well...", jsep);
                        this.forward.handleRemoteJsep({jsep});
                    }
                },
                onlocalstream: (mystream) => {
                    this.debug("[forward] ::: Got a local stream :::");
                },
                ondataopen: () => {
                    this.log("[forward] The DataChannel is available!");
                },
                ondata: (data) => {
                    this.warn("[forward] ::: data from the DataChannel! :::", data);
                },
                oncleanup: () => {
                    this.log("[forward] cleanup");
                }
            })
        });
    }

    forwardMessage = (msg) => {
        return this.data("forward", this.forward, msg);
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
                    }
                });
            } else {
                this.error("can't send to an uninitialized handle", component, action);
                reject(new Error(`${component} not initialized`));
            }
        });
    };

    data = (component, handle, payload) => {
        return new Promise((resolve, reject) => {
            if (handle) {
                this.debug(`[${component}] data`, payload);
                handle.data({
                    text: JSON.stringify(payload),
                    success: (...resp) => {
                        this.debug(`[${component}] data success`, payload);
                        resolve(...resp);
                    },
                    error: (err) => {
                        this.error(`[${component}] data error`, payload, err);
                        reject(err);
                    }
                });
            } else {
                this.error("can't send data to an uninitialized handle", component);
                reject(new Error(`${component} not initialized`));
            }
        });
    };
}

export default GxyJanus;

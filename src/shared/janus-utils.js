import {Janus} from "../lib/janus";
import {
    ADMIN_SECRET,
    JANUS_ADMIN_GXY1,
    JANUS_ADMIN_GXY2,
    JANUS_ADMIN_GXY3,
    JANUS_SRV_GXY1,
    JANUS_SRV_GXY2,
    JANUS_SRV_GXY3,
    PROTOCOL_ROOM,
    SDIOUT_ID,
    SHIDUR_ID,
    SNDMAN_ID,
    STORAN_ID,
    STUN_SRV_GXY
} from "./consts";
import {getDateString} from "./tools";

class GxyJanus {

    constructor(name) {
        this.name = name;
        this.gateway = null;
        this.chatroom = null;
        this.protocol = null;
        this.videoroom = null;
        this.remoteFeed = null;
    }

    static instanceConfig = (name) => {
        switch (name) {
            case "gxy1":
                return {server: JANUS_SRV_GXY1, admin: JANUS_ADMIN_GXY1};
            case "gxy2":
                return {server: JANUS_SRV_GXY2, admin: JANUS_ADMIN_GXY2};
            case "gxy3":
                return {server: JANUS_SRV_GXY3, admin: JANUS_ADMIN_GXY3};
            default:
                throw new Error(`Unknown janus instance ${name}`);
        }
    };

    init = () => {
        return new Promise((resolve, reject) => {
            Janus.init({
                debug: process.env.NODE_ENV !== 'production' ? ["log", "warn", "error"] : ["warn", "error"],
                callback: () => {
                    const config = GxyJanus.instanceConfig(this.name);
                    this.gateway = new Janus({
                        server: config.server,
                        ...{
                            iceServers: [{urls: STUN_SRV_GXY}],
                            success: () => {
                                this.log("Connected to JANUS");
                                resolve();
                            },
                            error: (err) => {
                                this.error("Janus.init error", err);
                                reject(err);
                            },
                            destroyed: () => {
                                this.error(":: Janus destroyed ::");
                            }
                        }
                    });
                }
            })
        });
    };

    destroy = () => {
        this.gateway.destroy();
    };

    debug = (...args) => {
        console.debug(`[${this.name}]`, ...args)
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
        return new Promise((resolve, reject) => {
            this.gateway.attach(
                {
                    plugin: "janus.plugin.textroom",
                    opaqueId: "gxy_protocol",
                    success: (handle) => {
                        this.protocol = handle;
                        this.log("[protocol] attach success", this.protocol.getId());
                        this.send("protocol", "setup", this.protocol, {request: "setup"})
                            .then(resolve)
                            .catch(reject);
                    },
                    error: (err) => {
                        this.error("[protocol] attach error", err);
                        reject(err);
                    },
                    webrtcState: (on) => {
                        this.log("[protocol] Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
                    },
                    onmessage: (msg, jsep) => {
                        this.debug("[protocol] message ", msg);
                        if (msg["error"] !== undefined && msg["error"] !== null) {
                            this.error("[protocol] message error", msg);
                            alert("protocol message error: " + msg["error"]);
                        }
                        if (jsep !== undefined && jsep !== null) {
                            // Answer
                            this.protocol.createAnswer(
                                {
                                    jsep: jsep,
                                    media: {audio: false, video: false, data: true},  // We only use datachannels
                                    success: (jsep) => {
                                        this.debug("[protocol] Got SDP!", jsep);
                                        this.send("protocol", "ack jsep", this.protocol, {request: "ack"}, {jsep});
                                    },
                                    error: (err) => {
                                        this.error("[protocol] createAnswer error", err);
                                        alert("protocol WebRTC createAnswer error: " + JSON.stringify(err));
                                    }
                                })
                            ;
                        }
                    },
                    ondataopen: () => {
                        this.log("[protocol] DataChannel is available. Joining in");
                        this.data("protocol", this.protocol, {
                            textroom: "join",
                            transaction: Janus.randomString(12),
                            room: PROTOCOL_ROOM,
                            username: user.id || user.sub,
                            display: user.display
                        });
                    },
                    ondata: (data) => {
                        this.debug("[protocol] data ", data);
                        this.onProtocolData(data, user, ondata);
                    },
                    oncleanup: () => {
                        this.warn("[protocol] ::: Got a cleanup notification :::");
                    }
                }
            );
        });
    };

    onProtocolData = (data, user, ondata) => {
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
                this.log("[protocol] private message", dateString, from, msg)
            } else {
                // Public message
                let message = JSON.parse(msg);
                message.time = dateString;
                ondata(message)
            }
        } else if (what === "success") {
            if (json.participants) {
                this.log("[protocol] Got Users: ", json, user);
                let shidur = json.participants.find(c => c.username === SHIDUR_ID);
                let storan = json.participants.find(c => c.username === STORAN_ID);
                let sndman = json.participants.find(c => c.username === SNDMAN_ID);
                let sdiout = json.participants.find(c => c.username === SDIOUT_ID);

                if (shidur) {
                    this.log("[protocol] :: Support Online ::");
                } else {
                    this.log("[protocol] :: Support Offline ::");
                }

                if (storan && (user.id === SDIOUT_ID || user.id === SNDMAN_ID)) {
                    this.log("[protocol] :: Shidur " + (sndman ? "Online" : "Offline") + " ::");
                    ondata({type: "event", shidur: storan.username === STORAN_ID})
                }

                if (sndman && user.id === STORAN_ID) {
                    this.log("[protocol] :: SoundMan " + (sndman ? "Online" : "Offline") + " ::");
                    ondata({type: "event", sndman: sndman.username === SNDMAN_ID})
                }

                if (sdiout && user.id === STORAN_ID) {
                    this.log("[protocol] :: SdiOut " + (sdiout ? "Online" : "Offline") + "  ::");
                    ondata({type: "event", sdiout: sdiout.username === SDIOUT_ID})
                }
            }
        } else if (what === "join") {
            // Somebody joined
            let username = json["username"];
            let display = json["display"];
            this.log("[protocol] Somebody joined - username: " + username + " : display: " + display);
            if (username === SHIDUR_ID) {
                this.log("[protocol] :: Support Enter ::");
            }

            if (username === SNDMAN_ID && user.id === STORAN_ID) {
                this.log("[protocol] :: SoundMan Enter ::");
                ondata({type: "event", sndman: true})
            }

            if (username === SDIOUT_ID && user.id === STORAN_ID) {
                this.log("[protocol] :: SdiOut Enter ::");
                ondata({type: "event", sdiout: true})
            }

            if (username === user.id) {
                this.log("[protocol] :: IT's me ::");
                ondata({type: "joined"})
            }
        } else if (what === "leave") {
            // Somebody left
            let username = json["username"];
            //var when = new Date();
            this.log("[protocol] Somebody left - username: " + username + " : Time: " + getDateString());
            ondata({type: "leave", id: username});

            if (username === SHIDUR_ID) {
                this.log("[protocol] :: Support Left ::");
            }

            if (username === SNDMAN_ID && user.id === STORAN_ID) {
                this.log("[protocol] :: SoundMan Left ::");
                ondata({type: "event", sndman: false})
            }

            if (username === SDIOUT_ID && user.id === STORAN_ID) {
                this.log("[protocol] :: SdiOut Left ::");
                ondata({type: "event", sdiout: false})
            }
        } else if (what === "kicked") {
            // Somebody was kicked
            // var username = json["username"];
        } else if (what === "destroyed") {
            let room = json["room"];
            this.warn("[protocol] room destroyed", room)
        } else if (what === "error") {
            this.error("[protocol] error", json);
            let error = json["error"];
            let error_code = json["error_code"];
            ondata({type: "error", error, error_code})
        }
    };

    sendProtocolMessage = (user, msg) => {
        return this.data("protocol", this.protocol, {
            ack: false,
            textroom: "message",
            transaction: Janus.randomString(12),
            room: PROTOCOL_ROOM,
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
                    this.log("[videoroom] Janus reports problems " + (uplink ? "sending" : "receiving") +
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

    detachVideoRoom = () => {
        return new Promise((resolve, reject) => {
            if (this.videoroom) {
                this.log('[videoroom] detach');
                this.videoroom.detach({
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
        return this.send("videoroom", "join room", this.videoroom,{
            request: "join",
            room,
            ptype,
            display: JSON.stringify(user)
        });
    };

    videoRoomLeave = (room) => {
        return this.send("videoroom", "leave room", this.videoroom,{
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
                    this.log("[remoteFeed] attach success", this.remoteFeed.getId() );
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
                    this.log("[remoteFeed] Janus reports problems " + (uplink ? "sending" : "receiving") +
                        " packets on mid " + mid + " (" + lost + " lost packets)");
                    if (callbacks.slowLink) callbacks.slowLink(uplink, lost, mid);
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
                ondataopen: () => {
                    this.log("[remoteFeed] The DataChannel is available!");
                    if (callbacks.ondataopen) callbacks.ondataopen();
                },
                ondata: (data) => {
                    this.log("[remoteFeed] data", data);
                    if (callbacks.ondata) callbacks.ondata(data);
                },
                onmessage: (msg, jsep) => {
                    this.log("[remoteFeed] message", msg);
                    if (callbacks.onmessage) callbacks.onmessage(msg, jsep);
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

    getPublisherInfo = (session, handle) => {
        if (handle === null || handle === undefined)
            return;

        return this.getData(`/${session}/${handle}`, {janus: "handle_info"});
    };

    getData = (path, params = {}) => {
        const config = GxyJanus.instanceConfig(this.name);
        const url = `${config.admin}${path}`;
        const payload = {
            ...{transaction: Janus.randomString(12)},
            ...params,
            ...{admin_secret: ADMIN_SECRET}
        };

        return new Promise((resolve, reject) => {
            fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            })
                .then((response) => {
                    response.json().then(data => resolve(data));
                })
                .catch(err => {
                    this.error("fetch error", url, payload, err);
                    reject(err);
                });
        });
    }
}

export default GxyJanus;

import {Janus} from "../lib/janus";
import {DATA_PORT, JANUS_STR_HOST_PL, JANUS_STR_HOST_GR, JANUS_STR_HOST_UK, SECRET} from "./consts";

let data_forward = {};
let myid;

export const initDataForward = (janus, callback) => {
    let fwdhandle;
    janus.attach({
        plugin: "janus.plugin.videoroom",
        opaqueId: "forward",
        success: (handle) => {
            fwdhandle = handle;
            Janus.log(fwdhandle);
            Janus.log("Plugin attached! (" + fwdhandle.getPlugin() + ", id=" + fwdhandle.getId() + ")");
            Janus.log("  -- Forward manager");
            let register = { "request": "join", "room": 1000, "ptype": "publisher", "display": "forward" };
            fwdhandle.send({"message": register});
        },
        error: (error) => {
            Janus.log("Error attaching plugin: " + error);
        },
        consentDialog: (on) => {
            Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
        },
        mediaState: (medium, on) => {
            Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
        },
        webrtcState: (on) => {
            Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
            forwardOwnFeed(myid, fwdhandle)
        },
        onmessage: (msg, jsep) => {
            onMessage(msg, jsep, fwdhandle);
        },
        onlocalstream: (mystream) => {
            Janus.debug(" ::: Got a local stream :::", mystream);
        },
        ondataopen: () => {
            Janus.log("The DataChannel is available!(Forward)");
            callback(fwdhandle);
        },
        ondata: (data) => {
            Janus.log("We got data from the DataChannel! (publisher) " + data);
        },
        oncleanup: () => {
            Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
        }
    });
};

const forwardOwnFeed = (myid, fwdhandle) => {
    let PL = `${JANUS_STR_HOST_PL}`;
    let FR = `${JANUS_STR_HOST_UK}`;
    let GR = `${JANUS_STR_HOST_GR}`;
    let ips = [PL, FR, GR];

    for(let i=0; i<ips.length; i++) {
        let isrfwd = { "request": "rtp_forward","publisher_id":myid,"room":1000,"secret":`${SECRET}`,"host":ips[i],"data_port":DATA_PORT};
        fwdhandle.send({"message": isrfwd,
            success: (data) => {
                data_forward[ips[i]] = data["rtp_stream"]["data_stream_id"];
                Janus.log(" :: ISR Data Forward: ", data);
            },
        });
    }
};

const onMessage = (msg, jsep, fwdhandle) => {
    let event = msg["videoroom"];
    Janus.log("Forward Event: " + event);
    if(event !== undefined && event !== null) {
        if(event === "joined") {
            myid = msg["id"];
            Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
            fwdhandle.createOffer(
                {
                    media: {  audio: false, video: false, data: true },
                    simulcast: false,
                    success: (jsep) => {
                        let publish = { "request": "configure", "audio": false, "video": false, "data": true };
                        fwdhandle.send({"message": publish, "jsep": jsep});
                    },
                    error: (error) => {
                        Janus.error("WebRTC error:", error);
                    }
                });
        } else if(event === "event") {
            } else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                let unpublished = msg["unpublished"];
                Janus.log("Publisher left: " + unpublished);
                if(unpublished === 'ok') {
                    fwdhandle.hangup();
                }
            } else if(msg["error"] !== undefined && msg["error"] !== null) {
                Janus.log(msg["error"]);
            }
    }
    if(jsep !== undefined && jsep !== null) {
        Janus.debug("Handling SDP as well...");
        Janus.debug(jsep);
        fwdhandle.handleRemoteJsep({jsep});
    }
};
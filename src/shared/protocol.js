import {Janus} from "../lib/janus";
import {PROTOCOL_ROOM,SHIDUR_ID} from "./consts";
import {getDateString} from "./tools";

const attachGxyProtocol = (protocol, user) => {
    let transaction = Janus.randomString(12);
    let register = {
        textroom: "join",
        transaction: transaction,
        room: PROTOCOL_ROOM,
        username: user.id || user.sub,
        display: user.display
    };
    protocol.data({
        text: JSON.stringify(register),
        error: (reason) => {
            alert(reason);
        }
    });
};

export const initGxyProtocol = (janus,user,callback,ondata) => {
    let protocol = null;
    janus.attach(
        {
            plugin: "janus.plugin.textroom",
            opaqueId: "gxy_protocol",
            success: (handle) => {
                protocol = handle;
                callback(protocol);
                Janus.log("Plugin attached! (" + protocol.getPlugin() + ", id=" + protocol.getId() + ")");
                // Setup the DataChannel
                let body = {"request": "setup"};
                Janus.debug("Sending message (" + JSON.stringify(body) + ")");
                protocol.send({"message": body});
            },
            error: (error) => {
                console.error("  -- Error attaching plugin...", error);
            },
            webrtcState: (on) => {
                Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
            },
            onmessage: (msg, jsep) => {
                Janus.debug(" ::: Got a message :::");
                Janus.debug(msg);
                if (msg["error"] !== undefined && msg["error"] !== null) {
                    alert(msg["error"]);
                }
                if (jsep !== undefined && jsep !== null) {
                    // Answer
                    protocol.createAnswer(
                        {
                            jsep: jsep,
                            media: {audio: false, video: false, data: true},	// We only use datachannels
                            success: (jsep) => {
                                Janus.debug("Got SDP!");
                                Janus.debug(jsep);
                                let body = {"request": "ack"};
                                protocol.send({"message": body, "jsep": jsep});
                            },
                            error: (error) => {
                                Janus.error("WebRTC error:", error);
                                alert("WebRTC error... " + JSON.stringify(error));
                            }
                        });
                }
            },
            ondataopen: () => {
                Janus.log("The DataChannel is available!");
                attachGxyProtocol(protocol,user);
            },
            ondata: (data) => {
                Janus.debug("We got data from the DataChannel! " + data);
                onProtocolData(data,ondata);
            },
            oncleanup: () => {
                Janus.log(" ::: Got a cleanup notification :::");
            }
        });
};

const onProtocolData = (data,ondata) => {
    let json = JSON.parse(data);
    // var transaction = json["transaction"];
    // if (transactions[transaction]) {
    //     // Someone was waiting for this
    //     transactions[transaction](json);
    //     delete transactions[transaction];
    //     return;
    // }
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
            Janus.log("-:: It's protocol private message: "+dateString+" : "+from+" : "+msg)
        } else {
            // Public message
            let message = JSON.parse(msg);
            message.time = dateString;
            ondata(message)
        }
    } else if (what === "success") {
        if(json.participants) {
            Janus.log("--- Got Protocol Users: ", json);
            let pcliens = json.participants.filter(c => c.username.match(SHIDUR_ID));
            if (pcliens.length > 0) {
                //TODO: Notify user
                Janus.log(":: Support Online ::");
            } else {
                Janus.log(":: Support Offline ::");
            }
        }
    } else if (what === "join") {
        // Somebody joined
        let username = json["username"];
        let display = json["display"];
        Janus.log("- Somebody joined - username: "+username+" : display: "+display);
        if (username.match(SHIDUR_ID)) {
            //TODO: Notify user
            Janus.log(":: Support Online ::");
        }
    } else if (what === "leave") {
        // Somebody left
        let username = json["username"];
        //var when = new Date();
        Janus.log("-:: Somebody left - username: "+username+" : Time: "+getDateString());
        if (username.match(SHIDUR_ID)) {
            //TODO: Notify user
            Janus.log(":: Support Offline ::");
        }
    } else if (what === "kicked") {
        // Somebody was kicked
        // var username = json["username"];
    } else if (what === "destroyed") {
        let room = json["room"];
        Janus.log("The room: "+room+" has been destroyed")
    }
};

export const sendProtocolMessage = (protocol,user,msg) => {
    //let msg = {user, text: text};
    let message = {
        textroom: "message",
        transaction: Janus.randomString(12),
        room: PROTOCOL_ROOM,
        text: JSON.stringify(msg),
    };
    // Note: messages are always acknowledged by default. This means that you'll
    // always receive a confirmation back that the message has been received by the
    // server and forwarded to the recipients. If you do not want this to happen,
    // just add an ack:false property to the message above, and server won't send
    // you a response (meaning you just have to hope it succeeded).
    protocol.data({
        text: JSON.stringify(message),
        error: (reason) => { alert(reason); },
        success: () => {
            Janus.log(":: Protocol Message sent ::");
        }
    });
};
import { Janus } from "../lib/janus";

const WFRP_STATE = process.env.REACT_APP_WFRP_STATE;
const WFDB_STATE = process.env.REACT_APP_WFDB_STATE;
const JANUS_SERVER = process.env.REACT_APP_JANUS_SERVER;
const JANUS_ADMIN = process.env.REACT_APP_JANUS_ADMIN;
const STUN_SERVER = process.env.REACT_APP_STUN_SERVER;
const SECRET = process.env.REACT_APP_SECRET;


export const initJanus = (cb) => {
    Janus.init({
        debug: ["log","error"],
        callback: () => {
            let janus = new Janus({
                server: JANUS_SERVER,
                iceServers: [{urls: STUN_SERVER}],
                success: () => {
                    Janus.log(" :: Connected to JANUS");
                    cb(janus);
                },
                error: (error) => {
                    Janus.log(error + " -- reconnect after 10 sec");
                    setTimeout(() => {
                        window.location.reload();
                    }, 10000);
                },
                destroyed: () => {
                    Janus.log(" :: Janus destroyed -- reconnect after 10 sec :: ");
                    setTimeout(() => {
                        window.location.reload();
                    }, 10000);
                }
            });
        }
    })
};

export const joinChatRoom = (textroom, roomid, user) => {
    let transaction = Janus.randomString(12);
    let register = {
        textroom: "join",
        transaction: transaction,
        room: roomid,
        username: user.name,
        display: user.display
    };
    // myusername = username;
    // transactions[transaction] = function(response) {
    //     if(response["textroom"] === "error") {
    //         // Something went wrong
    //         if(response["error_code"] === 417) {
    //             // This is a "no such room" error: give a more meaningful description
    //             bootbox.alert(
    //                 "<p>Apparently room <code>" + myroom + "</code> (the one this demo uses as a test room) " +
    //                 "does not exist...</p><p>Do you have an updated <code>janus.plugin.textroom.cfg</code> " +
    //                 "configuration file? If not, make sure you copy the details of room <code>" + myroom + "</code> " +
    //                 "from that sample in your current configuration file, then restart Janus and try again."
    //             );
    //         } else {
    //             bootbox.alert(response["error"]);
    //         }
    //         $('#username').removeAttr('disabled').val("");
    //         $('#register').removeAttr('disabled').click(registerUsername);
    //         return;
    //     }
    //     // We're in
    //     $('#roomjoin').hide();
    //     $('#room').removeClass('hide').show();
    //     $('#participant').removeClass('hide').html(myusername).show();
    //     $('#chatroom').css('height', ($(window).height()-420)+"px");
    //     $('#datasend').removeAttr('disabled');
    //     // Any participants already in?
    //     console.log("Participants:", response.participants);
    //     if(response.participants && response.participants.length > 0) {
    //         for(var i in response.participants) {
    //             var p = response.participants[i];
    //             participants[p.username] = p.display ? p.display : p.username;
    //             if(p.username !== myid && $('#rp' + p.username).length === 0) {
    //                 // Add to the participants list
    //                 $('#list').append('<li id="rp' + p.username + '" class="list-group-item">' + participants[p.username] + '</li>');
    //                 $('#rp' + p.username).css('cursor', 'pointer').click(function() {
    //                     var username = $(this).attr('id').split("rp")[1];
    //                     sendPrivateMsg(username);
    //                 });
    //             }
    //             $('#chatroom').append('<p style="color: green;">[' + getDateString() + '] <i>' + participants[p.username] + ' joined</i></p>');
    //             $('#chatroom').get(0).scrollTop = $('#chatroom').get(0).scrollHeight;
    //         }
    //     }
    // };
    textroom.data({
        text: JSON.stringify(register),
        error: (reason) => {
            alert(reason);
        }
    });
};

export const initChatRoom = (janus,roomid,handle,cb) => {
    var textroom = null;
    janus.attach(
        {
            plugin: "janus.plugin.textroom",
            opaqueId: "chatroom_user",
            success: (pluginHandle) => {
                textroom = pluginHandle;
                handle(textroom);
                Janus.log("Plugin attached! (" + textroom.getPlugin() + ", id=" + textroom.getId() + ")");
                // Setup the DataChannel
                let body = {"request": "setup"};
                Janus.debug("Sending message (" + JSON.stringify(body) + ")");
                textroom.send({"message": body});
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
                    textroom.createAnswer(
                        {
                            jsep: jsep,
                            media: {audio: false, video: false, data: true},	// We only use datachannels
                            success: (jsep) => {
                                Janus.debug("Got SDP!");
                                Janus.debug(jsep);
                                let body = {"request": "ack"};
                                textroom.send({"message": body, "jsep": jsep});
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
                // Prompt for a display name to join the default room
                // if(roomid) {
                //     joinChatRoom(textroom,roomid,null)
                // }
            },
            ondata: (data) => {
                Janus.debug("We got data from the DataChannel! " + data);
                cb(data);
            },
            oncleanup: () => {
                Janus.log(" ::: Got a cleanup notification :::");
            }
        });
};

export const notifyMe = (title, message, tout) => {
    if (!Notification) {
        alert('Desktop notifications not available in your browser. Try Chromium.');
        return;
    }
    if (Notification.permission !== "granted")
        Notification.requestPermission();
    else {
        var notification = new Notification(title+":", {
            icon: 'nlogo.png',
            body: message,
            requireInteraction: tout
        });
        notification.onclick = function () {
            window.focus();
        }
    }
};

export const getHiddenProp = () => {
    var prefixes = ['webkit','moz','ms','o'];
    if ('hidden' in document) return 'hidden';
    for (var i = 0; i < prefixes.length; i++){
        if ((prefixes[i] + 'Hidden') in document)
            return prefixes[i] + 'Hidden';
    }
    return null;
};

export const getDateString = (jsonDate) => {
    var when = new Date();
    if(jsonDate) {
        when = new Date(Date.parse(jsonDate));
    }
    var dateString =
        ("0" + when.getHours()).slice(-2) + ":" +
        ("0" + when.getMinutes()).slice(-2) + ":" +
        ("0" + when.getSeconds()).slice(-2);
    return dateString;
};

export const micLevel = (stream, canvas, cb) => {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    //let audioContext = null;
    //let mn = 25/128;
    let audioContext = new AudioContext();
    cb(audioContext);
    let analyser = audioContext.createAnalyser();
    let microphone = audioContext.createMediaStreamSource(stream);
    let javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 2048;

    microphone.connect(analyser);
    analyser.connect(javascriptNode);

    javascriptNode.connect(audioContext.destination);

    let canvasContext = canvas.getContext("2d");
    let gradient = canvasContext.createLinearGradient(0,0,0,55);
    gradient.addColorStop(1,'green');
    gradient.addColorStop(0.35,'#80ff00');
    gradient.addColorStop(0.10,'orange');
    gradient.addColorStop(0,'red');

    javascriptNode.onaudioprocess = function() {
        var array = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(array);
        var values = 0;

        var length = array.length;
        for (var i = 0; i < length; i++) {
            values += (array[i]);
        }

        var average = values / length;

//          console.log(Math.round(average - 40));

        canvasContext.clearRect(0, 0, 15, 35);
        canvasContext.fillStyle = gradient;
        //canvasContext.fillRect(0, 35-average*mn, 15, 35);
        canvasContext.fillRect(0, 35-average, 15, 35);
    }
};

export const checkNotification = () => {
    var iOS = !!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform);
    if ( !iOS && Notification.permission !== "granted") {
        Notification.requestPermission();
    }
};

export const checkDevices = (audioid,videoid,cb) => {
    let height = (Janus.webRTCAdapter.browserDetails.browser === "safari") ? 480 : 360;
    navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
    let video = videoid ? { height:height,width:640,deviceId: {exact: videoid}} : "";
    let audio = audioid ? { deviceId: {exact: audioid}} : "";
    // if (navigator.getUserMedia) {
        navigator.getUserMedia({ audio: audio, video: video }, stream => {
            cb(stream);
        }, function (e) {
            var message;
            switch (e.name) {
                case 'NotFoundError':
                case 'DevicesNotFoundError':
                    message = 'No input devices found.';
                    break;
                case 'SourceUnavailableError':
                    message = 'Your input device is busy';
                    break;
                case 'PermissionDeniedError':
                case 'SecurityError':
                    message = 'Permission denied!';
                    break;
                default: console.log('Permission devices usage is Rejected! You must grant it.', e);
                    return;
            }
            console.log(message);
        });
    // } else {
    //     console.log('Uncompatible browser!');
    // }
};

export const getDevices = (cb) => {
    navigator.mediaDevices.enumerateDevices().then(devices => {
        cb(devices);
        if (devices.length === 0)
            console.log(":: We did not found any input device");
    });
};

export const getState = (path, cb) => fetch(`${WFRP_STATE}/${path}`)
    .then((response) => {
        if (response.ok) {
            return response.json().then(data => cb(data));
        } else {
            let data = {};
            cb(data);
        }
    })
    .catch(ex => console.log(`get ${path}`, ex));

export const putData = (path, data, cb) => fetch(`${WFDB_STATE}/${path}`, {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body:  JSON.stringify(data)
})
    .then((response) => {
        if (response.ok) {
            return response.json().then(respond => cb(respond));
        }
    })
    .catch(ex => console.log("Put Data error:", ex));

export const getData = (url, request, cb) => fetch(`${url}`,{
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body:  JSON.stringify(request)
    }).then((response) => {
        if (response.ok) {
            return response.json().then(data => cb(data));
        }
    })
    .catch(ex => console.log(`get ${url}`, ex));

export const geoInfo = (url,cb) => fetch(`${url}`)
    .then((response) => {
    if (response.ok) {
        return response.json().then(data => cb(data));
    }
})
    .catch(ex => console.log(`get geoInfo`, ex));

export const getSessions = (cb) => {
    let request = { "janus": "list_sessions", "transaction": Janus.randomString(12), "admin_secret": SECRET };
    getData(JANUS_ADMIN,request,(json) => {
        let sessions = json["sessions"];
        cb(sessions);
    })
};

export const getHandles = (session,cb) => {
    if(session === null || session === undefined)
        return;
    let request = { "janus": "list_handles", "transaction": Janus.randomString(12), "admin_secret": SECRET };
    getData(`${JANUS_ADMIN}/${session}`,request,(json) => {
        let handles = json["handles"];
        cb(handles);
    })
};

export const getHandleInfo = (session, handle,cb) => {
    if(handle === null || handle === undefined)
        return;
    let request = { "janus": "handle_info", "transaction": Janus.randomString(12), "admin_secret": SECRET };
    getData(`${JANUS_ADMIN}/${session}/${handle}`,request,(json) => {
        let handleInfo = json["info"];
        if(handleInfo.opaque_id === "videoroom_user" && handleInfo["plugin_specific"]["type"] === "publisher") {
            let g = handleInfo["plugin_specific"]["display"];
            let ip = handleInfo.streams["0"].components["0"]["selected-pair"].split(" ")[3].split(":")[0];
            let json = {name: g, ip: ip};
            cb(json);
        }
    })
};

// function updateHandleInfo(vs, vh, port, vname) {
//     var session = vs;
//     var handle = vh;
//     if(handle === null || handle === undefined) {
//         return;
//     }
//     var updateHandle = currentHandle;
//     var request = { "janus": "handle_info", "transaction": randomString(12), "admin_secret": secret };
//     $.ajax({
//         type: 'POST',
//         url: srvadmin + "/" + session + "/" + handle,
//         cache: false,
//         contentType: "application/json",
//         data: JSON.stringify(request),
//         success: function(json) {
//             if(json["janus"] !== "success") {
//                 console.log("Ooops: " + json["error"].code + " " + json["error"].reason);       // FIXME
//                 if(refresh !== true)
//                     bootbox.alert(json["error"].reason);
//                 return;
//             }
//             console.log("Got info:");
//             console.log(json);
//             sgroups[port].handleInfo = json["info"];
//             sgroups[port].extip = sgroups[port].handleInfo.streams["0"].components["0"]["selected-pair"].split(" ")[3].split(":")[0];
//             sendStart(port,true);
//         },
//         error: function(XMLHttpRequest, textStatus, errorThrown) {
//             console.log(textStatus + ": " + errorThrown);   // FIXME
//             bootbox.alert("Couldn't contact the backend: is Janus down, or is the Admin/Monitor interface disabled?");
//             $('#update-handle').click(updateHandleInfo);
//         },
//         dataType: "json"
//     });
// }

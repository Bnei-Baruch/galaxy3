import {Janus} from "../lib/janus";
import * as Sentry from '@sentry/browser';
import {STUN_SRV_GXY, WKLI_ENTER, WKLI_LEAVE
} from "./env";

export const initJanus = (cb,er,server,token="",iceServers=[{urls: STUN_SRV_GXY}]) => {
    Janus.init({
        debug: process.env.NODE_ENV !== 'production' ? ["log","error"] : ["log", "error"],
        callback: () => {
            let janus = new Janus({
                server,
                token,
                iceServers,
                success: () => {
                    Janus.log(" :: Connected to JANUS");
                    cb(janus);
                },
                error: (error) => {
                    Janus.error(error);
                    er(error);
                },
                destroyed: () => {
                    Janus.error(" :: Janus destroyed :: ");
                }
            });
        }
    })
};

export const reportToSentry = (title, data, user, level) => {
    level = level || 'info';
    data  = data  || {};
    Sentry.withScope(scope => {
        Object.keys(data).forEach((key) => {
            scope.setExtra(key, data[key]);
        });
        scope.setLevel(level);
        if(user) {
            const {id,username,email} = user;
            Sentry.setUser({id,username,email});
        }
        Sentry.captureMessage(title);
    });
}

export const joinChatRoom = (textroom, roomid, user) => {
    let transaction = Janus.randomString(12);
    let register = {
        textroom: "join",
        transaction: transaction,
        room: roomid,
        username: user.id,
        display: user.display
    };
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
            icon: './nlogo.png',
            body: message,
            requireInteraction: tout
        });
        notification.onclick = function () {
            window.focus();
        };
        notification.onshow = function () {
            var audio = new Audio('./plucky.mp3');
            audio.play();
        };
    }
};

export const genUUID = () => {
    let dt = new Date().getTime();
    let uuid = 'vrtxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        let r = (dt + Math.random() * 16) % 16 | 0;
        dt = Math.floor(dt / 16);
        return (c === 'x' ? r : (r & (0x3 | 0x8))).toString(16);
    });
    return uuid;
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

//          Janus.log(Math.round(average - 40));

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

export const getMediaStream = (audio, video, setting={width: 320, height: 180, ideal: 15}, audioid, videoid) => {
    const {width,height,ideal} = setting;
    if(video && videoid) {
        video = {width, height, frameRate: {ideal, min: 1}, deviceId: {exact: videoid}};
    } else if(video && !videoid) {
        video = {width, height, frameRate: {ideal, min: 1}};
    }
    audio = audioid ? {deviceId: {exact: audioid}} : audio;
    return navigator.mediaDevices.getUserMedia({audio, video})
        .then(data => ([data, null]))
        .catch(error => Promise.resolve([null, error.name]));
};

export const getMedia = async (media) => {
    const {audio, video} = media;
    let error = null;
    let devices = [];

    //TODO: Translate exceptions - https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#Exceptions

    //Check saved devices in local storage
    let storage_video = localStorage.getItem("video_device");
    let storage_audio = localStorage.getItem("audio_device");
    let storage_setting = JSON.parse(localStorage.getItem("video_setting"));
    video.video_device = !!storage_video ? storage_video : null;
    audio.audio_device = !!storage_audio ? storage_audio : null;
    video.setting = !!storage_setting ? storage_setting : video.setting;

    //FIXME: Check saved device and on error retry?
    [video.stream, error] = await getMediaStream(true, true,
        video.setting, audio.audio_device, video.video_device);

    if(error) {
        //Get only audio
        [audio.stream, audio.error] = await getMediaStream(true, false,
            video.setting, audio.audio_device, null);
        devices = await navigator.mediaDevices.enumerateDevices()
        audio.devices = devices.filter(a => !!a.deviceId && a.kind === 'audioinput');

        //Get only video
        [video.stream, video.error] = await getMediaStream(false, true,
            video.setting, null, video.video_device);
        devices = await navigator.mediaDevices.enumerateDevices()
        video.devices = devices.filter(v => !!v.deviceId && v.kind === 'videoinput');
    } else {
        devices = await navigator.mediaDevices.enumerateDevices()
        audio.devices = devices.filter(a => !!a.deviceId && a.kind === 'audioinput');
        video.devices = devices.filter(v => !!v.deviceId && v.kind === 'videoinput');
        audio.stream = video.stream;
    }

    if(audio.stream) {
        audio.audio_device = audio.stream.getAudioTracks()[0].getCapabilities().deviceId
    } else {
        audio.audio_device = "";
    }

    if(video.stream) {
        video.video_device = video.stream.getVideoTracks()[0].getCapabilities().deviceId
    } else {
        video.video_device =  "";
    }

    return media
};

export const geoInfo = (url,cb) => fetch(`${url}`)
    .then((response) => {
    if (response.ok) {
        return response.json().then(data => cb(data));
    } else {
        cb(false);
    }
})
    .catch(ex => console.log(`get geoInfo`, ex));

export const recordAudio = (stream) =>
    new Promise(async resolve => {
        const mediaRecorder = new MediaRecorder(stream);
        const audioChunks = [];

        mediaRecorder.addEventListener("dataavailable", event => {
            audioChunks.push(event.data);
        });

        const start = () => mediaRecorder.start();

        const stop = () =>
            new Promise(resolve => {
                mediaRecorder.addEventListener("stop", () => {
                    const audioBlob = new Blob(audioChunks);
                    const audioUrl = URL.createObjectURL(audioBlob);
                    const audio = new Audio(audioUrl);
                    const play = () => audio.play();
                    resolve({ audioBlob, audioUrl, play });
                });

                mediaRecorder.stop();
            });

        resolve({ start, stop });
    });

export const sleep = time => new Promise(resolve => setTimeout(resolve, time));

export const testMic = async (stream) => {
    const recorder = await recordAudio(stream);
    recorder.start();
    await sleep(10000);
    const audio = await recorder.stop();
    audio.play();
    await sleep(10000);
};

export const takeImage = (user) => {
    let canvas = document.createElement('canvas')
    let video = document.getElementById('localVideo');
    if(video && video.width > 0) {
        canvas.width = video.width;
        canvas.height = video.height;
        let context = canvas.getContext('2d')
        context.drawImage(video, 0, 0, video.width, video.height);
        let dataUrl = canvas.toDataURL()
        let base64 = dataUrl.split(',')[1];
        wkliEnter(base64, user);
    }
};

const wkliEnter = (base64, user) => {
    const {title,id,group,room} = user;
    let request = {userName: title, userId: id, roomName: group, roomId: room, image: base64};
    fetch(`${WKLI_ENTER}`,{
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body:  JSON.stringify(request)
    }).then().catch(ex => console.log(`Error Send Image:`, ex));
};

export const wkliLeave = (user) => {
    let request = {userId: user.id};
    fetch(`${WKLI_LEAVE}`,{
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body:  JSON.stringify(request)
    }).then().catch(ex => console.log(`Leave User:`, ex));
};

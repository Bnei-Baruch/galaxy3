import {Janus} from "../lib/janus";
import {STUN_SRV_GXY, WKLI_ENTER, WKLI_LEAVE} from "./env";
import api from "./Api";

export const initJanus = (cb, er, server, token = "", iceServers = [{urls: STUN_SRV_GXY}]) => {
  Janus.init({
    debug: process.env.NODE_ENV !== "production" ? ["log", "error"] : ["log", "error"],
    callback: () => {
      let janus = new Janus({
        server: "https://gxydev.kli.one/janusgxy",
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
        },
      });
    },
  });
};

export const notifyMe = (title, message, tout) => {
  if (!!window.Notification) {
    if (Notification.permission !== "granted") Notification.requestPermission();
    else {
      let notification = new Notification(title + ":", {
        icon: "./nlogo.png",
        body: message,
        requireInteraction: tout,
      });
      notification.onclick = function () {
        window.focus();
      };
      notification.onshow = function () {
        var audio = new Audio("./plucky.mp3");
        audio.play();
      };
    }
  }
};

export const randomString = (len) => {
  let charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let randomString = "";
  for (let i = 0; i < len; i++) {
    let randomPoz = Math.floor(Math.random() * charSet.length);
    randomString += charSet.substring(randomPoz, randomPoz + 1);
  }
  return randomString;
};

export const genUUID = () => {
  let dt = new Date().getTime();
  let uuid = "vrtxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    let r = (dt + Math.random() * 16) % 16 | 0;
    dt = Math.floor(dt / 16);
    return (c === "x" ? r : r & (0x3 | 0x8)).toString(16);
  });
  return uuid;
};

export const getHiddenProp = () => {
  var prefixes = ["webkit", "moz", "ms", "o"];
  if ("hidden" in document) return "hidden";
  for (var i = 0; i < prefixes.length; i++) {
    if (prefixes[i] + "Hidden" in document) return prefixes[i] + "Hidden";
  }
  return null;
};

export const getDateString = (jsonDate) => {
  var when = new Date();
  if (jsonDate) {
    when = new Date(Date.parse(jsonDate));
    if (isNaN(when.getTime()) && jsonDate.length > 2) {
      // Fix some edge cases where : missing to be valid ISO 8601 format.
      const len = jsonDate.length;
      when = new Date(Date.parse(`${jsonDate.slice(0, len - 2)}:${jsonDate.slice(len - 2)}`));
    }
  }
  var dateString =
    ("0" + when.getHours()).slice(-2) +
    ":" +
    ("0" + when.getMinutes()).slice(-2) +
    ":" +
    ("0" + when.getSeconds()).slice(-2);
  return dateString;
};

export const micLevel = (stream, canvas, cb, renderType = "old") => {
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

  if (!canvas) return;

  renderType === "old"
    ? renderCanvasOld(canvas, javascriptNode, analyser)
    : renderType === "vertical"
    ? renderVerticalCanvas(canvas, javascriptNode, analyser)
    : renderHorizontalCanvas(canvas, javascriptNode, analyser);
};

const renderHorizontalCanvas = (c, node, analyser) => {
  let cc = c.getContext("2d");
  const w = c.width;
  const h = c.height;
  let gradient = cc.createLinearGradient(0, 0, w, 0);
  gradient.addColorStop(0, "green");
  gradient.addColorStop(0.3, "#80ff00");
  gradient.addColorStop(0.5, "orange");
  gradient.addColorStop(1, "red");

  node.onaudioprocess = function () {
    cc.clearRect(0, 0, w, h);
    var array = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(array);
    var values = 0;

    var length = array.length;
    for (var i = 0; i < length; i++) {
      values += array[i];
    }

    const barWidth = (values / length) * 2.5 - 1;

    cc.fillStyle = gradient;
    cc.fillRect(0, 0, barWidth, h);
  };
};

const renderVerticalCanvas = (canvas, javascriptNode, analyser) => {
  const w = canvas.width;
  const h = canvas.height;
  let canvasContext = canvas.getContext("2d");
  let gradient = canvasContext.createLinearGradient(0, 0, 0, 55);
  gradient.addColorStop(1, "green");
  gradient.addColorStop(0.35, "#80ff00");
  gradient.addColorStop(0.1, "orange");
  gradient.addColorStop(0, "red");

  javascriptNode.onaudioprocess = function () {
    var array = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(array);
    var values = 0;

    var length = array.length;
    for (var i = 0; i < length; i++) {
      values += array[i];
    }

    var average = values / length;

    //          Janus.log(Math.round(average - 40));

    canvasContext.clearRect(0, 0, w, h);
    canvasContext.fillStyle = gradient;
    //canvasContext.fillRect(0, 35-average*mn, 15, 35);
    canvasContext.fillRect(0, w - average, w, h);
  };
};

const renderCanvasOld = (canvas, javascriptNode, analyser) => {
  let canvasContext = canvas.getContext("2d");
  let gradient = canvasContext.createLinearGradient(0, 0, 0, 55);
  gradient.addColorStop(1, "green");
  gradient.addColorStop(0.35, "#80ff00");
  gradient.addColorStop(0.1, "orange");
  gradient.addColorStop(0, "red");

  javascriptNode.onaudioprocess = function () {
    var array = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(array);
    var values = 0;

    var length = array.length;
    for (var i = 0; i < length; i++) {
      values += array[i];
    }

    var average = values / length;

    //          Janus.log(Math.round(average - 40));

    canvasContext.clearRect(0, 0, 15, 35);
    canvasContext.fillStyle = gradient;
    //canvasContext.fillRect(0, 35-average*mn, 15, 35);
    canvasContext.fillRect(0, 35 - average, 15, 35);
  };
};

export const checkNotification = () => {
  if (!!window.Notification && Notification.permission !== "granted") {
    Notification.requestPermission();
  }
};

export const getMediaStream = (audio, video, setting = {width: 320, height: 180, ideal: 15}, audioid, videoid) => {
  const {width, height, ideal} = setting;
  if (video && videoid) {
    video = {width, height, frameRate: {ideal, min: 1}, deviceId: {exact: videoid}};
  } else if (video && !videoid) {
    video = {width, height, frameRate: {ideal, min: 1}};
  }
  audio = audioid ? {noiseSuppression: true, deviceId: {exact: audioid}} : audio;
  return navigator.mediaDevices
    .getUserMedia({audio, video})
    .then((data) => [data, null])
    .catch((error) => Promise.resolve([null, error.name]));
};

export const getMedia = async (media) => {
  const {audio, video} = media;
  let error = null;
  let devices = [];

  //TODO: Translate exceptions - https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#Exceptions

  // Check saved devices in local storage
  let storage_video = localStorage.getItem("video_device");
  let storage_audio = localStorage.getItem("audio_device");
  let storage_setting = JSON.parse(localStorage.getItem("video_setting"));
  video.video_device = !!storage_video ? storage_video : null;
  audio.audio_device = !!storage_audio ? storage_audio : null;
  video.setting = !!storage_setting ? storage_setting : video.setting;
  [video.stream, error] = await getMediaStream(true, true, video.setting, audio.audio_device, video.video_device);

  // Saved devices failed try with default
  if (error === "OverconstrainedError") {
    [video.stream, error] = await getMediaStream(true, true);
  }

  if (error) {
    // Get only audio
    [audio.stream, audio.error] = await getMediaStream(true, false, video.setting, audio.audio_device, null);
    devices = await navigator.mediaDevices.enumerateDevices();
    audio.devices = devices.filter((a) => !!a.deviceId && a.kind === "audioinput");

    // Get only video
    [video.stream, video.error] = await getMediaStream(false, true, video.setting, null, video.video_device);
    devices = await navigator.mediaDevices.enumerateDevices();
    video.devices = devices.filter((v) => !!v.deviceId && v.kind === "videoinput");
  } else {
    devices = await navigator.mediaDevices.enumerateDevices();
    audio.devices = devices.filter((a) => !!a.deviceId && a.kind === "audioinput");
    video.devices = devices.filter((v) => !!v.deviceId && v.kind === "videoinput");
    audio.stream = video.stream;
  }

  if (audio.stream) {
    console.log(audio.stream);
    audio.audio_device = audio.stream.getAudioTracks()[0].getSettings().deviceId;
  } else {
    audio.audio_device = "";
  }

  if (video.stream) {
    video.video_device = video.stream.getVideoTracks()[0].getSettings().deviceId;
  } else {
    video.video_device = "";
  }

  return media;
};

export const geoInfo = (url, cb) =>
  fetch(`${url}`)
    .then((response) => {
      if (response.ok) {
        return response.json().then((data) => cb(data));
      } else {
        cb(false);
      }
    })
    .catch((ex) => console.log(`get geoInfo`, ex));

export const updateGxyUser = (user) => {
  api
    .updateUser(user.id, user)
    .then((data) => {
      if (data.result === "success") {
        console.log("[User] success updating user state", user.id);
      }
    })
    .catch((err) => {
      console.error("[User] error updating user state", user.id, err);
    });
};

export const recordAudio = (stream) =>
  new Promise(async (resolve) => {
    const mediaRecorder = new MediaRecorder(stream);
    const audioChunks = [];

    mediaRecorder.addEventListener("dataavailable", (event) => {
      audioChunks.push(event.data);
    });

    const start = () => mediaRecorder.start();

    const stop = () =>
      new Promise((resolve) => {
        mediaRecorder.addEventListener("stop", () => {
          const audioBlob = new Blob(audioChunks);
          const audioUrl = URL.createObjectURL(audioBlob);
          const audio = new Audio(audioUrl);
          const play = () => audio.play();
          resolve({audioBlob, audioUrl, play});
        });

        mediaRecorder.stop();
      });

    resolve({start, stop});
  });

export const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));

export const testMic = async (stream) => {
  const recorder = await recordAudio(stream);
  recorder.start();
  await sleep(10000);
  const audio = await recorder.stop();
  audio.play();
  await sleep(10000);
};

export const takeImage = (user) => {
  let canvas = document.createElement("canvas");
  let video = document.getElementById("localVideo");
  if (video && video.width > 0) {
    canvas.width = video.width;
    canvas.height = video.height;
    let context = canvas.getContext("2d");
    context.drawImage(video, 0, 0, video.width, video.height);
    let dataUrl = canvas.toDataURL();
    let base64 = dataUrl.split(",")[1];
    wkliEnter(base64, user);
  }
};

const wkliEnter = (base64, user) => {
  const {display, id, group, room} = user;
  let request = {userName: display, userId: id, roomName: group, roomId: room, image: base64};
  fetch(`${WKLI_ENTER}`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(request),
  })
    .then()
    .catch((ex) => console.log(`Error Send Image:`, ex));
};

export const wkliLeave = (user) => {
  let request = {userId: user.id};
  fetch(`${WKLI_LEAVE}`, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(request),
  })
    .then()
    .catch((ex) => console.log(`Leave User:`, ex));
};

//chat tools
export const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;()]*[-A-Z0-9+&@#/%=~_|()])/gi;
export const isRTLChar = /[\u0590-\u07FF\u200F\u202B\u202E\uFB1D-\uFDFD\uFE70-\uFEFC]/;
export const isAscii = /[\x00-\x7F]/;
export const isAsciiChar = /[a-zA-Z]/;

export const isRTLString = (text) => {
  if (typeof text === "undefined") {
    return 0;
  }
  let rtl = 0;
  let ltr = 0;
  for (let i = 0; i < text.length; i++) {
    if (!isAscii.test(text[i]) || isAsciiChar.test(text[i])) {
      if (isRTLChar.test(text[i])) {
        rtl++;
      } else {
        ltr++;
      }
    }
  }
  return rtl > ltr;
};

//import {Janus} from "../lib/janus";
import {STUN_SRV_GXY, WKLI_ENTER, WKLI_LEAVE} from "./env";
import api from "./Api";
import mqtt from "./mqtt";

// export const initJanus = (cb, er, server, token = "", iceServers = [{urls: STUN_SRV_GXY}]) => {
//   Janus.init({
//     debug: process.env.NODE_ENV !== "production" ? ["log", "error"] : ["log", "error"],
//     callback: () => {
//       let janus = new Janus({
//         server,
//         token,
//         iceServers,
//         success: () => {
//           Janus.log(" :: Connected to JANUS");
//           cb(janus);
//         },
//         error: (error) => {
//           Janus.error(error);
//           er(error);
//         },
//         destroyed: () => {
//           Janus.error(" :: Janus destroyed :: ");
//         },
//       });
//     },
//   });
// };

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

export const checkNotification = () => {
  if (!!window.Notification && Notification.permission !== "granted") {
    Notification.requestPermission();
  }
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
  mqtt.send(JSON.stringify(user), false, "gxydb/users")
  // api
  //   .updateUser(user.id, user)
  //   .then((data) => {
  //     if (data.result === "success") {
  //       //console.log("[User] success updating user state", user.id);
  //     }
  //   })
  //   .catch((err) => {
  //     //console.error("[User] error updating user state", user.id, err);
  //   });
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

export const sendUserState = (user) => {
  const {camera, question, rfid, room} = user;
  const msg = {type: "client-state", user: {camera, question, rfid, room}};
  mqtt.send(JSON.stringify(msg), false, "galaxy/room/" + room);
}

export const createContext = (e) => {
  const left = e.clientX
  const top = e.clientY
  const right = left + 1
  const bottom = top + 1

  return {
    getBoundingClientRect: () => ({
      left,
      top,
      right,
      bottom,

      height: 0,
      width: 0,
    }),
  }
}

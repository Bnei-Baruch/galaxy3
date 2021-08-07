import ReconnectingWebSocket from "reconnectingwebsocket";
import {WEB_SOCKET_WORKSHOP_QUESTION} from "../../../shared/env";
import {MSGS_TYPES} from "./MessageManager";
import mqtt from "../../../shared/mqtt";
import kc from "../../../components/UserManager";

let currentMqttLang;
export const initWQ = (onMessage) => {
  const ws = new ReconnectingWebSocket(WEB_SOCKET_WORKSHOP_QUESTION);
  ws.onmessage = ({data}) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch (e) {
      msg = buildClear();
    }

    const {questions} = msg;
    if (questions) {
      questions.map((q) => wsToMsgAdapter(q)).forEach(onMessage);
      return;
    }

    if (msg.clear || msg.questions === null) msg = buildClear();
    onMessage(wsToMsgAdapter(msg));
  };

  return new Promise((res, rej) => {
    ws.onopen = (r) => res();
  });
};

export const initSubtitle = (lang, onMessage, attempts = 0) => {
  if (!lang) return;

  if (!mqtt.mq) {
    if (attempts > 0) return;
    const {
      sessionId: id,
      tokenParsed: {email},
      idToken: token,
    } = kc;
    mqtt.setToken(token);
    return mqtt.init(
      {id, email},
      () => {
        mqtt.watch((msg) => console.log("[mqtt] Message for not gxy user: ", msg));
        initSubtitle(lang, onMessage, ++attempts);
      },
      true
    );
  }

  currentMqttLang && mqtt.exit("subtitles/galaxy/" + currentMqttLang);
  currentMqttLang = lang;
  mqtt.join("subtitles/galaxy/" + lang);

  mqtt.mq.on("MqttSubtitlesEvent", (json) => {
    let msg = JSON.parse(json);
    if (msg.message === "on_air") return;
    console.log("[mqtt] MqttSubtitlesEvent subtitle mqtt listener ", msg);
    if (msg.message === "clear") msg = buildClear();
    onMessage(mqttToMsgAdapter(msg));
  });
};

const mqttToMsgAdapter = ({message, language}) => {
  return {
    message: message?.content ? message.content : message,
    type: MSGS_TYPES.subtitle,
    date: Date.now(),
    language,
  };
};

const wsToMsgAdapter = ({message, language}) => {
  return {message, type: MSGS_TYPES.workshop, date: Date.now(), language};
};

const buildClear = (language = "all") => {
  return {message: "clear", language};
};

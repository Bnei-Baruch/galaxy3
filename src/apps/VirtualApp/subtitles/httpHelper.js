import ReconnectingWebSocket from 'reconnectingwebsocket';
import { WEB_SOCKET_WORKSHOP_QUESTION } from '../../../shared/env';
import { MSGS_TYPES } from './MessageManager';
import mqtt from '../../../shared/mqtt';

let currentMqttLang;
export const initWQ = (onMessage) => {
  const ws     = new ReconnectingWebSocket(WEB_SOCKET_WORKSHOP_QUESTION);
  ws.onmessage = ({ data }) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch (e) {
      msg = buildClear();
    }

    const { questions } = msg;
    if (questions) {
      questions
        .map(q => wsToMsgAdapter(q))
        .forEach(onMessage);
      return;
    }

    if (msg.clear || msg.questions === null)
      msg = buildClear();
    onMessage(wsToMsgAdapter(msg));
  };

  return new Promise((res, rej) => {
    ws.onopen = (r) => res();
  });
};

export const initSubtitle = (lang, onMessage) => {
  if (!lang)
    return;

  currentMqttLang && mqtt.exit('subtitles/galaxy/' + currentMqttLang);
  mqtt.join('subtitles/galaxy/' + lang);
  currentMqttLang = lang;
  mqtt.mq.on('MqttSubtitlesEvent', (json) => {
    let msg = JSON.parse(json);
    if (msg.message === 'on_air')
      return;
    console.log('[mqtt] MqttSubtitlesEvent subtitle mqtt listener ', msg);
    if (msg.message === 'clear')
      msg = buildClear();
    onMessage(mqttToMsgAdapter(msg));
  });
};

const mqttToMsgAdapter = ({ message, language }) => {
  return {
    message: message?.content ? message.content : message,
    type: MSGS_TYPES.subtitle,
    date: Date.now(),
    language
  };
};

const wsToMsgAdapter = ({ message, language }) => {
  return { message, type: MSGS_TYPES.workshop, date: Date.now(), language };
};

const buildClear = (language = 'all') => {
  return { message: 'clear', language };
};

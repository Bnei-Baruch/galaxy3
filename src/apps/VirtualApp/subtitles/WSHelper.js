import ReconnectingWebSocket from 'reconnectingwebsocket';
import { WEB_SOCKET_WORKSHOP_QUESTION } from '../../../shared/env';
import { MSGS_TYPES } from './MessagesForShowStack';

export const initWS = async (onMessage) => {
  const ws     = new ReconnectingWebSocket(WEB_SOCKET_WORKSHOP_QUESTION);
  ws.onmessage = (json) => {
    let msg = JSON.parse(json);
    if (msg.clear)
      msg = {};
    onMessage(wsMsgAdapter(msg));
  };

  return new Promise((res, rej) => {
    ws.onopen = (json) => {
      const { questions } = JSON.parse(json);
      if (!questions) {
        return res([buildClear()]);
      }
      return questions.map(q => wsMsgAdapter(q));
    };
  });
};

const wsMsgAdapter = ({ message, language }) => {
  return { message, type: MSGS_TYPES.workshop, date: Date.now(), language };
};

const buildClear = (language = 'all') => {
  return wsMsgAdapter({ message: 'clear', language });
};

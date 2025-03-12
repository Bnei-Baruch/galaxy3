import markdownit from "markdown-it";
import {getUserRole} from "../../../shared/enums";
import mqtt from "../../../shared/mqtt";
import kc from "../../../components/UserManager";

export const MSGS_QUESTION = {type: "question", display_status: "questions", topic: "question"};
export const MSGS_SUBTITLE = {type: "subtitle", display_status: "subtitles", topic: "slide"}
export const MSGS_NONE = {type: "none", display_status: "none"}

const msgByType = [MSGS_SUBTITLE, MSGS_QUESTION, MSGS_NONE].reduce((acc, d) => {
  acc[d.type] = d;
  return acc;
}, {})

const md = markdownit({html: true})
const TOPIC = "subtitles/morning_lesson/";

export const initMqtt = () => {
  return new Promise((resolve, reject) => {
    const role = getUserRole();
    if (!role)
      reject();

    if (mqtt.mq)
      return resolve();

    const {sessionId: id, tokenParsed: {email}, idToken: token,} = kc;
    mqtt.setToken(token);
    return mqtt.init(
      {id, email, role},
      () => {
        mqtt.watch((msg) => console.log("[mqtt] Message for not gxy user: ", msg));
        return resolve();
      },
      true
    );
  })
}


export class MessageManager {
  wqMsg = {};
  subMsg = {};
  subLang;
  wqlang;

  async init(subLang, wqlang, onMessage) {
    try {
      await initMqtt()
    } catch (e) {
      console.log(e)
      return;
    }
    this.subLang = subLang;
    this.wqlang = wqlang;

    mqtt.join(`${TOPIC}${subLang}/${MSGS_SUBTITLE.topic}`);
    mqtt.join(`${TOPIC}${wqlang}/${MSGS_QUESTION.topic}`);

    mqtt.mq.on("MqttSubtitlesEvent", ({data, language, target: topic}) => {
      let msg = JSON.parse(data);
      console.log("[mqtt] MqttSubtitlesEvent subtitle mqtt listener ", msg);

      const info = msgByType[msg.type];
      if (info.topic !== topic && info.type !== MSGS_NONE.type)
        return;

      if (info.type === MSGS_NONE.type) {
        this.clearByTopic(topic);
      } else if (msg.display_status !== msgByType[msg.type]?.display_status) {
        this.clearByTopic(topic);
      } else {
        this.push(msg, language)
      }
      onMessage(this.getCurrentMessage());
    });
  }

  exit() {
    mqtt.exit(`${TOPIC}${this.subLang}/${MSGS_SUBTITLE.topic}`);
    mqtt.exit(`${TOPIC}${this.wqlang}/${MSGS_QUESTION.topic}`);
    mqtt.mq.removeAllListeners("MqttSubtitlesEvent")
  };

  push(msg, language) {
    const _msg = {...msg, language, message: md.render(msg.slide)}
    switch (msg.type) {
      case MSGS_SUBTITLE.type:
        this.subMsg = _msg;
        this.subLang = language;
        break;
      case MSGS_QUESTION.type:
        this.wqMsg = _msg
        this.wqlang = language;
        break;
    }
  }


  switchWqLang(lang) {
    mqtt.exit(`${TOPIC}${this.wqlang}/${MSGS_QUESTION.topic}`);
    this.wqlang = lang;
    mqtt.join(`${TOPIC}${lang}/${MSGS_QUESTION.topic}`);
  }

  clearByTopic(topic) {
    switch (topic) {
      case MSGS_SUBTITLE.topic:
        this.subMsg = {};
        break;
      case MSGS_QUESTION.topic:
        this.wqMsg = {};
        break;
    }
  }

  getCurrentMessage() {
    return [this.subMsg, this.wqMsg]
      .filter(x => x.type && (x.type !== 'none'))
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0]
  }
}

export const messageManager = new MessageManager();

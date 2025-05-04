import markdownit from "markdown-it";
import {getUserRole} from "../../../shared/enums";
import mqtt from "../../../shared/mqtt";
import kc from "../../../components/UserManager";

export const MSGS_QUESTION = {type: "question", display_status: "questions", topic: "question"};
export const MSGS_SUBTITLE = {type: "subtitle", display_status: "subtitles", topic: "slide"}
export const MSGS_NONE = {type: "none", display_status: "none"}

const MAIN_LANGS = ["en", "he", "ru"]

const MSGS_ALL = [MSGS_SUBTITLE, MSGS_QUESTION, MSGS_NONE];

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
  async init(subLang, wqLang, onMessage) {
    try {
      await initMqtt()
    } catch (e) {
      console.log(e)
      return;
    }

    this.onMessage = onMessage;

    this.wqLangs = [];
    this.wqMsgByLang = {};
    this.wqLang = wqLang;
    this.wqLangSel = wqLang;

    this.subMsg = {};
    this.subLang = subLang;

    mqtt.join(`${TOPIC}${subLang}/${MSGS_SUBTITLE.topic}`);
    mqtt.join(`${TOPIC}+/${MSGS_QUESTION.topic}`);

    mqtt.mq.on("MqttSubtitlesEvent", ({data, language, target: topic}) => {
      let msg = JSON.parse(data);

      const infoByType = MSGS_ALL.find(m => m.type === msg.type);
      if (msg.type !== MSGS_NONE.type && infoByType?.topic !== topic)
        return;

      if (
        msg.display_status === MSGS_NONE.display_status 
        || msg.display_status !== infoByType?.display_status
        || (!msg.visible && msg.type === MSGS_QUESTION.type)
      ) {
        this.clearByTopic(topic, language);
      } else {
        this.push(msg, language)
      }
      onMessage(this.getCurrentState());
    });
    onMessage(this.getCurrentState());
  }

  exit() {
    mqtt.exit(`${TOPIC}${this.subLang}/${MSGS_SUBTITLE.topic}`);
    mqtt.exit(`${TOPIC}+/${MSGS_QUESTION.topic}`);
    mqtt.mq.removeAllListeners("MqttSubtitlesEvent")
  };

  push(msg, language) {
    const _msg = {...msg, message: md.render(msg.slide)}
    switch (msg.type) {
      case MSGS_SUBTITLE.type:
        this.subMsg = _msg;
        break;
      case MSGS_QUESTION.type:
        this.wqLangs = [...this.wqLangs.filter(l => l !== language), language]
        this.wqMsgByLang[language] = _msg;
        break;
    }
  }

  clearByTopic(topic, language) {
    switch (topic) {
      case MSGS_SUBTITLE.topic:
        this.subMsg = {};
        break;
      case MSGS_QUESTION.topic:
        this.wqLangs = this.wqLangs.filter(l => l !== language);
        this.wqMsgByLang[language] = null
        break;
    }
  }

  getCurrentState() {
    const msg = this.getCurrentMsg()

    const resp = {msg, display_status: MSGS_NONE.display_status, wqLangs: this.wqLangs}
    if (!msg) {
      if (this.wqLangs.some(l => MAIN_LANGS.includes(l))) {
        resp.display_status = MSGS_QUESTION.display_status
        return resp
      }

      resp.display_status = MSGS_NONE.display_status
      return resp
    }

    if (msg.type === MSGS_SUBTITLE.type) {
      resp.display_status = MSGS_SUBTITLE.display_status
    } else {
      resp.display_status = MSGS_QUESTION.display_status;
    }
    return resp


  }

  getCurrentMsg() {
    const wqMsg = this.wqMsgByLang[this.wqLangSel] || this.wqMsgByLang[this.wqLang] || {};
    return [wqMsg, this.subMsg]
      .filter(x => x.type && (x.type !== 'none'))
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0]
  }

  switchWqLang(l) {
    this.wqLangSel = l
    this.onMessage(this.getCurrentState())
  }
}

export const messageManager = new MessageManager();

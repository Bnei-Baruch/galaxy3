import mqtt from "../../../shared/mqtt";
import kc from "../../../components/UserManager";
import {getUserRole} from "../../../shared/enums";
import markdownit from 'markdown-it'

const md = markdownit({html: true})
const TOPIC = "subtitles/morning_lesson/";

export const initSubtitle = (lang, onMessage, attempts = 0) => {
  if (!lang) return;

  const role = getUserRole();
  if (!role) return;

  if (!mqtt.mq) {
    if (attempts > 0) return;
    const {
      sessionId: id,
      tokenParsed: {email},
      idToken: token,
    } = kc;
    mqtt.setToken(token);
    return mqtt.init(
      {id, email, role},
      () => {
        mqtt.watch((msg) => console.log("[mqtt] Message for not gxy user: ", msg));
        initSubtitle(lang, onMessage, ++attempts);
      },
      true
    );
  }

  mqtt.join(`${TOPIC}${lang}/slide`);
  mqtt.join(`${TOPIC}+/question`);

  mqtt.mq.on("MqttSubtitlesEvent", ({data, lang, target}) => {
    let msg = JSON.parse(data);
    console.log("[mqtt] MqttSubtitlesEvent subtitle mqtt listener ", msg);
    if (msg.type === "none" || !msg.slide)
      msg = buildClear();
    onMessage(mqttToMsgAdapter({...msg, lang}));
  });
};

export const exitSubtitle = lang => {
  if (!lang) return;

  mqtt.exit(`${TOPIC}${lang}/slide`);
  mqtt.exit(`${TOPIC}+/question`);
  mqtt.mq.removeAllListeners("MqttSubtitlesEvent")
};

const mqttToMsgAdapter = ({slide, lang, type, date, visible}) => {
  return {
    message: slide && md.render(slide),
    type: type,
    date,
    language: lang,
    visible
  };
};

const buildClear = (language = "all") => {
  return {message: "clear", language, visible: false};
};

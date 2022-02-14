import mqtt from "mqtt";
import {MQTT_URL, MSG_URL} from "./env";
import {isServiceID} from "./enums";
import {randomString} from "./tools";
import GxyJanus from "./janus-utils";
import log from "loglevel";
import chalk from 'chalk';

class MqttMsg {
  constructor() {
    this.user = null;
    this.mq = null;
    this.mit = null;
    this.connected = false;
    this.room = null;
    this.token = null;
    this.reconnect_count = 0;
  }

  init = (user, callback) => {
    this.user = user;

    const RC = 30;
    const service = isServiceID(user.id);
    const svc_token = GxyJanus?.globalConfig?.dynamic_config?.mqtt_auth;
    const token = service ? svc_token : this.token;
    const id = service ? user.id : user.id + "-" + randomString(3);

    const transformUrl = (url, options, client) => {
      client.options.clientId = service ? user.id : user.id + "-" + randomString(3);
      client.options.password = service ? svc_token : this.token;
      return url;
    };

    let options = {
      keepalive: 10,
      connectTimeout: 10 * 1000,
      clientId: id,
      protocolId: "MQTT",
      protocolVersion: 5,
      clean: true,
      username: user.email,
      password: token,
      transformWsUrl: transformUrl,
      properties: {
        sessionExpiryInterval: 5,
        maximumPacketSize: 256000,
        requestResponseInformation: true,
        requestProblemInformation: true,
      },
    };

    if (service) {
      options.will = {
        qos: 2,
        retain: true,
        topic: "galaxy/service/" + user.role,
        payload: JSON.stringify({type: "event", [user.role]: false}),
        properties: {userProperties: user},
      };
    }

    const url = !user.role.match(/^(user|admin|root)$/) && !service ? MQTT_URL : MSG_URL;
    this.mq = mqtt.connect(`wss://${url}`, options);
    this.mq.setMaxListeners(50)

    this.mq.on("connect", (data) => {
      if (data && !this.connected) {
        log.info('[mqtt] Connected to server: ', data);
        this.connected = true;
        callback(false, false);
      } else {
        log.info("[mqtt] Connected: ", data);
        if(this.reconnect_count > RC) {
          callback(true, false);
        }
        this.reconnect_count = 0;
      }
    });

    this.mq.on("close", (data) => {
      if(this.reconnect_count < RC + 2) {
        this.reconnect_count++;
      }
      if(this.reconnect_count === RC) {
        this.reconnect_count++;
        log.warn("[mqtt] Notify: ", data)
        callback(false, true);
      }
    });
  };

  join = (topic, chat) => {
    if (!this.mq) return;
    log.info("[mqtt] Subscribe to: ", topic);
    let options = chat ? {qos: 0, nl: false} : {qos: 1, nl: true};
    this.mq.subscribe(topic, {...options}, (err) => {
      err && log.error("[mqtt] Error: ", err);
    });
  };

  exit = (topic) => {
    if (!this.mq) return;
    let options = {};
    log.info("[mqtt] Unsubscribe from: ", topic);
    this.mq.unsubscribe(topic, {...options}, (err) => {
      err && log.error("[mqtt] Error: ", err);
    });
  };

  send = (message, retain, topic, rxTopic, user) => {
    if (!this.mq) return;
    log.info("[mqtt] Send data on topic: ", topic, message);
    let properties = !!rxTopic ? {userProperties: user || this.user, responseTopic: rxTopic} : {userProperties: user || this.user};
    let options = {qos: 1, retain, properties};
    this.mq.publish(topic, message, {...options}, (err) => {
      err && log.error("[mqtt] Error: ", err);
    });
  };

  watch = (callback) => {
    this.mq.on("message", (topic, data, packet) => {
      log.debug(chalk.green("[mqtt] trigger topic : ") + topic + " : packet:", packet);
      const t = topic.split("/")
      if(t[0] === "msg") t.shift()
      const [root, service, id, target] = t
      switch(root) {
        case "subtitles":
          this.mq.emit("MqttSubtitlesEvent", data);
          break;
        case "galaxy":
          // FIXME: we need send cmd messages to separate topic
          if(service === "room" && target === "chat")
            this.mq.emit("MqttChatEvent", data);
          else if (service === "room" && target !== "chat" || service === "service")
            callback(JSON.parse(data.toString()), topic);
          else if (service === "users" && id === "broadcast")
            this.mq.emit("MqttBroadcastMessage", data);
          else
            this.mq.emit("MqttPrivateMessage", data);
          break;
        case "janus":
          const json = JSON.parse(data)
          const mit = json?.session_id || packet?.properties?.userProperties?.mit || service
          this.mq.emit(mit, data, id);
          break;
        default:
          if(typeof callback === "function")
            callback(JSON.parse(data.toString()), topic);
      }
    });
  };

  setToken = (token) => {
    this.token = token;
  };

}

const defaultMqtt = new MqttMsg();

export default defaultMqtt;

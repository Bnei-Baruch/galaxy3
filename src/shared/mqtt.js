import mqtt from "mqtt";
import {MQTT_URL, MSG_URL} from "./env";
import {isServiceID} from "./enums";
import {randomString} from "./tools";
import GxyJanus from "./janus-utils";

class MqttMsg {
  constructor() {
    this.user = null;
    this.mq = null;
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
        maximumPacketSize: 10000,
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

    this.mq.on("connect", (data) => {
      if (data && !this.connected) {
        console.log("[mqtt] Connected to server: ", data);
        this.connected = true;
        callback(false, false);
      } else {
        console.log("[mqtt] Connected: ", data);
        if (this.reconnect_count > RC) {
          callback(true, false);
        }
        this.reconnect_count = 0;
      }
    });

    this.mq.on("close", (data) => {
      if (this.reconnect_count < RC + 2) {
        this.reconnect_count++;
      }
      if (this.reconnect_count === RC) {
        this.reconnect_count++;
        console.warn("[mqtt] Notify: ", data);
        callback(false, true);
      }
    });
  };

  join = (topic, chat) => {
    if (!this.mq) return;
    console.log("[mqtt] Subscribe to: ", topic);
    let options = chat ? {qos: 0, nl: false} : {qos: 1, nl: true};
    this.mq.subscribe(topic, {...options}, (err) => {
      err && console.error("[mqtt] Error: ", err);
    });
  };

  exit = (topic) => {
    if (!this.mq) return;
    let options = {};
    console.log("[mqtt] Unsubscribe from: ", topic);
    this.mq.unsubscribe(topic, {...options}, (err) => {
      err && console.error("[mqtt] Error: ", err);
    });
  };

  send = (message, retain, topic) => {
    if (!this.mq) return;
    console.log("[mqtt] Send data on topic: ", topic, message);
    let options = {
      qos: 1,
      retain,
      properties: {
        userProperties: this.user,
        responseTopic: "gxy/from-janus/" + this.user.id,
      },
    };
    this.mq.publish(topic, message, {...options}, (err) => {
      err && console.error("[mqtt] Error: ", err);
    });
  };

  watch = (callback, stat) => {
    let message;
    this.mq.on("message", (topic, data, packet) => {
      console.debug("[mqtt] Got data on topic: ", topic, JSON.parse(data.toString()), packet);
      if (/subtitles\/galaxy\//.test(topic)) {
        this.mq.emit("MqttSubtitlesEvent", data);
      } else if (/galaxy\/room\/\d+\/chat/.test(topic)) {
        this.mq.emit("MqttChatEvent", data);
      } else if (topic.split("/")[1] === "from-janus" && topic.split("/")[2]) {
        this.mq.emit("MqttJanusMessage", data);
      } else if (topic.split("/")[1] === "from-janus" && !topic.split("/")[2]) {
        this.mq.emit("MqttJanusEvent", data);
      } else if (/galaxy\/users\//.test(topic)) {
        if (topic.split("/")[2] === "broadcast") {
          this.mq.emit("MqttBroadcastMessage", data);
        } else {
          this.mq.emit("MqttPrivateMessage", data);
        }
      } else {
        if (stat) {
          message = data.toString();
        } else {
          try {
            message = JSON.parse(data.toString());
          } catch (e) {
            console.error(e);
            console.error("[mqtt] Not valid JSON, ", data.toString());
            return;
          }
        }
        console.log("[mqtt] Got data on topic: ", topic, message);
        callback(message, topic);
      }
    });
  };

  setToken = (token) => {
    this.token = token;
  };
}

const defaultMqtt = new MqttMsg();

export default defaultMqtt;

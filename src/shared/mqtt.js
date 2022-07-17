import mqtt from "mqtt";
import {MQTT_URL, MSG_URL} from "./env";
import {isServiceID} from "./enums";
import {randomString} from "./tools";
import GxyJanus from "./janus-utils";
import log from "loglevel";
import {captureMessage} from "./sentry";

const mqttTimeout = 30 // Seconds
const mqttKeepalive = 3 // Seconds

class MqttMsg {
  constructor() {
    this.user = null;
    this.mq = null;
    this.mit = null;
    this.isConnected = false;
    this.room = null;
    this.token = null;
    this.reconnect_count = 0;
  }

  init = (user, callback) => {
    this.user = user;
    const RC = mqttTimeout;
    const service = isServiceID(user);
    const svc_token = GxyJanus?.globalConfig?.dynamic_config?.mqtt_auth;
    const token = service ? svc_token : this.token;
    const id = service ? user.id : user.id + "-" + randomString(3);

    const transformUrl = (url, options, client) => {
      client.options.clientId = service ? user.id : user.id + "-" + randomString(3);
      client.options.password = service ? svc_token : this.token;
      return url;
    };

    let options = {
      keepalive: mqttKeepalive,
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

    this.mq = mqtt.connect(`wss://${MSG_URL}`, options);
    this.mq.setMaxListeners(50)

    this.mq.on("connect", (data) => {
      if (data && !this.isConnected) {
        log.info('[mqtt] Connected to server: ', data);
        this.isConnected = true;
        if(typeof callback === "function") callback(false, false);
      } else {
        log.info("[mqtt] Connected: ", data);
        this.isConnected = true;
        if(this.reconnect_count > RC) {
          if(typeof callback === "function") callback(true, false);
        }
        this.reconnect_count = 0;
      }
    });

    this.mq.on("close", () => {
      if(this.reconnect_count < RC + 2) {
        this.reconnect_count++;
        log.debug("[mqtt] reconnecting counter: " + this.reconnect_count)
      }
      if(this.reconnect_count === RC) {
        this.reconnect_count++;
        log.warn("[mqtt] - disconnected - after: " + this.reconnect_count + " seconds")
        if(typeof callback === "function") callback(false, true);
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
    let correlationData = JSON.parse(message)?.transaction
    let cd = correlationData ? " | transaction: " + correlationData : ""
    log.debug("%c[mqtt] --> send message" + cd + " | topic: " + topic + " | data: " + message, "color: darkgrey");
    let properties = !!rxTopic ? {userProperties: user || this.user, responseTopic: rxTopic, correlationData} : {userProperties: user || this.user};
    let options = {qos: 1, retain, properties};
    this.mq.publish(topic, message, {...options}, (err) => {
      err && log.error("[mqtt] Error: ", err);
    });
  };

  watch = (callback) => {
    this.mq.on("message", (topic, data, packet) => {
      log.trace("[mqtt] <-- receive packet: ", packet)
      let cd = packet?.properties?.correlationData ? " | transaction: " + packet?.properties?.correlationData?.toString() : ""
      log.debug("%c[mqtt] <-- receive message" + cd + " | topic : " + topic, "color: darkgrey");
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
          else if (service === "room" && target !== "chat" || service === "service" && id !== "user") {
            try {
              let msg = JSON.parse(data.toString());
              callback(msg, topic);
            } catch (e) {
              log.error(e);
              log.error("[mqtt] Not valid JSON, ", data.toString());
              captureMessage(data.toString(), {source: "mqtt"});
              return;
            }
          }
          else if (service === "users" && id === "broadcast")
            this.mq.emit("MqttBroadcastMessage", data);
          else
            this.mq.emit("MqttPrivateMessage", data);
          break;
        case "janus":
          const json = JSON.parse(data)
          const mit = json?.session_id || packet?.properties?.userProperties?.mit || service
          //console.log(this.mq.listeners(mit).length);
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

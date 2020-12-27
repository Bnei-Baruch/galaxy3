import mqtt from 'mqtt';
import {MQTT_URL} from "./env";
import {isServiceID} from "./enums";
import {randomString} from "./tools";
import ConfigStore from "./ConfigStore";

class MqttMsg {

  constructor() {
    this.user = null;
    this.mq = null;
    this.connected = false;
    this.room = null;
  }

  init = (user, callback) => {
    this.user = user;

    const id = user.role === "user" ? user.id + "-" + randomString(3) : user.id;

    let options = {
      keepalive: 10,
      connectTimeout: 10 * 1000,
      clientId: id,
      protocolId: 'MQTT',
      protocolVersion: 5,
      clean: true,
      username: user.email,
      password: ConfigStore.dynamicConfig("mqtt_auth"),
      properties: {
        sessionExpiryInterval: 5,
        maximumPacketSize: 10000,
        requestResponseInformation: true,
        requestProblemInformation: true,
      }
    };

    if(isServiceID(user.id)) {
      options.will = {
        qos: 2,
        retain: true,
        topic: 'galaxy/service/' + user.role,
        payload: JSON.stringify({type: "event", [user.role]: false}),
        properties: {userProperties: user}}
    }

    console.log("[mqtt] Options: ", options)

    const mq = mqtt.connect(`wss://${MQTT_URL}`, options);
    this.mq = mq;

    mq.on('connect', (data) => {
      if(data && !this.connected) {
        console.log("[mqtt] Connected to server: ", data);
        this.connected = true;
        callback(data)
      }
    });

    mq.on('error', (data) => console.error('[mqtt] Error: ', data));
    mq.on('disconnect', (data) => console.error('[mqtt] Error: ', data));
  }

  join = (topic) => {
    console.log("[mqtt] Subscribe to: ", topic)
    let options = {qos: 2, nl: true}
    this.mq.subscribe(topic, {...options}, (err) => {
      err && console.error('[mqtt] Error: ', err);
    })
  }

  exit = (topic) => {
    let options = {}
    console.log("[mqtt] Unsubscribe from: ", topic)
    this.mq.unsubscribe(topic, {...options} ,(err) => {
      err && console.error('[mqtt] Error: ',err);
    })
  }

  send = (message, retain, topic) => {
    console.log("[mqtt] Send data on topic: ", topic, message)
    let options = {qos: 2, retain, properties: {messageExpiryInterval: 0, userProperties: this.user}};
    this.mq.publish(topic, message, {...options}, (err) => {
      err && console.error('[mqtt] Error: ',err);
    })
  }

  watch = (callback, stat) => {
    this.mq.on('message',  (topic, data, packet) => {
      let message = stat ? data.toString() : JSON.parse(data.toString());
      console.log("[mqtt] Got data on topic: ", topic, message);
      callback(message, topic)
    })
  }

}

const defaultMqtt = new MqttMsg();

export default defaultMqtt;




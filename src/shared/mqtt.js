import mqtt from 'mqtt';
import {MQTT_URL} from "./env";

class MqttMsg {

  constructor() {
    this.user = null;
    this.mq = null;
    this.connected = false;
    this.room = null;
  }

  init = (user, callback) => {
    this.user = user;

    let options = {
      keepalive: 10,
      connectTimeout: 10 * 1000,
      clientId: this.user.id,
      protocolId: 'MQTT',
      protocolVersion: 5,
      clean: true,
      properties: {
        sessionExpiryInterval: 5,
        maximumPacketSize: 10000,
        requestResponseInformation: true,
        requestProblemInformation: true,
      }
    };

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
      callback(message)
    })
  }

}

const defaultMqtt = new MqttMsg();

export default defaultMqtt;




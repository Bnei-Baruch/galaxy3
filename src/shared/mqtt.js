import mqtt from 'mqtt';
import {MQTT_URL} from "./env";

class MqttMsg {

  constructor() {
    this.user = null;
    this.mq = null;
    this.topic = 'galaxy/test';
    this.connected = false;
  }

  init = (user, callback) => {
    this.user = user;

    let options = {
      keepalive: 10,
      connectTimeout: 10 * 1000,
      clientId: this.user.id,
      protocolId: 'MQTT',
      protocolVersion: 5,
      clean: false,
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
        mq.subscribe(this.topic, {qos: 2}, (err) => {
          callback(data)
          this.connected = true;
          err && console.error(err);
        })
      }
    });

    mq.on('error', (data) => console.error(data));
    mq.on('disconnect', (data) => console.error(data));
  }

  send = (message) => {
    let properties = {messageExpiryInterval: 3, userProperties: this.user};
    this.mq.publish(this.topic, message, {qos: 2, properties}, (err) => {
      err && console.error(err);
    })
  }

  watch = (callback) => {
    this.mq.on('message',  (topic, data, packet) => {
      // packet.payload = packet.payload.toString();
      // callback(packet);
      let message = JSON.parse(data.toString());
      callback(message)
    })
  }

}

const defaultMqtt = new MqttMsg();

export default defaultMqtt;




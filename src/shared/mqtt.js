import mqtt from 'mqtt';
import {MQTT_URL} from "./env";

class MqttMsg {

  constructor() {
    this.user = null;
    this.mq = null;
    this.topic = 'galaxy/room'; //TODO: take it from argument
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
        this.connected = true;
        callback(data)
      }
    });

    mq.on('error', (data) => console.error(data));
    mq.on('disconnect', (data) => console.error(data));
  }

  join = (room, topic) => {
    this.room = room;
    let options = {qos: 2, nl: true}
    this.mq.subscribe(topic || this.topic + '/' + room, {...options}, (err) => {
      err && console.error(err);
    })
  }

  exit = (room, topic) => {
    this.room = room;
    let options = {}
    this.mq.unsubscribe(topic || this.topic + '/' + room, {...options} ,(err) => {
      err && console.error(err);
    })
  }

  send = (message, retain, topic) => {
    console.log("SENDING: ", message)
    let options = {qos: 2, retain, properties: {messageExpiryInterval: 0, userProperties: this.user}};
    this.mq.publish(topic, message, {...options}, (err) => {
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




import mqtt from 'mqtt';
import {MQTT_URL} from "./env";

class MqttMsg {

  constructor() {
    this.user = null;
    this.mq = null;
    this.topic = 'galaxy/user';
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
        this.connected = true;
        callback(data)
      }
    });

    mq.on('error', (data) => console.error(data));
    mq.on('disconnect', (data) => console.error(data));
  }

  join = (room, callback) => {
    this.room = room;
    this.mq.subscribe(this.topic + '/' + room, {qos: 2}, (err) => {
      err && console.error(err);
    })
    callback();
  }

  send = (message) => {
    console.log("SENDING: ", message)
    let properties = {messageExpiryInterval: 3, userProperties: this.user};
    this.mq.publish(this.topic + '/' + this.room, message, {qos: 2, properties}, (err) => {
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




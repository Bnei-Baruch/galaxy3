import mqtt from 'mqtt';
import {MQTT_URL} from "./env";


export const mqttInit = (user) => {

  let options = {
    keepalive: 10,
    connectTimeout: 10 * 1000,
    clientId: user.id,
    protocolId: 'MQTT',
    protocolVersion: 5,
    clean: false,
    properties: {
      sessionExpiryInterval: 5,
      maximumPacketSize: 10000,
      requestResponseInformation: true,
      requestProblemInformation: true,
      userProperties: {
        'test': 'test'
      },
    }
  };

  const mq = mqtt.connect(`wss://${MQTT_URL}`, options);
  mq.subscribe('galaxy/test', {qos: 2}, (err) => {
    err && console.error(err);
  });

  mq.on('message',  (topic, data, packet) => {
    packet.payload = packet.payload.toString();
    console.log(packet);
    let message = JSON.parse(data.toString());
    console.log(message);
  })

  setTimeout(() => {
    let message = JSON.stringify(user);
    mq.publish('galaxy/test', message, {qos: 2, properties: {messageExpiryInterval: 3, userProperties: user}}, (err) => {
      err && console.error(err);
    })
  }, 3000)

  return mq;
};



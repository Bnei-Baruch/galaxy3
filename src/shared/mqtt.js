import mqtt from 'mqtt';
import {MQTT_URL} from "./env";


export const mqttInit = (user) => {

  let options = {
    protocol: 'wss',
    clientId: user.id
  };

  const mq = mqtt.connect(`wss://${MQTT_URL}`, options);
  mq.subscribe('galaxy/test', {qos: 2}, (err) => {
    err && console.error(err);
  });

  mq.on('message',  (topic, data) => {
    let message = JSON.parse(data.toString());
    console.log(message);
  })

  setTimeout(() => {
    let message = JSON.stringify(user);
    mq.publish('galaxy/test', message, {qos: 2}, (err) => {
      err && console.error(err);
    })
  }, 3000)

  return mq;
};



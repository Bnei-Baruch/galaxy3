import mqtt from 'mqtt';
import {MQTT_URL} from "./env";


export const mqttInit = (id) => {

  let options = {
    protocol: 'mqtt',
    clientId: id
  };

  const client  = mqtt.connect(`mqtt://${MQTT_URL}`, options);
  client.subscribe('galaxy');

  client.on('message',  (topic, message) => {
    let note = message.toString();
    console.log(note);
    //client.end();
  })

  setTimeout(() => {
    client.publish('galaxy', 'Hello mqtt')
  }, 3000)

};


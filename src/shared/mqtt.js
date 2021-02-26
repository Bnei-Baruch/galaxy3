import mqtt from 'mqtt';
import { MQTT_URL } from './env';
import { isServiceID } from './enums';
import { randomString } from './tools';
import GxyJanus from './janus-utils';

class MqttMsg {

  constructor() {
    this.user      = null;
    this.mq        = null;
    this.connected = false;
    this.room      = null;
    this.token     = null;
  }

  init = (user, callback) => {
    this.user = user;

    const id = user.role === 'user' ? user.id + '-' + randomString(3) : user.id;

    const transformUrl = (url, options, client) => {
      client.options.password = this.token;
      return url;
    };

    let options = {
      keepalive: 10,
      connectTimeout: 10 * 1000,
      clientId: id,
      protocolId: 'MQTT',
      protocolVersion: 5,
      clean: true,
      username: user.email,
      password: this.token || GxyJanus.globalConfig.dynamic_config.mqtt_auth,
      transformWsUrl: transformUrl,
      properties: {
        sessionExpiryInterval: 5,
        maximumPacketSize: 10000,
        requestResponseInformation: true,
        requestProblemInformation: true,
      }
    };

    if (isServiceID(user.id)) {
      options.will = {
        qos: 2,
        retain: true,
        topic: 'galaxy/service/' + user.role,
        payload: JSON.stringify({ type: 'event', [user.role]: false }),
        properties: { userProperties: user }
      };
    }

    this.mq = mqtt.connect(`wss://${MQTT_URL}`, options);

    this.mq.on('connect', (data) => {
      if (data && !this.connected) {
        console.log('[mqtt] Connected to server: ', data);
        this.connected = true;
        callback(data);
      }
    });

    this.mq.on('error', (data) => console.error('[mqtt] Error: ', data));
    this.mq.on('disconnect', (data) => console.error('[mqtt] Error: ', data));
  };

  join = (topic) => {
    if (!this.mq) return;
    console.log('[mqtt] Subscribe to: ', topic);
    let options = { qos: 2, nl: true };
    this.mq.subscribe(topic, { ...options }, (err) => {
      err && console.error('[mqtt] Error: ', err);
    });
  };

  exit = (topic) => {
    if (!this.mq) return;
    let options = {};
    console.log('[mqtt] Unsubscribe from: ', topic);
    this.mq.unsubscribe(topic, { ...options }, (err) => {
      err && console.error('[mqtt] Error: ', err);
    });
  };

  send = (message, retain, topic) => {
    if (!this.mq) return;
    console.log('[mqtt] Send data on topic: ', topic, message);
    let options = { qos: 2, retain, properties: { messageExpiryInterval: 0, userProperties: this.user } };
    this.mq.publish(topic, message, { ...options }, (err) => {
      err && console.error('[mqtt] Error: ', err);
    });
  };

  watch = (callback, stat) => {
    this.mq.on('message', (topic, data, packet) => {
      console.debug('[mqtt] Got data on topic: ', topic);
      if (/subtitles\/galaxy\//.test(topic)) {
        this.mq.emit('MqttSubtitlesEvent', data);
      } else {
        let message = stat ? data.toString() : JSON.parse(data.toString());
        console.log('[mqtt] Got data on topic: ', topic, message);
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




import "paho-mqtt";

export default class JanusMQTT {
  constructor() {
    this.host = "192.168.99.100";
    this.port = 7800;
    this.client = null;
    this.onMessage = new Function();
  }

  connect() {
    this.client = new Paho.MQTT.Client(this.host, Number(this.port), "clientId");

    this.client.onConnectionLost = (response) => {
      console.log(response);
    };

    this.client.onMessageArrived = (message) => {
      this.onMessage(message.payloadString);
    };

    return new Promise((resolve, reject) => {
      this.client.connect({
        onSuccess: () => {
          resolve({connected: true});
        },
      });
    });
  }

  subscribe(topic) {
    this.client.subscribe(topic);
  }

  send(destination, message) {
    message = new Paho.MQTT.Message(JSON.stringify(message));
    message.destinationName = destination;
    this.client.send(message);
  }

  _getRandomString(len) {
    var charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    var randomString = "";
    for (var i = 0; i < len; i++) {
      var randomPoz = Math.floor(Math.random() * charSet.length);
      randomString += charSet.substring(randomPoz, randomPoz + 1);
    }
    return randomString;
  }
}

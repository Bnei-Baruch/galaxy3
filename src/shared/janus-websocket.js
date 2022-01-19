export default class JanusWebSocket {
  constructor() {
    this.host = "192.168.99.100";
    this.port = 8188;
    this.protocol = "janus-protocol";
    this.socket = null;
    this.onMessage = new Function();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(`ws://${this.host}:${this.port}`, this.protocol);

      this.socket.onopen = () => {
        resolve({connected: true});
      };
      this.socket.onerror = (error) => {
        reject(error);
      };
      this.socket.onmessage = (event) => {
        this.onMessage(event);
      };
    });
  }

  send(data) {
    this.socket.send(JSON.stringify(data));
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

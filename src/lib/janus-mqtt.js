import {randomString} from "../shared/tools";
import mqtt from "../shared/mqtt";

export class JanusMqtt {
  constructor(user, srv, mit) {
    this.user = user
    this.srv = srv
    this.mit = mit
    this.rxTopic = 'janus/' + srv + '/from-janus'
    this.txTopic = 'janus/' + srv + '/to-janus'
    this.stTopic = 'janus/' + srv + '/status'
    this.isConnected = false
    this.sessionId = undefined
    this.transactions = {}
    this.pluginHandles = {}
    this.sendCreate = true
    this.keepalive = null
  }

  init() {
    mqtt.join(this.rxTopic + "/" + this.user.id, false);
    mqtt.join(this.rxTopic, false);
    mqtt.join(this.stTopic, false);
    mqtt.watch(status => {
      console.log(status)
    });

    mqtt.mq.on("MqttJanusMessage", (data, tD) => this.onMessage(data, tD));

    return new Promise((resolve, reject) => {
      const transaction = randomString(12);
      const msg = { janus: 'create', transaction }

      this.transactions[transaction] = {
        resolve: (json) => {
          if (json.janus !== 'success') {
            console.error('Cannot connect to Janus', json)
            reject(json)
            return
          }

          this.sessionId = json.data.id
          this.isConnected = true
          this.keepAlive(true)

          console.debug('Janus connected, sessionId: ', this.sessionId)

          resolve(this)
        },
        reject,
        replyType: 'success'
      }
      mqtt.send(JSON.stringify(msg), false, this.txTopic, this.rxTopic)
    })

  }

  attach(plugin) {
    return this.transaction('attach', {plugin: 'janus.plugin.streaming', opaque_id: this.user.id}, 'success').then((json) => {
      if (json.janus !== 'success') {
        console.error('Cannot add plugin', json)
        plugin.error(json)
        throw new Error(json)
      }

      this.pluginHandles[json.data.id] = plugin

      return plugin.success(this, json.data.id)
    })
  }

  transaction(type, payload, replyType, timeoutMs) {
    if (!replyType) {
      replyType = 'ack'
    }
    const transactionId = randomString(12);

    return new Promise((resolve, reject) => {
      if (timeoutMs) {
        setTimeout(() => {
          reject(new Error('Transaction timed out after ' + timeoutMs + ' ms'))
        }, timeoutMs)
      }

      if (!this.isConnected) {
        reject(new Error('Janus is not connected'))
        return
      }

      const request = Object.assign({}, payload, {
        janus: type,
        session_id: (payload && parseInt(payload.session_id, 10)) || this.sessionId,
        transaction: transactionId
      })

      this.transactions[request.transaction] = {resolve, reject, replyType, request}
      mqtt.send(JSON.stringify(request), false, this.txTopic, this.rxTopic)
    })
  }

  keepAlive (isScheduled) {
    if (!this.isConnected || !this.sessionId) {
      return
    }

    if (isScheduled) {
      setTimeout(() => { this.keepAlive() }, 60 * 1000)
    } else {
      console.debug('Sending Janus keepalive')
      this.transaction('keepalive').then(() => {
        setTimeout(() => { this.keepAlive() }, 60 * 1000)
      }).catch((err) => {
        console.warn('Janus keepalive error', err)
      })
    }
  }

  getTransaction(json, ignoreReplyType = false) {
    const transactionId = json.transaction
    if(transactionId && Object.prototype.hasOwnProperty.call(this.transactions, transactionId)) {
      const ret = this.transactions[transactionId]
      delete this.transactions[transactionId]
      return ret
    }
  }

  onMessage(message, tD) {
    let json
    try {
      json = JSON.parse(message)
    } catch (err) {
      console.error('cannot parse message', message.data)
      return
    }

    console.debug(" :: New Janus Message: ", json);
    const {session_id, janus, data, jsep} = json;

    if(tD === "status") {
      return
    }

    if (janus === 'success') {
      const transaction = this.getTransaction(json)
      if (!transaction) {
        return
      }

      const pluginData = json.plugindata
      if (pluginData === undefined || pluginData === null) {
        transaction.resolve(json)
        return
      }

      const sender = json.sender
      if (!sender) {
        transaction.resolve(json)
        console.error('Missing sender for plugindata', json)
        return
      }

      const pluginHandle = this.pluginHandles[sender]
      if (!pluginHandle) {
        console.error('This handle is not attached to this session', json)
        return
      }

      transaction.resolve({ data: pluginData.data, json })
      return
    }

    if (janus === 'timeout' && json.session_id !== this.sessionId) {
      console.debug('GOT timeout from another websocket');
      return
    }

    if (janus === 'keepalive') { // Do nothing
      return
    }

    if (janus === 'ack') { // Just an ack, we can probably ignore
      const transaction = this.getTransaction(json)
      if (transaction && transaction.resolve) {
        transaction.resolve(json)
      }
      return
    }

    if (janus === 'webrtcup') { // The PeerConnection with the gateway is up! Notify this
      const sender = json.sender
      if (!sender) {
        console.warn('Missing sender...')
        return
      }
      const pluginHandle = this.pluginHandles[sender]
      if (!pluginHandle) {
        console.error('This handle is not attached to this session', sender)
        return
      }
      pluginHandle.webrtcState(true)
      return
    }

    if (janus === 'hangup') { // A plugin asked the core to hangup a PeerConnection on one of our handles
      return
    }

    if (janus === 'detached') { // A plugin asked the core to detach one of our handles
      return
    }

    if (janus === 'media') { // Media started/stopped flowing
      return
    }

    if (janus === 'slowlink') { // Trouble uplink or downlink
      console.debug('Got a slowlink event on session ' + this.sessionId)
      console.debug(json)
      return
    }

    if (janus === 'error') { // Oops, something wrong happened
      console.error('Janus error response' + json)
      return
    }

    if (janus === 'event') {
      console.debug("Got event", json)
      return
    }

    console.warn('Unknown message/event ' + janus + ' on session ' + this.sessionId)
    console.debug(json)
  }
}

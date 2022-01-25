import {randomString} from "../shared/tools";
import mqtt from "../shared/mqtt";
import {StreamingPlugin} from "./streaming-plugin";

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

    mqtt.mq.on("MqttJanusMessage", (data, tD) => this.onMessage(data, tD));

    return new Promise((resolve, reject) => {
      const transaction = randomString(12);
      const msg = { janus: 'create', transaction }

      this.transactions[transaction] = {
        resolve: (json) => {
          if (json.janus !== 'success') {
            console.error('[janus] Cannot connect to Janus', json)
            reject(json)
            return
          }

          this.sessionId = json.data.id
          this.isConnected = true
          this.keepAlive(true)

          console.debug('[janus] Janus connected, sessionId: ', this.sessionId)

          resolve(this)
        },
        reject,
        replyType: 'success'
      }
      mqtt.send(JSON.stringify(msg), false, this.txTopic, this.rxTopic + "/" + this.user.id)
    })

  }

  attach(plugin) {
    const name = plugin.getPluginName()
    return this.transaction('attach', {plugin: name, opaque_id: this.user.id}, 'success')
      .then((json) => {
      if (json.janus !== 'success') {
        console.error('[janus] Cannot add plugin', json)
        plugin.error(json)
        throw new Error(json)
      }

      this.pluginHandles[json.data.id] = plugin

      return plugin.success(this, json.data.id)
    })
  }

  destroyPlugin(plugin) {
    return new Promise((resolve, reject) => {
      if (!(plugin instanceof StreamingPlugin)) {
        reject(new Error('plugin is not a JanusPlugin'))
        return
      }

      if (!this.pluginHandles[plugin.janusHandleId]) {
        reject(new Error('unknown plugin'))
        return
      }

      this.transaction('detach', { plugin: plugin.pluginName, handle_id: plugin.janusHandleId }, 'success', 5000).then(() => {
        delete this.pluginHandles[plugin.janusHandleId]
        plugin.detach()

        resolve()
      }).catch((err) => {
        delete this.pluginHandles[plugin.janusHandleId]
        plugin.detach()

        reject(err)
      })
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
      mqtt.send(JSON.stringify(request), false, this.txTopic, this.rxTopic + "/" + this.user.id)
    })
  }

  keepAlive (isScheduled) {
    if (!this.isConnected || !this.sessionId) {
      return
    }

    if (isScheduled) {
      setTimeout(() => { this.keepAlive() }, 60 * 1000)
    } else {
      console.debug('[janus] Sending Janus keepalive')
      this.transaction('keepalive').then(() => {
        setTimeout(() => { this.keepAlive() }, 60 * 1000)
      }).catch((err) => {
        console.warn('[janus] Janus keepalive error', err)
      })
    }
  }

  getTransaction(json, ignoreReplyType = false) {
    const type = json.janus
    const transactionId = json.transaction
    if(transactionId && Object.prototype.hasOwnProperty.call(this.transactions, transactionId) &&
    (ignoreReplyType || this.transactions[transactionId].replyType === type)) {
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
      console.error('[janus] cannot parse message', message.data)
      return
    }

    console.debug("[janus] New Janus Message: ", json);
    const {session_id, janus, data, jsep} = json;

    if(tD === "status") {
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
        console.error('[janus] Missing sender for plugindata', json)
        return
      }

      const pluginHandle = this.pluginHandles[sender]
      if (!pluginHandle) {
        console.error('[janus] This handle is not attached to this session', json)
        return
      }

      transaction.resolve({ data: pluginData.data, json })
      return
    }

    if (janus === 'timeout' && json.session_id !== this.sessionId) {
      console.debug('[janus] GOT timeout from another websocket');
      return
    }

    if (janus === 'webrtcup') { // The PeerConnection with the gateway is up! Notify this
      const sender = json.sender
      if (!sender) {
        console.warn('[janus] Missing sender...')
        return
      }
      const pluginHandle = this.pluginHandles[sender]
      if (!pluginHandle) {
        console.error('[janus] This handle is not attached to this session', sender)
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
      console.debug('[janus] Got a slowlink event on session ' + this.sessionId)
      return
    }

    if (janus === 'error') { // Oops, something wrong happened
      console.error('[janus] Janus error response' + json)
      return
    }

    if (janus === 'event') {
      console.debug("[janus] Got event", json)
      const sender = json.sender
      if (!sender) {
        console.warn('Missing sender...')
        return
      }
      const pluginData = json.plugindata
      if (pluginData === undefined || pluginData === null) {
        console.error('Missing plugindata...')
        return
      }

      const pluginHandle = this.pluginHandles[sender]
      if (!pluginHandle) {
        console.error('This handle is not attached to this session', sender)
        return
      }

      const data = pluginData.data
      const transaction = this.getTransaction(json)
      if (transaction) {
        if (data.error_code) {
          transaction.reject({ data, json })
        } else {
          transaction.resolve({ data, json })
        }
        return
      }

      pluginHandle.onmessage(data, json)
      return
    }

    console.warn('[janus] Unknown message/event ' + janus + ' on session ' + this.sessionId)
  }
}

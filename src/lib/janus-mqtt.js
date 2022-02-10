import {randomString} from "../shared/tools";
import mqtt from "../shared/mqtt";
import log from "loglevel";
import chalk from "chalk";

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
    this.token = null
    this.onMessage = this.onMessage.bind(this)
  }

  init(token) {
    this.token = token
    mqtt.join(this.rxTopic + "/" + this.user.id, false);
    mqtt.join(this.rxTopic, false);
    mqtt.join(this.stTopic, false);

    // We can't make more than 1 session on the same janus server
    // fs it's problem for us, then logic here must be changed
    const mit = this.mit || this.srv
    mqtt.mq.on(mit, this.onMessage);

    return new Promise((resolve, reject) => {
      const transaction = randomString(12);
      const msg = { janus: 'create', transaction, token }

      this.transactions[transaction] = {
        resolve: (json) => {
          if (json.janus !== 'success') {
            log.error('[janus] Cannot connect to Janus', json)
            reject(json)
            return
          }

          this.sessionId = json.data.id
          this.isConnected = true
          this.keepAlive(true)

          log.debug('[janus] Janus connected, sessionId: ', this.sessionId)

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
        log.error('[janus] Cannot add plugin', json)
        plugin.error(json)
        throw new Error(json)
      }

      this.pluginHandles[json.data.id] = plugin

      return plugin.success(this, json.data.id)
    })
  }

  destroy () {
    if (!this.isConnected) {
      return Promise.resolve()
    }

    return this.transaction('destroy', {}, 'success', 5000).then(data => {
      log.debug('[janus] Janus destroyed: ', data)
      this.cleanup()
    }).catch(() => {
      this.cleanup()
    })
  }

  detach(plugin) {
    return new Promise((resolve, reject) => {
      if (!this.pluginHandles[plugin.janusHandleId]) {
        reject(new Error('[janus] unknown plugin'))
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
          reject(new Error('[janus] Transaction timed out after ' + timeoutMs + ' ms'))
        }, timeoutMs)
      }

      if (!this.isConnected) {
        reject(new Error('[janus] Janus is not connected'))
        return
      }

      const request = Object.assign({}, payload, {
        token: this.token,
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
      setTimeout(() => { this.keepAlive() }, 20 * 1000)
    } else {
      log.debug('[janus] Sending Janus keepalive')
      this.transaction('keepalive').then(() => {
        setTimeout(() => { this.keepAlive() }, 20 * 1000)
      }).catch((err) => {
        log.warn('[janus] Janus keepalive error', err)
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

  onClose () {
    if (!this.isConnected) {
      return
    }

    this.isConnected = false
    log.error('Lost connection to the gateway (is it down?)')
  }

  cleanup () {
    this._cleanupPlugins()
    this._cleanupTransactions()
  }

  _cleanupPlugins () {
    Object.keys(this.pluginHandles).forEach((pluginId) => {
      const plugin = this.pluginHandles[pluginId]
      delete this.pluginHandles[pluginId]
      plugin.detach()
    })
  }

  _cleanupTransactions () {
    Object.keys(this.transactions).forEach((transactionId) => {
      const transaction = this.transactions[transactionId]
      if (transaction.reject) {
        transaction.reject()
      }
    })
    this.transactions = {}
    this.sessionId = null
    this.isConnected = false

    mqtt.exit(this.rxTopic + "/" + this.user.id);
    mqtt.exit(this.rxTopic);
    mqtt.exit(this.stTopic);

    const mit = this.mit || this.srv
    mqtt.mq.removeListener(mit, this.onMessage);
  }

  onMessage(message, tD) {
    let json
    try {
      json = JSON.parse(message)
    } catch (err) {
      log.error('[janus] cannot parse message', message.data)
      return
    }

    log.debug("[janus] On message: ", json, tD);
    const {session_id, janus, data, jsep} = json;

    if(tD === "status" && json.online) {
      log.debug("[janus] Janus Server - " + this.srv + " - Online")
      return
    }

    if(tD === "status" && !json.online) {
      alert("[janus] Janus Server - " + this.srv + " - Offline")
      window.location.reload()
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
        log.error('[janus] Missing sender for plugindata', json)
        return
      }

      const pluginHandle = this.pluginHandles[sender]
      if (!pluginHandle) {
        log.debug(chalk.grey('[janus] This handle is not attached to this session', json))
        return
      }

      transaction.resolve({ data: pluginData.data, json })
      return
    }

    if (janus === 'timeout' && json.session_id !== this.sessionId) {
      log.debug('[janus] Timeout from another session');
      return
    }

    if (janus === 'webrtcup') { // The PeerConnection with the gateway is up! Notify this
      const sender = json.sender
      if (!sender) {
        log.warn('[janus] Missing sender...')
        return
      }
      const pluginHandle = this.pluginHandles[sender]
      if (!pluginHandle) {
        log.debug(chalk.grey('[janus] This handle is not attached to this session', sender))
        return
      }
      pluginHandle.webrtcState(true)
      return
    }

    if (janus === 'hangup') { // A plugin asked the core to hangup a PeerConnection on one of our handles
      const sender = json.sender
      if (!sender) {
        log.warn('[janus] Missing sender...')
        return
      }
      const pluginHandle = this.pluginHandles[sender]
      if (!pluginHandle) {
        log.debug(chalk.grey('[janus] This handle is not attached to this session', sender))
        return
      }
      pluginHandle.webrtcState(false, json.reason)
      pluginHandle.hangup()
      return
    }

    if (janus === 'detached') { // A plugin asked the core to detach one of our handles
      const sender = json.sender
      if (!sender) {
        log.warn('[janus] Missing sender...')
        return
      }
      return
    }

    if (janus === 'media') { // Media started/stopped flowing
      const sender = json.sender
      if (!sender) {
        log.warn('[janus] Missing sender...')
        return
      }
      const pluginHandle = this.pluginHandles[sender]
      if (!pluginHandle) {
        log.debug(chalk.grey('[janus] This handle is not attached to this session', sender))
        return
      }
      pluginHandle.mediaState(json.type, json.receiving)
      return
    }

    if (janus === 'slowlink') { // Trouble uplink or downlink
      log.debug('[janus] Got a slowlink event on session ' + this.sessionId)
      log.debug(json)
      const sender = json.sender
      if (!sender) {
        log.warn('[janus] Missing sender...')
        return
      }
      const pluginHandle = this.pluginHandles[sender]
      if (!pluginHandle) {
        log.debug(chalk.grey('[janus] This handle is not attached to this session', sender))
        return
      }
      pluginHandle.slowLink(json.uplink, json.nacks)
      return
    }

    if (janus === 'error') { // Oops, something wrong happened
      log.error('[janus] Janus error response' + json)
      const transaction = this.getTransaction(json, true)
      if (transaction && transaction.reject) {
        if (transaction.request) {
          log.debug('[janus] rejecting transaction', transaction.request, json)
        }
        transaction.reject(json)
      }
      return
    }

    if (janus === 'event') {
      log.debug("[janus] Got event", json)
      const sender = json.sender
      if (!sender) {
        log.warn('[janus] Missing sender...')
        return
      }
      const pluginData = json.plugindata
      if (pluginData === undefined || pluginData === null) {
        log.error('[janus] Missing plugindata...')
        return
      }

      const pluginHandle = this.pluginHandles[sender]
      if (!pluginHandle) {
        log.debug(chalk.grey('[janus] This handle is not attached to this session', sender))
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

    log.warn('[janus] Unknown message/event ' + janus + ' on session ' + this.sessionId)
  }
}

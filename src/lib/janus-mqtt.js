import {randomString} from "../shared/tools";
import mqtt from "../shared/mqtt";
import log from "loglevel";

export class JanusMqtt {
  constructor(user, srv, mit) {
    this.user = user
    this.srv = srv
    this.mit = mit
    this.rxTopic = 'janus/' + srv + '/from-janus'
    this.txTopic = 'janus/' + srv + '/to-janus'
    this.stTopic = 'janus/' + srv + '/status'
    this.isConnected = false
    this.onStatus = null
    this.sessionId = undefined
    this.transactions = {}
    this.pluginHandles = {}
    this.sendCreate = true
    this.keeptry = 0
    this.token = null
    this.onMessage = this.onMessage.bind(this)
  }

  init(token) {
    this.token = token
    mqtt.join(this.rxTopic + "/" + this.user.id, false);
    mqtt.join(this.rxTopic, false);
    mqtt.join(this.stTopic, false);

    mqtt.mq.on(this.srv, this.onMessage);

    // If we need more than 1 session on the same janus server
    // we need to set mit property in user object, otherwise - this.srv emit trigger
    // in wrong places and unexpected result occur.
    if(this.user.mit) mqtt.mq.on(this.user.mit, this.onMessage);

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
          this.keepAlive(false)

          log.debug('[janus] Janus connected, sessionId: ', this.sessionId)

          // this.user.mit - actually trigger once and after that we use
          // session id as emit. In case we not using multiple session on same server
          // still good as we will not see message from other sessions
          mqtt.mq.on(this.sessionId, this.onMessage);

          resolve(this)
        },
        reject,
        replyType: 'success'
      }
      mqtt.send(JSON.stringify(msg), false, this.txTopic, this.rxTopic + "/" + this.user.id, this.user)
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

    return new Promise((resolve, reject) => {
      this._cleanupPlugins().then(() => {
        return this.transaction('destroy', {}, 'success', 5000).then(data => {
          log.debug('[janus] Janus destroyed: ', data)
          this._cleanupTransactions()
          resolve()
        }).catch(() => {
          this._cleanupTransactions()
          resolve()
        })
      })
    })

  }

  detach(plugin) {
    return new Promise((resolve, reject) => {
      if (!this.pluginHandles[plugin.janusHandleId]) {
        reject(new Error('[janus] unknown plugin'))
        return
      }

      this.transaction('hangup', { plugin: plugin.pluginName, handle_id: plugin.janusHandleId }, 'success', 5000).then(() => {
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
          reject('[janus] Transaction timed out after ' + timeoutMs + ' ms')
        }, timeoutMs)
      }

      if (!this.isConnected) {
        reject('[janus] Janus is not connected')
        return
      }

      const request = Object.assign({}, payload, {
        token: this.token,
        janus: type,
        session_id: (payload && parseInt(payload.session_id, 10)) || this.sessionId,
        transaction: transactionId
      })

      this.transactions[request.transaction] = {resolve, reject, replyType, request}
      mqtt.send(JSON.stringify(request), false, this.txTopic, this.rxTopic + "/" + this.user.id, this.user)
    })
  }

  keepAlive (isScheduled) {
    if (!this.isConnected || !this.sessionId) {
      return
    }

    if (isScheduled) {
      setTimeout(() => this.keepAlive(), 20 * 1000)
    } else {
      log.debug('[janus] Sending keepalive to: ' + this.srv)
      this.transaction('keepalive', null, null, 20 * 1000).then(() => {
        this.keeptry = 0
        setTimeout(() => this.keepAlive(), 20 * 1000)
      }).catch(err => {
        log.debug(err, this.keeptry)
        if(this.keeptry === 3) {
          log.error('[janus] keepalive is not reached ('+ this.srv +') after: ' + this.keeptry + " tries")
          this.isConnected = false
          this.onStatus(this.srv, "error")
          return
        }
        setTimeout(() => this.keepAlive(), 20 * 1000)
        this.keeptry++
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

  _cleanupPlugins() {
    const arr = []
    Object.keys(this.pluginHandles).forEach((pluginId) => {
      const plugin = this.pluginHandles[pluginId]
      //delete this.pluginHandles[pluginId]
      arr.push(new Promise((resolve, reject) => {
        if (!this.pluginHandles[plugin.janusHandleId]) {
          reject(new Error('[janus] unknown plugin'))
          return
        }

        this.transaction('hangup', { plugin: plugin.pluginName, handle_id: plugin.janusHandleId }, 'success', 1000).then(() => {
          delete this.pluginHandles[plugin.janusHandleId]
          plugin.detach()

          resolve()
        }).catch((err) => {
          delete this.pluginHandles[plugin.janusHandleId]
          plugin.detach()

          reject(err)
        })
      }))
    })
    return Promise.allSettled(arr)
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

    mqtt.mq.removeListener(this.srv, this.onMessage);
    if(this.user.mit) mqtt.mq.removeListener(this.user.mit, this.onMessage);
    mqtt.mq.removeListener(this.sessionId, this.onMessage);
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
      if(typeof this.onStatus === "function")
        this.onStatus(this.srv, "online")
      return
    }

    if(tD === "status" && !json.online) {
      this.isConnected = false
      log.debug("[janus] Janus Server - " + this.srv + " - Offline")
      if(typeof this.onStatus === "function")
        this.onStatus(this.srv, "offline")
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
        log.debug('%c[janus] This handle is not attached to this session' + json, "color: darkgrey")
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
        log.debug('%c[janus] This handle is not attached to this session' + sender, "color: darkgrey")
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
        log.debug('%c[janus] This handle is not attached to this session' + sender, "color: darkgrey")
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
        log.debug('%c[janus] This handle is not attached to this session' + sender, "color: darkgrey")
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
        log.debug('%c[janus] This handle is not attached to this session' + sender, "color: darkgrey")
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
        log.debug('%c[janus] This handle is not attached to this session' + sender, "color: darkgrey")
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

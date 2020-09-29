import { Janus } from "./../lib/janus";

export const MAX_DELAY = 5 * 1000;  // 5 seconds.
export const RETRY_DELAY = 500;     // 0.5 seconds.
export const INTERVALS_DELAY = 100; // 100ms.

const ACK_FIELD = '__gack__';
const FROM_FIELD = '__from__';
const TO_ACK_FIELD = '__to_ack__';
const ACKED_FIELD = '__acked__';
const RETRY_FIELD = '__gretry__';
const TRANSACTION_FIELD = 'transaction';
export const DEADLINE_EXCEEDED = 'DEADLINE_EXCEEDED';

// Class for sending and receiving messages that we validate they were eventually received. If not we raise an error after MAX_DELAY.
export class GuaranteeDeliveryManager {
	constructor(userId, maxDelay = MAX_DELAY, retryDelay = RETRY_DELAY, intervalsDelay = INTERVALS_DELAY) {
    this.maxDelay = maxDelay;
    this.retryDelay = retryDelay;
    this.intervalsDelay = intervalsDelay;

    // Map from transaction to timestamp that message was sent and promise resolving or success
    // or rejecting on failure.
    // @const {!Map<string, {delivery: !Promise, sent: number, sendMessage: function, message: Object!}>}
    this.pending = new Map();

    // Map from transaction to timestamp guarantee message was received.
    this.accepted = new Map();

    // Process pending messages status.
    this.intervalIdentifier = setInterval(() => this.iterate_(), this.intervalsDelay);

    if (!userId) {
      throw new Error(`Unique userId has to be set for GuaranteeDeliveryManager, got [${userId}].`);
    }
    this.userId = userId;
	}

  // Iterate over exising pending messages and retries them if needed, when max delay
  // passes, delete them and reject.
  iterate_() {
    const now = Number(new Date());
    for (const [transaction, state] of this.pending) {
      const interval = now - state.sent;
      if (interval > this.maxDelay) {
        console.error('[GDM] Did not get all ack as required', state.ack);
        // Failed sending message on timeout. Delete and reject.
        this.pending.delete(transaction);
        state.delivery.reject({reason: DEADLINE_EXCEEDED, message: state.message});  // Note that if reject is computation heavy action, our timings might be not accurate.
      } else if (now - state.sent >= (state.message[RETRY_FIELD] + 1) * this.retryDelay) {
        // We should retry.
        state.message[RETRY_FIELD]++;
        // Update the toAck and acked fields.
        state.message[TO_ACK_FIELD].length = 0;
        state.message[ACKED_FIELD].length = 0;
        for (const [ackUserId, acked] of Object.entries(state.ack)) {
          if (acked) {
            state.message[ACKED_FIELD].push(ackUserId);
          } else {
            state.message[TO_ACK_FIELD].push(ackUserId);
          }
        }
        state.sendMessage(state.message);
      }
    }

    // Garbage collect accepted messages.
    for (const [transaction, accepted] of this.accepted) {
      const interval = now - accepted;
      if (interval > 10 * this.maxDelay) {
        // We don't expect messages to arrive after 10 * MAX_DELAY time, it is safe to delete
        // them now.
        this.accepted.delete(transaction);
      }
    }
  }

  // Send message that guarantee to arrive within MAX_DELAY or notify on timeout.
  // @param {!Object} message
  // @param {!Array<string>} toAck List of userIds that are expected to ack. If empty will expect any non-self user to ack.
  // @param {function(!Object)} sendMessage
  // @return {!Promise}  <====  Resolve for success, reject for failure.
  send(message, toAck, sendMessage) {
    // Make sure we have unique key in each message. Potentially use existing transaction.
    if (!(TRANSACTION_FIELD in message)) {
      message[TRANSACTION_FIELD] = Janus.randomString(12);
    }
    if (this.pending.has(message[TRANSACTION_FIELD])) {
      // Should not happen, sending new message with existing transaction.
      return Promise.reject(new Error(`Duplicate transaction ${message[TRANSACTION_FIELD]}`));
    }
    message[RETRY_FIELD] = 0;
    message[TO_ACK_FIELD] = toAck;
    message[ACKED_FIELD] = [];
    message[FROM_FIELD] = this.userId;
    const delivery = {};
    const ret = new Promise((resolve, reject) => {
      delivery.resolve = resolve;
      delivery.reject = reject;
    });
    const ack = toAck.reduce((ack, userId) => {
      ack[userId] = false;
      return ack;
    }, {});
    this.pending.set(message[TRANSACTION_FIELD], {
      delivery,
      sent: Number(new Date()),
      retries: 0,
      sendMessage,
      message,
      ack,
    });
    sendMessage(message);
    return ret;
	}

  // Check if ack message was received, handle it.
  // @param {!Object} message
  // @returns {boolean} true if ack was received, false if any other message.
  checkAck(message) {
    if (!(ACK_FIELD in message)) {
      return false;
    }
    const transaction = message[ACK_FIELD];
    if (this.pending.has(transaction)) {
      const {delivery, ack} = this.pending.get(transaction);
      const userId = message[FROM_FIELD];
      if (!userId) {
        console.error(`This should never happen, expecting userId in ack, got [${userId}].`);
        return true;  // Don't ack.
      }
      if (Object.keys(ack).length !== 0) {
        if (userId in ack) {
          ack[userId] = true;
        }
      } else if (this.userId === userId) {
        return true; // Don't ack yourself.
      }
      if (Object.entries(ack).every(([ackUserId, acked]) => acked)) {
        // console.log('Message acked, resolving.', ack);
        this.pending.delete(transaction);
        delivery.resolve();
      }
      return true;
    }
    // Ack message but not for me.
    return true;
  }

  // @param {!Object} message
  // @param {function(!Object)} sendMessage
  // @return {!Promise}  <==== Resolve only once when received, Resolve with null on any
  // consecutive times the same message received. Reject on errors.
  accept(message, sendAckBack) {
    if (!(RETRY_FIELD in message)) {
      // This is a regular non-guarantee message, resolve right away.
      // console.log(`${RETRY_FIELD} not found in `, message);
      return Promise.resolve(message);
    }
    [TRANSACTION_FIELD, FROM_FIELD].forEach((field) => {
      if (!(field in message)) {
        return Promise.reject(new Error(`Message missing field: ${field}`));
      }
    });
    const ack = {
      [ACK_FIELD]: message[TRANSACTION_FIELD],
      [FROM_FIELD]: this.userId,
    };
    // Sent ack back if toAck field is not set and I'm not sending ack to myself or
    // my userId explicitly set in the toAck field (event if this is me).
    const toAck = (TO_ACK_FIELD in message && message[TO_ACK_FIELD]) || [];
    if ((toAck.length === 0 && this.userId !== message[FROM_FIELD]) ||
        toAck.includes(this.userId)) {
      sendAckBack(ack);
    }
    if (this.accepted.has(message[TRANSACTION_FIELD])) {
      // Already resolved his message, skip.
      return Promise.resolve(null);
    } else {
      this.accepted.set(message[TRANSACTION_FIELD], Number(new Date()));
      return Promise.resolve(message);
    }
  }
}


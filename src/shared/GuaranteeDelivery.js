import { Janus } from "./../lib/janus";

const MAX_DELAY = 5 * 1000;  // 5 seconds.
const RETRY_DELAY = 500;     // 0.5 seconds.
const INTERVALS_DELAY = 100;       // 100ms.

const ACK_FIELD = '__gack__';
const RETRY_FIELD = '__gretry__';
const TRANSACTION_FIELD = 'transaction';
export const DEADLINE_EXCEEDED = 'DEADLINE_EXCEEDED';

// Class for sending and receiving messages that we validate they were eventually received. If not we raise an error after MAX_DELAY.
export class GuaranteeDeliveryManager {
	constructor(maxDelay, retryDelay, intervalsDelay) {
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
	}

  // Iterate over exising pending messages and retries them if needed, when max delay
  // passes, delete them and reject.
  iterate_() {
    const now = Number(new Date());
    for (let [transaction, state] of this.pending) {
      const interval = now - state.sent;
      if (interval > this.maxDelay) {
        // Failed sending message on timeout. Delete and reject.
        this.pending.delete(transaction);
        state.delivery.reject({reason: DEADLINE_EXCEEDED, message: state.message});  // Note that if reject is computation heavy action, our timings might be not accurate.
      } else if (now - state.sent >= (state.message[RETRY_FIELD] + 1) * this.retryDelay) {
        // We should retry.
        state.message[RETRY_FIELD]++;
        state.sendMessage(state.message);
      }
    }

    // Garbage collect accepted messages.
    for (let [transaction, accepted] of this.accepted) {
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
  // @param {function(!Object)} sendMessage
  // @return {!Promise}  <====  Resolve for success, reject for failure.
  sendGuaranteeMessage(message, sendMessage) {
    // Make sure we have unique key in each message. Potentially use existing transaction.
    if (!(TRANSACTION_FIELD in message)) {
      message[TRANSACTION_FIELD] = Janus.randomString(12);
    }
    if (this.pending.has(message[TRANSACTION_FIELD])) {
      // Should not happen, sending new message with existing transaction.
      return Promise.reject(new Error('Error, not expected new message with same transaction.', message));
    }
    message[RETRY_FIELD] = 0;
    const delivery = {};
    const ret = new Promise((resolve, reject) => {
      delivery.resolve = resolve;
      delivery.reject = reject;
    });
    this.pending.set(message[TRANSACTION_FIELD], {
      delivery,
      sent: Number(new Date()),
      retries: 0,
      sendMessage,
      message,
    });
    sendMessage(message);
    return ret;
	}

  // Check if ack message was received, handle it.
  // @param {!Object} message
  // @returns {boolean} true if successfull ack was received, false if any other message.
  checkForAck(message) {
    if (!(ACK_FIELD in message)) {
      return false;
    }
    const transaction = message[ACK_FIELD];
    if (this.pending.has(transaction)) {
      const {delivery} = this.pending.get(transaction);
      this.pending.delete(transaction);
      delivery.resolve();
      return true;
    }
  }

  // Use this when message is read by many subscribers and we are expecting
  // back many acks (validation) that message was received.
  sendMultiGuaranteeMessage(message, numOfExpectedAcks, sendMessage) {
    throw new Error('Not implemented');
  }

  // @param {!Object} message
  // @param {function(!Object)} sendMessage
  // @return {!Promise}  <==== Resolve only once when received, Resolve with null on any
  // consecutive times the same message received. Reject on errors.
  acceptGuaranteeMessage(message, sendAckBack) {
    if (!(RETRY_FIELD in message)) {
      // This is a regular non-guarantee message, resolve right away.
      return Promise.resolve(message);
    }
    if (!(TRANSACTION_FIELD in message)) {
      return Promise.reject(`All guarantee messages expect to have ${TRANSACTION_FIELD} field`);
    }
    const ack = {};
    ack[ACK_FIELD] = message[TRANSACTION_FIELD];
    sendAckBack(ack);
    if (this.accepted.has(message[TRANSACTION_FIELD])) {
      // Already resolved his message, skip.
      return Promise.resolve(null);
    } else {
      this.accepted.set(message[TRANSACTION_FIELD], Number(new Date()));
      return Promise.resolve(message);
    }
  }
}


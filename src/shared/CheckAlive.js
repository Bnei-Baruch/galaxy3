import { Janus } from "./../lib/janus";
import {captureMessage} from './sentry';
import {ALREADY_IN_ROOM_ERROR_CODE} from './consts';

export const SEND_ALIVE_INTERVAL = 2 * 60 * 1000;   // 2 minutes in milliseconds.
export const CHECK_ALIVE_DELAY = 3 * 60 * 1000;  // 3 minutes in milliseconds. Should be larger than SEND_ALIVE_INTERVAL.
export const CHECK_ALIVE_INTERVAL = 100; // 100ms.

export class CheckAlive {
  constructor(sendAliveInterval = SEND_ALIVE_INTERVAL, checkAliveDelay = CHECK_ALIVE_DELAY, checkAliveInterval = CHECK_ALIVE_INTERVAL) {
    this.sendAliveInterval = sendAliveInterval;
    this.checkAliveDelay = checkAliveDelay;
    this.checkAliveInterval = checkAliveInterval;

    this.stop();
  }

  stop() {
    this.textroom = null;
    this.roomid = 0;
    this.user = null;

    this.lastAlive = 0;
    this.notAliveCaptured = false;
    this.checkAliveTransactions = null;

    if (this.sendAliveIntervalId) {
      clearInterval(this.sendAliveIntervalId);
    }
    this.sendAliveIntervalId = 0;

    if (this.checkAliveIntervalId) {
      clearInterval(this.checkAliveIntervalId);
    }
    this.checkAliveIntervalId = 0;
  }

  start(textroom, roomid, user) {
    this.textroom = textroom;
    this.roomid = roomid;
    this.user = user;

    this.lastAlive = Date.now();
    this.notAliveCaptured = false;
    this.checkAliveTransactions = new Set();

    // Send alive periodically.
    this.sendAliveIntervalId = setInterval(() => this.sendAlive_(), this.sendAliveInterval);
    // Check alive periodically.
    this.checkAliveIntervalId = setInterval(() => this.checkAlive_(), this.checkAliveInterval);
  }

  checkAlive_() {
    const now = Date.now();
    if (!this.notAliveCaptured && (this.lastAlive === null || now - this.lastAlive >= this.checkAliveDelay)) {
      const msg = `Expected now (${now}) - lastAlive (${this.lastAlive}) to be less than ${this.checkAliveDelay}.`
			captureMessage('Not alive.', {source: 'CheckAlive', msg, room: this.roomid});
      console.log('[CheckAlive]', msg);
      this.notAliveCaptured = true;
    } else if (this.notAliveCaptured && this.lastAlive !== null && now - this.lastAlive < this.checkAliveDelay) {
      this.notAliveCaptured = false;
      console.log('[CheckAlive] Back alive.');
    }
  }

  sendAlive_() {
    const transaction = Janus.randomString(12);
    this.checkAliveTransactions.add(transaction);
    const register = {
      textroom: "join",
      transaction: transaction,
      room: this.roomid,
      username: this.user.id,
      display: this.user.display
    };
    this.textroom.data({
      text: JSON.stringify(register),
      success: () => {
        console.log("[CheckAlive] join sent successfully.", this.roomid);
      },
      error: (err) => {
        console.error("[CheckAlive] try join error", this.roomid, err);
        captureMessage(`CheckAlive error: join - ${err}`, {source: "CheckAlive", err, room: this.roomid}, 'error');
      }
    });
  }

  // Check if the message is check-alive message and handles it.
  // Returns true if this is a check-alive message.
  checkAlive(message) {
    if (!message?.transaction || !this?.checkAliveTransactions?.has(message.transaction)) {
      return false;
    }
    this.checkAliveTransactions.delete(message?.transaction);
    const {textroom, error_code} = message;
    if (textroom !== 'error' || error_code !== ALREADY_IN_ROOM_ERROR_CODE) {
      console.error('CheckAlive, expected already in room error.', message, error_code)
      captureMessage('CheckAlive, expected already in room error.', {source: "CheckAlive", err: message});
    }
    this.lastAlive = Date.now();
    return true;
  }
}

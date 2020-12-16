import { Janus } from './../lib/janus';
import { captureMessage } from './sentry';
import { ALREADY_IN_ROOM_ERROR_CODE, SHIDUR_ID } from './consts';

const SEND_ALIVE_INTERVAL = 1 * 60 * 1000;   // 1 minutes in milliseconds.
const MAX_ATTEMPT_WAIT    = 3;

export class CheckAlive {
  constructor() {
    this.stop();
  }

  stop() {
    this.textroom = null;
    this.roomid   = 0;
    this.user     = null;

    this.lastAlive              = 0;
    this.notAliveCaptured       = false;
    this.checkAliveTransactions = null;

    if (this.tickIntervalId) {
      clearInterval(this.tickIntervalId);
    }
    this.tickIntervalId = 0;
  }

  start(textroom, roomid, user) {
    this.textroom       = textroom;
    this.roomid         = roomid;
    this.user           = user;
    this.attemptCounter = 0;

    this.lastAlive = Date.now();

    // run tick
    this.tickIntervalId = setInterval(this.tick.bind(this), SEND_ALIVE_INTERVAL);
  }

  restart() {
    this.attemptCounter = 0;
    this.lastAlive      = Date.now();
    if (this.tickIntervalId) {
      clearInterval(this.tickIntervalId);
    }
    this.tickIntervalId = setInterval(this.tick.bind(this), SEND_ALIVE_INTERVAL);
  }

  tick() {
    if (this.attemptCounter > MAX_ATTEMPT_WAIT) {
      const msg = `Last alive was at: (${this.lastAlive}). Expected transaction: ${this.sendTransactionId}, Last transaction:  ${this.respTransactionId}.`;
      captureMessage('Not alive.', { source: 'CheckAlive', msg, room: this.roomid });
      console.log('[CheckAlive] Not alive.', msg);
      this.restart();
      return;
    }

    if (this.sendTransactionId !== this.respTransactionId) {
      this.attemptCounter++;
      console.log(`[CheckAlive] Not alive, attempt ${this.attemptCounter}`);
      return;
    }
    this.sendAlive_();
  }

  sendAlive_() {
    const transaction      = Janus.randomString(12);
    this.sendTransactionId = transaction;

    let message = {
      ack: false,
      textroom: 'message',
      to: this.user.id,
      room: this.roomid,
      username: this.user.id,
      transaction,
      text: JSON.stringify({ display: this.user.display, type: 'checkAlive', transaction }),
    };

    this.textroom.data({
      text: JSON.stringify(message),
      success: () => {
        console.log('[CheckAlive] join sent successfully.', this.roomid);
      },
      error: (err) => {
        console.error('[CheckAlive] try join error', this.roomid, err);
        captureMessage(`CheckAlive error: join - ${err}`, {
          source: 'CheckAlive',
          err,
          room: this.roomid,
          sendAt: this.lastAlive
        }, 'error');
      }
    });
  }

  checkAlive(data) {
    if (data?.from !== this.user?.id || !data.text) {
      return false;
    }

    const text = JSON.parse(data.text);
    if (text.type !== 'checkAlive' || text.transaction !== this.sendTransactionId) {
      return false;
    }

    this.respTransactionId = text.transaction;
    this.lastAlive         = Date.now();
    return true;
  }
}

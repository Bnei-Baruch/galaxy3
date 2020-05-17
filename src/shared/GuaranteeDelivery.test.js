import {GuaranteeDeliveryManager} from './GuaranteeDelivery';

class User {
  constructor(cb) {
    this.onMessageCallback = null;
  }

  setOnMessageCallback(cb) {
    this.onMessageCallback = cb;
  }

  send(message) {
    console.log('send', message);
    setTimeout(() => this.onMessage(message), 10);
  }

  onMessage(message) {
    if (this.onMessageCallback) {
      this.onMessageCallback(message);
    }
  }
}

it('messaged delivery guaranteed', (done) => {
  const gdm = new GuaranteeDeliveryManager(/* maxDelay= */ 2000, /* retryDelay= */ 500, /* intervalsDelay =*/ 100);
  const userA = new User();
  const userB = new User();

  userA.setOnMessageCallback((message) => {
    // User A receives message.
    if (gdm.checkForAck(message)) {
      return;  // ack message accepted don’t handle.
    }
    // Any other message...
    console.log('UserA Some message received', message);
  });

  userB.setOnMessageCallback((message) => {
    gdm.acceptGuaranteeMessage(message, (msg) => userA.send(msg)).then((message) => {
      if (message === null) {
        console.log('UserB Already received this message, skip.', message);
        return;
      }
      console.log('UserB onMessage', message);
    }).catch((error) => {
      console.log('UserB Failed receiving message', error);
    })
  });

  // User A to send guarantee message to user B.
  const theMessage = {test: 'test'};
  gdm.sendGuaranteeMessage(Object.assign({}, theMessage), (msg) => userB.send(msg)).then(() => {
    console.log('UserA success', theMessage);
    expect(true).toBe(true);
    done();
  }).catch((error) => {
    console.log('failed', error);
    expect(true).toBe(false);
    done();
  });

});

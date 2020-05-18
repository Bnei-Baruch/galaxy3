import {GuaranteeDeliveryManager, DEADLINE_EXCEEDED} from './GuaranteeDelivery';

class User {
  constructor(messageSendDelay) {
    this.onMessageCallback = null;
    this.messageSendDelay = messageSendDelay;
  }

  setOnMessageCallback(cb) {
    this.onMessageCallback = cb;
  }

  send(message) {
    console.log('send', message);
    setTimeout(() => this.onMessage(message), this.messageSendDelay);
  }

  onMessage(message) {
    if (this.onMessageCallback) {
      this.onMessageCallback(message);
    }
  }
}

it('messaged delivery guaranteed', (done) => {
  const gdm = new GuaranteeDeliveryManager(
    /* maxDelay= */ 2000, /* retryDelay= */ 500, /* intervalsDelay =*/ 100);
  const userA = new User(/* messageSendDelay= */ 10);
  const userB = new User(/* messageSendDelay= */ 10);

  userA.setOnMessageCallback((message) => {
    // User A receives message.
    if (gdm.checkForAck(message)) {
      return;  // ack message accepted don’t handle.
    }
    // Any other message...
    console.log('messaged delivery guaranteed - UserA Some message received', message);
  });

  userB.setOnMessageCallback((message) => {
    gdm.acceptGuaranteeMessage(message, (msg) => userA.send(Object.assign({}, msg))).then((message) => {
      if (message === null) {
        console.log('messaged delivery guaranteed - UserB Already received this message, skip.', message);
        return;
      }
      console.log('messaged delivery guaranteed - UserB onMessage', message);
    }).catch((error) => {
      console.log('messaged delivery guaranteed - UserB Failed receiving message', error);
    })
  });

  // User A to send guarantee message to user B.
  const theMessage = {test: 'messaged delivery guaranteed'};
  gdm.sendGuaranteeMessage(Object.assign({}, theMessage), (msg) => userB.send(Object.assign({}, msg))).then(() => {
    console.log('messaged delivery guaranteed - UserA success', theMessage);
    expect(true).toBe(true);
    done();
  }).catch((error) => {
    console.log('messaged delivery guaranteed - failed', error);
    expect(true).toBe(false);
    done();
  });

});

it('slow user, retry few times', (done) => {
  const gdm = new GuaranteeDeliveryManager(
    /* maxDelay= */ 200, /* retryDelay= */ 50, /* intervalsDelay =*/ 10);
  const userA = new User(/* messageSendDelay= */ 70);
  const userB = new User(/* messageSendDelay= */ 70);

  let retries = 0;
  let received = 0;
  let receivedNull = 0;
  let ackSent = 0;
  let ackReceived = 0;

  userA.setOnMessageCallback((message) => {
    // User A receives message.
    if (gdm.checkForAck(message)) {
      ackReceived++;
      return;  // ack message accepted don’t handle.
    }
    // Any other message...
    console.log('slow user, retry few times - UserA Some message received', message);
  });

  userB.setOnMessageCallback((message) => {
    gdm.acceptGuaranteeMessage(message, (msg) => { ackSent++; userA.send(Object.assign({}, msg)); }).then((message) => {
      received++;
      if (message === null) {
        receivedNull++;
        console.log('slow user, retry few times - UserB Already received this message, skip.', message);
        return;
      }
      console.log('slow user, retry few times - UserB onMessage', message);
    }).catch((error) => {
      console.log('slow user, retry few times - UserB Failed receiving message', error);
    })
  });

  // User A to send guarantee message to user B.
  const theMessage = {test: 'slow user, retry few times'};
  gdm.sendGuaranteeMessage(Object.assign({}, theMessage), (msg) => { retries++; userB.send(Object.assign({}, msg)); }).then(() => {
    console.log('slow user, retry few times - UserA success', theMessage);
    expect(retries).toBe(3);
    expect(received).toBe(2);
    expect(receivedNull).toBe(1);
    expect(ackSent).toBe(2);
    expect(ackReceived).toBe(1);
    done();
  }).catch((error) => {
    console.log('slow user, retry few times - failed', error);
    expect(error).toBe(null);
    done();
  });
});

it('very slow user, fail eventually', (done) => {
  const gdm = new GuaranteeDeliveryManager(
    /* maxDelay= */ 200, /* retryDelay= */ 50, /* intervalsDelay =*/ 10);
  const userA = new User(/* messageSendDelay= */ 120);
  const userB = new User(/* messageSendDelay= */ 120);

  let retries = 0;
  let received = 0;
  let receivedNull = 0;
  let ackSent = 0;
  let ackReceived = 0;

  userA.setOnMessageCallback((message) => {
    // User A receives message.
    if (gdm.checkForAck(message)) {
      ackReceived++;
      return;  // ack message accepted don’t handle.
    }
    // Any other message...
    console.log('very slow user, fail eventually - UserA Some message received', message);
  });

  userB.setOnMessageCallback((message) => {
    gdm.acceptGuaranteeMessage(message, (msg) => { ackSent++; userA.send(Object.assign({}, msg)); }).then((message) => {
      received++;
      if (message === null) {
        receivedNull++;
        console.log('very slow user, fail eventually - UserB Already received this message, skip.', message);
        return;
      }
      console.log('very slow user, fail eventually - UserB onMessage', message);
    }).catch((error) => {
      console.log('very slow user, fail eventually - UserB Failed receiving message', error);
    })
  });

  // User A to send guarantee message to user B.
  const theMessage = {test: 'very slow user, fail eventually'};
  gdm.sendGuaranteeMessage(Object.assign({}, theMessage), (msg) => { retries++; userB.send(Object.assign({}, msg)); }).then(() => {
    console.log('very slow user, fail eventually - UserA success', theMessage);
    expect(true).toBe(false);  // Should not get here.
    done();
  }).catch((error) => {
    console.log('very slow user, fail eventually - failed', error);
    expect(error.reason).toBe(DEADLINE_EXCEEDED);
    expect(retries).toBe(4);
    expect(received).toBe(2);
    expect(receivedNull).toBe(1);
    expect(ackSent).toBe(2);
    expect(ackReceived).toBe(0);
    done();
  });
});

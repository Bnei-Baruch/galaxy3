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
    // console.log('send', message);
    setTimeout(() => this.onMessage(message), this.messageSendDelay);
  }

  onMessage(message) {
    if (this.onMessageCallback) {
      this.onMessageCallback(message);
    }
  }
}

it('messaged delivery guaranteed', (done) => {
  const gdmA = new GuaranteeDeliveryManager('userA',
    /* maxDelay= */ 2000, /* retryDelay= */ 500, /* intervalsDelay =*/ 100);
  const userA = new User(/* messageSendDelay= */ 10);
  const gdmB = new GuaranteeDeliveryManager('userB',
    /* maxDelay= */ 2000, /* retryDelay= */ 500, /* intervalsDelay =*/ 100);
  const userB = new User(/* messageSendDelay= */ 10);

  userA.setOnMessageCallback((message) => {
    // User A receives message.
    if (gdmA.checkAck(message)) {
      return;  // ack message accepted don’t handle.
    }
    // Any other message...
    console.log('messaged delivery guaranteed - UserA Some message received', message);
  });

  userB.setOnMessageCallback((message) => {
    gdmB.accept(message, (msg) => userA.send(Object.assign({}, msg))).then((message) => {
      if (message === null) {
        console.log('messaged delivery guaranteed - UserB Already received this message, skip.', message);
        return;
      }
      console.log('messaged delivery guaranteed - UserB onMessage', message);
    }).catch((error) => {
      console.log('messaged delivery guaranteed - UserB Failed receiving message', error);
    });
  });

  // User A to send guarantee message to user B.
  const theMessage = {test: 'messaged delivery guaranteed'};
  gdmA.send(Object.assign({}, theMessage), /* toAck= */ [], (msg) => userB.send(Object.assign({}, msg))).then(() => {
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
  const gdmA = new GuaranteeDeliveryManager('userA',
    /* maxDelay= */ 200, /* retryDelay= */ 50, /* intervalsDelay =*/ 10);
  const userA = new User(/* messageSendDelay= */ 70);
  const gdmB = new GuaranteeDeliveryManager('userB',
    /* maxDelay= */ 200, /* retryDelay= */ 50, /* intervalsDelay =*/ 10);
  const userB = new User(/* messageSendDelay= */ 70);

  let retries = 0;
  let received = 0;
  let receivedNull = 0;
  let ackSent = 0;
  let ackReceived = 0;

  userA.setOnMessageCallback((message) => {
    // User A receives message.
    if (gdmA.checkAck(message)) {
      ackReceived++;
      return;  // ack message accepted don’t handle.
    }
    // Any other message...
    console.log('slow user, retry few times - UserA Some message received', message);
  });

  userB.setOnMessageCallback((message) => {
    gdmB.accept(message, (msg) => { ackSent++; userA.send(Object.assign({}, msg)); }).then((message) => {
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
  gdmA.send(Object.assign({}, theMessage), /* toAck= */ [], (msg) => { retries++; userB.send(Object.assign({}, msg)); }).then(() => {
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
  const gdmA = new GuaranteeDeliveryManager('userA',
    /* maxDelay= */ 200, /* retryDelay= */ 50, /* intervalsDelay =*/ 10);
  const userA = new User(/* messageSendDelay= */ 120);
  const gdmB = new GuaranteeDeliveryManager('userB',
    /* maxDelay= */ 200, /* retryDelay= */ 50, /* intervalsDelay =*/ 10);
  const userB = new User(/* messageSendDelay= */ 120);

  let retries = 0;
  let received = 0;
  let receivedNull = 0;
  let ackSent = 0;
  let ackReceived = 0;

  userA.setOnMessageCallback((message) => {
    // User A receives message.
    if (gdmA.checkAck(message)) {
      ackReceived++;
      return;  // ack message accepted don’t handle.
    }
    // Any other message...
    console.log('very slow user, fail eventually - UserA Some message received', message);
  });

  userB.setOnMessageCallback((message) => {
    gdmB.accept(message, (msg) => { ackSent++; userA.send(Object.assign({}, msg)); }).then((message) => {
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
  gdmA.send(Object.assign({}, theMessage), /* toAck= */ [], (msg) => { retries++; userB.send(Object.assign({}, msg)); }).then(() => {
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

it('cannot implicitly ack myself', (done) => {
  const gdm = new GuaranteeDeliveryManager('userA',
    /* maxDelay= */ 2000, /* retryDelay= */ 500, /* intervalsDelay =*/ 100);
  const userA = new User(/* messageSendDelay= */ 10);
  const userB = new User(/* messageSendDelay= */ 10);

  userA.setOnMessageCallback((message) => {
    // User A receives message.
    if (gdm.checkAck(message)) {
      return;  // ack message accepted don’t handle.
    }
    // Any other message...
    console.log('cannot implicitly ack myself - UserA Some message received', message);
  });

  userB.setOnMessageCallback((message) => {
    gdm.accept(message, (msg) => userA.send(Object.assign({}, msg))).then((message) => {
      if (message === null) {
        console.log('cannot implicitly ack myself - UserB Already received this message, skip.', message);
        return;
      }
      console.log('cannot implicitly ack myself - UserB onMessage', message);
    }).catch((error) => {
      console.log('cannot implicitly ack myself - UserB Failed receiving message', error);
    });
  });

  // User A to send guarantee message to user B.
  const theMessage = {test: 'cannot implicitly ack myself'};
  gdm.send(Object.assign({}, theMessage), /* toAck= */ [], (msg) => userB.send(Object.assign({}, msg))).then(() => {
    console.log('cannot implicitly ack myself - UserA success', theMessage);
    expect(true).toBe(false);
    done();
  }).catch((error) => {
    console.log('cannot implicitly ack myself - failed', error);
    expect(true).toBe(true);  // Eventually not getting guarantee from self.
    done();
  });
});

it('can explicitl ack myself', (done) => {
  const gdm = new GuaranteeDeliveryManager('userA',
    /* maxDelay= */ 2000, /* retryDelay= */ 500, /* intervalsDelay =*/ 100);
  const userA = new User(/* messageSendDelay= */ 10);
  const userB = new User(/* messageSendDelay= */ 10);

  userA.setOnMessageCallback((message) => {
    // User A receives message.
    if (gdm.checkAck(message)) {
      return;  // ack message accepted don’t handle.
    }
    // Any other message...
    console.log('can explicitl ack myself - UserA Some message received', message);
  });

  userB.setOnMessageCallback((message) => {
    gdm.accept(message, (msg) => userA.send(Object.assign({}, msg))).then((message) => {
      if (message === null) {
        console.log('can explicitl ack myself - UserB Already received this message, skip.', message);
        return;
      }
      console.log('can explicitl ack myself - UserB onMessage', message);
    }).catch((error) => {
      console.log('can explicitl ack myself - UserB Failed receiving message', error);
    });
  });

  // User A to send guarantee message to user B.
  const theMessage = {test: 'can explicitl ack myself'};
  gdm.send(Object.assign({}, theMessage), /* toAck= */ ['userA'], (msg) => userB.send(Object.assign({}, msg))).then(() => {
    console.log('can explicitl ack myself - UserA success', theMessage);
    expect(true).toBe(true);  // Can explicitly ack myself.
    done();
  }).catch((error) => {
    console.log('can explicitl ack myself - failed', error);
    expect(true).toBe(false);
    done();
  });
});

// After moving to room data channel, messages don't come back to self, so
// adding selfId to not send the message to myself.
const sendToAll = (room, selfId, unreachableUsers = []) => (message) => {
  console.log('Sending', message, 'to room. Unreachable: ', unreachableUsers);
  for (const [userId, {gdm, user}] of Object.entries(room)) {
    if (!(unreachableUsers.includes(userId))) {
      user.send(Object.assign({}, message));
    }
  }
};

const createRoom = (numUsers) => {
  const room = {};
  for (let i = 0; i < numUsers; ++i) {
    const userId = `user_${i}`;
    room[userId] = {
      gdm: new GuaranteeDeliveryManager(userId, /* maxDelay= */ 2000, /* retryDelay= */ 500, /* intervalsDelay =*/ 100),
      user: new User(/* messageSendDelay= */ 10),
    };
    room[userId].user.setOnMessageCallback((message) => {
      console.log('Message received on channel', userId, message);
      if (room[userId].gdm.checkAck(message)) {
        console.log('checkAck, ack accepted', userId, message);
        return;  // ack message accepted don’t handle.
      }
      room[userId].gdm.accept(message, sendToAll(room, userId)).then((message) => {
        if (message === null) {
          console.log('accept received more then once', userId, message);
        } else {
          console.log('accept received', userId, message);
        }
      }).catch((error) => {
        console.error('accept failed', userId, error);
      });
    });
  }
  return room;
}

it('messaged delivery guaranteed to many users any', (done) => {
  const room = createRoom(10);
  const theMessage = {test: 'test'};
  room['user_0'].gdm.send(Object.assign({}, theMessage), /* toAck= */ [], sendToAll(room, 'user_0')).then(() => {
    console.log('messaged delivery guaranteed to many users any', theMessage);
    expect(true).toBe(true);
    done();
  }).catch((error) => {
    console.log('messaged delivery guaranteed to many users any - failed', error);
    expect(true).toBe(false);
    done();
  });
});

it('messaged delivery guaranteed to many users - specific user ack', (done) => {
  const room = createRoom(10);
  const theMessage = {test: 'test'};
  room['user_0'].gdm.send(Object.assign({}, theMessage), /* toAck= */ ['user_5'], sendToAll(room, 'user_0')).then(() => {
    console.log('messaged delivery guaranteed to many users - specific user ack', theMessage);
    expect(true).toBe(true);
    done();
  }).catch((error) => {
    console.log('messaged delivery guaranteed to many users - specific user ack - failed', error);
    expect(true).toBe(false);
    done();
  });
});

it('messaged delivery guaranteed to many users - some users ack', (done) => {
  const room = createRoom(10);
  const theMessage = {test: 'test'};
  room['user_0'].gdm.send(Object.assign({}, theMessage), /* toAck= */ ['user_5', 'user_2', 'user_9'], sendToAll(room, 'user_0')).then(() => {
    console.log('messaged delivery guaranteed to many users - some users ack', theMessage);
    expect(true).toBe(true);
    done();
  }).catch((error) => {
    console.log('messaged delivery guaranteed to many users - some users ack - failed', error);
    expect(true).toBe(false);
    done();
  });
});

it('messaged delivery guaranteed to many users - some users ack - one of them unreachable', (done) => {
  const room = createRoom(10);
  const theMessage = {test: 'test'};
  room['user_0'].gdm.send(Object.assign({}, theMessage), /* toAck= */ ['user_5', 'user_2', 'user_9'], sendToAll(room, 'user_0', /* unreachableUsers= */ ['user_2'])).then(() => {
    console.log('messaged delivery guaranteed to many users - some users ack - one of them unreachable', theMessage);
    expect(true).toBe(false);  // Should not happen.
    done();
  }).catch((error) => {
    console.log('messaged delivery guaranteed to many users - some users ack - one of them unreachable - failed', error);
    expect(error.reason).toBe(DEADLINE_EXCEEDED);
    done();
  });
});

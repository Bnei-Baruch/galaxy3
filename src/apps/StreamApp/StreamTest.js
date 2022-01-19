import JanusMQTT from "../../shared/janus-mqtt.js";

const jw = new JanusMQTT();
const jwObject = {
  sessionId: null,
  handlerId: null,
  pc: new RTCPeerConnection(null),
};
const channelId = 1;
const subscribeTopic = "from-janus";
const publishTopic = "to-janus";

function jwStart() {
  jw.connect().then((connection) => {
    jw.subscribe(subscribeTopic);

    jwObject.pc.onicecandidate = (e) => {
      jwSendCandidate(e.candidate);
    };
    jwObject.pc.onaddstream = (e) => {
      const remoteVideo = document.getElementById("remote");
      remoteVideo.srcObject = e.stream;
    };

    return jw.send(publishTopic, {
      janus: "create",
      transaction: jw._getRandomString(12),
    });
  });

  jw.onMessage = jwMessageHandler;
}

function jwMessageHandler(message) {
  const data = JSON.parse(message);

  console.log(data);

  switch (data.janus) {
    case "success":
      if (!jwObject.sessionId) jwCreateSession(data.data.id);
      else if (!jwObject.handlerId) jwCreateHandler(data.data.id);
      break;
    case "event":
      if (data.jsep) jwEventHanler(data.jsep);
      break;
    case "timeout":
      console.log(data);
      break;
  }
}

function jwCreateSession(id) {
  jwObject.sessionId = id;
  jw.send(publishTopic, {
    janus: "attach",
    session_id: jwObject.sessionId,
    transaction: jw._getRandomString(12),
    plugin: "janus.plugin.streaming",
  });
}

function jwCreateHandler(id) {
  jwObject.handlerId = id;
  jw.send(publishTopic, {
    janus: "message",
    session_id: jwObject.sessionId,
    handle_id: jwObject.handlerId,
    transaction: jw._getRandomString(12),
    body: {
      request: "watch",
      id: channelId,
    },
  });
}

function jwEventHanler(offer) {
  jwObject.pc.setRemoteDescription(offer);
  jwObject.pc.createAnswer().then(
    (desc) => {
      jwObject.pc.setLocalDescription(desc);
      jwSendDescription(desc);
    },
    (error) => console.log(error)
  );
}

function jwSendDescription(desc) {
  jw.send(publishTopic, {
    janus: "message",
    session_id: jwObject.sessionId,
    handle_id: jwObject.handlerId,
    transaction: jw._getRandomString(12),
    body: {
      request: "start",
    },
    jsep: desc,
  });
}

function jwSendCandidate(candidate) {
  jw.send(publishTopic, {
    janus: "trickle",
    session_id: jwObject.sessionId,
    handle_id: jwObject.handlerId,
    transaction: jw._getRandomString(12),
    candidate: candidate,
  });
}

jwStart();

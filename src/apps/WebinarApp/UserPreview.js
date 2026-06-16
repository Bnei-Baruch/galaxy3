import React, {Component} from "react";
import {SubscriberPlugin} from "../../lib/subscriber-plugin";
import log from "loglevel";

// Shared subscriber-only video for a SINGLE user feed.
//
// Unlike QuadJanus (which joins a videoroom as a publisher and subscribes to
// every feed in it), this attaches a SubscriberPlugin and subscribes to exactly
// one feed (the user's rfid) in their room. It is meant to be reused by both
// QuadOut (air-queue tiles) and AdminClient (click-to-preview a user).
//
// It does NOT own any Janus connection: the gateway pool and its lifecycle stay
// with the parent. We only ensure the gateway (via props.initJanus) and detach
// our own subscriber on unmount/switch - never destroying the parent's gateway.
//
// Props:
//   user      - the user object ({rfid, janus, room, ...}) to show
//   gateways   - parent's gateway pool: { [serverName]: JanusMqtt }
//   initJanus  - (serverName) => Promise<JanusMqtt>, ensures/returns a gateway
//   withAudio  - if true, also render and attach the audio track
//   className  - optional class for the <video> element
class UserPreview extends Component {
  state = {mids: []};
  subscriber = null;
  janus = null;

  componentDidMount() {
    this.attach(this.props.user);
  }

  componentWillUnmount() {
    this.detach();
  }

  componentDidUpdate(prevProps) {
    const key = (u) => (u ? u.rfid || u.id : null);
    const cur = this.props.user;
    const prev = prevProps.user;
    if (key(cur) !== key(prev) || cur?.janus !== prev?.janus || cur?.room !== prev?.room) {
      this.detach(() => this.attach(cur));
    }
  }

  ensureGateway = (name) => {
    const {gateways, initJanus} = this.props;
    const existing = gateways && gateways[name];
    if (existing && existing.isConnected) return Promise.resolve(existing);
    if (typeof initJanus === "function") {
      const p = initJanus(name);
      if (p && typeof p.then === "function") return p;
    }
    return existing ? Promise.resolve(existing) : Promise.reject(new Error("no gateway: " + name));
  };

  attach = (u) => {
    if (!u || !u.rfid || !u.janus || u.room == null) {
      log.warn("[preview] not enough data to subscribe: ", u);
      return;
    }
    this.ensureGateway(u.janus)
      .then((janus) => {
        if (!janus) return;
        this.janus = janus;
        this.doSubscribe(u, janus);
      })
      .catch((err) => log.error("[preview] gateway not ready: ", u.janus, err));
  };

  doSubscribe = (u, janus) => {
    const subscriber = new SubscriberPlugin();
    subscriber.onTrack = this.onRemoteTrack;
    subscriber.onUpdate = this.onUpdateStreams;
    this.subscriber = subscriber;

    janus
      .attach(subscriber)
      .then(() => {
        subscriber
          .join([{feed: u.rfid}], u.room)
          .then((data) => {
            log.info("[preview] subscriber join: ", data);
            if (data && data.streams) this.onUpdateStreams(data.streams);
          })
          .catch((err) => log.error("[preview] join error: ", err));
      })
      .catch((err) => log.error("[preview] attach error: ", err));
  };

  detach = (callback) => {
    const v = this.refs.video;
    if (v) {
      v.src = "";
      v.srcObject = null;
    }
    const a = this.refs.audio;
    if (a) {
      a.src = "";
      a.srcObject = null;
    }
    // Only detach our own subscriber; the gateway belongs to the parent.
    if (this.subscriber && this.janus) {
      try {
        this.janus.detach(this.subscriber);
      } catch (err) {
        log.warn("[preview] detach failed: ", err && err.message);
      }
    }
    this.subscriber = null;
    this.janus = null;
    this.setState({mids: []}, () => {
      if (typeof callback === "function") callback();
    });
  };

  onUpdateStreams = (streams) => {
    const mids = Object.assign([], this.state.mids);
    for (let i in streams) {
      mids[streams[i]["mid"]] = streams[i];
    }
    this.setState({mids});
  };

  onRemoteTrack = (track, stream, on) => {
    if (!on) return;
    if (track.kind === "video") {
      const v = this.refs.video;
      if (v) v.srcObject = stream;
    } else if (track.kind === "audio" && this.props.withAudio) {
      const a = this.refs.audio;
      if (a) a.srcObject = stream;
    }
  };

  render() {
    const {withAudio, className} = this.props;
    return (
      <React.Fragment>
        <video
          ref="video"
          className={className}
          autoPlay
          controls={false}
          muted={true}
          playsInline
        />
        {withAudio ? <audio ref="audio" autoPlay controls={false} playsInline /> : null}
      </React.Fragment>
    );
  }
}

export default UserPreview;

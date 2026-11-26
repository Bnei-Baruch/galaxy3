// Studio client for the hosts (entry "studio"):
//   ?event=<eventId>&slot=host1|host2|screen
//
// host1/host2 publish camera + mic, screen publishes a shared screen/tab with
// sound (the "third host", e.g. a prepared clip). All of them are in the studio
// VideoRoom and see/hear each other directly; the guest comes through the
// "guest" mountpoint. The backend forwards each publisher to the mountpoint of
// its slot (the slot is in the join display).
//
// slot=screen also controls the layout seen by the viewers (buttons + keys 1/2/3).

import React, {Component} from "react";
import {Button, Container, Label, Message, Segment} from "semantic-ui-react";
import log from "loglevel";
import {getUser, kc} from "../../components/UserManager";
import mqtt from "../../shared/mqtt";
import {JanusMqtt} from "../../lib/janus-mqtt";
import {PublisherPlugin} from "../../lib/publisher-plugin";
import {SubscriberPlugin} from "../../lib/subscriber-plugin";
import {LAYOUTS, publishLayout, queryParam, StudioStore} from "./studio";
import StudioStream from "./StudioStream";
import "./StudioClient.scss";

const HOST_SLOTS = ["host1", "host2", "screen"];
const LAYOUT_LABELS = {hosts: "1 · Ведущие", screen_hosts: "2 · Экран + ведущие", screen: "3 · Только экран"};

class Video extends Component {
  ref = (el) => {
    this.el = el;
    this.attach();
  };

  componentDidUpdate() {
    this.attach();
  }

  attach() {
    if (!this.el) return;
    if (this.el.srcObject !== this.props.stream) this.el.srcObject = this.props.stream || null;
    this.el.muted = !!this.props.muted;
  }

  render() {
    return <video ref={this.ref} autoPlay playsInline />;
  }
}

class StudioClient extends Component {
  state = {
    user: null,
    loginChecked: false,
    eventId: queryParam("event"),
    slot: queryParam("slot"),
    event: null,
    joined: false,
    publishing: false,
    localStream: null,
    feeds: {}, // feedId -> {display, stream}
    guestStream: null,
    error: null,
  };

  janus = null;
  publisher = null;
  subscriber = null;
  subscribed = new Set(); // feed ids
  capture = null;

  componentDidMount() {
    getUser((user) => this.setState({user, loginChecked: true}, () => user && this.init()));
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("beforeunload", this.leave);
  }

  componentWillUnmount() {
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("beforeunload", this.leave);
    this.leave();
    if (this.store) this.store.stop();
    if (this.guestStream) this.guestStream.stop();
  }

  init = () => {
    const {user, eventId, slot} = this.state;
    if (!eventId || !HOST_SLOTS.includes(slot)) {
      this.setState({error: "Нужны параметры ?event=<id>&slot=host1|host2|screen"});
      return;
    }
    mqtt.init(user, (reconnected, error) => {
      if (error) {
        this.setState({error: "Нет связи с MQTT"});
        return;
      }
      if (reconnected) return;
      mqtt.watch(() => {});
      this.store = new StudioStore(this.onEvents);
      this.store.start();
    });
  };

  onEvents = (events) => {
    const event = events[this.state.eventId] || null;
    const prev = this.state.event;
    this.setState({event});
    if (!event) return;
    if (!this.janus) this.joinStudio(event);
    if (!this.guestStream) {
      this.guestStream = new StudioStream(this.state.user, (slot, stream) => this.setState({guestStream: stream}), [
        "guest",
      ]);
    }
    if (!prev || prev.studio?.str !== event.studio?.str || prev.mountpoints?.guest !== event.mountpoints?.guest) {
      this.guestStream.start(event);
    }
  };

  // ---- Studio VideoRoom ------------------------------------------------------

  joinStudio = (event) => {
    const {user, slot} = this.state;
    const {janus: srv, room} = event.studio || {};
    if (!srv || !room) {
      this.setState({error: "У события не заданы studio.janus / studio.room"});
      return;
    }
    const janus = new JanusMqtt(user, srv, mqtt.clientId);
    janus.onStatus = (s, status) => {
      if (status !== "online") {
        log.warn("[studio-client] janus status:", status);
        this.setState({error: "Потеряна связь со студией, переподключение..."});
        this.leave();
        setTimeout(() => this.state.event && this.joinStudio(this.state.event), 5000);
      }
    };
    this.janus = janus;

    janus
      .init()
      .then(() => {
        const publisher = new PublisherPlugin();
        publisher.subTo = this.onPublishers;
        publisher.unsubFrom = this.onLeaving;
        publisher.talkEvent = () => {};
        publisher.iceFailed = () => this.setState({error: "Проблема с соединением (ICE)"});
        this.publisher = publisher;
        return janus.attach(publisher);
      })
      .then(() => {
        const display = {id: user.id, display: `${user.display} (${slot})`, role: "studio", slot, timestamp: Date.now()};
        return this.publisher.join(room, display, {slot});
      })
      .then((data) => {
        log.info("[studio-client] joined:", data);
        this.setState({joined: true, error: null});
        this.onPublishers(data.publishers || []);
        if (slot !== "screen") this.publishCamera();
      })
      .catch((err) => {
        log.error("[studio-client] join failed:", err);
        this.setState({error: "Не удалось войти в студию"});
      });
  };

  leave = () => {
    this.stopCapture();
    const janus = this.janus;
    this.janus = null;
    this.publisher = null;
    this.subscriber = null;
    this.subscribed = new Set();
    if (janus) {
      try {
        janus.destroy();
      } catch (e) {
        log.debug("[studio-client] destroy failed:", e && e.message);
      }
    }
    this.setState({joined: false, publishing: false, localStream: null, feeds: {}});
  };

  publishCamera = () => {
    navigator.mediaDevices
      .getUserMedia({audio: true, video: {width: 1280, height: 720}})
      .then((stream) => this.publish(stream, stream))
      .catch((err) => {
        log.error("[studio-client] getUserMedia failed:", err);
        this.setState({error: "Нет доступа к камере или микрофону"});
      });
  };

  startScreen = () => {
    navigator.mediaDevices
      .getDisplayMedia({video: {frameRate: 30}, audio: true, systemAudio: "include", preferCurrentTab: false})
      .then((capture) => {
        const v = capture.getVideoTracks()[0];
        const a = capture.getAudioTracks()[0];
        if (!a) {
          alert('Нет звука: выберите вкладку и отметьте "Поделиться звуком"');
        }
        try {
          v.contentHint = "motion";
        } catch (e) {
          /* not supported */
        }
        v.onended = () => this.stopScreen();
        this.capture = capture;
        this.publish(new MediaStream([v]), a ? new MediaStream([a]) : null, capture);
      })
      .catch((err) => log.info("[studio-client] getDisplayMedia cancelled:", err && err.name));
  };

  // Screen publishing restarts the whole studio session: a fresh publisher is
  // simpler and more reliable than renegotiating tracks on the old one.
  stopScreen = () => {
    const event = this.state.event;
    this.leave();
    if (event) setTimeout(() => this.joinStudio(event), 500);
  };

  publish = (video, audio, preview) => {
    if (!this.publisher) return;
    this.publisher
      .publish(video, audio)
      .then(() => this.setState({publishing: true, localStream: preview || video}))
      .catch((err) => {
        log.error("[studio-client] publish failed:", err);
        this.setState({error: "Не удалось начать публикацию"});
      });
  };

  stopCapture = () => {
    const tracks = [
      ...(this.capture ? this.capture.getTracks() : []),
      ...(this.state.localStream ? this.state.localStream.getTracks() : []),
    ];
    tracks.forEach((t) => {
      t.onended = null;
      try {
        t.stop();
      } catch (e) {
        /* already stopped */
      }
    });
    this.capture = null;
  };

  // Other publishers of the studio room: the other hosts and the screen.
  onPublishers = (publishers) => {
    const feeds = {...this.state.feeds};
    const subscription = [];
    publishers.forEach((p) => {
      if (this.subscribed.has(p.id)) return;
      let display = {};
      try {
        display = JSON.parse(p.display);
      } catch (e) {
        display = {display: p.display};
      }
      this.subscribed.add(p.id);
      feeds[p.id] = {display, stream: null};
      (p.streams || []).forEach((s) => {
        if (!s.disabled && (s.type === "video" || s.type === "audio")) subscription.push({feed: p.id, mid: s.mid});
      });
    });
    this.setState({feeds});
    if (subscription.length === 0 || !this.janus) return;

    if (!this.subscriber) {
      const subscriber = new SubscriberPlugin();
      subscriber.onTrack = this.onTrack;
      subscriber.onUpdate = () => {};
      subscriber.iceFailed = () => this.setState({error: "Проблема с соединением (ICE)"});
      this.subscriber = subscriber;
      this.janus
        .attach(subscriber)
        .then(() => subscriber.join(subscription, this.state.event.studio.room))
        .catch((err) => log.error("[studio-client] subscribe failed:", err));
    } else {
      this.subscriber.sub(subscription).catch((err) => log.error("[studio-client] sub failed:", err));
    }
  };

  onTrack = (track, stream, on) => {
    if (!on) return;
    const id = Number(stream.id) || stream.id;
    this.setState((state) => {
      const feed = state.feeds[id];
      if (!feed) return null;
      return {feeds: {...state.feeds, [id]: {...feed, stream}}};
    });
  };

  onLeaving = (ids) => {
    const feeds = {...this.state.feeds};
    ids.forEach((id) => {
      delete feeds[id];
      this.subscribed.delete(id);
    });
    this.setState({feeds});
    if (this.subscriber) {
      const p = this.subscriber.unsub(ids.map((feed) => ({feed})));
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  };

  // ---- Layout (slot=screen) -------------------------------------------------

  setLayout = (layout) => {
    const {event} = this.state;
    if (event) publishLayout(event.id, layout);
  };

  onKey = (e) => {
    if (this.state.slot !== "screen" || e.target.tagName === "INPUT") return;
    const layout = LAYOUTS[Number(e.key) - 1];
    if (layout) this.setLayout(layout);
  };

  // ---- Render -----------------------------------------------------------------

  renderTile = (key, stream, label, muted) => (
    <div className="studio-client__tile" key={key}>
      <Video stream={stream} muted={muted} />
      <Label className="studio-client__label" size="small">
        {label}
      </Label>
    </div>
  );

  render() {
    const {user, loginChecked, event, slot, joined, publishing, localStream, feeds, guestStream, error} = this.state;

    if (!loginChecked) return null;
    if (!user) {
      return (
        <Container textAlign="center" className="studio-client__login">
          <Message size="large">
            <Message.Header>Studio</Message.Header>
            <Button primary size="large" onClick={() => kc.login({redirectUri: window.location.href})}>
              Login
            </Button>
          </Message>
        </Container>
      );
    }

    const tiles = [];
    if (localStream) tiles.push(this.renderTile("me", localStream, `Я (${slot})`, true));
    Object.entries(feeds).forEach(([id, f]) => tiles.push(this.renderTile(id, f.stream, f.display?.display || id, false)));
    if (event?.guest) tiles.push(this.renderTile("guest", guestStream, `Гость: ${event.guest.display}`, false));

    return (
      <div className="studio-client">
        <Segment className="studio-client__bar" basic>
          <b>{event ? event.name : "Событие не найдено"}</b>
          <Label color={event?.active ? "red" : "grey"}>{event?.active ? "В ЭФИРЕ" : "не активно"}</Label>
          <Label>{slot}</Label>
          <Label color={joined ? "green" : "grey"}>{joined ? "в студии" : "не подключено"}</Label>
          {slot === "screen" && joined && !publishing && (
            <Button size="small" primary onClick={this.startScreen}>
              Поделиться экраном
            </Button>
          )}
          {slot === "screen" && publishing && (
            <Button size="small" negative onClick={this.stopScreen}>
              Остановить экран
            </Button>
          )}
          {slot === "screen" && event && (
            <Button.Group size="small">
              {LAYOUTS.map((l) => (
                <Button key={l} active={event.layout === l} color={event.layout === l ? "blue" : undefined} onClick={() => this.setLayout(l)}>
                  {LAYOUT_LABELS[l]}
                </Button>
              ))}
            </Button.Group>
          )}
        </Segment>
        {error && <Message negative>{error}</Message>}
        <div className={`studio-client__grid studio-client__grid--${tiles.length}`}>{tiles}</div>
      </div>
    );
  }
}

export default StudioClient;

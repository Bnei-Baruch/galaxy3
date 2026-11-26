// Quad of a studio event (entry "squad"): ?event=<eventId>
// Runs on a VM in Chrome; the screen is captured and fed into the event's
// "quad" mountpoint. Shows all rooms of the event, 16 per page with rotation.
// Based on WebinarApp/QuadOut, on the main galaxy infrastructure.
import React, {Component} from "react";
import {Grid, Message} from "semantic-ui-react";
import log from "loglevel";
import api from "../../../shared/Api";
import mqtt from "../../../shared/mqtt";
import {JanusMqtt} from "../../../lib/janus-mqtt";
import {MQTT_PWD} from "../../../shared/env";
import {queryParam, StudioStore} from "../studio";
import QuadUsers from "./QuadUsers";
import "./QuadOut.css";
import "./QuadUsers.scss";

const PAGE = 16;

class StudioQuadOut extends Component {
  constructor(props) {
    super(props);
    const eventId = queryParam("event");
    this.state = {
      eventId,
      event: null,
      groups: [],
      quads: [],
      round: 0,
      gateways: {},
      gxy_list: [],
      // Service identity: "squad-*" is a service id (shared/enums.js), one per event.
      user: {
        session: 0,
        handle: 0,
        role: "squad",
        display: "squad",
        id: "squad-" + eventId,
        name: "squad",
        email: "webout@galaxy.kli.one",
      },
    };
    this._initPromises = {};
  }

  componentDidMount() {
    if (!this.state.eventId) return;
    const {user} = this.state;
    mqtt.init(user, (reconnected, error) => {
      if (reconnected || error) return;
      mqtt.watch(() => {});
      this.store = new StudioStore((events) => this.setState({event: events[this.state.eventId] || null}, this.fetchRooms));
      this.store.start();
    });
    this._roomsTimer = setInterval(this.fetchRooms, 10 * 1000);
    this._pageTimer = setInterval(this.rotatePage, 60 * 1000);
  }

  componentWillUnmount() {
    clearInterval(this._roomsTimer);
    clearInterval(this._pageTimer);
    if (this.store) this.store.stop();
    Object.values(this.state.gateways).forEach((x) => x.destroy());
  }

  rotatePage = () => {
    const {groups, round} = this.state;
    const pages = Math.max(1, Math.ceil(groups.length / PAGE));
    const next = (round + 1) % pages;
    if (next !== round) this.setState({round: next}, this.fetchRooms);
  };

  fetchRooms = () => {
    const {event} = this.state;
    if (!event) return;
    const ids = new Set((event.rooms || []).map(Number));
    api.setAccessToken(MQTT_PWD);
    api
      .fetchActiveRooms()
      .then((rooms) => {
        // All rooms of the event that have people in them (no camera filter).
        const groups = (rooms || [])
          .filter((r) => ids.has(Number(r.room)) && (r.users || []).length > 0)
          .sort((a, b) => String(a.description).localeCompare(String(b.description)));
        let round = this.state.round;
        if (round * PAGE >= groups.length) round = 0;
        const quads = groups.slice(round * PAGE, round * PAGE + PAGE);
        if (quads.length > 0) this.initServers(quads);
        this.setState({groups, quads, round});
      })
      .catch((err) => log.error("[squad] error fetching active rooms", err));
  };

  initServers = (quads) => {
    const {gateways, gxy_list} = this.state;
    const uniq = [...new Set(quads.map((k) => k.janus))];
    const added = uniq.filter((x) => !gxy_list.includes(x));
    this.setState({gxy_list: uniq});
    if (added.length > 0) {
      uniq.forEach((gxy) => {
        if (!gateways[gxy]?.isConnected) this.initJanus(gxy).catch(() => {});
      });
    }
    this.cleanSession(uniq);
  };

  initJanus = (gxy) => {
    const {gateways, user} = this.state;
    if (gateways[gxy]?.isConnected) return Promise.resolve(gateways[gxy]);
    if (this._initPromises[gxy]) return this._initPromises[gxy];

    const janus = new JanusMqtt(user, gxy, gxy);
    gateways[gxy] = janus;
    janus.onStatus = (srv, status) => {
      if (status !== "online") {
        log.error("[" + srv + "] Janus: ", status);
        delete this._initPromises[srv];
        setTimeout(() => this.initJanus(srv), 10000);
      }
    };
    const p = janus
      .init()
      .then(() => {
        this.setState({gateways});
        return janus;
      })
      .catch((err) => {
        log.error("[" + gxy + "] Janus init", err);
        delete this._initPromises[gxy];
        throw err;
      });
    this._initPromises[gxy] = p;
    return p;
  };

  cleanSession = (uniq) => {
    const {gateways} = this.state;
    Object.keys(gateways).forEach((key) => {
      const session = gateways[key];
      const empty = Object.keys(session.pluginHandles || {}).length === 0;
      if (empty && !uniq.includes(key)) {
        session.destroy();
        delete gateways[key];
      }
    });
  };

  setProps = (props) => this.setState({...props});

  render() {
    const {eventId, event} = this.state;
    if (!eventId) return <Message negative content="Нужен параметр ?event=<id>" />;
    if (event && !event.active) return <div className="sdi_container" />;

    const col = (index) => <QuadUsers index={index} {...this.state} setProps={this.setProps} />;
    return (
      <Grid columns={2} className="sdi_container">
        <Grid.Row className="sdi_top">
          <Grid.Column>{col(0)}</Grid.Column>
          <Grid.Column>{col(4)}</Grid.Column>
        </Grid.Row>
        <Grid.Row className="sdi_bottom">
          <Grid.Column>{col(8)}</Grid.Column>
          <Grid.Column>{col(12)}</Grid.Column>
        </Grid.Row>
      </Grid>
    );
  }
}

export default StudioQuadOut;

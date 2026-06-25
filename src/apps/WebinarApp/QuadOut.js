import React, {Component, Fragment} from "react";
import {Grid} from "semantic-ui-react";
import "./QuadOut.css";
import "./QuadUsers.scss";
import api from "../../shared/Api";
import QuadUsers from "./QuadUsers";
import UserPreview from "./UserPreview";
import mqtt from "../../shared/mqtt";
import log from "loglevel";
import {JanusMqtt} from "../../lib/janus-mqtt";
import version from './Version.js';
import {MQTT_PWD} from "../../shared/env";

// Retained MQTT topic carrying the broadcast (air) queue as an array of full
// user objects (each tagged with on_air). Published by AdminClient; consumed
// here. TODO: keep in sync with AdminClient's AIR_QUEUE_TOPIC.
const AIR_QUEUE_TOPIC = "webinar/room/air_queue";

class QuadOut extends Component {
  state = {
    qg: null,
    group: null,
    room: null,
    groups: [],
    groups_queue: 0,
    shidur_mode: "beyahad",
    round: 0,
    questions: [],
    air_queue: [],
    quads: [],
    rooms: [],
    user: {
      session: 0,
      handle: 0,
      role: "webout",
      display: "wquad",
      id: "wquad",
      name: "wquad",
      email: "wquad@galaxy.kli.one",
    },
    qcol: 0,
    gateways: {},
    gatewaysInitialized: false,
    appInitError: null,
    vote: false,
    roomsStatistics: {},
    reinit_inst: null,
    pnum: {},
    gxy_list: []
  };

  // In-flight Janus init promises keyed by server name (dedup concurrent inits).
  _initPromises = {};

  componentDidMount() {
    log.info(" :: Version :: ", version);
    this.initApp();
    setTimeout(() => {
      this.fetchRooms()
    },3000)
  }

  componentWillUnmount() {
    Object.values(this.state.gateways).forEach((x) => x.destroy());
  }

  initApp = () => {
    const {user} = this.state;
    console.log(" :: Version :: ", version);
    this.setState({user});
    this.initMQTT(user);
    this.pollRooms();
  };

  initMQTT = (user) => {
    mqtt.init(user, (data) => {
      log.info("[WebOut] mqtt init: ", data);
      // Retained topic: we get the current air queue immediately on subscribe.
      mqtt.join(AIR_QUEUE_TOPIC);
      mqtt.watch((msg, topic) => {
        if (topic === AIR_QUEUE_TOPIC) {
          this.setState({air_queue: Array.isArray(msg) ? msg : []});
        }
      });
    });
  };

  pollRooms = () => {
    this.fetchRooms();
    setInterval(this.fetchRooms, 10 * 1000);
  };

  fetchRooms = () => {
    let {disabled_rooms, groups, shidur_mode, region_groups} = this.state;
    api.setAccessToken(MQTT_PWD);
    api
      .fetchActiveRooms()
      .then((data) => {
        let rooms = data;

        if (shidur_mode === "nashim") {
          rooms = rooms.filter((r) => r.description.match(/^W /));
        } else if (shidur_mode === "gvarim") {
          rooms = rooms.filter((r) => !r.description.match(/^W /));
        } else if (shidur_mode === "beyahad") {
          this.setState({shidur_mode: ""});
        }

        groups = rooms.filter((r) => r.users.filter((r) => r.camera).length > 1);

        let quads = [
          ...this.col1.state.vquad,
          ...this.col2.state.vquad,
          ...this.col3.state.vquad,
          ...this.col4.state.vquad,
        ];
        let quads_list = quads.filter(k => k)
        if(quads_list.length > 0) this.initServers(quads_list);

        this.setState({quads, rooms, groups, disabled_rooms, region_groups});
      })
      .catch((err) => {
        log.error("[WebOut] error fetching active rooms", err);
      });
  };

  initServers = (quads_list) => {
    const {gateways, gxy_list} = this.state;
    //let quads_list = [...qids.q1.vquad, ...qids.q2.vquad, ...qids.q3.vquad, ...qids.q4.vquad];
    let Janus_list = quads_list.map(k => k.janus);
    let uniq_list = [...new Set(Janus_list)];
    let added_list = uniq_list.filter(x => !gxy_list.includes(x));
    this.setState({gxy_list: uniq_list});
    if(added_list.length > 0) {
      log.info("[WebOut] -- NEW SERVERS -- ", added_list);
      uniq_list.map(gxy => {
        if(!gateways[gxy]?.isConnected) {
          this.initJanus(gxy).catch(() => {});
        }
      })
    }
    if(uniq_list) this.cleanSession(uniq_list);
  }

  // Returns a Promise that resolves to a connected gateway. Reused both by the
  // grid (initServers) and by UserPreview (air-queue tiles) via ensureGateway,
  // so we cache in-flight inits to avoid opening duplicate sessions per server.
  initJanus = (gxy) => {
    const {gateways, user} = this.state;
    if (gateways[gxy]?.isConnected) return Promise.resolve(gateways[gxy]);
    if (this._initPromises[gxy]) return this._initPromises[gxy];

    log.info("["+gxy+"] Janus init")
    const janus = new JanusMqtt(user, gxy, gxy);
    gateways[gxy] = janus;
    janus.onStatus = (srv, status) => {
      if (status !== "online") {
        log.error("["+srv+"] Janus: ", status);
        delete this._initPromises[srv];
        setTimeout(() => {
          this.initJanus(srv);
        }, 10000)
      }
    };
    const p = janus.init().then((data) => {
      log.info("["+gxy+"] Janus init success", data)
      this.setState({gateways});
      return janus;
    }).catch((err) => {
      log.error("["+gxy+"] Janus init", err);
      delete this._initPromises[gxy];
      throw err;
    });
    this._initPromises[gxy] = p;
    return p;
  };

  cleanSession = (uniq_list) => {
    log.info("[WebOut] -- uniq_list -- ", uniq_list)
    const {gateways} = this.state;
    Object.keys(gateways).forEach(key => {
      const session = gateways[key];
      const sessionEmpty = Object.keys(session.pluginHandles).length === 0;
      const gxyOnProgram = uniq_list.find(g => g === key);
      if(sessionEmpty && !gxyOnProgram) {
        log.info("[WebOut] -- CLEAN SERVER -- ", key)
        session.destroy();
        delete gateways[key]
      }
    })
  }

  setProps = (props) => {
    this.setState({...props});
  };

  // Top strip with the operator-curated air queue. Rendered as its own block
  // ABOVE the grid (never inside it) so showing/hiding it just shifts the grid
  // and can't disturb the fixed 2x2 column layout.
  renderAirQueue = () => {
    const {air_queue} = this.state;
    if (!air_queue || air_queue.length === 0) return null;
    return (
      <div className="air_queue_strip">
        {air_queue.map((u, i) => (
          <div
            key={u.rfid || u.id || i}
            className={"air_queue_tile" + (u.on_air ? " air_queue_tile__onair" : "")}
          >
            <UserPreview
              user={u}
              gateways={this.state.gateways}
              initJanus={this.initJanus}
              className="air_queue_tile__video"
            />
            <div className="air_queue_tile__name">{u.display}</div>
          </div>
        ))}
      </div>
    );
  };

  render() {
    let {qg} = this.state;
    return (
      <Fragment>
        {this.renderAirQueue()}
        <Grid columns={2} className="sdi_container">
        <Grid.Row className="sdi_top">
          <Grid.Column>
            <QuadUsers
              index={0}
              qst={qg}
              {...this.state}
              ref={(col1) => {this.col1 = col1;}}
              setProps={this.setProps}
            />
          </Grid.Column>
          <Grid.Column>
            <QuadUsers
              index={4}
              qst={qg}
              {...this.state}
              ref={(col2) => {this.col2 = col2;}}
              setProps={this.setProps}
            />
          </Grid.Column>
        </Grid.Row>
        <Grid.Row className="sdi_bottom">
          <Grid.Column>
            <QuadUsers
              index={8}
              qst={qg}
              {...this.state}
              ref={(col3) => {this.col3 = col3;}}
              setProps={this.setProps}
            />
          </Grid.Column>
          <Grid.Column>
            <QuadUsers
              index={12}
              qst={qg}
              {...this.state}
              ref={(col4) => {this.col4 = col4;}}
              setProps={this.setProps}
            />
          </Grid.Column>
        </Grid.Row>
        </Grid>
      </Fragment>
    );
  }
}

export default QuadOut;

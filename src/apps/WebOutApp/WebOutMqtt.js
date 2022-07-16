import React, {Component} from "react";
import {Grid} from "semantic-ui-react";
import "./WebOutApp.css";
import "./UsersQuad.scss";
import api from "../../shared/Api";
import {API_BACKEND_PASSWORD, API_BACKEND_USERNAME} from "../../shared/env";
import GxyJanus from "../../shared/janus-utils";
import UsersQuad from "./UsersQuad";
import mqtt from "../../shared/mqtt";
import log from "loglevel";
import ConfigStore from "../../shared/ConfigStore";
import {JanusMqtt} from "../../lib/janus-mqtt";

class WebOutApp extends Component {
  state = {
    qg: null,
    group: null,
    room: null,
    groups: [],
    groups_queue: 0,
    shidur_mode: "nashim",
    round: 0,
    questions: [],
    quads: [],
    rooms: [],
    user: {
      session: 0,
      handle: 0,
      role: "webout",
      display: "webout",
      id: "webout",
      name: "webout",
      email: "webout@galaxy.kli.one",
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

  componentDidMount() {
    this.initApp();
    setTimeout(() => {
      this.fetchRooms()
    },1000)
  }

  componentWillUnmount() {
    Object.values(this.state.gateways).forEach((x) => x.destroy());
  }

  pollRooms = () => {
    this.fetchRooms();
    setInterval(this.fetchRooms, 10 * 1000);
  };

  fetchRooms = () => {
    let {disabled_rooms, groups, shidur_mode, region_groups} = this.state;
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

        groups = rooms.filter((r) => r.users.filter((r) => r.camera).length > 3);

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

  initApp = () => {
    const {user} = this.state;

    api.setBasicAuth(API_BACKEND_USERNAME, API_BACKEND_PASSWORD);

    api.fetchConfig().then(data => {
      ConfigStore.setGlobalConfig(data);
      GxyJanus.setGlobalConfig(data);
    }).then(() => this.initMQTT(user))
      .then(this.pollRooms)
      .catch((err) => {
        log.error("[WebOut] error initializing app", err);
        this.setState({appInitError: err});
      });
  };

  initMQTT = (user) => {
    mqtt.init(user, (data) => {
      log.info("[WebOut] mqtt init: ", data);
      mqtt.watch(() => {});
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
          this.initJanus(gxy, uniq_list);
        }
      })
    }
    if(uniq_list) this.cleanSession(uniq_list);
  }

  initJanus = (gxy) => {
    log.info("["+gxy+"] Janus init")
    const {user, gateways} = this.state;
    const token = ConfigStore.globalConfig.gateways.rooms[gxy].token
    gateways[gxy] = new JanusMqtt(user, gxy, gxy);
    gateways[gxy].init(token).then(data => {
      log.info("["+gxy+"] Janus init success", data)
      gateways[gxy].onStatus = (srv, status) => {
        if (status !== "online") {
          log.error("["+srv+"] Janus: ", status);
          setTimeout(() => {
            this.initJanus(srv);
          }, 10000)
        }
      }
    }).catch(err => {
      log.error("["+gxy+"] Janus init", err);
    })
  };

  cleanSession = (uniq_list) => {
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

  render() {
    let {qg} = this.state;
    return (
      <Grid columns={2} className="sdi_container">
        <Grid.Row className="sdi_top">
          <Grid.Column>
            <UsersQuad
              index={0}
              qst={qg}
              {...this.state}
              ref={(col1) => {this.col1 = col1;}}
              setProps={this.setProps}
            />
          </Grid.Column>
          <Grid.Column>
            <UsersQuad
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
            <UsersQuad
              index={8}
              qst={qg}
              {...this.state}
              ref={(col3) => {this.col3 = col3;}}
              setProps={this.setProps}
            />
          </Grid.Column>
          <Grid.Column>
            <UsersQuad
              index={12}
              qst={qg}
              {...this.state}
              ref={(col4) => {this.col4 = col4;}}
              setProps={this.setProps}
            />
          </Grid.Column>
        </Grid.Row>
      </Grid>
    );
  }
}

export default WebOutApp;

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
        this.setState({rooms, groups, disabled_rooms, region_groups});
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
    }).then(() => this.initGateways(user))
      .then(this.pollRooms)
      .catch((err) => {
        log.error("[WebOut] error initializing app", err);
        this.setState({appInitError: err});
      });
  };

  initGateways = (user) => {
    mqtt.init(user, (data) => {
      log.info("[WebOut] mqtt init: ", data);
      mqtt.watch(() => {});
      Object.keys(ConfigStore.globalConfig.gateways.rooms).forEach(gxy => {
        this.initJanus(user, gxy)
      })
    });
  };

  initJanus = (user, gxy) => {
    log.info("["+gxy+"] Janus init")
    const {gateways} = this.state;
    const token = ConfigStore.globalConfig.gateways.rooms[gxy].token
    gateways[gxy] = new JanusMqtt(user, gxy, gxy);
    gateways[gxy].init(token).then(data => {
      log.info("["+gxy+"] Janus init success", data)
    }).catch(err => {
      log.error("["+gxy+"] Janus init", err);
    })
    gateways[gxy].onStatus = (srv, status) => {
      if (status !== "online") {
        log.error("["+srv+"] Janus: ", status);
        setTimeout(() => {
          this.initJanus(user, srv);
        }, 10000)
      }
    }
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
              ref={(col1) => {
                this.col1 = col1;
              }}
              setProps={this.setProps}
            />
          </Grid.Column>
          <Grid.Column>
            <UsersQuad
              index={4}
              qst={qg}
              {...this.state}
              ref={(col2) => {
                this.col2 = col2;
              }}
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
              ref={(col3) => {
                this.col3 = col3;
              }}
              setProps={this.setProps}
            />
          </Grid.Column>
          <Grid.Column>
            <UsersQuad
              index={12}
              qst={qg}
              {...this.state}
              ref={(col4) => {
                this.col4 = col4;
              }}
              setProps={this.setProps}
            />
          </Grid.Column>
        </Grid.Row>
      </Grid>
    );
  }
}

export default WebOutApp;

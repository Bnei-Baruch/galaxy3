import React, {Component, Fragment} from 'react';
import {Grid} from "semantic-ui-react";
import './WebOutApp.css';
import './UsersQuad.scss'
import api from "../../shared/Api";
import {API_BACKEND_PASSWORD, API_BACKEND_USERNAME} from "../../shared/env";
import GxyJanus from "../../shared/janus-utils";
import UsersQuad from "./UsersQuad";
import {captureException} from "../../shared/sentry";


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
  };

  componentWillUnmount() {
    Object.values(this.state.gateways).forEach(x => x.destroy());
  };

  pollRooms = () => {
    this.fetchRooms();
    setInterval(this.fetchRooms, 10 * 1000)
  };

  fetchRooms = () => {
    let {disabled_rooms, groups, shidur_mode, region_groups} = this.state;
    api.fetchActiveRooms()
      .then((data) => {
        let rooms = data;

        if(shidur_mode === "nashim") {
          rooms = rooms.filter(r => r.description.match(/^W /));
        } else if(shidur_mode === "gvarim") {
          rooms = rooms.filter(r => !r.description.match(/^W /));
        } else if(shidur_mode === "beyahad") {
          this.setState({shidur_mode: ""})
        }

        groups = rooms.filter(r => r.users.filter(r => r.camera).length > 3);
        this.setState({rooms, groups, disabled_rooms, region_groups});
      })
      .catch(err => {
        console.error("[Shidur] error fetching active rooms", err);
      })
  };

  initApp = () => {
    const {user} = this.state;
    api.setBasicAuth(API_BACKEND_USERNAME, API_BACKEND_PASSWORD);

    api.fetchConfig()
      .then(data => GxyJanus.setGlobalConfig(data))
      .then(() => this.initGateways(user))
      .then(this.pollRooms)
      .catch(err => {
        console.error("[SDIOut] error initializing app", err);
        this.setState({appInitError: err});
        captureException(err, {source: 'SDIOut'});
      });
  };

  initGateways = (user) => {
    const gateways = GxyJanus.makeGateways("rooms");
    this.setState({gateways});
    Object.values(gateways).map(gateway => gateway.init());
  };

  setProps = (props) => {
    this.setState({...props})
  };

  render() {
    let {qg} = this.state;
    return (
      <Grid columns={2} className="sdi_container">
        <Grid.Row className="sdi_top">
          <Grid.Column>
            <UsersQuad index={0} qst={qg} {...this.state}
                       ref={col1 => {this.col1 = col1;}} setProps={this.setProps} />
          </Grid.Column>
          <Grid.Column>
            <UsersQuad index={4} qst={qg}  {...this.state}
                       ref={col2 => {this.col2 = col2;}} setProps={this.setProps} />
          </Grid.Column>
        </Grid.Row>
        <Grid.Row className="sdi_bottom">
          <Grid.Column>
            <UsersQuad index={8} qst={qg}  {...this.state}
                       ref={col3 => {this.col3 = col3;}} setProps={this.setProps} />
          </Grid.Column>
          <Grid.Column>
            <UsersQuad index={12} qst={qg}  {...this.state}
                       ref={col4 => {this.col4 = col4;}} setProps={this.setProps} />
          </Grid.Column>
        </Grid.Row>
      </Grid>
    );
  }
}

export default WebOutApp;

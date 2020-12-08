import React, {Component, Fragment} from 'react';
import {Grid} from "semantic-ui-react";
import './WebOutApp.css';
import './UsersQuad.scss'
import {USERNAME_ALREADY_EXIST_ERROR_CODE, SDIOUT_ID} from "../../shared/consts";
import api from "../../shared/Api";
import {API_BACKEND_PASSWORD, API_BACKEND_USERNAME} from "../../shared/env";
import GxyJanus from "../../shared/janus-utils";
import UsersQuad from "./UsersQuad";
import {GuaranteeDeliveryManager} from '../../shared/GuaranteeDelivery';
import {captureException, captureMessage} from "../../shared/sentry";


class WebOutApp extends Component {

  state = {
    qg: null,
    group: null,
    room: null,
    groups: [],
    groups_queue: 0,
    shidur_mode: "",
    round: 0,
    questions: [],
    quads: [],
    rooms: [],
    user: {
      session: 0,
      handle: 0,
      role: "sdiout",
      display: "sdiout",
      id: "webout",
      name: "sdiout",
    },
    qcol: 0,
    gateways: {},
    gatewaysInitialized: false,
    appInitError: null,
    vote: false,
    gdm: new GuaranteeDeliveryManager(SDIOUT_ID),
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
    setInterval(this.fetchRooms, 2 * 1000)
  };

  fetchRooms = () => {
    let {disabled_rooms, groups, shidur_mode, preusers_count, region, region_groups} = this.state;
    api.fetchActiveRooms()
      .then((data) => {
        const users_count = data.map(r => r.num_users).reduce((su, cur) => su + cur, 0);

        let rooms = data;

        if(shidur_mode === "nashim") {
          rooms = rooms.filter(r => r.description.match(/^W /));
        } else if(shidur_mode === "gvarim") {
          rooms = rooms.filter(r => !r.description.match(/^W /));
        } else if(shidur_mode === "beyahad") {
          this.setState({shidur_mode: ""})
        }

        groups = rooms.filter(r => !r.extra?.disabled);

        // Extra exist and disabled
        disabled_rooms = rooms.filter(r => r.extra?.disabled);

        //let quads = [...this.col1.state.vquad,...this.col2.state.vquad,...this.col3.state.vquad,...this.col4.state.vquad];
        //let list = groups.filter(r => !quads.find(q => q && r.room === q.room));
        //let questions = list.filter(room => room.questions);
        this.setState({users_count, rooms, groups, disabled_rooms, region_groups});
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

    const gatewayToInitPromise = (gateway) => this.initGateway(user, gateway)
      .catch(error => {
        captureException(error, {source: 'SDIOut', gateway: gateway.name});
        throw error;
      });

    return Promise.all(Object.values(gateways).map(gatewayToInitPromise))
      .then(() => {
        console.log("[SDIOut] gateways initialization complete");
        this.setState({gatewaysInitialized: true});
      });
  };

  initGateway = (user, gateway) => {
    console.log("[SDIOut] initializing gateway", gateway.name);

    gateway.addEventListener("reinit", () => {
        this.setState({reinit_inst: gateway.name});
        this.postInitGateway(user, gateway)
          .catch(err => {
            console.error("[SDIOut] postInitGateway error after reinit. Reloading", gateway.name, err);
            captureException(err, {source: 'SDIOut', gateway: gateway.name});
            this.initGateway(user, gateway);
          });
      }
    );

    return gateway.init()
      .then(() => this.postInitGateway(user, gateway))
      .catch(err => {
        console.error("[SDIOut] error initializing gateway", gateway.name, err);
        setTimeout(() => {
          this.initGateway(user, gateway)
            .catch(err => captureException(err, {source: 'SDIOut', gateway: gateway.name}));
        }, 10000);
      });
  };

  postInitGateway = (user, gateway) => {
    if (gateway.name === "gxy3") {
      return gateway.initServiceProtocol(user, data => this.onServiceData(gateway, data));
    }
    return Promise.resolve();
  };

  onServiceData = (gateway, data, user) => {
    const { gdm } = this.state;
    if (gdm.checkAck(data)) {
      // Ack received, do nothing.
      return;
    }
    gdm.accept(data, (msg) => gateway.sendServiceMessage(msg)).then((data) => {
      if (data === null) {
        console.log('Message received more then once.');
        return;
      }

      if (data.type === "error") {
        if (data.error_code === USERNAME_ALREADY_EXIST_ERROR_CODE) {
          console.error("[SDIOut] service error message (reloading in 10 seconds)", data.error);
          captureMessage(data.error, {source: "SDIOut", msg: data});
          setTimeout(() => {
            this.initGateway(user, gateway);
          }, 10000);
        } else {
          captureException(data.error, {source: "SDIOut", msg: data});
        }
      }

      const {room, col, feed, group, i, status, qst} = data;

      if(data.type === "sdi-fullscr_group" && status) {
        if(qst) {
          this.setState({col, i, group, room, qg: this.state.qids["q"+col].vquad[i]})
        } else {
          this["col"+col].toFullGroup(i,feed);
        }
      } else if(data.type === "sdi-fullscr_group" && !status) {
        let {col, feed, i} = data;
        if(qst) {
          this.setState({group: null, room: null, qg: null});
        } else {
          this["col"+col].toFourGroup(i,feed);
        }
      } else if(data.type === "sdi-vote") {
        if(this.state.group)
          return
        this.setState({vote: status, qg: null});
      } else if(data.type === "sdi-restart_sdiout") {
        window.location.reload();
      } else if(data.type === "event") {
        delete data.type;
        this.setState({...data});
      }
    }).catch((error) => {
      console.error(`Failed receiving ${data}: ${error}`);
    });
  };

  setProps = (props) => {
    this.setState({...props})
  };

  render() {
    let {appInitError, gatewaysInitialized,qg} = this.state;
    if (appInitError) {
      return (
        <Fragment>
          <h1>Error Initializing Application</h1>
          {`${appInitError}`}
        </Fragment>
      );
    }

    if (!gatewaysInitialized) {
      return "Initializing WebRTC gateways...";
    }

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

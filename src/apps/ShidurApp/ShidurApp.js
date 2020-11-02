import React, {Component, Fragment} from 'react';
import {Grid, Confirm} from "semantic-ui-react";
import api from '../../shared/Api';
import {kc} from "../../components/UserManager";
import GxyJanus from "../../shared/janus-utils";
import LoginPage from "../../components/LoginPage";
import ShidurToran from "./ShidurToran";
import UsersQuad from "./UsersQuad";
import './ShidurApp.css'
import {USERNAME_ALREADY_EXIST_ERROR_CODE, LOST_CONNECTION, STORAN_ID} from "../../shared/consts"
import {GuaranteeDeliveryManager} from '../../shared/GuaranteeDelivery';
import {captureException, captureMessage, updateSentryUser} from "../../shared/sentry";
import {getDateString} from "../../shared/tools";


class ShidurApp extends Component {

  state = {
    ce: null,
    delay: false,
    full_qst: false,
    full_feed: {},
    full_group: {},
    full_col: null,
    group: "",
    groups: [],
    groups_queue: 0,
    shidur_mode: "",
    preview_mode: true,
    round: 0,
    questions: [],
    quads: [],
    rooms: [],
    disabled_rooms: [],
    pre_groups: [],
    user: null,
    gateways: {},
    gatewaysInitialized: false,
    appInitError: null,
    presets: {1:[],2:[],3:[],4:[]},
    sdiout: false,
    sndman: false,
    users_count: 0,
    gdm: new GuaranteeDeliveryManager(STORAN_ID),
    alert: false,
    timer: 10,
    lost_servers: [],
    roomsStatistics: {},
    reinit_inst: null,
    log_list: [],
    preusers_count: 6,
  };

  componentWillUnmount() {
    Object.values(this.state.gateways).forEach(x => x.destroy());
  };

  componentDidUpdate(prevProps, prevState) {
    let {groups} = this.state;
    if(groups.length > prevState.groups.length) {
      let res = groups.filter(o => !prevState.groups.some(v => v.room === o.room))[0];
      console.debug("[Shidur] :: Group enter in queue: ", res);
      this.actionLog(res, "enter");
    } else if(groups.length < prevState.groups.length) {
      let res = prevState.groups.filter(o => !groups.some(v => v.room === o.room))[0];
      console.debug("[Shidur] :: Group exit from queue: ", res);
      this.actionLog(res, "leave");
    }
  };

  checkPermission = (user) => {
    const allowed = kc.hasRealmRole("gxy_shidur");
    if (allowed) {
      delete user.roles;
      user.role = "shidur";
      user.session = 0;
      this.initApp(user);
    } else {
      alert("Access denied!");
      kc.logout();
      updateSentryUser(null);
    }
  };

  initApp = (user) => {
    this.setState({user});
    updateSentryUser(user);
    api.fetchConfig()
      .then(data => GxyJanus.setGlobalConfig(data))
      .then(() => this.initGateways(user))
      .then(this.pollRooms)
      .catch(err => {
        console.error("[Shidur] error initializing app", err);
        this.setState({appInitError: err});
        captureException(err, {source: 'ShidurApp'});
      });
  };

  initGateways = (user) => {
    const gateways = GxyJanus.makeGateways("rooms");
    this.setState({gateways});

    const gatewayToInitPromise = (gateway) => this.initGateway(user, gateway)
      .catch(error => {
        captureException(error, {source: 'ShidurApp', gateway: gateway.name});
        throw error;
      });

    return Promise.all(Object.values(gateways).map(gatewayToInitPromise))
      .then(() => {
        console.log("[Shidur] gateways initialization complete");
        this.setState({gatewaysInitialized: true});
      });
  };

  initGateway = (user, gateway) => {
    console.log("[Shidur] initializing gateway", gateway.name);

    gateway.addEventListener("reinit", () => {
        this.setState({reinit_inst: gateway.name});
        this.postInitGateway(user, gateway)
          .catch(err => {
            console.error("[Shidur] postInitGateway error after reinit. Reloading", gateway.name, err);
            this.initGateway(user, gateway);
          });
      }
    );

    gateway.addEventListener("net-lost", (err) => {
        if(err.detail === LOST_CONNECTION)
          this.reinitTimer(gateway);
      }
    );

    return gateway.init()
      .then(() => this.postInitGateway(user, gateway))
      .catch(err => {
        console.error("[Shidur] error initializing gateway. Will retry postInitGateway in 10 seconds.", gateway.name, err);
        captureException(err, {source: 'ShidurApp', gateway: gateway.name});
        setTimeout(() => {
          this.initGateway(user, gateway)
            .catch(err => {
              console.error("[Shidur] error initializing gateway.", gateway.name, err);
              captureException(err, {source: 'ShidurApp', gateway: gateway.name});
            });
        }, 10000);
      });
  };

  reinitTimer = (gateway) => {
    const {lost_servers} =  this.state;
    lost_servers.push(gateway.name);
    this.setState({lost_servers, alert: true});
    let count = 11;
    let timer = setInterval(() => {
      count--;
      this.setState({timer: count});
      if (count === 0) {
        clearInterval(timer);
        if(lost_servers.length <= 1) {
          this.setState({alert: false});
        }
        for (let i=0; i<lost_servers.length; i++) {
          if (lost_servers[i] === gateway.name) {
            lost_servers.splice(i, 1);
            this.setState({lost_servers});
            break
          }
        }
      }
    }, 1000);
  };

  postInitGateway = (user, gateway) => {
    return gateway.initChatRoom(data => this.onChatData(gateway, data))
      .then(() => {
        if (gateway.name === "gxy3") {
          return gateway.initServiceProtocol(user, data => this.onServiceData(gateway, data))
        }
        return Promise.resolve();
      })
  };

  pollRooms = () => {
    this.fetchRooms();
    setInterval(this.fetchRooms, 2 * 1000)
  };

  fetchRooms = () => {
    let {disabled_rooms, groups, shidur_mode, preview_mode, preusers_count} = this.state;
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

        let pre_groups = [];
        if(preview_mode) {
          pre_groups = rooms.filter(r => !disabled_rooms.find(d => r.room === d.room) && !groups.find(g => r.room === g.room) && r.num_users < preusers_count);
          this.setState({pre_groups});
        } else {
          pre_groups = [];
          this.setState({pre_groups});
        }

        groups = rooms.filter(r => !disabled_rooms.find(d => r.room === d.room) && !pre_groups.find(d => r.room === d.room));
        disabled_rooms = rooms.filter(r => !groups.find(g => r.room === g.room) && !pre_groups.find(d => r.room === d.room));
        //this.setState({rooms, groups, disabled_rooms});
        let quads = [...this.col1.state.vquad,...this.col2.state.vquad,...this.col3.state.vquad,...this.col4.state.vquad];
        let list = groups.filter(r => !quads.find(q => q && r.room === q.room));
        let questions = list.filter(room => room.questions);
        this.setState({quads, questions, users_count, rooms, groups, disabled_rooms});
      })
      .catch(err => {
        console.error("[Shidur] error fetching active rooms", err);
        captureException(err, {source: "Shidur"});
      })

    api.fetchRoomsStatistics()
      .then((roomsStatistics) => {
        this.setState({roomsStatistics});
      })
      .catch(err => {
        console.error("[Shidur] error fetching rooms statistics", err);
        captureException(err, {source: "Shidur"});
      });
  };

  onChatData = (gateway, data) => {
    const json = JSON.parse(data);
    const what = json["textroom"];
    if (what === "message") {
      let msg = json['text'];
      let message = JSON.parse(msg);
      const { gdm } = this.state;
      if (gdm.checkAck(message)) {
        // Ack received, do nothing.
        return;
      }
    }
  };

  onServiceData = (gateway, data) => {
    const { gdm } = this.state;
    if (gdm.checkAck(data)) {
      // Ack received, do nothing.
      return;
    }

    if (data.type === "error") {
      if (data.error_code === USERNAME_ALREADY_EXIST_ERROR_CODE) {
        console.error("[Shidur] service error message (reloading in 10 seconds)", data.error);
        captureMessage(data.error, {source: "Shidur", msg: data});
        setTimeout(() => {
          this.initGateway(this.state.user, gateway);
        }, 10000);
        return;
      } else {
        captureException(data.error, {source: "Shidur", msg: data});
      }
    }

    if(data.type === "event") {
      delete data.type;
      this.setState({...data});
      if(data.sdiout || data.sndman) {
        setTimeout(() => {
          console.log("[Shidur] :: Check Full Screen state :: ");
          this.checkFullScreen();
        }, 3000);
      }
      return;
    }
  };

  nextInQueue = () => {
    let {groups_queue,groups,round} = this.state;
    groups_queue++;
    if(groups_queue >= groups.length) {
      // End round here!
      console.log("[Shidur] -- ROUND END --");
      groups_queue = 0;
      round++;
      this.setState({groups_queue,round});
    } else {
      this.setState({groups_queue});
    }
  };

  checkFullScreen = () => {
    this.col1.checkFullScreen();
    this.col2.checkFullScreen();
    this.col3.checkFullScreen();
    this.col4.checkFullScreen();
  };

  setProps = (props) => {
    this.setState({...props})
  };

  actionLog = (user, text) => {
    let {log_list} = this.state;
    let time = getDateString();
    let log = {time, user, text};
    log_list.push(log);
    this.setState({log_list});
  };

  render() {
    const {user, gatewaysInitialized, appInitError, alert, timer, lost_servers} = this.state;

    if (appInitError) {
      return (
        <Fragment>
          <h1>Error Initializing Application</h1>
          {`${appInitError}`}
        </Fragment>
      );
    }

    if (!!user && !gatewaysInitialized) {
      return "Initializing connections to janus instances...";
    }

    let login = (<LoginPage user={user} checkPermission={this.checkPermission} />);

    let content = (
      <Grid columns={2} padded>
        <Grid.Column width={16}>
          <Grid columns={4}>
            <Grid.Row>
              <Grid.Column>
                <UsersQuad index={0} {...this.state} ref={col1 => {this.col1 = col1;}} setProps={this.setProps} />
              </Grid.Column>
              <Grid.Column>
                <UsersQuad index={4} {...this.state} ref={col2 => {this.col2 = col2;}} setProps={this.setProps} />
              </Grid.Column>
              <Grid.Column>
                <UsersQuad index={8} {...this.state} ref={col3 => {this.col3 = col3;}} setProps={this.setProps} />
              </Grid.Column>
              <Grid.Column>
                <UsersQuad index={12} {...this.state} ref={col4 => {this.col4 = col4;}} setProps={this.setProps} />
              </Grid.Column>
            </Grid.Row>
            <ShidurToran {...this.state} setProps={this.setProps} nextInQueue={this.nextInQueue} />
          </Grid>
        </Grid.Column>
      </Grid>
    );

    return (
      <div>
        {user ? content : login}
        <Confirm cancelButton={null} confirmButton={timer}
                 header='Error'
                 content={'Lost connection to servers: ' + lost_servers.toString()}
                 open={alert}
                 size='mini' />
      </div>
    );
  }
}

export default ShidurApp;

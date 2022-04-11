import React, {Component, Fragment} from "react";
import {Grid, Confirm} from "semantic-ui-react";
import api from "../../shared/Api";
import {kc} from "../../components/UserManager";
import GxyJanus from "../../shared/janus-utils";
import LoginPage from "../../components/LoginPage";
import ToranToolsHttp from "./ToranToolsHttp";
import QuadPanelHttp from "./QuadPanelHttp";
import "./ShidurApp.css";
import {LOST_CONNECTION, STORAN_ID, short_regions} from "../../shared/consts";
import {GuaranteeDeliveryManager} from "../../shared/GuaranteeDelivery";
import {captureException, updateSentryUser} from "../../shared/sentry";
import {getDateString} from "../../shared/tools";
import mqtt from "../../shared/mqtt";

class ShidurAppHttp extends Component {
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
    presets: {1: [], 2: [], 3: [], 4: []},
    region_groups: [],
    region_list: [],
    region: null,
    sdiout: false,
    audout: false,
    users_count: 0,
    gdm: new GuaranteeDeliveryManager(STORAN_ID),
    alert: false,
    timer: 10,
    lost_servers: [],
    roomsStatistics: {},
    reinit_inst: null,
    log_list: [],
    preusers_count: 6,
    pnum: {},
    tcp: "mqtt",
  };

  componentWillUnmount() {
    Object.values(this.state.gateways).forEach((x) => x.destroy());
  }

  componentDidUpdate(prevProps, prevState) {
    let {groups} = this.state;
    if (groups.length > prevState.groups.length) {
      let res = groups.filter((o) => !prevState.groups.some((v) => v.room === o.room))[0];
      console.debug("[Shidur] :: Group enter in queue: ", res);
      this.actionLog(res, "enter");
    } else if (groups.length < prevState.groups.length) {
      let res = prevState.groups.filter((o) => !groups.some((v) => v.room === o.room))[0];
      console.debug("[Shidur] :: Group exit from queue: ", res);
      this.actionLog(res, "leave");
    }
  }

  checkPermission = (user) => {
    const allowed = kc.hasRealmRole("gxy_shidur");
    if (allowed) {
      delete user.roles;
      user.role = "shidur";
      user.session = 0;
      user.email = "toran@galaxy.kli.one";
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
    api
      .fetchConfig()
      .then((data) => GxyJanus.setGlobalConfig(data))
      .then(() => this.initGateways(user))
      .then(this.pollRooms)
      .catch((err) => {
        console.error("[Shidur] error initializing app", err);
        this.setState({appInitError: err});
        captureException(err, {source: "ShidurAppHttp"});
      });
  };

  initGateways = (user) => {
    this.setState({tcp: GxyJanus.globalConfig.dynamic_config.galaxy_protocol});
    mqtt.init(user, (data) => {
      console.log("[Shidur] mqtt init: ", data);
      mqtt.watch((data) => {
        this.onMqttData(data);
      });
      mqtt.join("galaxy/service/#");
      mqtt.join("galaxy/users/broadcast");
      mqtt.send(JSON.stringify({type: "event", [user.role]: true}), true, "galaxy/service/" + user.role);
    });

    const gateways = GxyJanus.makeGateways("rooms");
    this.setState({gateways});

    const gatewayToInitPromise = (gateway) =>
      this.initGateway(user, gateway).catch((error) => {
        captureException(error, {source: "ShidurAppHttp", gateway: gateway.name});
        throw error;
      });

    return Promise.all(Object.values(gateways).map(gatewayToInitPromise)).then(() => {
      console.log("[Shidur] gateways initialization complete");
      this.setState({gatewaysInitialized: true});
    });
  };

  initGateway = (user, gateway) => {
    console.log("[Shidur] initializing gateway", gateway.name);

    gateway.addEventListener("net-lost", (err) => {
      if (err.detail === LOST_CONNECTION) this.reinitTimer(gateway);
    });

    return gateway.init();
  };

  reinitTimer = (gateway) => {
    const {lost_servers} = this.state;
    lost_servers.push(gateway.name);
    this.setState({lost_servers, alert: true});
    let count = 11;
    let timer = setInterval(() => {
      count--;
      this.setState({timer: count});
      if (count === 0) {
        clearInterval(timer);
        if (lost_servers.length <= 1) {
          this.setState({alert: false});
        }
        for (let i = 0; i < lost_servers.length; i++) {
          if (lost_servers[i] === gateway.name) {
            lost_servers.splice(i, 1);
            this.setState({lost_servers});
            break;
          }
        }
      }
    }, 1000);
  };

  pollRooms = () => {
    this.fetchRooms();
    setInterval(this.fetchRooms, 2 * 1000);
  };

  fetchRooms = () => {
    let {disabled_rooms, groups, shidur_mode, preview_mode, preusers_count, region, region_groups} = this.state;
    api
      .fetchActiveRooms()
      .then((data) => {
        const users_count = data.map((r) => r.num_users).reduce((su, cur) => su + cur, 0);

        let rooms = data;

        if (shidur_mode === "nashim") {
          rooms = rooms.filter((r) => r.description.match(/^W /));
        } else if (shidur_mode === "gvarim") {
          rooms = rooms.filter((r) => !r.description.match(/^W /));
        } else if (shidur_mode === "beyahad") {
          this.setState({shidur_mode: ""});
        }

        let pre_groups = [];
        if (preview_mode) {
          // Extra exist and disabled
          if (preusers_count !== "Off") {
            pre_groups = rooms.filter((r) => !r.extra && r.users.filter((r) => r.camera).length < preusers_count);
            groups = rooms.filter(
              (r) => r.users.filter((r) => r.camera).length >= preusers_count && !r.extra?.disabled
            );
          } else {
            pre_groups = rooms;
            groups = rooms.filter((r) => !r.extra?.disabled);
          }
        } else {
          groups = rooms.filter((r) => !r.extra?.disabled);
        }

        this.groupsByRegion(groups);

        if (region) {
          region_groups = groups.filter((r) => r.region === region);
        }

        // Extra exist and disabled
        disabled_rooms = rooms.filter((r) => r.extra?.disabled);

        let quads = [
          ...this.col1.state.vquad,
          ...this.col2.state.vquad,
          ...this.col3.state.vquad,
          ...this.col4.state.vquad,
        ];
        let list = groups.filter((r) => !quads.find((q) => q && r.room === q.room));
        let questions = list.filter((room) => room.questions);
        this.setState({quads, questions, users_count, rooms, groups, disabled_rooms, pre_groups, region_groups});
      })
      .catch((err) => {
        console.error("[Shidur] error fetching active rooms", err);
        captureException(err, {source: "Shidur"});
      });

    api
      .fetchRoomsStatistics()
      .then((roomsStatistics) => {
        this.setState({roomsStatistics});
      })
      .catch((err) => {
        console.error("[Shidur] error fetching rooms statistics", err);
        captureException(err, {source: "Shidur"});
      });
  };

  groupsByRegion = (groups) => {
    const list = {}
    Object.keys(short_regions).map(k => list[k] = groups.filter((r) => r.region === k));
    this.setState({region_list: list});
  };

  onMqttData = (data) => {
    if (data.type === "event" && !data.hasOwnProperty("user")) {
      delete data.type;
      this.setState({...data});
      if (data.sdiout || data.audout) {
        setTimeout(() => {
          console.log("[Shidur] :: Check Full Screen state :: ");
          this.checkFullScreen();
        }, 3000);
      }
    } else if (data.type === "reload-config") {
      this.reloadConfig();
    }
  };

  reloadConfig = () => {
    api
      .fetchConfig()
      .then((data) => {
        GxyJanus.setGlobalConfig(data);
        this.setState({tcp: GxyJanus.globalConfig.dynamic_config.galaxy_protocol});
      })
      .catch((err) => {
        console.error("[User] error reloading config", err);
      });
  };

  nextInQueue = () => {
    let {groups_queue, groups, round} = this.state;
    groups_queue++;
    if (groups_queue >= groups.length) {
      // End round here!
      console.log("[Shidur] -- ROUND END --");
      groups_queue = 0;
      round++;
      this.setState({groups_queue, round});
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
    this.setState({...props});
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

    let login = <LoginPage user={user} checkPermission={this.checkPermission} />;

    let content = (
      <Grid columns={2} padded>
        <Grid.Column width={16}>
          <Grid columns={4}>
            <Grid.Row>
              <Grid.Column>
                <QuadPanelHttp
                  index={0}
                  {...this.state}
                  ref={(col1) => {
                    this.col1 = col1;
                  }}
                  setProps={this.setProps}
                />
              </Grid.Column>
              <Grid.Column>
                <QuadPanelHttp
                  index={4}
                  {...this.state}
                  ref={(col2) => {
                    this.col2 = col2;
                  }}
                  setProps={this.setProps}
                />
              </Grid.Column>
              <Grid.Column>
                <QuadPanelHttp
                  index={8}
                  {...this.state}
                  ref={(col3) => {
                    this.col3 = col3;
                  }}
                  setProps={this.setProps}
                />
              </Grid.Column>
              <Grid.Column>
                <QuadPanelHttp
                  index={12}
                  {...this.state}
                  ref={(col4) => {
                    this.col4 = col4;
                  }}
                  setProps={this.setProps}
                />
              </Grid.Column>
            </Grid.Row>
            <ToranToolsHttp {...this.state} setProps={this.setProps} nextInQueue={this.nextInQueue} />
          </Grid>
        </Grid.Column>
      </Grid>
    );

    return (
      <div>
        {user ? content : login}
        <Confirm
          cancelButton={null}
          confirmButton={timer}
          header="Error"
          content={"Lost connection to servers: " + lost_servers.toString()}
          open={alert}
          size="mini"
        />
      </div>
    );
  }
}

export default ShidurAppHttp;

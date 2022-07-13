import React, {Component, Fragment} from "react";
import {Grid, Confirm} from "semantic-ui-react";
import api from "../../shared/Api";
import {kc} from "../../components/UserManager";
import log from "loglevel";
import GxyJanus from "../../shared/janus-utils";
import LoginPage from "../../components/LoginPage";
import ToranToolsMqtt from "./ToranToolsMqtt";
import QuadPanelMqtt from "./QuadPanelMqtt";
import "./ShidurApp.css";
import {getDateString} from "../../shared/tools";
import mqtt from "../../shared/mqtt";
import ConfigStore from "../../shared/ConfigStore";
import {JanusMqtt} from "../../lib/janus-mqtt";
import {short_regions, region_filter} from "../../shared/consts";
import {isServiceID} from "../../shared/enums";

class ShidurAppMqtt extends Component {
  state = {
    ce: null,
    delay: false,
    full_qst: false,
    full_feed: {},
    full_group: {},
    full_col: null,
    gateways: {},
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
    vip1_rooms: [],
    vip2_rooms: [],
    vip3_rooms: [],
    pre_groups: [],
    user: null,
    gatewaysInitialized: false,
    appInitError: null,
    presets: {1: [], 2: [], 3: [], 4: []},
    region_groups: [],
    region_filter: region_filter,
    region_list: [],
    region: null,
    sdiout: false,
    audout: false,
    users_count: 0,
    alert: false,
    timer: 10,
    lost_servers: [],
    roomsStatistics: {},
    reinit_inst: null,
    log_list: [],
    preusers_count: 6,
    pnum: {},
    tcp: "mqtt",
    gxy_list: []
  };

  componentWillUnmount() {
    Object.values(this.state.gateways).forEach((x) => x.destroy());
  }

  componentDidUpdate(prevProps, prevState) {
    let {groups} = this.state;
    if (groups.length > prevState.groups.length) {
      let res = groups.filter((o) => !prevState.groups.some((v) => v.room === o.room))[0];
      log.debug("[Shidur] :: Group enter in queue: ", res);
      this.actionLog(res, "enter");
    } else if (groups.length < prevState.groups.length) {
      let res = prevState.groups.filter((o) => !groups.some((v) => v.room === o.room))[0];
      log.debug("[Shidur] :: Group exit from queue: ", res);
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
    }
  };

  initApp = (user) => {
    this.setState({user});
    api.fetchConfig().then(data => {
      ConfigStore.setGlobalConfig(data);
      GxyJanus.setGlobalConfig(data);
    }).then(() => this.initMQTT(user))
      .then(this.pollRooms)
      .catch((err) => {
        log.error("[Shidur] error initializing app", err);
        this.setState({appInitError: err});
      });
  };

  initMQTT = (user) => {
    this.setState({tcp: GxyJanus.globalConfig.dynamic_config.galaxy_protocol});
    mqtt.init(user, (data) => {
      log.info("[Shidur] mqtt init: ", data);
      mqtt.watch((data) => {
        this.onMqttData(data);
      });
      mqtt.join("galaxy/service/#");
      mqtt.join("galaxy/users/broadcast");
      if(isServiceID(user.id))
        mqtt.send(JSON.stringify({type: "event", [user.role]: true}), true, "galaxy/service/" + user.role);

      // Object.keys(ConfigStore.globalConfig.gateways.rooms).forEach(gxy => {
      //   this.initJanus(user, gxy)
      // })
    });

    this.setState({gatewaysInitialized: true});
  };

  initServers = (quads_list) => {
    const {gateways, gxy_list} = this.state;
    //let quads_list = [...qids.q1.vquad, ...qids.q2.vquad, ...qids.q3.vquad, ...qids.q4.vquad];
    let Janus_list = quads_list.map(k => k.janus);
    let uniq_list = [...new Set(Janus_list)];
    let added_list = uniq_list.filter(x => !gxy_list.includes(x));
    this.setState({gxy_list: uniq_list});
    if(added_list.length > 0) {
      log.info("[SDIOut] -- NEW SERVERS -- ", added_list);
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
        log.info("[SDIOut] -- CLEAN SERVER -- ", key)
        session.destroy();
        delete gateways[key]
      }
    })
  }

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
    //this.fetchRooms();
    setInterval(this.fetchRooms, 2 * 1000);
  };

  fetchRooms = () => {
    let {vip1_rooms, vip2_rooms, vip3_rooms, disabled_rooms, groups, shidur_mode, preview_mode, preusers_count, region, region_list, region_groups, region_filter} = this.state;
    api
      .fetchActiveRooms()
      .then((data) => {
        const users_count = data.map((r) => r.num_users).reduce((su, cur) => su + cur, 0);
        const isRegoinFilter = Object.values(region_filter).find(v => v)
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

          if (preusers_count !== "Off") {
            pre_groups = rooms.filter((r) => !r.extra?.disabled && r.users.filter((r) => r.camera).length < preusers_count);
            let new_groups = rooms.filter((r) => r.users.filter((r) => r.camera).length >= preusers_count && !r.extra?.disabled);

            for (let i=0; i<groups.length; i++) {
              let exist_group = new_groups.find(g => g.room === groups[i].room);
              if(exist_group) {
                groups[i] = exist_group;
              } else {
                groups.splice(i, 1);
              }
            }

            for (let i=0; i<new_groups.length; i++) {
              let exist_group = groups.find(g => g.room === new_groups[i].room);
              if(!exist_group) {
                groups.push(new_groups[i]);
              }
            }

          } else {
            pre_groups = rooms;
            groups = rooms.filter((r) => !r.extra?.disabled);
          }
        } else {
          groups = rooms.filter((r) => !r.extra?.disabled);
        }

        this.groupsByRegion(groups);

        if(isRegoinFilter) {
          groups = []
          Object.keys(region_filter).map(g => {
            if(!region_filter[g]) {
              groups = [...groups, ...region_list[g]]
            }
          })
        }

        if (region) {
          region_groups = groups.filter((r) => r.region === region);
        }

        // Extra exist and disabled
        disabled_rooms = rooms.filter((r) => r.extra?.disabled);
        vip1_rooms = rooms.filter((r) => r.extra?.vip);
        vip2_rooms = rooms.filter((r) => r.extra?.vip2);
        vip3_rooms = rooms.filter((r) => r.extra?.vip3);

        let quads = [
          ...this.col1.state.vquad,
          ...this.col2.state.vquad,
          ...this.col3.state.vquad,
          ...this.col4.state.vquad,
        ];
        let quads_list = quads.filter(k => k)
        if(quads_list.length > 0) this.initServers(quads_list);
        let list = groups.filter((r) => !quads.find((q) => q && r.room === q.room));
        let questions = list.filter((room) => room.questions);
        this.setState({quads, questions, users_count, rooms, groups, vip1_rooms, vip2_rooms, vip3_rooms, disabled_rooms, pre_groups, region_groups});
      })
      .catch((err) => {
        log.error("[Shidur] error fetching active rooms", err);
      });

    api
      .fetchRoomsStatistics()
      .then((roomsStatistics) => {
        this.setState({roomsStatistics});
      })
      .catch((err) => {
        log.error("[Shidur] error fetching rooms statistics", err);
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
          log.info("[Shidur] :: Check Full Screen state :: ");
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
        log.error("[User] error reloading config", err);
      });
  };

  nextInQueue = () => {
    let {groups_queue, groups, round} = this.state;
    groups_queue++;
    if (groups_queue >= groups.length) {
      // End round here!
      log.info("[Shidur] -- ROUND END --");
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
                <QuadPanelMqtt
                  index={0}
                  {...this.state}
                  ref={(col1) => {
                    this.col1 = col1;
                  }}
                  setProps={this.setProps}
                />
              </Grid.Column>
              <Grid.Column>
                <QuadPanelMqtt
                  index={4}
                  {...this.state}
                  ref={(col2) => {
                    this.col2 = col2;
                  }}
                  setProps={this.setProps}
                />
              </Grid.Column>
              <Grid.Column>
                <QuadPanelMqtt
                  index={8}
                  {...this.state}
                  ref={(col3) => {
                    this.col3 = col3;
                  }}
                  setProps={this.setProps}
                />
              </Grid.Column>
              <Grid.Column>
                <QuadPanelMqtt
                  index={12}
                  {...this.state}
                  ref={(col4) => {
                    this.col4 = col4;
                  }}
                  setProps={this.setProps}
                />
              </Grid.Column>
            </Grid.Row>
            <ToranToolsMqtt {...this.state} setProps={this.setProps} nextInQueue={this.nextInQueue} />
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

export default ShidurAppMqtt;

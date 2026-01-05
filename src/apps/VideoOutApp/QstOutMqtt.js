import React, {Component, Fragment} from "react";
import {Grid} from "semantic-ui-react";
import "./QstOutApp.css";
import "./QstOutQuad.scss";
import {QSTOUT_ID} from "../../shared/consts";
import log from "loglevel";
import api from "../../shared/Api";
import {API_BACKEND_PASSWORD, API_BACKEND_USERNAME} from "../../shared/env";
import GxyJanus from "../../shared/janus-utils";
import VideoHandleMqtt from "./VideoHandleMqtt";
import mqtt from "../../shared/mqtt";
import ConfigStore from "../../shared/ConfigStore";
import {JanusMqtt} from "../../lib/janus-mqtt";

class QstOutMqtt extends Component {
  state = {
    qg: null,
    group: null,
    room: null,
    user: {
      session: 0,
      handle: 0,
      role: "qstout",
      display: "qstout",
      id: "QSTOUT_ID",
      name: "qstout",
      email: "qstout@galaxy.kli.one",
    },
    qids: [],
    qlist: [],
    qcol: 0,
    gateways: {},
    appInitError: null,
    vote: false,
    roomsStatistics: {},
    reinit_inst: null,
  };

  componentDidMount() {
    this.initApp();
  }

  componentWillUnmount() {
    Object.values(this.state.gateways).forEach((x) => x.destroy());
  }

  getVideoOut = (callback) => {
    api.fetchProgram().then((qids) => {
      this.setState({qids});
      callback(qids)
    })
      .catch((err) => {
        log.error("[SDIOut] error fetching quad state", err);
      });
  }

  initApp = () => {
    const {user} = this.state;

    api.setBasicAuth(API_BACKEND_USERNAME, API_BACKEND_PASSWORD);

    api.fetchConfig().then((data) => {
        ConfigStore.setGlobalConfig(data);
        GxyJanus.setGlobalConfig(data);
      }).then(() => this.initGateways(user))
      .catch((err) => {
        log.error("[SDIOut] error initializing app", err);
        this.setState({appInitError: err});
      });
  };

  initGateways = (user) => {
    mqtt.init(user, (data) => {
      log.info("[SDIOut] mqtt init: ", data);
      mqtt.join("galaxy/service/shidur");
      mqtt.join("galaxy/users/broadcast");
      //mqtt.send(JSON.stringify({type: "event", [user.role]: true}), true, "galaxy/service/" + user.role);
      mqtt.watch((data) => {
        this.onMqttData(data);
      });
    });
  };

  initJanus = (user, gxy, callback) => {
    log.info("["+gxy+"] Janus init")
    const {gateways} = this.state;
    const token = ConfigStore.globalConfig.gateways.rooms[gxy].token
    gateways[gxy] = new JanusMqtt(user, gxy, gxy);
    gateways[gxy].init(token).then(data => {
      log.info("["+gxy+"] Janus init success", data);
      callback()
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

  cleanSession = () => {
    const {gateways} = this.state;
    Object.keys(gateways).forEach(key => {
      const session = gateways[key];
      session.destroy();
      delete gateways[key]
    })
  };

  onMqttData = (data) => {
    const {col, feed, group, i, status, qst} = data;
    const room = group?.room
    log.info("[QSTOut] onMqttData: ", data)
    if (data.type === "sdi-fullscr_group" && status) {
      if (qst) {
        this.getVideoOut(qids => {
          this.initJanus(this.state.user, group.janus, () => {
            this.setState({col, i, group, room, qg: qids["q" + col].vquad[i]});
          });
        })
      } else {
        this["col" + col].toFullGroup(i, feed);
      }
    } else if (data.type === "sdi-fullscr_group" && !status) {
      let {col, feed, i} = data;
      if (qst) {
        this.setState({group: null, room: null, qg: null}, () => {
          const {gateways} = this.state;
          const session = gateways[group.janus];
          session.destroy();
          delete gateways[group.janus]
        });
      } else {
        this["col" + col].toFourGroup(i, feed);
      }
    } else if (data.type === "sdi-vote") {
      if (this.state.group) return;
      this.setState({vote: status, qg: null});
    } else if (data.type === "sdi-restart_sdiout") {
      window.location.reload();
    } else if (data.type === "reload-config") {
      this.reloadConfig();
    } else if (data.type === "event") {
      delete data.type;
      this.setState({...data});
    }
  };

  reloadConfig = () => {
    api.fetchConfig().then((data) => {
        GxyJanus.setGlobalConfig(data);
      })
      .catch((err) => {
        log.error("[User] error reloading config", err);
      });
  };

  render() {
    let {vote, group, qids, qg, gateways, roomsStatistics, user} = this.state;

    if(!gateways) return

    // let qst = g && g.questions;
    let name = group && group.description;

    return (
      <Grid columns={2} className="sdi_container">
        <Grid.Row>
          <Grid.Column>
            <div className="preview_sdi">
              <div className="usersvideo_grid">
                <div className="video_full">
                  {vote ? (
                    <iframe title="Vote" src="https://vote.kli.one" width="100%" height="100%" frameBorder="0" />
                  ) : qg ? (
                    <Fragment>
                      {/*{group && group.questions ? <div className="qst_fullscreentitle">?</div> : ""}*/}
                      <div className="fullscrvideo_title">{name}</div>
                      <VideoHandleMqtt key={"q5"} g={qg} index={13} col={5} q={5} qst_group={true} user={user} gateways={gateways} {...this.state} />
                    </Fragment>
                  ) : (
                    ""
                  )}
                </div>
              </div>
            </div>
          </Grid.Column>
          <Grid.Column>
          </Grid.Column>
        </Grid.Row>
        <Grid.Row>
          <Grid.Column>
          </Grid.Column>
          <Grid.Column>
          </Grid.Column>
        </Grid.Row>
      </Grid>
    );
  }
}

export default QstOutMqtt;

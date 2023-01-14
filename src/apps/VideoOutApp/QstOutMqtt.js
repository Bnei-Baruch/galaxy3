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
      role: "live",
      display: "live",
      id: "live_out",
      name: "live_out",
      email: "live_out@janus.kli.one",
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
    // setTimeout(() => {
    //   this.getVideoOut()
    // },1000)
  }

  componentWillUnmount() {
    Object.values(this.state.gateways).forEach((x) => x.destroy());
  }

  initApp = () => {
    const {user} = this.state;

    mqtt.init(user, (data) => {
      log.info("[audout] mqtt init: ", data);
      mqtt.join("live/service/shidur");
      mqtt.join("live/users/broadcast");
      mqtt.send(JSON.stringify({type: "event", [user.role]: true}), true, "live/service/" + user.role);
      mqtt.watch((data) => {
        this.onMqttData(data);
      });
      this.initJanus(user, "live")
    });
  };

  initJanus = (user, gxy) => {
    log.info("["+gxy+"] Janus init")
    const {gateways} = this.state;
    gateways[gxy] = new JanusMqtt(user, gxy, gxy);
    gateways[gxy].init("token").then(data => {
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

  onMqttData = (data) => {
    const {room, col, feed, group, i, status, qst} = data;

    if (data.type === "sdi-fullscr_group" && status) {
      if (qst) {
        this.setState({col, i, group, room, qg: this.state.qids["q" + col].vquad[i]});
      } else {
        this["col" + col].toFullGroup(i, feed);
      }
    } else if (data.type === "sdi-fullscr_group" && !status) {
      let {col, feed, i} = data;
      if (qst) {
        this.setState({group: null, room: null, qg: null});
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
                  <VideoHandleMqtt key={"q5"} g={qg} group={group} index={13} col={5} q={5} user={user} gateways={gateways} />
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

import React, {Component, Fragment} from "react";
import {Grid, Segment} from "semantic-ui-react";
import "./VideoOutApp.css";
import "./VideoOutQuad.scss";
import {SDIOUT_ID} from "../../shared/consts";
import api from "../../shared/Api";
import {API_BACKEND_PASSWORD, API_BACKEND_USERNAME} from "../../shared/env";
import GxyJanus from "../../shared/janus-utils";
import VideoHandleHttp from "./VideoHandleHttp";
import VideoOutQuad from "./VideoOutQuad";
import {captureException} from "../../shared/sentry";
import mqtt from "../../shared/mqtt";

class VideoOutMqtt extends Component {
  state = {
    qg: null,
    group: null,
    room: null,
    user: {
      session: 0,
      handle: 0,
      role: "sdiout",
      display: "sdiout",
      id: SDIOUT_ID,
      name: "sdiout",
      email: "sdiout@galaxy.kli.one",
    },
    qids: [],
    qcol: 0,
    gateways: {},
    appInitError: null,
    vote: false,
    roomsStatistics: {},
    reinit_inst: null,
  };

  componentDidMount() {
    setInterval(() => {
      api
        .fetchProgram()
        .then((qids) => {
          this.setState({qids});
          if (this.state.qg) {
            const {col, i} = this.state;
            this.setState({qg: this.state.qids["q" + col].vquad[i]});
          }
        })
        .catch((err) => {
          console.error("[SDIOut] error fetching quad state", err);
          captureException(err, {source: "SDIOut"});
        });

      api
        .fetchRoomsStatistics()
        .then((roomsStatistics) => {
          this.setState({roomsStatistics});
        })
        .catch((err) => {
          console.error("[SDIOut] error fetching rooms statistics", err);
          captureException(err, {source: "SDIOut"});
        });
    }, 1000);
    this.initApp();
  }

  componentWillUnmount() {
    Object.values(this.state.gateways).forEach((x) => x.destroy());
  }

  initApp = () => {
    const {user} = this.state;

    api.setBasicAuth(API_BACKEND_USERNAME, API_BACKEND_PASSWORD);

    api
      .fetchConfig()
      .then((data) => GxyJanus.setGlobalConfig(data))
      .then(() => this.initGateways(user))
      .catch((err) => {
        console.error("[SDIOut] error initializing app", err);
        this.setState({appInitError: err});
        captureException(err, {source: "SDIOut"});
      });
  };

  initGateways = (user) => {
    mqtt.init(user, (data) => {
      console.log("[SDIOut] mqtt init: ", data);
      setTimeout(() => {
        mqtt.watch((data) => {
          this.onMqttData(data);
        });
        mqtt.join("galaxy/service/shidur");
        mqtt.join("galaxy/users/broadcast");
        mqtt.send(JSON.stringify({type: "event", [user.role]: true}), true, "galaxy/service/" + user.role);
      }, 3000);
    });
    const gateways = GxyJanus.makeGateways("rooms");
    this.setState({gateways});
    Object.values(gateways).map((gateway) => gateway.init());
  };

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
    api
      .fetchConfig()
      .then((data) => {
        GxyJanus.setGlobalConfig(data);
      })
      .catch((err) => {
        console.error("[User] error reloading config", err);
      });
  };

  render() {
    let {vote, group, qids, qg, gateways, roomsStatistics} = this.state;
    // let qst = g && g.questions;
    let name = group && group.description;

    return (
      <Grid columns={2} className="sdi_container">
        <Grid.Row>
          <Grid.Column>
            <VideoOutQuad
              index={0}
              {...qids.q1}
              qst={qg}
              gateways={gateways}
              roomsStatistics={roomsStatistics}
              ref={(col) => {this.col1 = col;}}
            />
          </Grid.Column>
          <Grid.Column>
            <VideoOutQuad
              index={4}
              {...qids.q2}
              qst={qg}
              gateways={gateways}
              roomsStatistics={roomsStatistics}
              ref={(col) => {this.col2 = col;}}
            />
          </Grid.Column>
        </Grid.Row>
        <Grid.Row>
          <Grid.Column>
            <VideoOutQuad
              index={8}
              {...qids.q3}
              qst={qg}
              gateways={gateways}
              roomsStatistics={roomsStatistics}
              ref={(col) => {this.col3 = col;}}
            />
          </Grid.Column>
          <Grid.Column>
            <VideoOutQuad
              index={12}
              {...qids.q4}
              qst={qg}
              gateways={gateways}
              roomsStatistics={roomsStatistics}
              ref={(col) => {this.col4 = col;}}
            />
          </Grid.Column>
        </Grid.Row>
        <Grid.Row>
          <Grid.Column>
            <Segment className="preview_sdi">
              <div className="usersvideo_grid">
                <div className="video_full">
                  {vote ? (
                    <iframe title="Vote" src="https://vote.kli.one" width="100%" height="100%" frameBorder="0" />
                  ) : qg ? (
                    <Fragment>
                      {/*{group && group.questions ? <div className="qst_fullscreentitle">?</div> : ""}*/}
                      <div className="fullscrvideo_title">{name}</div>
                      <VideoHandleHttp key={"q5"} g={qg} group={group} index={13} gateways={gateways} />
                    </Fragment>
                  ) : (
                    ""
                  )}
                </div>
              </div>
            </Segment>
          </Grid.Column>
          <Grid.Column></Grid.Column>
        </Grid.Row>
      </Grid>
    );
  }
}

export default VideoOutMqtt;

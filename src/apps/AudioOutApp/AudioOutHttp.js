import React, {Component} from "react";
import {Segment} from "semantic-ui-react";
import "./AudioOutApp.css";
import AudioHandleHttp from "./AudioHandleHttp";
import api from "../../shared/Api";
import {API_BACKEND_PASSWORD, API_BACKEND_USERNAME} from "../../shared/env";
import GxyJanus from "../../shared/janus-utils";
import {AUDOUT_ID} from "../../shared/consts";
import mqtt from "../../shared/mqtt";

class AudioOutHttp extends Component {
  state = {
    audio: false,
    group: null,
    room: null,
    user: {
      session: 0,
      handle: 0,
      role: "audout",
      display: "audout",
      id: AUDOUT_ID,
      name: "audout",
      email: "audout@galaxy.kli.one",
    },
    gateways: {},
    gatewaysInitialized: false,
    appInitError: null,
  };

  componentDidMount() {
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
      .then(() => {
        this.initMqtt(user);
        this.initGateways(user);
      })
      .catch((err) => {
        console.error("[AudioOut] error initializing app", err);
      });
  };

  initMqtt = (user) => {
    mqtt.init(user, (data) => {
      console.log("[Shidur] mqtt init: ", data);
      setTimeout(() => {
        mqtt.watch((data) => {
          this.onMqttData(data);
        });
        mqtt.join("galaxy/service/shidur");
        mqtt.join("galaxy/users/broadcast");
        mqtt.send(JSON.stringify({type: "event", [user.role]: true}), true, "galaxy/service/" + user.role);
      }, 3000);
    });
  };

  initGateways = (user) => {
    const gateways = GxyJanus.makeGateways("rooms");
    this.setState({gateways});
    Object.values(gateways).map((gateway) => gateway.init());
  };

  onMqttData = (data) => {
    const {room, group, status, qst} = data;

    if (data.type === "sdi-fullscr_group" && status && qst) {
      this.setState({group, room});
    } else if (data.type === "sdi-fullscr_group" && !status && qst) {
      this.setState({group: null, room: null});
    } else if (data.type === "sdi-restart_audout") {
      window.location.reload();
    } else if (data.type === "audio-out") {
      this.setState({audio: status});
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

  setProps = (props) => {
    this.setState({...props});
  };

  render() {
    const {gateways, group, audio} = this.state;

    const name = group && group.description;

    return (
      <Segment className="preview_sdi">
        <div className="usersvideo_grid">
          <div className="video_full">
            <div className="title">{name}</div>
            <AudioHandleHttp g={group} gateways={gateways} audio={audio} setProps={this.setProps} />
          </div>
        </div>
      </Segment>
    );
  }
}

export default AudioOutHttp;

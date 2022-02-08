import React, {Component} from "react";
import {Segment} from "semantic-ui-react";
import log from "loglevel";
import "./AudioOutApp.css";
import JanusHandleMqtt from "./JanusHandleMqtt";
import api from "../../shared/Api";
import {API_BACKEND_PASSWORD, API_BACKEND_USERNAME} from "../../shared/env";
import GxyJanus from "../../shared/janus-utils";
import {AUDOUT_ID} from "../../shared/consts";
import mqtt from "../../shared/mqtt";
import ConfigStore from "../../shared/ConfigStore";

class AudioOutMqtt extends Component {
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
    }
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
      .then((data) => {
        ConfigStore.setGlobalConfig(data);
        GxyJanus.setGlobalConfig(data);
      })
      .then(() => this.initMqtt(user))
      .catch((err) => {
        log.error("[audout] error initializing app", err);
      });
  };

  initMqtt = (user) => {
    mqtt.init(user, (data) => {
      log.info("[audout] mqtt init: ", data);
      mqtt.watch((data) => {
        this.onMqttData(data);
      });
      mqtt.join("galaxy/service/shidur");
      mqtt.join("galaxy/users/broadcast");
      mqtt.send(JSON.stringify({type: "event", [user.role]: true}), true, "galaxy/service/" + user.role);
    });
  };

  onMqttData = (data) => {
    log.info("[audout] Cmd message: ", data)
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
        log.error("[audout] error reloading config", err);
      });
  };

  render() {
    const {user, group, audio} = this.state;

    const name = group && group.description;

    return (
      <Segment className="preview_sdi">
        <div className="usersvideo_grid">
          <div className="video_full">
            <div className="title">{name}</div>
            <JanusHandleMqtt g={group} user={user} audio={audio} />
          </div>
        </div>
      </Segment>
    );
  }
}

export default AudioOutMqtt;

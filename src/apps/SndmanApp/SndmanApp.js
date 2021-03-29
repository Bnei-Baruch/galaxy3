import React, {Component, Fragment} from "react";
import "./SndmanApp.css";
import "./UsersSndman.css";
import api from "../../shared/Api";
import {kc} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";
import {Grid} from "semantic-ui-react";
import UsersQuadSndman from "./UsersQuadSndman";
import GxyJanus from "../../shared/janus-utils";
import {captureException, updateSentryUser} from "../../shared/sentry";
import mqtt from "../../shared/mqtt";

class SndmanApp extends Component {
  state = {
    user: null,
    gateways: {},
    gatewaysInitialized: false,
    appInitError: null,
  };

  componentWillUnmount() {
    Object.values(this.state.gateways).forEach((x) => x.destroy());
  }

  checkPermission = (user) => {
    const allowed = kc.hasRealmRole("gxy_sndman");
    if (allowed) {
      delete user.roles;
      user.role = "sndman";
      user.session = 0;
      user.email = "sndman@galaxy.kli.one";
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
      .catch((err) => {
        console.error("[Sndman] error initializing app", err);
        this.setState({appInitError: err});
        captureException(err, {source: "Sndman"});
      });
  };

  initGateways = (user) => {
    mqtt.init(user, (data) => {
      console.log("[Sndman] mqtt init: ", data);
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
    let {col, group, i, status} = data;

    // Shidur action
    if (data.type === "sdi-fullscr_group" && status) {
      this["col" + col].fullScreenGroup(i, group);
    } else if (data.type === "sdi-fullscr_group" && !status) {
      this["col" + col].toFourGroup(i, group);
    }

    if (data.type === "event") {
      delete data.type;
      this.setState({...data});
    }

    if (data.type === "sdi-restart_sndman") {
      window.location.reload();
    }
    if (data.type === "reload-config") {
      this.reloadConfig();
    }
  };

  setProps = (props) => {
    this.setState({...props});
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
    const {user, gatewaysInitialized, appInitError} = this.state;

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
        <Grid.Row>
          <Grid.Column>
            <UsersQuadSndman
              index={0}
              {...this.state}
              ref={(col) => {
                this.col1 = col;
              }}
              setProps={this.setProps}
            />
          </Grid.Column>
          <Grid.Column>
            <UsersQuadSndman
              index={4}
              {...this.state}
              ref={(col) => {
                this.col2 = col;
              }}
              setProps={this.setProps}
            />
          </Grid.Column>
        </Grid.Row>
        <Grid.Row>
          <Grid.Column>
            <UsersQuadSndman
              index={8}
              {...this.state}
              ref={(col) => {
                this.col3 = col;
              }}
              setProps={this.setProps}
            />
          </Grid.Column>
          <Grid.Column>
            <UsersQuadSndman
              index={12}
              {...this.state}
              ref={(col) => {
                this.col4 = col;
              }}
              setProps={this.setProps}
            />
          </Grid.Column>
        </Grid.Row>
      </Grid>
    );

    return <div>{user ? content : login}</div>;
  }
}

export default SndmanApp;

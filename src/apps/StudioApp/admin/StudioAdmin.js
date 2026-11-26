// Admin of the Studio mode (entry "sadmin"): login + two tabs
//   Studio - events, questions, guest on air, layout (StudioManager)
//   Rooms  - the regular galaxy rooms view (AdminRootMqtt), used to preview people.
import React, {Component, Suspense} from "react";
import {Tab} from "semantic-ui-react";
import log from "loglevel";
import {kc} from "../../../components/UserManager";
import LoginPage from "../../../components/LoginPage";
import mqtt from "../../../shared/mqtt";
import AdminRootMqtt from "../../AdminApp/AdminRootMqtt";
import StudioManager from "./StudioManager";

class StudioAdmin extends Component {
  state = {
    user: null,
  };

  checkPermission = (user) => {
    const roles = new Set(user.roles || []);
    let role = null;
    if (roles.has("gxy_root")) role = "root";
    else if (roles.has("gxy_admin")) role = "admin";

    delete user.roles;
    user.role = role;

    if (!role) {
      alert("Access denied!");
      kc.logout();
      return;
    }
    this.setState({user}, () => this.initMQTT(user));
  };

  initMQTT = (user) => {
    mqtt.init(user, (data) => {
      log.info("[studio-admin] mqtt init: ", data);
      mqtt.join("galaxy/users/broadcast");
      mqtt.join("galaxy/users/" + user.id);
      mqtt.watch(() => {});
      this.setState({mqttReady: true});
    });
  };

  render() {
    const {user, mqttReady} = this.state;
    if (!user) return <LoginPage user={user} checkPermission={this.checkPermission} />;
    if (!mqttReady) return <Tab.Pane loading />;

    const loading = <Tab.Pane loading />;
    const panes = [
      {
        menuItem: {key: "studio", icon: "video camera", content: "Studio"},
        render: () => (
          <Tab.Pane attached={false}>
            <StudioManager user={user} />
          </Tab.Pane>
        ),
      },
      {
        menuItem: {key: "rooms", icon: "sitemap", content: "Rooms"},
        render: () => (
          <Tab.Pane attached={false}>
            <Suspense fallback={loading}>
              <AdminRootMqtt user={user} />
            </Suspense>
          </Tab.Pane>
        ),
      },
    ];

    return <Tab menu={{secondary: true, pointing: true, color: "blue"}} panes={panes} />;
  }
}

export default StudioAdmin;

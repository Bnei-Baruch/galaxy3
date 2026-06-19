import React, {Component, Suspense} from "react";
import {Tab} from "semantic-ui-react";
import {kc} from "../../../components/UserManager";
import mqtt from "../../../shared/mqtt";
import AdminLogin from "../components/AdminLogin";
import RoomUsers from "./RoomUsers";
import RoomsManager from "./RoomsManager";
import log from "loglevel";

// Parent shell of the WebinarApp admin (wadmin entry).
// Owns login, role resolution and the single shared MQTT connection, then
// renders permission-gated tabs:
//   - "Users" (RoomUsers)    — visible to viewer/admin/root
//   - "Rooms" (RoomsManager) — visible to admin/root
// Each tab keeps its own fine-grained checks (isAllowed("root"/"admin")) for
// the controls inside it.
class AdminClient extends Component {
  state = {
    user: null,
    gxy_panes: [],
  };

  isAllowed = (level) => {
    const {user} = this.state;
    if (!user) {
      return false;
    }

    const {role} = user;
    switch (level) {
      case "root":
        return role === "root";
      case "admin":
        return role === "admin" || role === "root";
      case "viewer":
        return role === "viewer" || role === "admin" || role === "root";
      default:
        return false;
    }
  };

  checkPermission = (user) => {
    const roles = new Set(user.roles || []);

    let role = null;
    if (roles.has("gxy_root")) {
      role = "root";
    } else if (roles.has("gxy_admin")) {
      role = "admin";
    } else if (roles.has("gxy_viewer")) {
      role = "viewer";
    } else if (roles.has("gxy_notify")) {
      role = "notify";
    }

    delete user.roles;
    user.role = role;

    const gxy_admin = !!role;
    const gxy_monitor = gxy_admin || kc.hasRealmRole("gxy_support");

    if (gxy_monitor) {
      this.setState({user}, () => {
        this.initMQTT(user);
        this.initApps();
      });
    } else {
      alert("Access denied!");
      kc.logout();
    }
  };

  initMQTT = (user) => {
    mqtt.init(user, (data) => {
      log.info("[admin] mqtt init: ", data);
      mqtt.join("galaxy/users/broadcast");
      mqtt.join("galaxy/users/" + user.id);
      mqtt.watch(() => {});
    });
  };

  initApps = () => {
    const {user} = this.state;

    const loading = <Tab.Pane loading />;

    const users = (
      <Suspense fallback={loading}>
        <RoomUsers user={user} />
      </Suspense>
    );
    const rooms = (
      <Suspense fallback={loading}>
        <RoomsManager user={user} />
      </Suspense>
    );

    const panes = [
      {
        menuItem: {key: "users", icon: "users", content: "Users", disabled: !this.isAllowed("viewer")},
        render: () => <Tab.Pane attached={false}>{users}</Tab.Pane>,
      },
      {
        menuItem: {key: "rooms", icon: "sitemap", content: "Rooms", disabled: !this.isAllowed("admin")},
        render: () => <Tab.Pane attached={false}>{rooms}</Tab.Pane>,
      },
    ];

    const gxy_panes = panes.filter((p) => !p.menuItem.disabled);
    this.setState({gxy_panes});
  };

  render() {
    const {user, gxy_panes} = this.state;

    if (!user) {
      return <AdminLogin user={user} checkPermission={this.checkPermission} />;
    }

    return <Tab menu={{secondary: true, pointing: true, color: "blue"}} panes={gxy_panes} />;
  }
}

export default AdminClient;

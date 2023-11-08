import React, {Component, Suspense} from "react";
import {Container, Message, Tab, Image} from "semantic-ui-react";
import {kc} from "../../components/UserManager";
import RoomManager from "./components/RoomManager";
import LoginPage from "../../components/LoginPage";
import AdminRootMqtt from "./AdminRootMqtt";
import MonitorApp from "./components/MonitorApp";
import logo from "./KL_Tree_128.png";
import version from './Version.js';
import log from "loglevel";
import NotificationManager from "./NotificationManager";

class AdminApp extends Component {
  state = {
    user: null,
    gxy_panes: [],
  };

  componentDidMount() {
    log.info(" :: Version :: ", version);
    this.initApps();
  }

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

    let gxy_admin = !!role;
    let gxy_monitor = gxy_admin || kc.hasRealmRole("gxy_support");
    let gxy_rooms = kc.hasRealmRole("gxy_root");
    let gxy_notify = kc.hasRealmRole("gxy_notify");

    if (gxy_monitor) {
      this.setState({user, gxy_admin, gxy_monitor, gxy_rooms, gxy_notify}, () => {
        this.initApps();
      });
    } else {
      alert("Access denied!");
      kc.logout();
    }
  };

  initApps = () => {
    const {user, gxy_admin, gxy_monitor, gxy_rooms, gxy_notify} = this.state;

    const loading = <Tab.Pane loading />;

    let welcome = (
      <Container textAlign="center">
        <Message size="massive">
          <Message.Header>Arvut System</Message.Header>
          <p>Administrative Tools and Services</p>
          <Image src={logo} centered />
        </Message>
      </Container>
    );

    let login = <LoginPage user={user} checkPermission={this.checkPermission} />;

    let home = <Suspense fallback={loading}>{user ? welcome : login}</Suspense>;

    let admin = (
      <Suspense fallback={loading}>
        <AdminRootMqtt user={user} />
      </Suspense>
    );
    let monitor = (
      <Suspense fallback={loading}>
        <MonitorApp user={user} />
      </Suspense>
    );
    let room = (
      <Suspense fallback={loading}>
        <RoomManager user={user} />
      </Suspense>
    );
    let notifications = (
      <Suspense fallback={loading}>
        <NotificationManager user={user} />
      </Suspense>
    );

    const panes = [
      {
        menuItem: {key: "Home", icon: "home", content: "Home", disabled: false},
        render: () => <Tab.Pane attached={true}>{home}</Tab.Pane>,
      },
      {
        menuItem: {key: "admin", icon: "detective", content: "Admin", disabled: !gxy_admin},
        render: () => <Tab.Pane attached={false}>{admin}</Tab.Pane>,
      },
      {
        menuItem: {key: "monitor", icon: "eye", content: "Monitor", disabled: !gxy_monitor},
        render: () => <Tab.Pane attached={false}>{monitor}</Tab.Pane>,
      },
      {
        menuItem: {key: "aricha", icon: "edit", content: "Rooms", disabled: !gxy_rooms},
        render: () => <Tab.Pane attached={false}>{room}</Tab.Pane>,
      },
      {
        menuItem: {key: "notes", icon: "envelope", content: "Notifications", disabled: !gxy_notify},
        render: () => <Tab.Pane attached={false}>{notifications}</Tab.Pane>,
      },
    ];

    const gxy_panes = panes.filter((p) => !p.menuItem.disabled);
    this.setState({gxy_panes});
  };

  render() {
    const {gxy_panes} = this.state;

    return <Tab menu={{secondary: true, pointing: true, color: "blue"}} panes={gxy_panes} />;
  }
}

export default AdminApp;

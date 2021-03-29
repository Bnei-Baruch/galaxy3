import React, {Component} from "react";
import {Icon, Menu, Tab} from "semantic-ui-react";
import MonitoringAdmin from "./MonitoringAdmin";
import MonitoringUser from "./MonitoringUser";

class MonitorApp extends Component {
  state = {
    activeTab: 0,
    user: null,
    usersTabs: [],
  };

  componentDidMount() {}

  shouldComponentUpdate(nextProps, nextState) {
    const {activeTab, gatewaysInitialized, user, usersTabs} = this.state;
    return (
      user === null ||
      gatewaysInitialized === false ||
      activeTab === 0 ||
      nextState.activeTab === 0 ||
      activeTab !== nextState.activeTab ||
      nextState.usersTabs.length !== usersTabs.length
    );
  }

  addUserTab(user, stats) {
    const {usersTabs} = this.state;
    if (!usersTabs.find((u) => u.id === user.id)) {
      const newUsersTabs = usersTabs.slice();
      newUsersTabs.push({user, stats});
      this.setState({usersTabs: newUsersTabs, activeTab: 2 + newUsersTabs.length - 1});
    }
  }

  removeUserTab(index) {
    const {usersTabs} = this.state;
    if (index < usersTabs.length) {
      const newUsersTabs = usersTabs.slice();
      newUsersTabs.splice(index, 1);
      this.setState({usersTabs: newUsersTabs, activeTab: 2});
    }
  }

  render() {
    const {usersTabs, activeTab} = this.state;

    const panes = [
      {
        menuItem: "Monitor",
        render: () => (
          <Tab.Pane>
            <MonitoringAdmin addUserTab={(user, stats) => this.addUserTab(user, stats)} />
          </Tab.Pane>
        ),
      },
    ];

    usersTabs.forEach(({user, stats}, index) =>
      panes.push({
        menuItem: (
          <Menu.Item key={user.id}>
            {user.display || user.name}&nbsp;
            <Icon
              name="window close"
              style={{cursor: "pointer"}}
              onClick={(e) => {
                e.stopPropagation();
                this.removeUserTab(index);
              }}
            />
          </Menu.Item>
        ),
        render: () => (
          <Tab.Pane>
            <MonitoringUser user={user} stats={stats} />
          </Tab.Pane>
        ),
      })
    );

    return (
      <Tab
        panes={panes}
        activeIndex={activeTab || 0}
        onTabChange={(e, {activeIndex}) => this.setState({activeTab: activeIndex})}
        renderActiveOnly={true}
      />
    );
  }
}

export default MonitorApp;

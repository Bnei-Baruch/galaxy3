import React, { Component, Fragment } from 'react';
import { Tab } from 'semantic-ui-react'
import LoginPage from '../../components/LoginPage';
import {client, getUser} from "../../components/UserManager";
import GroupClient from "./GroupClient";

class GroupsApp extends Component {

    state = {
        user: null,
        gxy_user: true,
        gxy_group: true,
        gxy_admin: true,
        gxy_shidur: true,
        gxy_sndman: true,
        gxy_sdiout: true,
    };

    componentDidMount() {
        getUser(cb => {
            if(cb) this.checkPermission(cb);
        });
    };

    checkPermission = (user) => {
        let gxy_public = user.roles.filter(role => role === 'bb_user').length === 0;
        let gxy_user = user.roles.filter(role => role === 'gxy_user').length === 0;
        let gxy_group = user.roles.filter(role => role === 'gxy_group').length === 0;
        let gxy_admin = user.roles.filter(role => role === 'gxy_admin').length === 0;
        let gxy_shidur = user.roles.filter(role => role === 'gxy_shidur').length === 0;
        let gxy_sndman = user.roles.filter(role => role === 'gxy_sndman').length === 0;
        let gxy_sdiout = user.roles.filter(role => role === 'gxy_sdiout').length === 0;
        if(!gxy_public) {
            this.setState({user, gxy_public, gxy_user, gxy_group, gxy_admin, gxy_shidur, gxy_sndman, gxy_sdiout});
        } else {
            alert("Access denied!");
            client.signoutRedirect();
        }
    };

    render() {

        const {gxy_public,gxy_user,gxy_group,gxy_admin,gxy_shidur,gxy_sndman,gxy_sdiout,user} = this.state;

        let login = (<LoginPage user={user} />);

        const panes = [
            { menuItem: { key: 'Home', icon: 'home', content: 'Home', disabled: false },
                render: () => <Tab.Pane attached={true} >{login}</Tab.Pane> },
            { menuItem: { key: 'groups', icon: 'copyright', content: 'Groups', disabled: gxy_group },
                render: () => <Tab.Pane attached={false} ><GroupClient user={user} /></Tab.Pane> },
        ];

        return (

            <Tab menu={{ secondary: true, pointing: true, color: "blue" }} panes={panes} />

        );
    }
}

export default GroupsApp;
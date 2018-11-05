import React, { Component, Fragment } from 'react';
import LoginPage from '../../components/LoginPage';
import {client, getUser} from "../../components/UserManager";
import GroupClient from "./GroupClient";

class GroupsApp extends Component {

    state = {
        pass: false,
        user: null,
        gxy_user: true,
        gxy_group: true,
        gxy_admin: true,
        gxy_shidur: true,
        gxy_sndman: true,
        gxy_sdiout: true,
        gxy_temp: true,
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
        let gxy_temp = user.roles.filter(role => role === 'offline_access').length === 0;
        if(!gxy_public) {
            this.setState({user, gxy_public, gxy_user, gxy_group, gxy_admin, gxy_shidur, gxy_sndman, gxy_sdiout, gxy_temp});
        } else {
            // alert("Access denied!");
            // client.signoutRedirect();
            // FIXME: Tmp disable check permission
            this.setState({user, gxy_public, gxy_user, gxy_group, gxy_admin, gxy_shidur, gxy_sndman, gxy_sdiout, gxy_temp});
        }
    };

    authPass = () => {
        this.setState({pass: true})
    };

    render() {

        const {gxy_public,gxy_user,gxy_group,gxy_admin,gxy_shidur,gxy_sndman,gxy_sdiout,user, pass} = this.state;

        let login = (<LoginPage user={user} enter={this.authPass} />);
        let enter = (<GroupClient user={user} client={client} />);

        return (

            <Fragment>
                {pass ? enter: login}
            </Fragment>

        );
    }
}

export default GroupsApp;
import React, { Component, Fragment } from 'react';
import LoginPage from '../../components/LoginPage';
import {client, getUser} from "../../components/UserManager";
import GroupClient from "./GroupClient";

class GroupsApp extends Component {

    state = {
        pass: false,
        user: null,
        gxy_group: true,
        gxy_public: true,
    };

    componentDidMount() {
        getUser(cb => {
            if(cb) this.checkPermission(cb);
        });
    };

    checkPermission = (user) => {
        let gxy_public = user.roles.filter(role => role === 'bb_user').length === 0;
        let gxy_group = user.roles.filter(role => role === 'gxy_group').length === 0;
        if(!gxy_public) {
            this.setState({user, gxy_public, gxy_group});
        } else {
            alert("Access denied!");
            client.signoutRedirect();
        }
    };

    authPass = () => {
        this.setState({pass: true});
    };

    render() {

        const {user, pass} = this.state;

        let login = (<LoginPage user={user} enter={this.authPass} />);
        let enter = (<GroupClient user={user} />);
        return (

            <Fragment>
                {pass ? enter : login}
            </Fragment>

        );
    }
}

export default GroupsApp;
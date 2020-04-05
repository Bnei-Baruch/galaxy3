import React, { Component, Fragment } from 'react';
import {Button} from "semantic-ui-react";
import LoginPage from '../components/LoginPage';
import {client} from "../components/UserManager";

class GalaxyApp extends Component {

    state = {
        pass: false,
        user: null,
        roles: [],
    };

    checkPermission = (user) => {
        let gxy_public = user.roles.filter(role => role === 'bb_user').length === 0;
        if(!gxy_public) {
            this.setState({user, roles: user.roles});
        } else {
            alert("Thank you for registering to the Galaxy system. We will grant you the access to the system soon.");
            client.signoutRedirect();
        }
    };

    render() {
        const {user, roles} = this.state;

        const opt = roles.map((role,i) => {
            switch (role) {
                case "bb_user":
                    //return (<Button key={i} size='massive' color='green' onClick={() => window.open("https://galaxy.kli.one/stream")} >Stream</Button>);
                case "gxy_user":
                        return (<Button key={i} size='massive' color='green' onClick={() => window.open("https://galaxy.kli.one/user","_self")} >Galaxy</Button>);
                case "gxy_shidur":
                        return (<Button key={i} size='massive' color='green' onClick={() => window.open("https://galaxy.kli.one/shidur","_self")} >Shidur</Button>);
                case "gxy_sndman":
                        return (<Button key={i} size='massive' color='green' onClick={() => window.open("https://galaxy.kli.one/sndman","_self")} >SoundMan</Button>);
                case "gxy_admin":
                case "gxy_root":
                case "gxy_guest":
                        return (<Button key={i} size='massive' color='green' onClick={() => window.open("https://galaxy.kli.one/admin","_self")} >Admin</Button>);
                default:
                    return null;
            }
        });

        return (
            <Fragment>
                <LoginPage user={user} enter={opt} checkPermission={this.checkPermission} />
            </Fragment>
        );
    }
}

export default GalaxyApp;

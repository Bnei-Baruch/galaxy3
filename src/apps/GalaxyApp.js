import React, { Component, Fragment } from 'react';
import {Button} from "semantic-ui-react";
import LoginPage from '../components/LoginPage';
import {client} from "../components/UserManager";

class GalaxyApp extends Component {

    state = {
        user: null,
        roles: [],
    };

    checkPermission = (user) => {
        let gxy = user.roles.filter(role => /gxy_/.test(role));
        let gxy_user = gxy.length === 0
        console.log(gxy)
        if(!gxy_user && gxy.length > 1) {
            this.setState({user, roles: user.roles});
        } else if(!gxy_user && gxy.length === 1 && gxy[0] === "gxy_user") {
            window.location = '/user';
        } else {
            alert("Access denied.");
            client.signoutRedirect();
        }
    };

    render() {
        const {user, roles} = this.state;

        const opt = roles.map((role,i) => {
            //if(role === "bb_user") return (<Button key={i} size='massive' color='green' onClick={() => window.open("https://galaxy.kli.one/stream")} >Stream</Button>);
            if(role === "gxy_user") return (<Button key={i} size='massive' color='green' onClick={() => window.open("https://galaxy.kli.one/user","_self")} >Galaxy</Button>);
            if(role === "gxy_shidur") return (<Button key={i} size='massive' color='green' onClick={() => window.open("https://galaxy.kli.one/shidur","_self")} >Shidur</Button>);
            if(role === "gxy_sndman") return (<Button key={i} size='massive' color='green' onClick={() => window.open("https://galaxy.kli.one/sndman","_self")} >SoundMan</Button>);
            if(role.match(/^(gxy_admin|gxy_root|gxy_viewer)$/)) return (<Button key={i} size='massive' color='green' onClick={() => window.open("https://galaxy.kli.one/admin","_self")} >Admin</Button>);
            return false;
        });

        return (
            <Fragment>
                <LoginPage user={user} enter={opt} checkPermission={this.checkPermission} />
            </Fragment>
        );
    }
}

export default GalaxyApp;

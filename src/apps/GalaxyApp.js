import React, {Component, Fragment,} from 'react';
import {Button, Grid,} from "semantic-ui-react";
import LoginPage from '../components/LoginPage';
import {kc} from "../components/UserManager";
import {withTranslation} from "react-i18next";
import {languagesOptions, setLanguage} from "../i18n/i18n";
import {updateSentryUser} from "../shared/sentry";
import {getUserRole} from "../shared/enums";
import {mqttInit} from "../shared/mqtt";

class GalaxyApp extends Component {

    state = {
        user: null,
        roles: [],
        options: 0,
        mq: null,
    };

    componentDidMount() {
        const url = new URL(window.location.href);
        if (url.searchParams.has('lang')) {
            const lang = url.searchParams.get('lang');
            if (languagesOptions.find((option) => option.value === lang) !== null) {
                setLanguage(lang);
                url.searchParams.delete('lang');
                window.history.pushState({}, document.title, url.href);
            }
        }
    }

    checkPermission = (user) => {
        const allow = getUserRole();
        const options = this.buttonOptions(user.roles);
        this.setState({options: options.length});
        const mq = mqttInit(user);
        this.setState({mq});
        if(options.length > 1 && allow !== null) {
            this.setState({user, roles: user.roles});
            updateSentryUser(user);
        } else if(allow !== null && options.length === 1) {
            window.location = '/user';
        } else {
            alert("Access denied.");
            kc.logout();
            updateSentryUser(null);
        }
    }

  sendMessage = () => {
     let message = JSON.stringify(this.state.user);
     this.state.mq.publish('galaxy/test', message, {qos: 2, retain: true, properties: {messageExpiryInterval: 3}}, (err) => {
        err && console.error(err);
     })
  }

    buttonOptions = (roles) => {
        return roles.map((role, i) => {
            if(role.match(/^(new_user|gxy_guest|gxy_pending_approval|gxy_user|pending_approval)$/)) {
                return (<Button key={i} size='massive' color='green' onClick={() => window.open("user","_self")}>
                    Galaxy
                </Button>);
            }
            if(role === "gxy_shidur") {
                return (<Button key={i} size='massive' color='green' onClick={() => window.open("shidur","_self")}>
                    Shidur
                </Button>);
            }
            if(role === "gxy_sndman") {
                return (<Button key={i} size='massive' color='green' onClick={() => window.open("sndman","_self")}>
                    SoundMan
                </Button>);
            }
            if(role.match(/^(gxy_admin|gxy_root|gxy_viewer)$/)) {
                return (<Button key={i} size='massive' color='green' onClick={() => window.open("admin","_self")}>
                    Admin
                </Button>);
            }
            return false;
        }).filter(element => element);
    }

    render() {
        const {user, roles} = this.state;

        const enter = (
            <Grid>
                <Grid.Row>
                    <Grid.Column style={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                        {this.buttonOptions(roles)}
                      <Button size='massive' color='green' onClick={this.sendMessage}>Send</Button>
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );

        return (
            <Fragment>
                <LoginPage user={user} enter={enter} checkPermission={this.checkPermission} />
            </Fragment>
        );
    }
}

export default withTranslation()(GalaxyApp);

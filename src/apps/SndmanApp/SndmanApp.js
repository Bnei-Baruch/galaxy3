import React, {Component, Fragment} from 'react';
import './SndmanApp.css';
import './UsersSndman.css'
import api from '../../shared/Api';
import {client} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";
import {Grid} from "semantic-ui-react";
import UsersQuadSndman from "./UsersQuadSndman";
import GxyJanus from "../../shared/janus-utils";


class SndmanApp extends Component {

    state = {
        user: null,
        gateways: {},
        gatewaysInitialized: false,
        appInitError: null,
    };

    componentWillUnmount() {
        Object.values(this.state.gateways).forEach(x => x.destroy());
    };

    checkPermission = (user) => {
        const allowed = user.roles.filter(role => role === 'gxy_sndman').length > 0;
        if (allowed) {
            delete user.roles;
            user.role = "sndman";
            user.session = 0;
            this.initApp(user);
        } else {
            alert("Access denied!");
            client.signoutRedirect();
        }
    };

    initApp = (user) => {
        this.setState({user});

        api.setAccessToken(user.access_token);
        client.events.addUserLoaded((user) => api.setAccessToken(user.access_token));
        client.events.addUserUnloaded(() => api.setAccessToken(null));

        api.fetchConfig()
            .then(data => GxyJanus.setGlobalConfig(data))
            .then(() => this.initGateways(user))
            .catch(err => {
                console.error("[Sndman] error initializing app", err);
                this.setState({appInitError: err});
            });
    }

    initGateways = (user) => {
        const gateways = GxyJanus.makeGateways("rooms");
        this.setState({gateways});

        return Promise.all(Object.values(gateways).map(gateway => (this.initGateway(user, gateway))))
            .then(() => {
                console.log("[Sndman] gateways initialization complete");
                this.setState({gatewaysInitialized: true});
            });
    }

    initGateway = (user, gateway) => {
        console.log("[Sndman] initializing gateway", gateway.name);

        // we re-initialize the whole gateway on protocols error
        gateway.destroy();

        return gateway.init()
            .then(() => {
                return gateway.initGxyProtocol(user, data => this.onProtocolData(gateway, data))
                    .then(() => {
                        if (gateway.name === "gxy3") {
                            return gateway.initServiceProtocol(user, data => this.onServiceData(gateway, data))
                                .then(gateway.initForward)
                        }
                    });
            })
            .catch(err => {
                console.error("[Sndman] error initializing gateway", gateway.name, err);
                setTimeout(() => {
                    this.initGateway(user, gateway);
                }, 10000);
            });
    }

    onServiceData = (gateway, data) => {
        if (data.type === "error" && data.error_code === 420) {
            console.error("[Sndman] service error message (reloading in 10 seconds)", data.error);
            setTimeout(() => {
                this.initGateway(this.state.user, gateway);
            }, 10000);
        }

        let {col, group, i, status} = data;

        // Shidur action
        if(data.type === "sdi-fullscr_group" && status) {
            this["col"+col].fullScreenGroup(i,group);
        } else if(data.type === "sdi-fullscr_group" && !status) {
            this["col"+col].toFourGroup(i,group);
        }

        if(data.type === "event") {
            delete data.type;
            this.setState({...data});
        }

        if(data.type === "sdi-restart_sndman") {
            window.location.reload();
        }
    };

    onProtocolData = (gateway, data) => {
        if (data.type === "error" && data.error_code === 420) {
            console.error("[Sndman] protocol error message (reloading in 10 seconds)", data.error);
            setTimeout(() => {
                this.initGateway(this.state.user, gateway);
            }, 10000);
        }

        // let {users} = this.state;
        //
        // // Set status in users list
        // if(data.type.match(/^(camera|question|sound_test)$/)) {
        //     if(users[data.user.id]) {
        //         users[data.user.id][data.type] = data.status;
        //         this.setState({users});
        //     } else {
        //         users[data.user.id] = {[data.type]: data.status};
        //         this.setState({users});
        //     }
        // }
        //
        // if(data.type === "leave" && users[data.id]) {
        //     delete users[data.id];
        //     this.setState({users});
        // }
    };

    setProps = (props) => {
        this.setState({...props})
    };

    render() {
        const {user, gatewaysInitialized, appInitError} = this.state;

        if (appInitError) {
            return (
                <Fragment>
                    <h1>Error Initializing Application</h1>
                    {`${appInitError}`}
                </Fragment>
            );
        }

        if (!!user && !gatewaysInitialized) {
            return "Initializing connections to janus instances...";
        }

        let login = (<LoginPage user={user} checkPermission={this.checkPermission} />);
        let content = (
            <Grid columns={2} padded>
                <Grid.Row>
                    <Grid.Column>
                        <UsersQuadSndman index={0} {...this.state} ref={col => {this.col1 = col;}} setProps={this.setProps} />
                    </Grid.Column>
                    <Grid.Column>
                        <UsersQuadSndman index={4} {...this.state} ref={col => {this.col2 = col;}} setProps={this.setProps} />
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column>
                        <UsersQuadSndman index={8} {...this.state} ref={col => {this.col3 = col;}} setProps={this.setProps} />
                    </Grid.Column>
                    <Grid.Column>
                        <UsersQuadSndman index={12} {...this.state} ref={col => {this.col4 = col;}} setProps={this.setProps} />
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );

        return (
            <div>
                {user ? content : login}
            </div>
        );
    }
}

export default SndmanApp;

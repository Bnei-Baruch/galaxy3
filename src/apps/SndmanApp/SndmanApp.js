import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {getState, initJanus} from "../../shared/tools";
import './SndmanApp.css';
import './UsersSndman.css'
import {initGxyProtocol} from "../../shared/protocol";
import {client} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";
import {initDataForward} from "../../shared/forward";
import {Grid} from "semantic-ui-react";
import UsersQuadSndman from "./UsersQuadSndman";


class SndmanApp extends Component {

    state = {
        fwdhandle: null,
        janus: null,
        protocol: null,
        group: "",
        groups: [],
        groups_queue: 0,
        round: 0,
        rooms: [],
        disabled_rooms: [],
        user: null,
        users: {},
        shidur: false,
    };

    componentWillUnmount() {
        this.state.janus.destroy();
    };

    checkPermission = (user) => {
        let gxy_group = user.roles.filter(role => role === 'gxy_sndman').length > 0;
        if (gxy_group) {
            delete user.roles;
            user.role = "sndman";
            this.initApp(user);
        } else {
            alert("Access denied!");
            client.signoutRedirect();
        }
    };

    initApp = (user) => {
        initJanus(janus => {
            user.session = janus.getSessionId();
            this.setState({janus,user});
            getState('galaxy/users', (users) => {
                this.setState({users});
            });
            initGxyProtocol(janus, user, protocol => {
                this.setState({protocol});
            }, ondata => {
                Janus.log("-- :: It's protocol public message: ", ondata);
                if(ondata.type === "error" && ondata.error_code === 420) {
                    alert(ondata.error);
                    this.state.protocol.hangup();
                } else if(ondata.type === "joined") {
                    initDataForward(janus, fwdhandle => {
                        this.setState({fwdhandle});
                        console.log(" --- FWD ---", fwdhandle)
                    })
                }
                this.onProtocolData(ondata);
            });
        },er => {
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        }, true);
    };

    onProtocolData = (data) => {
        let {users} = this.state;
        let {col, group, i, status} = data;

        // Shidur action
        if(data.type === "sdi-fullscr_group" && status) {
            this["col"+col].fullScreenGroup(i,group);
        } else if(data.type === "sdi-fullscr_group" && !status) {
            this["col"+col].toFourGroup(i,group);
        }

        // Set status in users list
        if(data.type.match(/^(camera|question|sound_test)$/)) {
            if(users[data.user.id]) {
                users[data.user.id][data.type] = data.status;
                this.setState({users});
            } else {
                users[data.user.id] = {[data.type]: data.status};
                this.setState({users});
            }
        }

        if(data.type === "leave" && users[data.id]) {
            delete users[data.id];
            this.setState({users});
        }

        if(data.type === "event") {
            delete data.type;
            this.setState({...data});
        }

        if(data.type === "sdi-restart_sndman") {
            window.location.reload();
        }
    };

    setProps = (props) => {
        this.setState({...props})
    };


    render() {
        const {user} = this.state;

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
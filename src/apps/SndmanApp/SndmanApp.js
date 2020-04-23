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
        GxyJanus: {
            gxy1: {janus: null, protocol: null},
            gxy2: {janus: null, protocol: null},
            gxy3: {janus: null, protocol: null},
        },
        fwdhandle: null,
        service: null,
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
        this.state.GxyJanus.gxy1.janus.destroy();
        this.state.GxyJanus.gxy2.janus.destroy();
        this.state.GxyJanus.gxy3.janus.destroy();
    };

    checkPermission = (user) => {
        let gxy_group = user.roles.filter(role => role === 'gxy_sndman').length > 0;
        if (gxy_group) {
            delete user.roles;
            user.role = "sndman";
            user.session = 0;
            getState('galaxy/users', (users) => {
                this.setState({user,users});
                let gxy = ["gxy1","gxy2","gxy3"]
                this.initGalaxy(user,gxy);
            });
        } else {
            alert("Access denied!");
            client.signoutRedirect();
        }
    };

    initGalaxy = (user,gxy) => {
        for(let i=0; i<gxy.length; i++) {
            let {GxyJanus} = this.state;
            initJanus(janus => {
                // Right now we going to use gxy3 for service protocol
                if(gxy[i] === "gxy3")
                    this.initService(janus, user);
                if(GxyJanus[gxy[i]].janus)
                    GxyJanus[gxy[i]].janus.destroy();
                GxyJanus[gxy[i]].janus = janus;
                initGxyProtocol(janus, user, protocol => {
                    GxyJanus[gxy[i]].protocol = protocol;
                    this.setState({...GxyJanus[gxy[i]]});
                }, ondata => {
                    Janus.log(i + " :: protocol public message: ", ondata);
                    if(ondata.type === "error" && ondata.error_code === 420) {
                        console.error(ondata.error + " - Reload after 10 seconds");
                        this.state.GxyJanus[gxy[i]].protocol.hangup();
                        setTimeout(() => {
                            this.initGalaxy(user,[gxy[i]]);
                        }, 10000);
                    }
                    this.onProtocolData(ondata, gxy[i]);
                }, false);
            },er => {
                console.error(gxy[i] + ": " + er);
                setTimeout(() => {
                    this.initGalaxy(user,[gxy[i]]);
                }, 10000);
            }, gxy[i]);
        }
    };

    initService = (janus, user) => {
        initDataForward(janus, fwdhandle => {
            this.setState({fwdhandle});
        })
        initGxyProtocol(janus, user, service => {
            this.setState({service});
        }, ondata => {
            Janus.log(" :: Service message: ", ondata);
            if(ondata.type === "error" && ondata.error_code === 420) {
                console.error(ondata.error + " - Reload after 10 seconds");
                this.state.service.hangup();
                setTimeout(() => {
                    this.initService(janus,user);
                }, 10000);
            }
            this.onServiceData(ondata);
        }, true);
    };

    onServiceData = (data) => {
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

    onProtocolData = (data, inst) => {
        let {users} = this.state;

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
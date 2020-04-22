import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Grid, Segment} from "semantic-ui-react";
import {getState, initJanus} from "../../shared/tools";
import './SDIOutApp.css';
import './UsersSDIOut.css'
import './UsersQuadSDIOut.scss'
import {initGxyProtocol} from "../../shared/protocol";
import {SDIOUT_ID} from "../../shared/consts";
import UsersHandleSDIOut from "./UsersHandleSDIOut";
import UsersQuadSDIOut from "./UsersQuadSDIOut";


class SDIOutApp extends Component {

    state = {
        ce: null,
        group: null,
        room: null,
        GxyJanus: {
            gxy1: {janus: null, protocol: null},
            gxy2: {janus: null, protocol: null},
            gxy3: {janus: null, protocol: null},
        },
        service: null,
        mids: [],
        gxyhandle: null,
        myid: null,
        mypvtid: null,
        mystream: null,
        user: {
            session: 0,
            handle: 0,
            role: "sdiout",
            display: "sdiout",
            id: SDIOUT_ID,
            name: "sdiout"
        },
        users: {},
        shidur: false,
    };

    componentDidMount() {
        let {user} = this.state;
        getState('galaxy/users', (users) => {
            this.setState({users});
            let gxy = ["gxy1","gxy2","gxy3"]
            this.initGalaxy(user,gxy);
        });
    };

    componentWillUnmount() {
        this.state.GxyJanus.gxy1.janus.destroy();
        this.state.GxyJanus.gxy2.janus.destroy();
        this.state.GxyJanus.gxy3.janus.destroy();
    };

    initGalaxy = (user,gxy) => {
        for(let i=0; i<gxy.length; i++) {
            let {GxyJanus} = this.state;
            initJanus(janus => {
                if(GxyJanus[gxy[i]].janus)
                    GxyJanus[gxy[i]].janus.destroy();
                GxyJanus[gxy[i]].janus = janus;
                user.id = "sdiout-" + gxy[i];

                // Right now we going to use gxy3 for service protocol
                if(gxy[i] === "gxy3")
                    this.initService(janus, user);

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
        Janus.log(" :: Got Shidur Action: ", data);
        let {room, col, feed, group, i, status, qst} = data;

        if(data.type === "sdi-fullscr_group" && status) {
            if(qst) {
                if(room) {
                    this.users.exitVideoRoom(this.state.room, () => {
                        this.users.initVideoRoom(group.room, group.janus);
                        this.setState({group, room});
                    });
                } else {
                    this.users.initVideoRoom(group.room, group.janus);
                    this.setState({group, room});
                }
            } else {
                this["col"+col].toFullGroup(i,feed);
            }
        } else if(data.type === "sdi-fullscr_group" && !status) {
            let {col, feed, i} = data;
            if(qst) {
                this.users.exitVideoRoom(this.state.room, () => {});
                this.setState({group: null, room: null});
            } else {
                this["col"+col].toFourGroup(i,feed);
            }
        } else if(data.type === "sdi-restart_sdiout") {
            window.location.reload();
        } else if(data.type === "event") {
            delete data.type;
            this.setState({...data});
        }
    };

    onProtocolData = (data, inst) => {
        let {users} = this.state;

        // Set status in users list
        if(data.type && data.type.match(/^(camera|question|sound_test)$/)) {
            if(users[data.user.id]) {
                users[data.user.id][data.type] = data.status;
                this.setState({users});
            } else {
                users[data.user.id] = {[data.type]: data.status};
                this.setState({users});
            }
        }

        if(data.type && data.type === "camera") {
            this.setState({ce: data.user});
        }

        if(data.type && data.type === "leave" && users[data.id]) {
            delete users[data.id];
            this.setState({users});
        }
    };

    setProps = (props) => {
        this.setState({...props})
    };

    render() {
        let {group} = this.state;
        // let qst = g && g.questions;
        let name = group && group.description;

        return (

            <Grid columns={2} className="sdi_container">
                <Grid.Row>
                    <Grid.Column>
                        <UsersQuadSDIOut index={0} {...this.state} ref={col => {this.col1 = col;}} setProps={this.setProps} />
                    </Grid.Column>
                    <Grid.Column>
                        <UsersQuadSDIOut index={4} {...this.state} ref={col => {this.col2 = col;}} setProps={this.setProps} />
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column>
                        <UsersQuadSDIOut index={8} {...this.state} ref={col => {this.col3 = col;}} setProps={this.setProps} />
                    </Grid.Column>
                    <Grid.Column>
                        <UsersQuadSDIOut index={12} {...this.state} ref={col => {this.col4 = col;}} setProps={this.setProps} />
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column>
                        <Segment className="preview_sdi">
                            <div className="usersvideo_grid">
                                <div className="video_full">
                                    {/*{group && group.questions ? <div className="qst_fullscreentitle">?</div> : ""}*/}
                                    <div className="fullscrvideo_title" >{name}</div>
                                    <UsersHandleSDIOut ref={users => {this.users = users;}} {...this.state} setProps={this.setProps} />
                                </div>
                            </div>
                        </Segment>
                    </Grid.Column>
                    <Grid.Column>
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }
}

export default SDIOutApp;
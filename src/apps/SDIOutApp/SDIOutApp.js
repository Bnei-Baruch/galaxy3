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
        gxy1: {janus: null, protocol: null},
        gxy3: {janus: null, protocol: null},
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
        let {user,gxy1,gxy3} = this.state;

        // Init GXY1
        initJanus(janus => {
            gxy1.janus = janus;
            getState('galaxy/users', (users) => {
                this.setState({users});
            });
            user.id = "gxy1";
            initGxyProtocol(janus, user, protocol => {
                gxy1.protocol = protocol;
                this.setState({gxy1});
            }, ondata => {
                Janus.log("GXY1 :: It's protocol public message: ", ondata);
                if(ondata.type === "error" && ondata.error_code === 420) {
                    console.log(ondata.error + " - Reload after 10 seconds");
                    this.state.gxy1.protocol.hangup();
                    setTimeout(() => {
                        window.location.reload();
                    }, 10000);
                }
                this.onProtocolData(ondata, "gxy1");
            });
        }, er => {
            Janus.error(er);
        }, "gxy1");

        // Init GXY3
        initJanus(janus => {
            gxy3.janus = janus;
            initGxyProtocol(janus, user, protocol => {
                gxy3.protocol = protocol;
                this.setState({gxy3});
            }, ondata => {
                Janus.log("GXY3 :: It's protocol public message: ", ondata);
                if(ondata.type === "error" && ondata.error_code === 420) {
                    console.log(ondata.error + " - Reload after 10 seconds");
                    this.state.gxy3.protocol.hangup();
                    setTimeout(() => {
                        window.location.reload();
                    }, 10000);
                }
                this.onProtocolData(ondata, "gxy3");
            });
        }, er => {
            setTimeout(() => {
                window.location.reload();
            }, 10000);
        }, "gxy3");
    };

    componentWillUnmount() {
        this.state.gxy1.janus.destroy();
        this.state.gxy3.janus.destroy();
    };

    onProtocolData = (data, inst) => {
        Janus.log(" :: Got Shidur Action: ", data);
        let {users} = this.state;
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
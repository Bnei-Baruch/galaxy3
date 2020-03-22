import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Grid, Segment} from "semantic-ui-react";
import {getState, initJanus} from "../../shared/tools";
import './SDIOutApp.css';
import './UsersSDIOut.css'
import {initGxyProtocol} from "../../shared/protocol";
import {SDIOUT_ID} from "../../shared/consts";
import UsersHandleSDIOut from "./UsersHandleSDIOut";
import UsersQuadSDIOut from "./UsersQuadSDIOut";


class SDIOutApp extends Component {

    state = {
        ce: null,
        group: null,
        room: null,
        qam: {0:1,1:2,2:3,3:1,4:2,5:3,6:1,7:2,8:3,9:1,10:2,11:3},
        janus: null,
        mids: [],
        gxyhandle: null,
        protocol: null,
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
        initJanus(janus => {
            let {user} = this.state;
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
                    console.log(ondata.error + " - Reload after 10 seconds");
                    this.state.protocol.hangup();
                    setTimeout(() => {
                        window.location.reload();
                    }, 10000);
                }
                this.onProtocolData(ondata);
            });
        }, er => {
            setTimeout(() => {
                window.location.reload();
            }, 10000);
        }, true);
    };

    componentWillUnmount() {
        this.state.janus.destroy();
    };

    onProtocolData = (data) => {
        Janus.log(" :: Got Shidur Action: ", data);
        let {users} = this.state;
        let {room, col, feed, group, i, status, qst} = data;

        if(data.type === "sdi-fullscr_group" && status) {
            if(qst) {
                this.setState({group, room});
                this.users.initVideoRoom(group.room);
            } else {
                this["col"+col].toFullGroup(i,feed);
            }
        } else if(data.type === "sdi-fullscr_group" && !status) {
            let {col, feed, i} = data;
            if(qst) {
                this.users.exitVideoRoom(this.state.group.room, () => {
                    this.setState({room: null})
                });
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
        let {group,room} = this.state;
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
                        {!room ?
                        <Segment className="preview_sdi">
                            <div className="usersvideo_grid">
                                <div className="video_full">
                                    <div className="fullscrvideo_title" >{name}</div>
                                    {group && group.questions ? <div className="qst_fullscreentitle">?</div> : ""}
                                    <UsersHandleSDIOut ref={users => {this.users = users;}} {...this.state} setProps={this.setProps} />
                                </div>
                            </div>
                        </Segment>
                            : ""}
                    </Grid.Column>
                    <Grid.Column>
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }
}

export default SDIOutApp;
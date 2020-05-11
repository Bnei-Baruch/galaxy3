import React, {Component, Fragment} from 'react';
import {Grid, Segment} from "semantic-ui-react";
import './SDIOutApp.css';
import './UsersQuadSDIOut.scss'
//import {SDIOUT_ID} from "../../shared/consts";
import api from "../../shared/Api";
import {SDIOUT_ID} from "../../shared/consts";
import {API_BACKEND_PASSWORD, API_BACKEND_USERNAME} from "../../shared/env";
import GxyJanus from "../../shared/janus-utils";
import UsersHandleSDIOut from "./UsersHandleSDIOut";
import UsersQuadSDIOut from "./UsersQuadSDIOut";


class SDIOutApp extends Component {

    state = {
        qg: null,
        group: null,
        room: null,
        user: {
            session: 0,
            handle: 0,
            role: "sdiout",
            display: "sdiout",
            //id: SDIOUT_ID,
            id: "SDIOUT_ID",
            name: "sdiout"
        },
        qids: [],
        qcol: 0,
        users: {},
        gateways: {},
        gatewaysInitialized: false,
        appInitError: null,
    };

    componentDidMount() {
        this.initApp();
    };

    componentWillUnmount() {
        Object.values(this.state.gateways).forEach(x => x.destroy());
    };

    initApp = () => {
        api.setBasicAuth(API_BACKEND_USERNAME, API_BACKEND_PASSWORD);

        api.fetchConfig()
            .then(data => GxyJanus.setGlobalConfig(data))
            .then(api.fetchUsers)
            .then(data => this.setState({users: data}))
            .then(this.initGateways)
            .catch(err => {
                console.error("[SDIOut] error initializing app", err);
                this.setState({appInitError: err});
            });
    }

    initGateways = () => {
        const gateways = GxyJanus.makeGateways("rooms");
        this.setState({gateways});

        return Promise.all(Object.values(gateways).map(gateway => (this.initGateway(gateway))))
            .then(() => {
                console.log("[SDIOut] gateways initialization complete");
                this.setState({gatewaysInitialized: true});
            });
                    }

    initGateway = (gateway) => {
        console.log("[SDIOut] initializing gateway", gateway.name);

        // we re-initialize the whole gateway on protocols error
        gateway.destroy();

        const {user} = this.state;
        return gateway.init()
            .then(() => {
                return gateway.initGxyProtocol(user, data => this.onProtocolData(gateway, data))
                    .then(() => {
                        if (gateway.name === "gxy3") {
                            return gateway.initServiceProtocol(user, data => this.onServiceData(gateway, data))
                        }
                    });
            })
            .catch(err => {
                console.error("[SDIOut] error initializing gateway", gateway.name, err);
                setTimeout(() => {
                    this.initGateway(gateway);
                }, 10000);
            });
    };

    onServiceData = (gateway, data) => {
        if (data.type === "error" && data.error_code === 420) {
            console.error("[SDIOut] service error message (reloading in 10 seconds)", data.error);
                setTimeout(() => {
                this.initGateway(gateway);
                }, 10000);
            }

        const {room, col, feed, group, i, status, qst} = data;

        if(data.type === "sdi-fullscr_group" && status) {
            if(qst) {
                this.setState({qg: this.state.qids["q"+col].vquad[i]})
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

    setProps = (props) => {
        this.setState({...props})
    };

    render() {
        let {appInitError, gatewaysInitialized,group,qids,qg} = this.state;
        // let qst = g && g.questions;
        let name = group && group.description;

        if (appInitError) {
        return (
                <Fragment>
                    <h1>Error Initializing Application</h1>
                    {`${appInitError}`}
                </Fragment>
            );
        }

        if (!gatewaysInitialized) {
            return "Initializing WebRTC gateways...";
        }

        return (
            <Grid columns={2} className="sdi_container">
                <Grid.Row>
                    <Grid.Column>
                        <UsersQuadSDIOut index={0} {...qids.q1} {...this.state} ref={col => {this.col1 = col;}} setProps={this.setProps} />
                    </Grid.Column>
                    <Grid.Column>
                        <UsersQuadSDIOut index={4} {...qids.q2} {...this.state} ref={col => {this.col2 = col;}} setProps={this.setProps} />
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column>
                        <UsersQuadSDIOut index={8} {...qids.q3} {...this.state} ref={col => {this.col3 = col;}} setProps={this.setProps} />
                    </Grid.Column>
                    <Grid.Column>
                        <UsersQuadSDIOut index={12} {...qids.q4} {...this.state} ref={col => {this.col4 = col;}} setProps={this.setProps} />
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column>
                        <Segment className="preview_sdi">
                            <div className="usersvideo_grid">
                                <div className="video_full">
                                    {/*{group && group.questions ? <div className="qst_fullscreentitle">?</div> : ""}*/}
                                    <div className="fullscrvideo_title" >{name}</div>
                                    <UsersHandleSDIOut g={qg} ref={users => {this.users = users;}} {...this.state} setProps={this.setProps} />
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

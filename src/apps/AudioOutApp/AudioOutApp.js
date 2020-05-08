import React, {Component, Fragment} from 'react';
import {Janus} from "../../lib/janus";
import {Segment} from "semantic-ui-react";
import './AudioOutApp.css';
import './UsersAudioOut.css'
import UsersHandleAudioOut from "./UsersHandleAudioOut";
import api from "../../shared/Api";
import {API_BACKEND_PASSWORD, API_BACKEND_USERNAME} from "../../shared/env";
import GxyJanus from "../../shared/janus-utils";


class AudioOutApp extends Component {

    state = {
        audio: false,
        group: null,
        room: null,
        user: {
            session: 0,
            handle: 0,
            role: "audioout",
            display: "audioout",
            id: Janus.randomString(10),
            name: "audioout"
        },
        users: {},
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
                console.error("[AudioOut] error initializing app", err);
                this.setState({appInitError: err});
            })
    }

    initGateways = () => {
        const gateways = GxyJanus.makeGateways("rooms");
        this.setState({gateways});

        return Promise.all(Object.values(gateways).map(gateway => (this.initGateway(gateway))))
            .then(() => {
                console.log("[AudioOut] gateways initialization complete");
                this.setState({gatewaysInitialized: true});
            });
    }

    initGateway = (gateway) => {
        console.log("[AudioOut] initializing gateway", gateway.name);

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
                console.error("[AudioOut] error initializing gateway", gateway.name, err);
                setTimeout(() => {
                    this.initGateway(gateway);
                }, 10000);
            });
    }

    onServiceData = (gateway, data) => {
        if (data.type === "error" && data.error_code === 420) {
            console.error("[AudioOut] service error message (reloading in 10 seconds)", data.error);
            setTimeout(() => {
                this.initGateway(gateway);
            }, 10000);
        }

        const {room, group, status, qst} = data;

        if (data.type === "sdi-fullscr_group" && status && qst) {
            this.setState({group, room});
            this.users.initVideoRoom(group.room, group.janus);
        } else if (data.type === "sdi-fullscr_group" && !status && qst) {
            if (this.state.group && this.state.group.room) {
                this.users.exitVideoRoom(this.state.group.room, () => {
                });
            }
        } else if (data.type === "sdi-restart_sdiout") {
            window.location.reload();
        } else if (data.type === "audio-out") {
            this.setState({audio: status});
        } else if (data.type === "event") {
            delete data.type;
            this.setState({...data});
        }
    };

    onProtocolData = (gateway, data) => {
        if (data.type === "error" && data.error_code === 420) {
            console.error("[AudioOut] protocol error message (reloading in 10 seconds)", data.error);
            setTimeout(() => {
                this.initGateway(gateway);
            }, 10000);
        }

        let {users} = this.state;

        // Set status in users list
        if (data.type && data.type.match(/^(question|sound_test)$/)) {
            if (users[data.user.id]) {
                users[data.user.id][data.type] = data.status;
                this.setState({users});
            } else {
                users[data.user.id] = {[data.type]: data.status};
                this.setState({users});
            }
        }

        if (data.type && data.type === "leave" && users[data.id]) {
            delete users[data.id];
            this.setState({users});
        }
    };

    setProps = (props) => {
        this.setState({...props})
    };

    render() {
        const {group, appInitError, gatewaysInitialized} = this.state;

        if (appInitError) {
            return (
                <Fragment>
                    <h1>Error initializing Application</h1>
                    {`${appInitError}`}
                </Fragment>
            );
        }

        if (!gatewaysInitialized) {
            return "Initializing WebRTC gateways...";
        }

        const name = group && group.description;

        return (
            <Segment className="preview_sdi">
                <div className="usersvideo_grid">
                    <div className="video_full">
                        <div className="title">{name}</div>
                        <UsersHandleAudioOut ref={users => {
                            this.users = users;
                        }} {...this.state} setProps={this.setProps}/>
                    </div>
                </div>
            </Segment>
        );
    }
}

export default AudioOutApp;

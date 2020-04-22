import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Segment} from "semantic-ui-react";
import {getState, initJanus} from "../../shared/tools";
import './AudioOutApp.css';
import './UsersAudioOut.css'
import {initGxyProtocol} from "../../shared/protocol";
import UsersHandleAudioOut from "./UsersHandleAudioOut";


class AudioOutApp extends Component {

    state = {
        audio: false,
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
            role: "audioout",
            display: "audioout",
            id: Janus.randomString(10),
            name: "audioout"
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
                user.id = "audout-" + gxy[i];

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
                });
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

        if(data.type === "sdi-fullscr_group" && status && qst) {
            this.setState({group, room});
            this.users.initVideoRoom(group.room, group.janus);
        } else if(data.type === "sdi-fullscr_group" && !status && qst) {
            if(this.state.group && this.state.group.room) {
                this.users.exitVideoRoom(this.state.group.room, () =>{});
            }
        } else if(data.type === "sdi-restart_sdiout") {
            window.location.reload();
        } else if(data.type === "audio-out") {
            this.setState({audio: status});
        } else if(data.type === "event") {
            delete data.type;
            this.setState({...data});
        }
    };

    onProtocolData = (data, inst) => {
        let {users} = this.state;

        // Set status in users list
        if(data.type && data.type.match(/^(question|sound_test)$/)) {
            if(users[data.user.id]) {
                users[data.user.id][data.type] = data.status;
                this.setState({users});
            } else {
                users[data.user.id] = {[data.type]: data.status};
                this.setState({users});
            }
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
        let name = group && group.description;

        return (
            <Segment className="preview_sdi">
                <div className="usersvideo_grid">
                    <div className="video_full">
                        <div className="title" >{name}</div>
                        <UsersHandleAudioOut ref={users => {this.users = users;}} {...this.state} setProps={this.setProps} />
                    </div>
                </div>
            </Segment>
        );
    }
}

export default AudioOutApp;
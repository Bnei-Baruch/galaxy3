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
            role: "audioout",
            display: "audioout",
            id: Janus.randomString(10),
            name: "audioout"
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
                } else if(ondata.type === "joined") {
                    //this.initVideoRoom();
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

        if(data.type === "sdi-fullscr_group" && status && qst) {
            this.setState({group, room});
            this.users.initVideoRoom(group.room);
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
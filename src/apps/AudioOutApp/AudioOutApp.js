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

        if(data.type === "sdi-switch_req") {
            this.switchTo(feed)
        // } else if(data.type === "sdi-subscribe_req") {
        //     this.subscribeTo(feed)
        // } else if(data.type === "sdi-unsubscribe_req") {
        //     this.unsubscribeFrom(feed)
        } else if(data.type === "sdi-fullscr_group" && status) {
            if(qst) {
                if(room) {
                    // this.setState({group: feed, room}, () => {
                    //     let fourvideo = this["col"+col].refs["programVideo" + i];
                    //     let fullvideo = this.qst.refs.fullscreenVideo;
                    //     fullvideo.srcObject = fourvideo.captureStream();
                    //     this.qst.toFullGroup(i,feed);
                    // });
                } else {
                    this.setState({group, room});
                    this.users.initVideoRoom(group.room);
                }
            } else {
                //this["col"+col].toFullGroup(i,feed);
            }
        } else if(data.type === "sdi-fullscr_group" && !status) {
            let {col, feed, i} = data;
            if(qst) {
                if(col !== 1 && !this.state.room) {
                    this.users.exitVideoRoom(this.state.group.room, () =>{
                        this.setState({room: 1234});
                    });
                } else if(this.qst) {
                    //this.qst.toFourGroup(i,feed);
                }
            } else {
                //this["col"+col].toFourGroup(i,feed);
            }
        } else if(data.type === "sdi-sync_sdiout") {
            this.programState(feed);
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

        // if(data.type && data.type === "camera") {
        //     this.setState({ce: data.user});
        // }

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
            <Segment className="preview_sdi">
                <div className="usersvideo_grid">
                    <div className="video_full">
                        <div className="fullscrvideo_title" >{name}</div>
                        {group && group.questions ? <div className="qst_fullscreentitle">?</div> : ""}
                        <UsersHandleAudioOut ref={users => {this.users = users;}} {...this.state} setProps={this.setProps} />
                    </div>
                </div>
            </Segment>
        );
    }
}

export default AudioOutApp;
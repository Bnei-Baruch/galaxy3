import React, {Component, Fragment} from 'react';
import { Janus } from "../../lib/janus";
import {getState, initJanus} from "../../shared/tools";
import './UsersSndman.css'
import {initGxyProtocol} from "../../shared/protocol";
import UsersQuadSndman from "./UsersQuadSndman";

class UsersSndman extends Component {

    state = {
        janus: null,
        protocol: null,
        group: "",
        groups: [],
        groups_queue: 0,
        round: 0,
        rooms: [],
        disabled_rooms: [],
        user: {
            session: 0,
            handle: 0,
            role: "sdiout",
            display: "sdiout",
            id: Janus.randomString(10),
            name: "sdiout"
        },
        users: {},
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
                this.onProtocolData(ondata);
            });
        },er => {}, true);
    };

    componentWillUnmount() {
        this.state.janus.destroy();
    };

    onProtocolData = (data) => {
        let {users} = this.state;
        let {col, group, i, status} = data;

        // Shidur action
        if(data.type === "sdi-fullscr_group" && col === 4) {
            this.quad.switchFullScreen(i,group);
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
    };

    setProps = (props) => {
        this.setState({...props})
    };

    render() {
        return (
            <Fragment>
                <UsersQuadSndman {...this.state} ref={quad => {this.quad = quad;}} setProps={this.setProps} />
            </Fragment>
        );
    }
}

export default UsersSndman;

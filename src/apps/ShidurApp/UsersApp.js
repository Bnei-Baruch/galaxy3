import React, {Component, Fragment} from 'react';
import { Janus } from "../../lib/janus";
import {getState, initJanus} from "../../shared/tools";
import './UsersApp.css'
import {initGxyProtocol} from "../../shared/protocol";
import UsersQuad from "./UsersQuad";
import UsersToran from "./UsersToran";

class UsersApp extends Component {

    state = {
        ce: null,
        janus: null,
        protocol: null,
        group: "",
        groups: [],
        groups_queue: 0,
        round: 0,
        questions: 0,
        rooms: [],
        disabled_rooms: [],
        user: {
            session: 0,
            handle: 0,
            role: "shidur",
            display: "shidur",
            id: Janus.randomString(10),
            name: "shidur"
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
            setInterval(() => this.getRoomList(), 3000 );
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

    getRoomList = () => {
        let {disabled_rooms} = this.state;
        getState('galaxy/rooms', (rooms) => {
            let groups = rooms.filter((room) => !disabled_rooms.find(droom => room.room === droom.room));
            disabled_rooms = rooms.filter((room) => !groups.find(droom => room.room === droom.room));
            this.setState({groups,disabled_rooms});
            this.quad.questionStatus();
        });
    };

    onProtocolData = (data) => {
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

        // if(data.type === "camera") {
        //     this.setState({ce: data.user});
        // }

        if(data.type === "question") {
            this.quad.setQuestion(data.room, data.status);
        }

        if(data.type === "leave" && users[data.id]) {
            delete users[data.id];
            this.setState({users});
        }
    };

    checkFullScreen = () => {
        this.quad.checkFullScreen();
    };

    setProps = (props) => {
        this.setState({...props})
    };

    render() {
        return (
            <Fragment>
                <UsersQuad {...this.state} ref={quad => {this.quad = quad;}} setProps={this.setProps} />
                <UsersToran {...this.state} setProps={this.setProps} gerGroups={this.getRoomList} />
            </Fragment>
        );
    }
}

export default UsersApp;

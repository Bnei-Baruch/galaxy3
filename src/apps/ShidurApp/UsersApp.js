import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Segment} from "semantic-ui-react";
import {getState, putData, initJanus} from "../../shared/tools";
import './UsersApp.css'
import {initGxyProtocol} from "../../shared/protocol";
import UsersQuad from "./UsersQuad";
import UsersToran from "./UsersToran";

class UsersApp extends Component {

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
            setInterval(() => this.getRoomList(), 5000 );
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
            Janus.log(" :: Get Rooms: ", rooms);
            let groups = rooms.filter((room) => !disabled_rooms.find(droom => room.room === droom.room));
            disabled_rooms = rooms.filter((room) => !groups.find(droom => room.room === droom.room));
            this.setState({groups,disabled_rooms});
        });
    };

    onProtocolData = (data) => {
        let {users} = this.state;

        // Set status in users list
        if(data.type.match(/^(camera|question|sound-test)$/)) {
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
        const {users} = this.state;


        return (

            <Segment className="users_container">
                <UsersQuad {...this.state} setProps={this.setProps} />
                <UsersToran ref={toran => {this.toran = toran;}} {...this.state} setProps={this.setProps} />
            </Segment>
        );
    }
}

export default UsersApp;

import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Segment} from "semantic-ui-react";
import {getState, putData, initJanus, getPluginInfo} from "../../shared/tools";
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
            //setInterval(() => this.chkDisabledRooms(), 10000 );
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
        const {disabled_rooms} = this.state;
        let req = {request: "list"};
        getPluginInfo(req, data => {
            let usable_rooms = data.response.list.filter(room => room.num_participants > 0);
            let newarray = usable_rooms.filter((room) => !disabled_rooms.find(droom => room.room === droom.room));
            this.getFeedsList(newarray)
        })
    };

    getFeedsList = (rooms) => {
        let {users,groups} = this.state;
        rooms.forEach((room,i) => {
            if(room.num_participants > 0) {
                let req = {request: "listparticipants", "room": room.room};
                getPluginInfo(req, data => {
                    Janus.debug("Feeds: ", data);
                    let count = data.response.participants.filter(p => JSON.parse(p.display).role === "user");
                    if(count.length !== 0) {
                        let questions = data.response.participants.find(p => users[JSON.parse(p.display).id] ? users[JSON.parse(p.display).id].question : null);
                        rooms[i].num_participants = count.length;
                        rooms[i].questions = questions;
                        this.setState({rooms});
                    }
                })
            }
        });
        if(groups.length === 0) {
            this.setState({groups: rooms});
        } else {
            setTimeout(() => this.groupsQueue(),4000);
        }
    };

    groupsQueue = () => {
        let {groups,rooms} = this.state;
        if(groups.length > rooms.length) {
            for (let i=0; i<groups.length; i++) {
                let group = rooms.find(r => r.room === groups[i].room);
                if (!group) {
                    groups.splice(i, 1);
                    this.setState({groups});
                    break
                }
            }
        } else {
            for(let i=0; i<rooms.length; i++) {
                let group = groups.find(r => r.room === rooms[i].room);
                if(group) {
                    for(let g=0; g<groups.length; g++) {
                        if(groups[g].room === rooms[i].room && groups[g].num_participants !== rooms[i].num_participants) {
                            groups[g] = rooms[i];
                        }
                    }
                } else {
                    groups.push(rooms[i]);
                }
            }
            this.setState({groups});
        }
    };

    chkDisabledRooms = () => {
        let {users,disabled_rooms} = this.state;
        for (let i=0; i<disabled_rooms.length; i++) {
            if(disabled_rooms[i].num_participants === 0) {
                disabled_rooms.splice(i, 1);
                this.setState({disabled_rooms});
                continue;
            }
            let req = {request: "listparticipants", "room": disabled_rooms[i].room};
            getPluginInfo(req, data => {
                Janus.debug("Feeds: ", data.response.participants);
                let count = data.response.participants.filter(p => JSON.parse(p.display).role === "user");
                let questions = data.response.participants.find(p => users[JSON.parse(p.display).id] ? users[JSON.parse(p.display).id].question : null);
                disabled_rooms[i].num_participants = count.length;
                disabled_rooms[i].questions = questions;
                this.setState({disabled_rooms});
            });
        }
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

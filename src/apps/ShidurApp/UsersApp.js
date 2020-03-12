import React, {Component, Fragment} from 'react';
import { Janus } from "../../lib/janus";
import {getState, initJanus} from "../../shared/tools";
import './UsersApp.css'
import {initGxyProtocol} from "../../shared/protocol";
import UsersQuad from "./UsersQuad";
import UsersToran from "./UsersToran";
import {Grid} from "semantic-ui-react";

class UsersApp extends Component {

    state = {
        ce: null,
        janus: null,
        protocol: null,
        group: "",
        groups: [],
        groups_queue: 0,
        round: 0,
        questions: [],
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
        presets:[],
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
            this.col3.questionStatus();
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
            this.col3.setQuestion(data.room, data.status);
        }

        if(data.type === "leave" && users[data.id]) {
            delete users[data.id];
            this.setState({users});
        }
    };

    checkFullScreen = () => {
        this.col3.checkFullScreen();
    };

    setProps = (props) => {
        this.setState({...props})
    };

    render() {
        return (
            <Fragment>
                <Grid columns={3} className='virtual' >
                    <Grid.Row>
                        <Grid.Column className='vquad2'>
                            <UsersQuad index={0} {...this.state} ref={col2 => {this.col2 = col2;}} setProps={this.setProps} />
                        </Grid.Column>
                        <Grid.Column className='vquad3'>
                            <UsersQuad index={4} {...this.state} ref={col3 => {this.col3 = col3;}} setProps={this.setProps} />
                        </Grid.Column>
                        <Grid.Column>
                            <UsersQuad index={8} {...this.state} ref={col4 => {this.col4 = col4;}} setProps={this.setProps} />
                        </Grid.Column>
                    </Grid.Row>
                        <div className='vtoran' >
                            <Grid.Column>
                                <UsersToran {...this.state} setProps={this.setProps} gerGroups={this.getRoomList} />
                            </Grid.Column>
                        </div>
                </Grid>
            </Fragment>
        );
    }
}

export default UsersApp;

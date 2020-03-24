import React, {Component} from 'react';
import {Janus} from "../../lib/janus";
import {Grid} from "semantic-ui-react";
import {getDateString, getState, initJanus} from "../../shared/tools";
import {initGxyProtocol} from "../../shared/protocol";
import {client} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";
import ShidurToran from "./ShidurToran";
import UsersQuad from "./UsersQuad";
import './UsersApp.css'


class ShidurApp extends Component {

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
        user: null,
        users: {},
        presets:[],
        sdiout: false,
        sndman: false,
    };

    componentWillUnmount() {
        this.state.janus.destroy();
    };

    checkPermission = (user) => {
        let gxy_group = user.roles.filter(role => role === 'gxy_shidur').length > 0;
        if (gxy_group) {
            delete user.roles;
            user.role = "shidur";
            this.initGalaxy(user);
        } else {
            alert("Access denied!");
            client.signoutRedirect();
        }
    };

    initGalaxy = (user) => {
        initJanus(janus => {
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
        },er => {
            alert(er);
            window.location.reload();
        }, true);
    };

    getRoomList = () => {
        let {disabled_rooms} = this.state;
        getState('galaxy/rooms', (rooms) => {
            let groups = rooms.filter((room) => !disabled_rooms.find(droom => room.room === droom.room));
            disabled_rooms = rooms.filter((room) => !groups.find(droom => room.room === droom.room));
            this.setState({groups,disabled_rooms});
            let quads = [...this.col1.state.vquad,...this.col2.state.vquad,...this.col3.state.vquad,...this.col4.state.vquad];
            let list = groups.filter((room) => !quads.find(droom => droom && room.room === droom.room));
            let questions = list.filter(room => room.questions);
            this.setState({questions});
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

        if(data.type === "question") {
            setTimeout(() => {
                this.col1.setQuestion(data.room);
                this.col2.setQuestion(data.room);
                this.col3.setQuestion(data.room);
                this.col4.setQuestion(data.room);
            }, 3000);
        }

        if(data.type === "leave" && users[data.id]) {
            let user = users[data.id];
            if(user.room) {
                setTimeout(() => {
                    this.col1.setQuestion(user.room);
                    this.col2.setQuestion(user.room);
                    this.col3.setQuestion(user.room);
                    this.col4.setQuestion(user.room);
                }, 3000);
            }
            delete users[data.id];
            this.setState({users});
        }

        if(data.type === "event") {
            delete data.type;
            this.setState({...data});
            if(data.sdiout || data.sndman) {
                setTimeout(() => {
                    Janus.log(":: Check Full Screen state :: ");
                    this.checkFullScreen();
                }, 3000);
            }
        }
    };

    checkFullScreen = () => {
        this.col1.checkFullScreen();
        this.col2.checkFullScreen();
        this.col3.checkFullScreen();
        this.col4.checkFullScreen();
    };

    setProps = (props) => {
        this.setState({...props})
    };


    actionLog = (user, text) => {
        let {log_list} = this.state;
        let time = getDateString();
        let log = {time, user, text};
        log_list.push(log);
        this.setState({log_list});
    };

    render() {

        const {user} = this.state;

        let login = (<LoginPage user={user} checkPermission={this.checkPermission} />);

        let content = (
            <Grid columns={2} padded>
                <Grid.Column width={16}>
                    <Grid columns={4}>
                        <Grid.Row>
                            <Grid.Column>
                                <UsersQuad index={0} {...this.state} ref={col1 => {this.col1 = col1;}} setProps={this.setProps} />
                            </Grid.Column>
                            <Grid.Column>
                                <UsersQuad index={4} {...this.state} ref={col2 => {this.col2 = col2;}} setProps={this.setProps} />
                            </Grid.Column>
                            <Grid.Column>
                                <UsersQuad index={8} {...this.state} ref={col3 => {this.col3 = col3;}} setProps={this.setProps} />
                            </Grid.Column>
                            <Grid.Column>
                                <UsersQuad index={12} {...this.state} ref={col4 => {this.col4 = col4;}} setProps={this.setProps} />
                            </Grid.Column>
                        </Grid.Row>
                        <ShidurToran {...this.state} setProps={this.setProps} gerGroups={this.getRoomList} />
                    </Grid>
                </Grid.Column>
                {/*<Grid.Column width={4}>*/}
                {/*<UsersApp ref={users => {this.users = users;}} />*/}
                {/*</Grid.Column>*/}
            </Grid>
        );

        return (
            <div>
                {user ? content : login}
            </div>
        );
    }
}

export default ShidurApp;
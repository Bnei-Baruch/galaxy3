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
        GxyJanus: {
            gxy1: {janus: null, protocol: null},
            gxy2: {janus: null, protocol: null},
            gxy3: {janus: null, protocol: null},
        },
        group: "",
        groups: [],
        groups_queue: 0,
        mode: "",
        round: 0,
        questions: [],
        rooms: [],
        disabled_rooms: [],
        user: null,
        users: {},
        presets: {1:[],2:[],3:[],4:[]},
        sdiout: false,
        sndman: false,
    };

    componentWillUnmount() {
        this.state.GxyJanus.gxy1.janus.destroy();
        this.state.GxyJanus.gxy2.janus.destroy();
        this.state.GxyJanus.gxy3.janus.destroy();
    };

    checkPermission = (user) => {
        let gxy_group = user.roles.filter(role => role === 'gxy_shidur').length > 0;
        if (gxy_group) {
            delete user.roles;
            user.role = "shidur";
            user.session = 0;
            getState('galaxy/users', (users) => {
                this.setState({user,users});
                setInterval(() => this.getRoomList(), 2000 );
                let gxy = ["gxy1","gxy2","gxy3"]
                this.initGalaxy(user,gxy);
            });
        } else {
            alert("Access denied!");
            client.signoutRedirect();
        }
    };

    initGalaxy = (user,gxy) => {
        for(let i=0; i<gxy.length; i++) {
            let {GxyJanus} = this.state;
            initJanus(janus => {
                if(GxyJanus[gxy[i]].janus)
                    GxyJanus[gxy[i]].janus.destroy();
                GxyJanus[gxy[i]].janus = janus;
                if(gxy[i] !== "gxy3")
                    user.id = "shidur-" + gxy[i];
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
                alert(gxy[i] + ": " + er);
                this.initGalaxy(user,[gxy[i]]);
            }, gxy[i]);
        }
    };

    getRoomList = () => {
        let {disabled_rooms,mode} = this.state;
        getState('galaxy/rooms', (rooms) => {
            if(mode === "nashim") {
                rooms = rooms.filter(r => r.description.match(/^W /));
            } else if(mode === "gvarim") {
                rooms = rooms.filter(r => !r.description.match(/^W /));
            } else if(mode === "beyahad") {
                this.setState({mode: ""})
            }
            let groups = rooms.filter((room) => room.janus !== "" && !disabled_rooms.find(droom => room.room === droom.room));
            disabled_rooms = rooms.filter((room) => room.janus !== "" && !groups.find(droom => room.room === droom.room));
            this.setState({rooms,groups,disabled_rooms});
            let quads = [...this.col1.state.vquad,...this.col2.state.vquad,...this.col3.state.vquad,...this.col4.state.vquad];
            let list = groups.filter((room) => !quads.find(droom => droom && room.room === droom.room));
            let questions = list.filter(room => room.questions);
            this.setState({questions});
        });
    };

    onProtocolData = (data, inst) => {
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
            const {room, status} = data;
            setTimeout(() => {
                this.col1.setQuestion(room, status);
                this.col2.setQuestion(room, status);
                this.col3.setQuestion(room, status);
                this.col4.setQuestion(room, status);
            }, 3000);
        }

        if(data.type === "leave" && users[data.id]) {
            let user = users[data.id];
            if(user.room && user.question) {
                setTimeout(() => {
                    this.col1.setQuestion(user.room, false);
                    this.col2.setQuestion(user.room, false);
                    this.col3.setQuestion(user.room, false);
                    this.col4.setQuestion(user.room, false);
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
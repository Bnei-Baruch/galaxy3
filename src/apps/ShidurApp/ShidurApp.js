import React, {Component, Fragment} from 'react';
import {Grid} from "semantic-ui-react";
import api from '../../shared/Api';
import {kc} from "../../components/UserManager";
import GxyJanus from "../../shared/janus-utils";
import LoginPage from "../../components/LoginPage";
import ShidurToran from "./ShidurToran";
import UsersQuad from "./UsersQuad";
import './ShidurApp.css'
import {STORAN_ID} from "../../shared/consts"
import {GuaranteeDeliveryManager} from '../../shared/GuaranteeDelivery';
import * as Sentry from "@sentry/browser";
import {SENTRY_KEY} from "../../shared/env";


class ShidurApp extends Component {

    state = {
        ce: null,
        delay: false,
        full_qst: false,
        full_feed: {},
        full_group: {},
        full_col: null,
        group: "",
        groups: [],
        groups_queue: 0,
        shidur_mode: "",
        preview_mode: true,
        round: 0,
        questions: [],
        quads: [],
        rooms: [],
        disabled_rooms: [],
        pre_groups: [],
        user: null,
        gateways: {},
        gatewaysInitialized: false,
        appInitError: null,
        presets: {1:[],2:[],3:[],4:[]},
        sdiout: false,
        sndman: false,
        users_count: 0,
        gdm: new GuaranteeDeliveryManager(STORAN_ID),
    };

    componentDidMount() {
        Sentry.init({dsn: `https://${SENTRY_KEY}@sentry.kli.one/2`});
    }

    componentWillUnmount() {
        Object.values(this.state.gateways).forEach(x => x.destroy());
    };

    checkPermission = (user) => {
        const allowed = kc.hasRealmRole("gxy_shidur");
        if (allowed) {
            delete user.roles;
            user.role = "shidur";
            user.session = 0;
            this.initApp(user);
        } else {
            alert("Access denied!");
            kc.logout();
        }
    };

    initApp = (user) => {
        this.setState({user});
        api.fetchConfig()
            .then(data => GxyJanus.setGlobalConfig(data))
            .then(() => this.initGateways(user))
            .then(this.pollRooms)
            .catch(err => {
                console.error("[Shidur] error initializing app", err);
                this.setState({appInitError: err});
            });
    }

    initGateways = (user) => {
        const gateways = GxyJanus.makeGateways("rooms");
        this.setState({gateways});

        return Promise.all(Object.values(gateways).map(gateway => (this.initGateway(user, gateway))))
            .then(() => {
                console.log("[Shidur] gateways initialization complete");
                this.setState({gatewaysInitialized: true});
            });
    };

    initGateway = (user, gateway) => {
        console.log("[Shidur] initializing gateway", gateway.name);

        // we re-initialize the whole gateway on protocols error
        gateway.destroy();

        return gateway.init()
            .then(() => {
                return gateway.initGxyProtocol(user, data => this.onProtocolData(gateway, data))
                    .then(() => {
                        if (gateway.name === "gxy3") {
                            return gateway.initServiceProtocol(user, data => this.onServiceData(gateway, data))
                        }
                    });
            })
            .catch(err => {
                console.error("[Shidur] error initializing gateway", gateway.name, err);
                setTimeout(() => {
                    this.initGateway(user, gateway);
                }, 10000);
            });
    }

    pollRooms = () => {
        this.fetchRooms();
        setInterval(this.fetchRooms, 2 * 1000)
    }

    fetchRooms = () => {
        let {disabled_rooms,groups,shidur_mode,preview_mode} = this.state;
        api.fetchActiveRooms()
            .then((data) => {
                const users_count = data.map(r => r.num_users).reduce((su, cur) => su + cur, 0);

                let rooms = data;
                if(shidur_mode === "nashim") {
                    rooms = rooms.filter(r => r.description.match(/^W /));
                } else if(shidur_mode === "gvarim") {
                    rooms = rooms.filter(r => !r.description.match(/^W /));
                } else if(shidur_mode === "beyahad") {
                    this.setState({shidur_mode: ""})
                }

                let pre_groups = [];
                if(preview_mode) {
                    pre_groups = rooms.filter(r => !disabled_rooms.find(d => r.room === d.room) && !groups.find(g => r.room === g.room));
                    this.setState({pre_groups});
                } else {
                    pre_groups = [];
                    this.setState({pre_groups});
                }

                groups = rooms.filter(r => !disabled_rooms.find(d => r.room === d.room) && !pre_groups.find(d => r.room === d.room));
                disabled_rooms = rooms.filter(r => !groups.find(g => r.room === g.room) && !pre_groups.find(d => r.room === d.room));
                this.setState({rooms,groups,disabled_rooms});
                let quads = [...this.col1.state.vquad,...this.col2.state.vquad,...this.col3.state.vquad,...this.col4.state.vquad];
                let list = groups.filter(r => !quads.find(q => q && r.room === q.room));
                let questions = list.filter(room => room.questions);
                this.setState({quads, questions, users_count});
            })
            .catch(err => {
                console.error("[Shidur] error fetching active rooms", err);
            })
    }

    onServiceData = (gateway, data) => {
      const { gdm } = this.state;
      if (gdm.checkAck(data)) {
        // Ack received, do nothing.
        return;
      }

      if (data.type === "error" && data.error_code === 420) {
          console.error("[Shidur] service error message (reloading in 10 seconds)", data.error);
          setTimeout(() => {
              this.initGateway(this.state.user, gateway);
          }, 10000);
          return;
      }

      if(data.type === "event") {
          delete data.type;
          this.setState({...data});
          if(data.sdiout || data.sndman) {
              setTimeout(() => {
                  console.log("[Shidur] :: Check Full Screen state :: ");
                  this.checkFullScreen();
              }, 3000);
          }
          return;
      }
    };

    onProtocolData = (gateway, data) => {
        const { gdm, gateways } = this.state;
        if (gdm.checkAck(data)) {
            // Ack received, do nothing.
            return;
        }

        const {type, error_code, gxy} = data;

        if (type === "error" && error_code === 420) {
            console.error("[Shidur] protocol error message (reloading in 10 seconds)", data.error);
            setTimeout(() => {
                this.initGateway(this.state.user, gateway);
            }, 10000);
        } else if (type === 'shidur-ping') {
            gdm.accept(data, (msg) => gateways[gxy].sendProtocolMessage(msg)).then((data) => {
                if (data === null) {
                    console.log('Message received more then once.');
                    return;
                }
            }).catch((error) => {
                console.error(`Failed receiving ${data}: ${error}`);
            });
        }
    };

    nextInQueue = () => {
        let {groups_queue,groups,round} = this.state;
        groups_queue++;
        if(groups_queue >= groups.length) {
            // End round here!
            console.log("[Shidur] -- ROUND END --");
            groups_queue = 0;
            round++;
            this.setState({groups_queue,round});
        } else {
            this.setState({groups_queue});
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

    render() {
        const {user, gatewaysInitialized, appInitError} = this.state;

        if (appInitError) {
            return (
                <Fragment>
                    <h1>Error Initializing Application</h1>
                    {`${appInitError}`}
                </Fragment>
            );
        }

        if (!!user && !gatewaysInitialized) {
            return "Initializing connections to janus instances...";
        }

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
                        <ShidurToran {...this.state} setProps={this.setProps} nextInQueue={this.nextInQueue} />
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

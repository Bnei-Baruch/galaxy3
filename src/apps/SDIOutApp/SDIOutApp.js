import React, {Component, Fragment} from 'react';
import {Grid, Segment} from "semantic-ui-react";
import './SDIOutApp.css';
import './UsersQuadSDIOut.scss'
import {USERNAME_ALREADY_EXIST_ERROR_CODE, SDIOUT_ID} from "../../shared/consts";
import api from "../../shared/Api";
import {API_BACKEND_PASSWORD, API_BACKEND_USERNAME} from "../../shared/env";
import GxyJanus from "../../shared/janus-utils";
import UsersHandleSDIOut from "./UsersHandleSDIOut";
import UsersQuadSDIOut from "./UsersQuadSDIOut";
import {GuaranteeDeliveryManager} from '../../shared/GuaranteeDelivery';
import {captureException, captureMessage} from "../../shared/sentry";
import mqtt from "../../shared/mqtt";


class SDIOutApp extends Component {

    state = {
        qg: null,
        group: null,
        room: null,
        user: {
            session: 0,
            handle: 0,
            role: "sdiout",
            display: "sdiout",
            id: SDIOUT_ID,
            name: "sdiout",
        },
        qids: [],
        qcol: 0,
        gateways: {},
        gatewaysInitialized: false,
        appInitError: null,
        vote: false,
        gdm: new GuaranteeDeliveryManager(SDIOUT_ID),
        roomsStatistics: {},
        reinit_inst: null,
    };

    componentDidMount() {
        setInterval(() => {
            api.fetchProgram()
                .then(qids => {
                    this.setState({qids});
                    if(this.state.qg) {
                        const {col, i} = this.state;
                        this.setState({qg: this.state.qids["q"+col].vquad[i]})
                    }
                })
                .catch(err => {
                    console.error("[SDIOut] error fetching quad state", err);
                    captureException(err, {source: "SDIOut"});
                });

            api.fetchRoomsStatistics()
                .then((roomsStatistics) => {
                    this.setState({roomsStatistics});
                })
                .catch(err => {
                    console.error("[SDIOut] error fetching rooms statistics", err);
                    captureException(err, {source: "SDIOut"});
                });
        }, 1000);
        this.initApp();
    };

    componentWillUnmount() {
        Object.values(this.state.gateways).forEach(x => x.destroy());
    };

    initApp = () => {
        const {user} = this.state;

        mqtt.init(user, (connected) => {
          setTimeout(() => {
            mqtt.watch((data) => {
              this.onMqttData(data);
            })
            mqtt.join('galaxy/service/#');
          }, 3000);
        })

        api.setBasicAuth(API_BACKEND_USERNAME, API_BACKEND_PASSWORD);

        api.fetchConfig()
            .then(data => GxyJanus.setGlobalConfig(data))
            .then(() => this.initGateways(user))
            .catch(err => {
                console.error("[SDIOut] error initializing app", err);
                this.setState({appInitError: err});
                captureException(err, {source: 'SDIOut'});
            });
    };

    initGateways = (user) => {
        const gateways = GxyJanus.makeGateways("rooms");
        this.setState({gateways});

        const gatewayToInitPromise = (gateway) => this.initGateway(user, gateway)
					.catch(error => {
						captureException(error, {source: 'SDIOut', gateway: gateway.name});
						throw error;
					});

        return Promise.all(Object.values(gateways).map(gatewayToInitPromise))
					.then(() => {
						console.log("[SDIOut] gateways initialization complete");
						this.setState({gatewaysInitialized: true});
					});
    };

    initGateway = (user, gateway) => {
        console.log("[SDIOut] initializing gateway", gateway.name);

        gateway.addEventListener("reinit", () => {
                this.setState({reinit_inst: gateway.name});
                this.postInitGateway(user, gateway)
                    .catch(err => {
                        console.error("[SDIOut] postInitGateway error after reinit. Reloading", gateway.name, err);
                        captureException(err, {source: 'SDIOut', gateway: gateway.name});
                        this.initGateway(user, gateway);
                    });
            }
        );

        return gateway.init()
            .then(() => this.postInitGateway(user, gateway))
            .catch(err => {
                console.error("[SDIOut] error initializing gateway", gateway.name, err);
                setTimeout(() => {
                    this.initGateway(user, gateway)
                        .catch(err => captureException(err, {source: 'SDIOut', gateway: gateway.name}));
                }, 10000);
            });
    };

    postInitGateway = (user, gateway) => {
        if (gateway.name === "gxy3") {
            return gateway.initServiceProtocol(user, data => this.onServiceData(gateway, data));
        }
        return Promise.resolve();
    };

  onMqttData = (data) => {
    const {room, col, feed, group, i, status, qst} = data;

    if(data.type === "sdi-fullscr_group" && status) {
      if(qst) {
        this.setState({col, i, group, room, qg: this.state.qids["q"+col].vquad[i]})
      } else {
        this["col"+col].toFullGroup(i,feed);
      }
    } else if(data.type === "sdi-fullscr_group" && !status) {
      let {col, feed, i} = data;
      if(qst) {
        this.setState({group: null, room: null, qg: null});
      } else {
        this["col"+col].toFourGroup(i,feed);
      }
    } else if(data.type === "sdi-vote") {
      if(this.state.group)
        return
      this.setState({vote: status, qg: null});
    } else if(data.type === "sdi-restart_sdiout") {
      window.location.reload();
    } else if(data.type === "event") {
      delete data.type;
      this.setState({...data});
    }
  };

    onServiceData = (gateway, data, user) => {
        const { gdm } = this.state;
        if (gdm.checkAck(data)) {
          // Ack received, do nothing.
          return;
        }
        gdm.accept(data, (msg) => gateway.sendServiceMessage(msg)).then((data) => {
          if (data === null) {
            console.log('Message received more then once.');
            return;
          }

          if (data.type === "error") {
            if (data.error_code === USERNAME_ALREADY_EXIST_ERROR_CODE) {
              console.error("[SDIOut] service error message (reloading in 10 seconds)", data.error);
              captureMessage(data.error, {source: "SDIOut", msg: data});
              setTimeout(() => {
                this.initGateway(user, gateway);
              }, 10000);
            } else {
              captureException(data.error, {source: "SDIOut", msg: data});
            }
          }

          const {room, col, feed, group, i, status, qst} = data;

          if(data.type === "sdi-fullscr_group" && status) {
              if(qst) {
                  this.setState({col, i, group, room, qg: this.state.qids["q"+col].vquad[i]})
              } else {
                  this["col"+col].toFullGroup(i,feed);
              }
          } else if(data.type === "sdi-fullscr_group" && !status) {
              let {col, feed, i} = data;
              if(qst) {
                  this.setState({group: null, room: null, qg: null});
              } else {
                  this["col"+col].toFourGroup(i,feed);
              }
          } else if(data.type === "sdi-vote") {
              if(this.state.group)
                  return
              this.setState({vote: status, qg: null});
          } else if(data.type === "sdi-restart_sdiout") {
              window.location.reload();
          } else if(data.type === "event") {
              delete data.type;
              this.setState({...data});
          }
        }).catch((error) => {
          console.error(`Failed receiving ${data}: ${error}`);
        });
    };

    render() {
        let {vote,appInitError, gatewaysInitialized,group,qids,qg,gateways, roomsStatistics} = this.state;
        // let qst = g && g.questions;
        let name = group && group.description;

        if (appInitError) {
        return (
                <Fragment>
                    <h1>Error Initializing Application</h1>
                    {`${appInitError}`}
                </Fragment>
            );
        }

        if (!gatewaysInitialized) {
            return "Initializing WebRTC gateways...";
        }

        return (
            <Grid columns={2} className="sdi_container">
                <Grid.Row>
                    <Grid.Column>
                        <UsersQuadSDIOut index={0} {...qids.q1} qst={qg} gateways={gateways}
                                         roomsStatistics={roomsStatistics} ref={col => {this.col1 = col;}} />
                    </Grid.Column>
                    <Grid.Column>
                        <UsersQuadSDIOut index={4} {...qids.q2} qst={qg} gateways={gateways}
                                         roomsStatistics={roomsStatistics} ref={col => {this.col2 = col;}} />
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column>
                        <UsersQuadSDIOut index={8} {...qids.q3} qst={qg} gateways={gateways}
                                         roomsStatistics={roomsStatistics} ref={col => {this.col3 = col;}} />
                    </Grid.Column>
                    <Grid.Column>
                        <UsersQuadSDIOut index={12} {...qids.q4} qst={qg} gateways={gateways}
                                         roomsStatistics={roomsStatistics} ref={col => {this.col4 = col;}} />
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column>
                        <Segment className="preview_sdi">
                            <div className="usersvideo_grid">
                                <div className="video_full">
                                    {vote ?
                                        <iframe title="Vote" src='https://vote.kli.one'
                                                width="100%" height="100%" frameBorder="0" />
                                    :
                                        qg ? <Fragment>
                                        {/*{group && group.questions ? <div className="qst_fullscreentitle">?</div> : ""}*/}
                                        <div className="fullscrvideo_title" >{name}</div>
                                        <UsersHandleSDIOut key={"q5"} g={qg} group={group} index={13} gateways={gateways} />
                                        </Fragment> : ""
                                    }
                                </div>
                            </div>
                        </Segment>
                    </Grid.Column>
                    <Grid.Column>
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }
}

export default SDIOutApp;

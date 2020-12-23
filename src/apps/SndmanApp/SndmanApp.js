import React, {Component, Fragment} from 'react';
import './SndmanApp.css';
import './UsersSndman.css'
import api from '../../shared/Api';
import {kc} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";
import {Grid} from "semantic-ui-react";
import UsersQuadSndman from "./UsersQuadSndman";
import GxyJanus from "../../shared/janus-utils";
import {USERNAME_ALREADY_EXIST_ERROR_CODE, SNDMAN_ID} from "../../shared/consts"
import {GuaranteeDeliveryManager} from '../../shared/GuaranteeDelivery';
import {captureException, captureMessage, updateSentryUser} from "../../shared/sentry";
import mqtt from "../../shared/mqtt";


class SndmanApp extends Component {

    state = {
        user: null,
        gateways: {},
        gatewaysInitialized: false,
        appInitError: null,
        gdm: new GuaranteeDeliveryManager(SNDMAN_ID),
    };

    componentWillUnmount() {
        Object.values(this.state.gateways).forEach(x => x.destroy());
    };

    checkPermission = (user) => {
        const allowed = kc.hasRealmRole("gxy_sndman");
        if (allowed) {
            delete user.roles;
            user.role = "sndman";
            user.session = 0;
            this.initApp(user);
        } else {
            alert("Access denied!");
            kc.logout();
            updateSentryUser(null);
        }
    };

    initApp = (user) => {
        this.setState({user});
        updateSentryUser(user);

      mqtt.init(user, (connected) => {
        setTimeout(() => {
          mqtt.watch((data) => {
            this.onMqttData(data);
          })
          mqtt.join('galaxy/service/#');
          mqtt.send(JSON.stringify({type: "event", [user.role]: true}), true, 'galaxy/service/' + user.role);
        }, 3000);
      })

        api.fetchConfig()
            .then(data => GxyJanus.setGlobalConfig(data))
            .then(() => this.initGateways(user))
            .catch(err => {
                console.error("[Sndman] error initializing app", err);
                this.setState({appInitError: err});
                captureException(err, {source: 'Sndman'});
            });
    }

    initGateways = (user) => {
        const gateways = GxyJanus.makeGateways("rooms");
        this.setState({gateways});

        const gatewayToInitPromise = (gateway) => this.initGateway(user, gateway)
					.catch(error => {
						captureException(error, {source: 'Sndman', gateway: gateway.name});
						throw error;
					});

        return Promise.all(Object.values(gateways).map(gatewayToInitPromise))
					.then(() => {
							console.log("[Sndman] gateways initialization complete");
							this.setState({gatewaysInitialized: true});
					});
    }

    initGateway = (user, gateway) => {
        console.log("[Sndman] initializing gateway", gateway.name);

        gateway.destroy();

        return gateway.init()
            .then(() => {
                if (gateway.name === "gxy3") {
                    return gateway.initServiceProtocol(user, data => this.onServiceData(gateway, data));
                }
                return Promise.resolve();
            })
            .catch(err => {
                console.error("[Sndman] error initializing gateway. Will retry in 10 sec.", gateway.name, err);
                captureException(err, {source: 'Sndman', gateway: gateway.name});
                setTimeout(() => {
                    this.initGateway(user, gateway)
											.catch(err => {
												console.error("[Sndman] error initializing gateway.", gateway.name, err);
												captureException(err, {source: 'Sndman', gateway: gateway.name});
											});
                }, 10000);
            });
    }

  onMqttData = (data) => {
    let {col, group, i, status} = data;

    // Shidur action
    if(data.type === "sdi-fullscr_group" && status) {
      this["col"+col].fullScreenGroup(i,group);
    } else if(data.type === "sdi-fullscr_group" && !status) {
      this["col"+col].toFourGroup(i,group);
    }

    if(data.type === "event") {
      delete data.type;
      this.setState({...data});
    }

    if(data.type === "sdi-restart_sndman") {
      window.location.reload();
    }
  };

    onServiceData = (gateway, data) => {
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
              console.error("[Sndman] service error message (reloading in 10 seconds)", data.error);
              captureMessage(data.error, {source: "Sndman", msg: data});
              setTimeout(() => {
                  this.initGateway(this.state.user, gateway);
              }, 10000);
            } else {
              captureException(data.error, {source: "Sndman", msg: data});
            }
          }

          let {col, group, i, status} = data;

          // Shidur action
          if(data.type === "sdi-fullscr_group" && status) {
              this["col"+col].fullScreenGroup(i,group);
          } else if(data.type === "sdi-fullscr_group" && !status) {
              this["col"+col].toFourGroup(i,group);
          }

          if(data.type === "event") {
              delete data.type;
              this.setState({...data});
          }

          if(data.type === "sdi-restart_sndman") {
              window.location.reload();
          }
        }).catch((error) => {
          console.error(`Failed receiving ${data}: ${error}`);
        });
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
                <Grid.Row>
                    <Grid.Column>
                        <UsersQuadSndman index={0} {...this.state} ref={col => {this.col1 = col;}} setProps={this.setProps} />
                    </Grid.Column>
                    <Grid.Column>
                        <UsersQuadSndman index={4} {...this.state} ref={col => {this.col2 = col;}} setProps={this.setProps} />
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column>
                        <UsersQuadSndman index={8} {...this.state} ref={col => {this.col3 = col;}} setProps={this.setProps} />
                    </Grid.Column>
                    <Grid.Column>
                        <UsersQuadSndman index={12} {...this.state} ref={col => {this.col4 = col;}} setProps={this.setProps} />
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );

        return (
            <div>
                {user ? content : login}
            </div>
        );
    }
}

export default SndmanApp;

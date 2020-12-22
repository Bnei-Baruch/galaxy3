import React, {Component, Fragment} from 'react';
import {Segment} from "semantic-ui-react";
import './AudioOutApp.css';
import './UsersAudioOut.css'
import UsersHandleAudioOut from "./UsersHandleAudioOut";
import api from "../../shared/Api";
import {API_BACKEND_PASSWORD, API_BACKEND_USERNAME} from "../../shared/env";
import GxyJanus from "../../shared/janus-utils";
import {USERNAME_ALREADY_EXIST_ERROR_CODE, AUDIOOUT_ID} from "../../shared/consts"
import {GuaranteeDeliveryManager} from '../../shared/GuaranteeDelivery';
import {captureException, captureMessage} from "../../shared/sentry";
import mqtt from "../../shared/mqtt";


class AudioOutApp extends Component {

    state = {
        audio: false,
        group: null,
        room: null,
        user: {
            session: 0,
            handle: 0,
            role: "audioout",
            display: "audioout",
            id: AUDIOOUT_ID,
            name: "audioout"
        },
        gateways: {},
        gatewaysInitialized: false,
        appInitError: null,
        gdm: new GuaranteeDeliveryManager(AUDIOOUT_ID),
    };

    componentDidMount() {
        this.initApp();
    };

    componentWillUnmount() {
        Object.values(this.state.gateways).forEach(x => x.destroy());
    };

    initApp = () => {
        const {user} = this.state;

        mqtt.init(user, (connected) => {
          console.log("Connection to MQTT Server: ", connected);
          mqtt.watch((data) => {
            this.onServiceData(data);
          })
          mqtt.join(null, 'galaxy/service/#');
        })

        api.setBasicAuth(API_BACKEND_USERNAME, API_BACKEND_PASSWORD);

        api.fetchConfig()
            .then(data => GxyJanus.setGlobalConfig(data))
            .then(() => this.initGateways(user))
            .catch(err => {
                console.error("[AudioOut] error initializing app", err);
                this.setState({appInitError: err});
                captureException(err, {source: 'AudioOut'});
            });
    }

    initGateways = (user) => {
        const gateways = GxyJanus.makeGateways("rooms");
        this.setState({gateways});

        const gatewayToInitPromise = (gateway) => this.initGateway(user, gateway)
					.catch(error => {
						captureException(error, {source: 'AudioOut', gateway: gateway.name});
						throw error;
					});

        return Promise.all(Object.values(gateways).map(gatewayToInitPromise))
					.then(() => {
						console.log("[AudioOut] gateways initialization complete");
						this.setState({gatewaysInitialized: true});
					});
    }

    initGateway = (user, gateway) => {
        console.log("[AudioOut] initializing gateway", gateway.name);

        gateway.addEventListener("reinit", () => {
                this.postInitGateway(user, gateway)
                    .catch(err => {
                        console.error("[AudioOut] postInitGateway error after reinit. Reloading", gateway.name, err);
                        captureException(err, {source: 'AudioOut', gateway: gateway.name});
                        window.location.reload();
                    });
            }
        );

        gateway.addEventListener("reinit_failure", (e) => {
            if (e.detail > 10) {
                console.error("[AudioOut] too many reinit_failure. Reloading", gateway.name, e);
                captureException(e, {source: 'Audioout', gateway: gateway.name});
                window.location.reload();
            }
        });

        return gateway.init()
            .then(() => this.postInitGateway(user, gateway));
    }

    postInitGateway = (user, gateway) => {
        console.log("[AudioOut] initializing gateway", gateway.name);

        if (gateway.name === "gxy3") {
            return gateway.initServiceProtocol(user, data => this.onServiceData(gateway, data, user))
        } else {
            return Promise.resolve();
        }
    };

    onServiceData = (gateway, data, user) => {
      const { gdm } = this.state;
      if (gdm.checkAck(data)) {
        // Ack received, do nothing.
        return;
      }
      gdm.accept(data, (msg) => gateway.sendServiceMessage(msg))
				.then((data) => {
					if (data.type === "error") {
						if (data.error_code === USERNAME_ALREADY_EXIST_ERROR_CODE) {
							console.error("[AudioOut] service error message (reloading in 10 seconds)", data.error);
							captureMessage(data.error, {source: "AudioOut", msg: data});
							setTimeout(() => {
									this.initGateway(user, gateway);
							}, 10000);
						} else {
							captureException(data.error, {source: "AudioOut", msg: data});
						}
					}

					const {room, group, status, qst} = data;

					if (data.type === "sdi-fullscr_group" && status && qst) {
						this.setState({group, room});
					} else if (data.type === "sdi-fullscr_group" && !status && qst) {
						this.setState({group: null, room: null});
					} else if (data.type === "sdi-restart_sdiout") {
						window.location.reload();
					} else if (data.type === "audio-out") {
							this.setState({audio: status});
					} else if (data.type === "event") {
							delete data.type;
							this.setState({...data});
					}
				})
				.catch((error) => {
						console.error(`Failed receiving ${data}: ${error}`);

				});
		};

    setProps = (props) => {
        this.setState({...props})
    };

    render() {
        const {gateways, group, appInitError, gatewaysInitialized, audio} = this.state;

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

        const name = group && group.description;

        return (
            <Segment className="preview_sdi">
                <div className="usersvideo_grid">
                    <div className="video_full">
                        <div className="title">{name}</div>
                        <UsersHandleAudioOut g={group} gateways={gateways} audio={audio} setProps={this.setProps}/>
                    </div>
                </div>
            </Segment>
        );
    }
}

export default AudioOutApp;

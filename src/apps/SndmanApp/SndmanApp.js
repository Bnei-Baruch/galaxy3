import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Grid} from "semantic-ui-react";
import {getState, initJanus} from "../../shared/tools";
import './SndmanApp.css';
import {initGxyProtocol} from "../../shared/protocol";
import SndmanGroups from "./SndmanGroups";
import SndmanUsers from "./SndmanUsers";
import {
    DATA_PORT,
    JANUS_IP_ISRPT,
    JANUS_IP_EURFR,
    SECRET
} from "../../shared/consts";
import {client, getUser} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";


class SndmanApp extends Component {

    state = {
        qam: {0:1,1:2,2:3,3:1,4:2,5:3,6:1,7:2,8:3,9:1,10:2,11:3},
        janus: null,
        feedStreams: {},
        mids: [],
        gxyhandle: null,
        data_forward: {},
        disabled_groups: [],
        protocol: null,
        room: 1234,
        remotefeed: null,
        myid: null,
        mypvtid: null,
        mystream: null,
        user: null,
        users: {},
        shidur: false,
    };

    componentDidMount() {
        getUser(user => {
            if(user) {
                let gxy_group = user.roles.filter(role => role === 'gxy_sndman').length > 0;
                if (gxy_group) {
                    delete user.roles;
                    user.role = "sndman";
                    this.initApp(user);
                } else {
                    alert("Access denied!");
                    client.signoutRedirect();
                }
            }
        });
    };

    componentWillUnmount() {
        this.state.janus.destroy();
    };

    initApp = (user) => {
        initJanus(janus => {
            user.session = janus.getSessionId();
            this.setState({janus,user});

            initGxyProtocol(janus, user, protocol => {
                this.setState({protocol});
            }, ondata => {
                Janus.log("-- :: It's protocol public message: ", ondata);
                if(ondata.type === "error" && ondata.error_code === 420) {
                    alert(ondata.error);
                    this.state.protocol.hangup();
                } else if(ondata.type === "joined") {
                    this.initVideoRoom();
                }
                this.onProtocolData(ondata);
            });

        },er => {
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }, true);
    };

    initVideoRoom = () => {
        this.state.janus.attach({
            plugin: "janus.plugin.videoroom",
            opaqueId: "preview_shidur",
            success: (gxyhandle) => {
                Janus.log(gxyhandle);
                this.setState({gxyhandle});
                Janus.log("Plugin attached! (" + gxyhandle.getPlugin() + ", id=" + gxyhandle.getId() + ")");
                Janus.log("  -- This is a publisher/manager");
                let {user} = this.state;
                let register = { "request": "join", "room": 1234, "ptype": "publisher", "display": JSON.stringify(user) };
                gxyhandle.send({"message": register});
            },
            error: (error) => {
                Janus.log("Error attaching plugin: " + error);
            },
            consentDialog: (on) => {
                Janus.debug("Consent dialog should be " + (on ? "on" : "off") + " now");
            },
            mediaState: (medium, on) => {
                Janus.log("Janus " + (on ? "started" : "stopped") + " receiving our " + medium);
            },
            webrtcState: (on) => {
                Janus.log("Janus says our WebRTC PeerConnection is " + (on ? "up" : "down") + " now");
                this.forwardOwnFeed(this.state.room);
            },
            onmessage: (msg, jsep) => {
                this.onMessage(msg, jsep, false);
            },
            onlocalstream: (mystream) => {
                Janus.debug(" ::: Got a local stream :::", mystream);
            },
            oncleanup: () => {
                Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
            }
        });
    };

    publishOwnFeed = (useAudio) => {
        // Publish our stream
        let {gxyhandle} = this.state;

        gxyhandle.createOffer(
            {
                media: {  audio: false, video: false, data: true },	// Publishers are sendonly
                simulcast: false,
                success: (jsep) => {
                    Janus.debug("Got publisher SDP!");
                    Janus.debug(jsep);
                    let publish = { "request": "configure", "audio": false, "video": false, "data": true };
                    gxyhandle.send({"message": publish, "jsep": jsep});
                },
                error: (error) => {
                    Janus.error("WebRTC error:", error);
                    if (useAudio) {
                        this.publishOwnFeed(false);
                    } else {
                        Janus.error("WebRTC error... " + JSON.stringify(error));
                    }
                }
            });
    };

    forwardOwnFeed = (room) => {
        let {myid,gxyhandle,data_forward} = this.state;
        let isrip = `${JANUS_IP_ISRPT}`;
        let frip = `${JANUS_IP_EURFR}`;
        let dport = DATA_PORT;
        let isrfwd = { "request": "rtp_forward","publisher_id":myid,"room":room,"secret":`${SECRET}`,"host":isrip,"data_port":dport};
        let efrfwd = { "request": "rtp_forward","publisher_id":myid,"room":room,"secret":`${SECRET}`,"host":frip,"data_port":dport};
        gxyhandle.send({"message": isrfwd,
            success: (data) => {
                data_forward.isr = data["rtp_stream"]["data_stream_id"];
                Janus.log(" :: ISR Data Forward: ", data);
            },
        });
        gxyhandle.send({"message": efrfwd,
            success: (data) => {
                data_forward.efr = data["rtp_stream"]["data_stream_id"];
                Janus.log(" :: EFR Data Forward: ", data);
                this.setState({onoff_but: false});
            },
        });
    };

    onMessage = (msg, jsep) => {
        let {gxyhandle} = this.state;
        Janus.debug(" ::: Got a message (publisher) :::");
        Janus.debug(msg);
        let event = msg["videoroom"];
        Janus.debug("Event: " + event);
        if(event !== undefined && event !== null) {
            if(event === "joined") {
                // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
                let myid = msg["id"];
                let mypvtid = msg["private_id"];
                this.setState({myid ,mypvtid});
                Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
                this.publishOwnFeed();
                if(this.state.shidur) {
                    Janus.log(" :: Shidur online - getting state :: ");
                    getState('state/galaxy/shidur', (state) => {
                        const {users,mids} = state;
                        this.setState({users});
                        this.programSubscribtion(mids);
                    });
                }
            } else if(event === "event") {
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let feed = msg["publishers"];
                    let {users} = this.state;
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.log(feed);
                    for(let f in feed) {
                        let id = feed[f]["id"];
                        let display = JSON.parse(feed[f]["display"]);
                        if(display.role !== "group")
                            return;
                        users[display.id] = display;
                        users[display.id].rfid = id;
                    }
                    this.setState({users});
                } else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
                    // One of the publishers has gone away?
                    let leaving = msg["leaving"];
                    Janus.log("Publisher left: " + leaving);
                } else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                    // One of the publishers has unpublished?
                    let unpublished = msg["unpublished"];
                    Janus.log("Publisher left: " + unpublished);
                    if(unpublished === 'ok') {
                        // That's us
                        this.state.gxyhandle.hangup();
                        return;
                    }
                } else if(msg["error"] !== undefined && msg["error"] !== null) {
                    if(msg["error_code"] === 426) {
                        Janus.log("This is a no such room");
                    } else {
                        Janus.log(msg["error"]);
                    }
                }
            }
        }
        if(jsep !== undefined && jsep !== null) {
            Janus.debug("Handling SDP as well...");
            Janus.debug(jsep);
            gxyhandle.handleRemoteJsep({jsep: jsep});
        }
    };

    newRemoteFeed = (subscription) => {
        this.state.janus.attach(
            {
                plugin: "janus.plugin.videoroom",
                opaqueId: "switchfeed_user",
                success: (pluginHandle) => {
                    let remoteFeed = pluginHandle;
                    Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
                    Janus.log("  -- This is a multistream subscriber",remoteFeed);
                    this.setState({remoteFeed, creatingFeed: false});
                    let subscribe = { "request": "join", "room": 1234, "ptype": "subscriber", streams: subscription };
                    remoteFeed.send({"message": subscribe});
                },
                error: (error) => {
                    Janus.error("  -- Error attaching plugin...", error);
                },
                iceState: (state) => {
                    Janus.log("ICE state (remote feed) changed to " + state);
                },
                webrtcState: (on) => {
                    Janus.log("Janus says this WebRTC PeerConnection (remote feed) is " + (on ? "up" : "down") + " now");
                },
                slowLink: (uplink, nacks) => {
                    Janus.warn("Janus reports problems " + (uplink ? "sending" : "receiving") +
                        " packets on this PeerConnection (remote feed, " + nacks + " NACKs/s " + (uplink ? "received" : "sent") + ")");
                },
                onmessage: (msg, jsep) => {
                    Janus.debug(" ::: Got a message (subscriber) :::");
                    Janus.debug(msg);
                    let event = msg["videoroom"];
                    Janus.debug("Event: " + event);
                    if(msg["error"] !== undefined && msg["error"] !== null) {
                        Janus.debug(":: Error msg: " + msg["error"]);
                    } else if(event !== undefined && event !== null) {
                        if(event === "attached") {
                            // Subscriber created and attached
                            Janus.log("Successfully attached to feed in room " + msg["room"]);
                        } else {
                            // What has just happened?
                        }
                    }
                    if(msg["streams"]) {
                        // Update map of subscriptions by mid
                        Janus.log(" :: Streams updated! : ",msg["streams"]);
                        let {mids} = this.state;
                        for(let i in msg["streams"]) {
                            let mindex = msg["streams"][i]["mid"];
                            mids[mindex] = msg["streams"][i];
                            if(mids[mindex].active) {
                                mids[mindex].user = JSON.parse(msg["streams"][i]["feed_display"]);
                            }
                        }
                        this.setState({mids});
                    }
                    if(jsep !== undefined && jsep !== null) {
                        Janus.debug("Handling SDP as well...");
                        Janus.debug(jsep);
                        let {remoteFeed} = this.state;
                        // Answer and attach
                        remoteFeed.createAnswer(
                            {
                                jsep: jsep,
                                media: { audio: false, videoSend: false },	// We want recvonly audio/video
                                success: (jsep) => {
                                    Janus.debug("Got SDP!");
                                    Janus.debug(jsep);
                                    let body = { "request": "start", "room": 1234 };
                                    remoteFeed.send({"message": body, "jsep": jsep});
                                },
                                error: (error) => {
                                    Janus.error("WebRTC error:", error);
                                }
                            });
                    }
                },
                onlocalstream: (stream) => {
                    // The subscriber stream is recvonly, we don't expect anything here
                },
                onremotetrack: (track,mid,on) => {
                    Janus.log(" ::: Got a remote track event ::: (remote feed)");
                    Janus.log("Remote track (mid=" + mid + ") " + (on ? "added" : "removed") + ":", track);
                    if(track.kind === "video" && on) {
                        let {qam} = this.state;
                        let stream = new MediaStream();
                        stream.addTrack(track.clone());
                        let col = "col" + qam[mid];
                        let video = this[col].refs["programVideo" + mid];
                        Janus.log(" Attach remote stream on video: "+mid);
                        Janus.attachMediaStream(video, stream);
                    }
                },
                oncleanup: () => {
                    Janus.log(" ::: Got a cleanup notification (remote feed) :::");
                }
            });
    };

    subscribeTo = (subscription) => {
        // New feeds are available, do we need create a new plugin handle first?
        Janus.log(" -- Going to subscribe: ",subscription);
        if (this.state.remoteFeed) {
            this.state.remoteFeed.send({message:
                    {request: "subscribe", streams: subscription}
            });
            return;
        }

        // We don't have a handle yet, but we may be creating one already
        if (this.state.creatingFeed) {
            // Still working on the handle
            setTimeout(() => {
                this.subscribeTo(subscription);
            }, 500);
            return;
        }

        // We don't creating, so let's do it
        this.setState({creatingFeed: true});
        this.newRemoteFeed(subscription);
    };

    programSubscribtion = (mids) => {
        let subscription = [];
        mids.forEach((mid,i) => {
            Janus.debug(" :: mids iteration - ", i, mid);
            if (mid && mid.active) {
                subscription.push({feed: mid.feed_id, mid: "1"})
            }
        });
        this.subscribeTo(subscription);
    };

    programState = (mids) => {
        let streams = [];
        mids.forEach((m,i) => {
            Janus.debug(" :: mids iteration - ", i, m.mid);
            if (m && m.active) {
                streams.push({feed: m.feed_id, mid: "1", sub_mid: m.mid});
            }
        });
        this.switchTo(streams);
    };

    switchTo = (streams) => {
        Janus.log(" :: Going to switch four: ", streams);
        let message = {request: "switch", streams};
        this.state.remoteFeed.send ({message,
            success: () => {
                Janus.debug(" -- Switch success: ");
            }
        });
    };

    onProtocolData = (data) => {
        Janus.log(" :: Got Shidur Action: ", data);
        let {col, feed, i, status} = data;
        if(data.type === "sdi-switch_req") {
            this.switchTo(feed)
        } else if(data.type === "sdi-subscribe_req") {
            this.subscribeTo(feed)
        } else if(data.type === "sdi-unsubscribe_req") {
            this.unsubscribeFrom(feed)
        } else if(data.type === "sdi-fullscr_group" && status) {
            this["col"+col].fullScreenGroup(i,feed);
        } else if(data.type === "sdi-fullscr_group" && !status) {
            let {col, feed, i} = data;
            this["col"+col].toFourGroup(i,feed);
        } else if(data.type === "sdi-sync_sndman") {
            this.programState(feed);
        } else if(data.type === "sdi-restart_sndman") {
            window.location.reload();
        } else if(data.type === "question") {
            let {users} = this.state;
            if(users[data.user.id]) {
                users[data.user.id].question = data.status;
                this.setState({users});
            }
        } else if(data.type === "sdi-state_shidur" && data.status.sndman) {
            getState('state/galaxy/shidur', (state) => {
                const {users} = state;
                this.setState({users});
            });
        } else if(data.type === "event") {
            delete data.type;
            this.setState({...data});
        }
    };

    unsubscribeFrom = (streams) => {
        Janus.log(" :: Going to unsubscribe: ",streams);
        let {remoteFeed} = this.state;

        Janus.debug(" -- Sending request with data: ",streams);
        let unsubscribe = {request: "unsubscribe", streams};
        if(remoteFeed !== null)
            remoteFeed.send({ message: unsubscribe });
    };

    render() {
        const {user} = this.state;

        let login = (<LoginPage user={user} />);
        let content = (
            <Grid columns={3}>
                <Grid.Column>
                    <SndmanUsers
                        ref={col => {this.col4 = col;}}
                        setProps={this.setProps}
                        onProtocolData={this.onProtocolData} />
                </Grid.Column>
                <Grid.Row>
                    <Grid.Column>
                        <SndmanGroups
                            index={0} {...this.state}
                            ref={col => {this.col1 = col;}}
                        />
                    </Grid.Column>
                    <Grid.Column>
                        <SndmanGroups
                            index={4} {...this.state}
                            ref={col => {this.col2 = col;}}
                        />
                    </Grid.Column>
                    <Grid.Column>
                        <SndmanGroups
                            index={8} {...this.state}
                            ref={col => {this.col3 = col;}}
                        />
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
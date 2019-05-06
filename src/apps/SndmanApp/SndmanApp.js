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
        feeds: [],
        feedStreams: {},
        mids: [],
        gxyhandle: null,
        data_forward: {},
        name: "",
        disabled_groups: [],
        group: null,
        pr1: [],
        pre: null,
        program: null,
        pre_feed: null,
        full_feed: null,
        protocol: null,
        pgm_state: [],
        quistions_queue: [],
        room: 1234,
        remotefeed: null,
        myid: null,
        mypvtid: null,
        mystream: null,
        audio: null,
        muted: true,
        feeds_queue: 0,
        user: null,
        users: {},
        shidur: false,
        zoom: false,
        fullscr: false,
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
                //let register = { "request": "join", "room": 1234, "ptype": "publisher", "display": "sdi_out" };
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

    onMessage = (msg, jsep, initdata) => {
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
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    // let list = msg["publishers"];
                    // let feeds = list.filter(feeder => JSON.parse(feeder.display).role === "group");
                    // this.setState({feeds});
                    //this.makeSubscribtion(feeds);
                }
            } else if(event === "talking") {
                //let id = msg["id"];
                //Janus.log("User: "+id+" - start talking");
            } else if(event === "stopped-talking") {
                //let id = msg["id"];
                //Janus.log("User: "+id+" - stop talking");
            } else if(event === "destroyed") {
                // The room has been destroyed
                Janus.warn("The room has been destroyed!");
            } else if(event === "event") {
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let feed = msg["publishers"];
                    let {feeds,feedStreams,users} = this.state;
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.log(feed);
                    for(let f in feed) {
                        let id = feed[f]["id"];
                        let display = JSON.parse(feed[f]["display"]);
                        if(display.role !== "group")
                            return;
                        //let talk = feed[f]["talking"];
                        let streams = feed[f]["streams"];
                        feed[f].display = display;
                        for (let i in streams) {
                            let stream = streams[i];
                            if(stream.type === "video") {
                                stream["id"] = id;
                                stream["display"] = display;
                            }
                        }
                        feedStreams[id] = {id, display, streams};
                        users[display.id] = display;
                        users[display.id].rfid = id;
                    }
                    feeds.push(feed[0]);
                    this.setState({feeds,feedStreams,users});
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
                    // Which publisher are we getting on this mid?
                    let {mids,feedStreams,qam} = this.state;
                    let feed = mids[mid].feed_id;
                    Janus.log(" >> This track is coming from feed " + feed + ":", mid);
                    if(!on) {
                        Janus.log(" :: Going to stop track :: " + track + ":", mid);
                        //FIXME: Remove callback for audio track does not come
                        track.stop();
                        //FIXME: does we really need to stop all track for feed id?
                        return;
                    }
                    if(track.kind !== "video" || !on) {
                        return;
                    }
                    let stream = new MediaStream();
                    stream.addTrack(track.clone());
                    feedStreams[feed].stream = stream;
                    this.setState({feedStreams});
                    //let col = "col" + (mid < 4 ? 1 : mid < 8 ? 2 : mid < 12 ? 3 : 4);
                    let col = "col" + qam[mid];
                    let video = this[col].refs["programVideo" + mid];
                    Janus.log(" Attach remote stream on video: "+mid);
                    Janus.attachMediaStream(video, stream);
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

    makeSubscribtion = (feeds) => {
        let {feedStreams,users} = this.state;
        let subscription = [];
        for(let f in feeds) {
            let id = feeds[f]["id"];
            let display = JSON.parse(feeds[f]["display"]);
            //let talk = feeds[f]["talking"];
            let streams = feeds[f]["streams"];
            feeds[f].display = display;
            //feeds[f].talk = talk;
            for (let i in streams) {
                let stream = streams[i];
                if(stream.type === "video" && subscription.length < 12) {
                    let subst = {feed: id};
                    stream["id"] = id;
                    stream["display"] = display;
                    subst.mid = stream.mid;
                    subscription.push(subst);
                }
            }
            feedStreams[id] = {id, display, streams};
            users[display.id] = display;
            users[display.id].rfid = id;
        }
        this.setState({feeds,feedStreams,users});
        // Set next feed in queue first after program is full
        if(feeds.length > 12) {
            this.setState({feeds_queue: 12});
        }
        if(subscription.length > 0)
            this.subscribeTo(subscription);
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
        let switch_sync = {request: "switch", streams};
        this.state.remoteFeed.send ({"message": switch_sync,
            success: () => {
                Janus.debug(" -- Switch success: ");
            }
        });
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
        } else if(data.type === "sdi-restart_sndman") {
            // const {feeds,users,quistions_queue,disabled_groups,feeds_queue,feedStreams,mids,pre_feed,program} = data.feed;
            // this.setState({feeds,users,quistions_queue,disabled_groups,feeds_queue,feedStreams,pre_feed,program});
            // this.programState(mids);
            window.location.reload();
        } else if(data.type === "sdi-reset_queue") {
            this.resetQueue();
        } else if(data.type === "question" && data.status) {
            let {quistions_queue,users} = this.state;
            if(users[data.user.id]) {
                users[data.user.id].question = true;
                data.rfid = users[data.user.id].rfid;
                quistions_queue.push(data);
                this.setState({quistions_queue, users});
            }
        } else if(data.type === "question" && !data.status) {
            let {quistions_queue,users} = this.state;
            for(let i = 0; i < quistions_queue.length; i++){
                if(quistions_queue[i].user.id === data.user.id) {
                    users[data.user.id].question = false;
                    quistions_queue.splice(i, 1);
                    this.setState({quistions_queue,users});
                    break
                }
            }
        } else if(data.type === "sdi-state_shidur" && data.status.sndman) {
            if(data.feed === 0) {
                Janus.log(" :: Shidur page was reloaded or all groups is Offline :: ");
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
                //this.recoverState();
            } else {
                getState('state/galaxy/shidur', (state) => {
                    const {feeds,users,quistions_queue,feedStreams,mids} = state;
                    this.setState({feeds,users,quistions_queue,feedStreams});
                    this.programSubscribtion(mids);
                });
            }
        } else if(data.type === "event") {
            delete data.type;
            this.setState({...data});
            if(data.shidur) {
                //TODO: We will need it when when start using DB state
                Janus.log(" :: Here we go do something when shidur already running :: ");
            }
        }
    };


    recoverState = () => {
        getState('state/galaxy/shidur', (state) => {
            Janus.log(" :: Get State: ", state);
            if(JSON.stringify(state) === "{}") {
                Janus.log(" :: Got empty state - nothing to recover :(");
                return;
            }
            const {feeds,users,quistions_queue,disabled_groups,feeds_queue,feedStreams,mids} = state;
            this.setState({feeds,users,quistions_queue,disabled_groups,feeds_queue,feedStreams});
            let subscription = [];
            mids.forEach((mid,i) => {
                Janus.debug(" :: mids iteration - ", i, mid);
                if (mid && mid.active) {
                    subscription.push({feed: mid.feed_id, mid: "1"})
                }
            });
            this.subscribeTo(subscription);
        });
    };

    unsubscribeFrom = (streams, id) => {
        Janus.log(" :: Going to unsubscribe: ",streams);
        let {remoteFeed} = this.state;

        Janus.debug(" -- Sending request with data: ",streams);
        let unsubscribe = {request: "unsubscribe", streams};
        if(remoteFeed !== null)
            remoteFeed.send({ message: unsubscribe });
    };

    removeFeed = (id, disable) => {
        let {feeds,users,quistions_queue,feeds_queue} = this.state;

        for(let i=0; i<feeds.length; i++) {
            if(feeds[i].id === id) {
                // Delete from users mapping object
                let user = feeds[i].display;
                console.log(" :: Remove feed: " + id + " - Name: " + user.username);
                delete users[user.id];

                // Delete from questions list
                for(let i = 0; i < quistions_queue.length; i++) {
                    if(quistions_queue[i].user.id === user.id) {
                        quistions_queue.splice(i, 1);
                        break
                    }
                }

                // Remove from general feeds list
                feeds.splice(i, 1);

                // Fix feeds_queue if equal to last index
                if(feeds_queue >= feeds.length - 1) {
                    feeds_queue = feeds.length - 1;
                    this.setState({feeds_queue});
                }

                this.setState({feeds,users,quistions_queue}, () => {
                    // Send an unsubscribe request
                    let streams = [{ feed: id }];
                    this.unsubscribeFrom(streams, id);
                });
                break
            }
        }
    };

    fillProgram = (pre_feed, manual) => {
        let {round,mids,feeds,feeds_queue} = this.state;

        // Make sure there is no empty space in program
        if(feeds.length > 12 && manual === null) {
            Janus.log(" :: Auto Switch mids - ", mids);
            mids.forEach((mid,i) => {
                Janus.debug(" :: mids iteration - ", i, mid);
                if (mid && !mid.active) {
                    Janus.log(" :: Found empty slot in program! - ", mids[i]);
                    let feed = feeds[feeds_queue];
                    feeds_queue++;
                    if(feeds_queue >= feeds.length) {
                        // End round here!
                        Janus.log(" -- ROUND END --");
                        feeds_queue = 0;
                        round++;
                        this.setState({feeds_queue,round});
                    } else {
                        this.setState({feeds_queue});
                    }
                    Janus.log(":: Switch program to: ", feed);
                    if(feed && feed.id) {
                        let streams = [{feed: feed.id, mid: "1"}];
                        this.subscribeTo(streams);
                    }
                }
            })
            // Slot in program changed manually
        } else if(manual !== null) {
            Janus.log(" :: Manual Switch mids - ", mids);
            for(let i=0; i<mids.length; i++) {
                let mid = mids[i];
                Janus.debug(" :: mids iteration - ", i, mid);
                if (mid && !mid.active) {
                    Janus.log(" :: Found empty slot in program! - ", mids[i]);
                    // If feed was in preview take him else take next in queue
                    let feed = pre_feed ? pre_feed : feeds[feeds_queue];
                    if(pre_feed) {
                        // Hide preview
                        this.setState({pre_feed: null});
                    } else {
                        feeds_queue++;
                        if(feeds_queue >= feeds.length) {
                            // End round here!
                            Janus.log(" -- ROUND END --");
                            feeds_queue = 0;
                            round++;
                            this.setState({feeds_queue,round});
                        } else {
                            this.setState({feeds_queue});
                        }
                    }
                    this.setState({program: null});
                    Janus.log(":: Switch program to: ", feed);
                    if(feed && feed.id) {
                        let streams = [{feed: feed.id, mid: "1"}];
                        this.subscribeTo(streams);
                    } else {
                        // We can't leave empty slot in program, so trigger autofill
                        this.fillProgram(null, null);
                    }
                    break
                }
            }
        } else {
            Janus.log(":: Auto Switch was triggered but program is not full :: ");
        }
    };

    nextInQueue = () => {
        let {feeds_queue,feeds,round} = this.state;
        feeds_queue++;
        if(feeds_queue >= feeds.length) {
            // End round here!
            Janus.log(" -- ROUND END --");
            feeds_queue = 0;
            round++;
            this.setState({feeds_queue,round});
        } else {
            this.setState({feeds_queue});
        }
    };

    setProps = (props) => {
        this.setState({...props})
    };

    resetQueue = () => {
        if(this.state.feeds.length > 12) {
            Janus.log("-- Reset Queue --");
            this.setState({feeds_queue: 0});
        }
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
                            setProps={this.setProps}
                            unsubscribeFrom={this.unsubscribeFrom}
                            subscribeTo={this.subscribeTo}
                            removeFeed={this.removeFeed} />
                    </Grid.Column>
                    <Grid.Column>
                        <SndmanGroups
                            index={4} {...this.state}
                            ref={col => {this.col2 = col;}}
                            setProps={this.setProps}
                            unsubscribeFrom={this.unsubscribeFrom}
                            subscribeTo={this.subscribeTo}
                            removeFeed={this.removeFeed} />
                    </Grid.Column>
                    <Grid.Column>
                        <SndmanGroups
                            index={8} {...this.state}
                            ref={col => {this.col3 = col;}}
                            setProps={this.setProps}
                            unsubscribeFrom={this.unsubscribeFrom}
                            subscribeTo={this.subscribeTo}
                            removeFeed={this.removeFeed} />
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
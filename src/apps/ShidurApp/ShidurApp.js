import React, {Component} from 'react';
import {Janus} from "../../lib/janus";
import {Grid} from "semantic-ui-react";
import {getDateString, getState, initJanus, putData} from "../../shared/tools";
import {initGxyProtocol} from "../../shared/protocol";
import ShidurGroups from "./ShidurGroups";
//import ShidurUsers from "./ShidurUsers";
import {client} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";
import ShidurToran from "./ShidurToran";
import {GROUPS_ROOM} from "../../shared/consts";
import UsersApp from "./UsersApp";


class ShidurApp extends Component {

    state = {
        qam: {0:1,1:2,2:3,3:1,4:2,5:3,6:1,7:2,8:3,9:1,10:2,11:3},
        quad: ["0","3","6","9","1","4","7","10","2","5","8","11"],
        janus: null,
        feeds: [],
        feedStreams: {},
        mids: [],
        qfeeds: [],
        log_list: [],
        gxyhandle: null,
        disabled_groups: [],
        pre: null,
        program: null,
        pre_feed: null,
        protocol: null,
        questions_queue: [],
        myid: null,
        mypvtid: null,
        mystream: null,
        disable_button: false,
        next_button: false,
        feeds_queue: 0,
        user: null,
        users: {},
        round: 0,
        sdiout: false,
        sndman: false,
        presets:[
            // Moscow - 3b04bda7-9317-4eac-9027-02a4f25a14a1
            // Piter - 4ead87b5-346b-454f-8a58-8e18643d8da9
            // New York - f97ee9c7-1866-481d-b01a-57b1a2985858
            // Kiev - 369fd5ce-43dc-467d-9936-a08f77739a40
            {"sub_mid":"0","user_id":"3b04bda7-9317-4eac-9027-02a4f25a14a1"},
            {"sub_mid":"3","user_id":"4ead87b5-346b-454f-8a58-8e18643d8da9"},
            {"sub_mid":"6","user_id":"f97ee9c7-1866-481d-b01a-57b1a2985858"},
            {"sub_mid":"9","user_id":"369fd5ce-43dc-467d-9936-a08f77739a40"},
        ],
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
            this.setState({janus,user});
            getState('galaxy/groups', (users) => {
                this.setState({users});
            });
            initGxyProtocol(janus, user, protocol => {
                this.setState({protocol});
            }, ondata => {
                Janus.debug("-- :: It's protocol public message: ", ondata);
                if(ondata.type === "error" && ondata.error_code === 420) {
                    alert(ondata.error);
                    this.state.protocol.hangup();
                } else if(ondata.type === "joined") {
                    this.initVideoRoom();
                }
                this.onProtocolData(ondata);
            });
        },er => {}, true);
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
                let register = { "request": "join", "room": GROUPS_ROOM, "ptype": "publisher", "display": JSON.stringify(user) };
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
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    let {feedStreams,users} = this.state;
                    let feeds = list.filter(feeder => JSON.parse(feeder.display).role === "group");

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
                        users[display.id] = {...display, ...users[display.id], rfid: id};
                        // Add this for customize preset 1
                        // let pst = presets.find(p => p.user_id === display.id);
                        // if(pst) {
                        //     users[display.id].preset = 1;
                        // }
                    }
                    this.setState({feeds,feedStreams,users});
                    // Set next feed in queue first after program is full
                    if(feeds.length > 12) {
                        this.setState({feeds_queue: 12});
                    }
                    if(subscription.length > 0)
                        this.subscribeTo(subscription);
                    this.pre.sdiAction("restart_sndman");
                    this.pre.sdiAction("restart_sdiout");
                }
            } else if(event === "event") {
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let feed = msg["publishers"];
                    let {feeds,feedStreams,users} = this.state;
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.log(feed);
                    let subscription = [];
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
                                let subst = {feed: id};
                                stream["id"] = id;
                                stream["display"] = display;
                                subst.mid = stream.mid;
                                subscription.push(subst);
                            }
                        }
                        feedStreams[id] = {id, display, streams};
                        users[display.id] = {...display, ...users[display.id], rfid: id};
                        // Add this for customize preset 1
                        // let pst = presets.find(p => p && p.user_id === display.id);
                        // if(pst) {
                        //     users[display.id].preset = 1;
                        // }
                    }
                    feeds.push(feed[0]);
                    this.setState({feeds,feedStreams,users});
                    this.actionLog(feed[0].display, "enter");
                    // Set next feed in queue first after program is full
                    if(feeds.length === 13) {
                        this.setState({feeds_queue: 12});
                    }
                    // Subscribe until program full
                    if(feeds.length < 13 && subscription.length > 0) {
                        this.subscribeTo(subscription);
                    }
                } else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
                    // One of the publishers has gone away?
                    let leaving = msg["leaving"];
                    Janus.log("Publisher left: " + leaving);
                    this.removeFeed(leaving);
                    // Delete from disabled_groups
                    let {disabled_groups} = this.state;
                    for(let i = 0; i < disabled_groups.length; i++){
                        if(disabled_groups[i].id === leaving) {
                            disabled_groups.splice(i, 1);
                            this.setState({disabled_groups});
                            break
                        }
                    }
                } else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                    // One of the publishers has unpublished?
                    let unpublished = msg["unpublished"];
                    Janus.log("Publisher left: " + unpublished);
                    if(unpublished === 'ok') {
                        // That's us
                        this.state.gxyhandle.hangup();
                        return;
                    }
                    this.removeFeed(unpublished);
                    // Delete from disabled_groups
                    let {disabled_groups} = this.state;
                    for(let i = 0; i < disabled_groups.length; i++){
                        if(disabled_groups[i].id === unpublished) {
                            disabled_groups.splice(i, 1);
                            this.setState({disabled_groups});
                            break
                        }
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

    actionLog = (user, text) => {
        let {log_list} = this.state;
        let time = getDateString();
        let log = {time, user, text};
        log_list.push(log);
        this.setState({log_list});
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
                    let subscribe = { "request": "join", "room": GROUPS_ROOM, "ptype": "subscriber", streams: subscription };
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
                        let {mids,pre_feed,program} = this.state;
                        for(let i in msg["streams"]) {
                            let mindex = msg["streams"][i]["mid"];
                            mids[mindex] = msg["streams"][i];
                            if(mids[mindex].active) {
                                mids[mindex].user = JSON.parse(msg["streams"][i]["feed_display"]);
                            }
                        }
                        this.setState({mids}, () => {
                            this.fillProgram(pre_feed,program);
                        });
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
                                    let body = { "request": "start", "room": GROUPS_ROOM };
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
                    let {mids,feedStreams,qam} = this.state;
                    let feed = mids[mid].feed_id;
                    if(track.kind === "video" && on) {
                        Janus.log(" >> This track is coming from feed " + feed + ":", mid);
                        let stream = new MediaStream();
                        stream.addTrack(track.clone());
                        feedStreams[feed].stream = stream;
                        this.setState({feedStreams});
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
        this.pre.sdiAction("subscribe_req" , true, null, subscription);
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

    onProtocolData = (data) => {
        if(data.type === "question" && data.status) {
            let {questions_queue,users,qfeeds,mids} = this.state;
            if(users[data.user.id]) {
                users[data.user.id].question = true;
                data.rfid = users[data.user.id].rfid;
                let q = {id: data.rfid, display: data.user};
                questions_queue.push(data);

                // Check if qfeed already in program
                let chk = mids.find(q => q.feed_id === data.rfid);

                if(!chk) {
                    qfeeds.push(q);
                } else {
                    //FIXME: Does we need reattach same feed to fix delay after many switch requests?
                    //
                    // for(let i = 0; i < mids.length; i++){
                    //     let c = 0;
                    //     if(mids[i] && mids[i].active && mids[i].feed_id === chk[c].id) {
                    //         // TODO: unsubscribe-subscribe same stream
                    //         if(chk.length > 1) {
                    //             c++
                    //         }
                    //     }
                    // }
                }

                this.setState({questions_queue, users, qfeeds});
            }
        } else if(data.type === "question" && !data.status) {
            let {questions_queue,users,qfeeds} = this.state;
            for(let i = 0; i < questions_queue.length; i++){
                if(questions_queue[i].user.id === data.user.id) {
                    users[data.user.id].question = false;
                    questions_queue.splice(i, 1);
                    qfeeds.splice(i, 1);
                    this.setState({questions_queue,users});
                    break
                }
            }
            for(let i = 0; i < qfeeds.length; i++) {
                if(qfeeds[i].display.id === data.user.id) {
                    qfeeds.splice(i, 1);
                    this.setState({qfeeds});
                    break
                }
            }
        } else if(data.type === "sound_test") {
            let {users} = this.state;
            if(users[data.id]) {
                users[data.id].sound_test = true;
                this.setState({users});
            }
        } else if(data.type === "event") {
            delete data.type;
            this.setState({...data});
            if(data.sdiout || data.sndman) {
                const {mids} = this.state;
                // Save state
                putData(`galaxy/mids`, {mids}, (cb) => {
                    Janus.log(":: Save MIDS to DB: ",cb);
                    setTimeout(() => {
                        Janus.log(":: Check Full Screen state :: ");
                        this.col1.checkFullScreen();
                        this.col2.checkFullScreen();
                        this.col3.checkFullScreen();
                    }, 3000);
                });
            }
        }
    };

    checkPreview = (id) => {
        let {pre_feed} = this.state;
        if(pre_feed && pre_feed.id === id) {
            this.setState({pre_feed: null});
        }
    };

    unsubscribeFrom = (streams, id) => {
        Janus.log(" :: Going to unsubscribe: ",streams);
        this.pre.sdiAction("unsubscribe_req" , true, null, streams);
        let {remoteFeed} = this.state;

        // Remove feed from preview
        if(id) this.checkPreview(id);

        Janus.debug(" -- Sending request with data: ",streams);
        let unsubscribe = {request: "unsubscribe", streams};
        if(remoteFeed !== null)
            remoteFeed.send({ message: unsubscribe });
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

    removeFeed = (id, disable) => {
        let {feeds,users,questions_queue,qfeeds,feeds_queue,presets} = this.state;

        // Clean preview
        this.checkPreview(id);

        for(let i=0; i<feeds.length; i++) {
            if(feeds[i].id === id) {
                // Delete from users mapping object
                let user = feeds[i].display;

                if(!disable) {
                    // Write to log
                    this.actionLog(user, "leave");
                    Janus.log(" :: Remove feed: " + id + " - Name: " + user.username);
                    delete users[user.id];

                    // Delete from presets
                    for(let i = 4; i < presets.length; i++) {
                        if(presets[i] !== null && presets[i] !== undefined && presets[i].user_id === user.id) {
                            presets[i] = null;
                        }
                    }

                    // Delete from questions list
                    for(let i = 0; i < questions_queue.length; i++) {
                        if(questions_queue[i].user.id === user.id) {
                            questions_queue.splice(i, 1);
                            break
                        }
                    }

                    // Delete from qfeeds
                    for(let i = 0; i < qfeeds.length; i++){
                        if(qfeeds[i].display.id === user.id) {
                            qfeeds.splice(i, 1);
                            break
                        }
                    }
                }

                // Remove from general feeds list
                feeds.splice(i, 1);

                // Fix feeds_queue if equal to last index
                if(feeds_queue >= feeds.length - 1) {
                    feeds_queue = feeds.length - 1;
                    this.setState({feeds_queue});
                }

                this.setState({feeds,users,questions_queue,presets}, () => {
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
            //FIXME: Here maybe problem lost sync if some slave is offline
            //       and some leaving feed made empty slot. In this case if slave goes online
            //       mids in master and slave will be different.
            //       Maybe we need remove check of full program (feeds.length > 12).
            //       But in this case we will get duplicate feeds,
            //       because empty slot will be filled with next in queue
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
                    }
                    this.setState({feeds_queue,round}, () => {
                        Janus.log(":: Switch program to: ", feed);
                        if(feed && feed.id) {
                            let streams = [{feed: feed.id, mid: "1"}];
                            this.subscribeTo(streams);
                        } else {
                            // We can't leave empty slot in program, so trigger autofill
                            this.fillProgram(null, null);
                        }
                    });
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
        let {feeds,quad} = this.state;
        if(feeds.length > 12) {
            Janus.log("-- Reset Queue --");
            let streams = [];
            let feeds_queue = 0;
            for(let i=0; i<12; i++) {
                let sub_mid = quad[i];
                let feed = feeds[i].id;
                streams.push({feed, mid: "1", sub_mid});
                feeds_queue++;
            }
            this.setState({feeds_queue});
            this.switchTo(streams);

            // Add to qfeeds if removed from program with question status
            setTimeout(() => {
                this.col1.questionStatus();
            }, 1000);

            // Send sdi action
            this.pre.sdiAction("switch_req" , true, null, streams);
        }
    };

    render() {

        const {user} = this.state;

        let login = (<LoginPage user={user} checkPermission={this.checkPermission} />);

        let content = (
            <Grid columns={2} padded>
                <Grid.Column width={12}>
                    <Grid columns={3}>
                        <Grid.Row>
                            <Grid.Column>
                                <ShidurGroups
                                    index={0} {...this.state}
                                    ref={col => {this.col1 = col;}}
                                    setProps={this.setProps}
                                    unsubscribeFrom={this.unsubscribeFrom}
                                    removeFeed={this.removeFeed} />
                            </Grid.Column>
                            <Grid.Column>
                                <ShidurGroups
                                    index={4} {...this.state}
                                    ref={col => {this.col2 = col;}}
                                    setProps={this.setProps}
                                    unsubscribeFrom={this.unsubscribeFrom}
                                    removeFeed={this.removeFeed} />
                            </Grid.Column>
                            <Grid.Column>
                                <ShidurGroups
                                    index={8} {...this.state}
                                    ref={col => {this.col3 = col;}}
                                    setProps={this.setProps}
                                    unsubscribeFrom={this.unsubscribeFrom}
                                    removeFeed={this.removeFeed} />
                            </Grid.Column>
                        </Grid.Row>
                        <ShidurToran
                            {...this.state}
                            ref={pre => {this.pre = pre;}}
                            resetQueue={this.resetQueue}
                            setProps={this.setProps}
                            nextInQueue={this.nextInQueue}
                            unsubscribeFrom={this.unsubscribeFrom}
                            removeFeed={this.removeFeed} />
                    </Grid>
                </Grid.Column>
                <Grid.Column width={4}>
                    <UsersApp />
                    {/*<ShidurUsers*/}
                    {/*    ref={col => {this.col4 = col;}}*/}
                    {/*    setProps={this.setProps} />*/}
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
import React, { Component } from 'react';
import { Janus } from "../lib/janus";
import {Segment, Table, Icon, Dropdown, Grid, Button} from "semantic-ui-react";
import {getState, putData, initGXYJanus} from "../shared/tools";
import {MAX_FEEDS} from "../shared/consts";
//import '../shared/VideoConteiner.scss'
//import nowebcam from './nowebcam.jpeg';
import {initGxyProtocol} from "../shared/protocol";

class ShidurGroups extends Component {

    state = {
        janus: null,
        feeds: [],
        rooms: [],
        gxyhandle: null,
        index: 0,
        room: "",
        name: "",
        disabled_groups: [],
        group: null,
        pr1: [],
        pre: null,
        program: null,
        preview: null,
        protocol: null,
        pgm_state: [],
        quistions_queue: [],
        remotefeed: null,
        myid: null,
        mypvtid: null,
        mystream: null,
        audio: null,
        muted: true,
        feeds_queue: 0,
        user: {
            session: 0,
            handle: 0,
            role: "shidur",
            display: "shidur",
            id: Janus.randomString(10),
            name: "shidur"
        },
        users: {},
    };

    componentDidMount() {
        initGXYJanus(janus => {
            let {user} = this.state;
            user.session = janus.getSessionId();
            this.setState({janus,user});
            this.initVideoRoom();

            // initGxyProtocol(janus, user, protocol => {
            //     this.setState({protocol});
            // }, ondata => {
            //     Janus.log("-- :: It's protocol public message: ", ondata);
            //     this.onProtocolData(ondata);
            // });

            // getState('state/galaxy/pr1', (pgm_state) => {
            //     Janus.log(" :: Get State: ", pgm_state);
            //     this.setState({program_room: pgm_state.room, program_name: pgm_state.name, pgm_state});
            //     this.initVideoRoom(pgm_state.room, "program");
            // });
        });
    };

    onProtocolData = (data) => {
        if(data.type === "question" && data.status) {
            let {quistions_queue} = this.state;
            quistions_queue.push(data);
            this.setState({quistions_queue});
        } else if(data.type === "question" && !data.status) {
            let {quistions_queue} = this.state;
            for(let i = 0; i < quistions_queue.length; i++){
                if(quistions_queue[i].user.id === data.user.id) {
                    quistions_queue.splice(i, 1);
                    this.setState({quistions_queue});
                    break
                }
            }
        }
    };

    componentWillUnmount() {
        //FIXME: If we don't detach remote handle, Janus still send UDP stream!
        //this may happen because Janus in use for now is very old version
        //Need to check if this shit happend on latest Janus version
        this.state.pre.detach();
        this.state.pr1.forEach(feed => {
            Janus.debug(" Detach feed: ",feed);
            feed.detach();
        });
        this.state.janus.destroy();
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
                // let register = { "request": "join", "room": 1234, "ptype": "publisher", "display": JSON.stringify(user) };
                let register = { "request": "join", "room": 1234, "ptype": "publisher", "display": "shidur_admin" };
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

    // newRemoteFeed = (id, handle, talk) => {
    //     // A new feed has been published, create a new plugin handle and attach to it as a subscriber
    //     var remoteFeed = null;
    //     this.state.janus.attach(
    //         {
    //             plugin: "janus.plugin.videoroom",
    //             opaqueId: "remotefeed_shidur",
    //             success: (pluginHandle) => {
    //                 remoteFeed = pluginHandle;
    //                 remoteFeed.simulcastStarted = false;
    //                 //this.setState({remotefeed});
    //                 Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
    //                 Janus.log("  -- This is a subscriber");
    //                 // We wait for the plugin to send us an offer
    //                 let listen = { "request": "join", "room": 1234, "ptype": "subscriber", "feed": id, "private_id": this.state.mypvtid };
    //                 remoteFeed.send({"message": listen});
    //             },
    //             error: (error) => {
    //                 Janus.error("  -- Error attaching plugin...", error);
    //             },
    //             onmessage: (msg, jsep) => {
    //                 Janus.debug(" ::: Got a message (subscriber) :::");
    //                 Janus.debug(msg);
    //                 let event = msg["videoroom"];
    //                 Janus.debug("Event: " + event);
    //                 if(msg["error"] !== undefined && msg["error"] !== null) {
    //                     Janus.debug(":: Error msg: " + msg["error"]);
    //                 } else if(event !== undefined && event !== null) {
    //                     if(event === "attached") {
    //                         // Subscriber created and attached
    //                         let {feeds,users} = this.state;
    //                         for(let i=1;i<MAX_FEEDS;i++) {
    //                             if(feeds[i] === undefined || feeds[i] === null) {
    //                                 remoteFeed.rfindex = i;
    //                                 remoteFeed.rfid = msg["id"];
    //                                 remoteFeed.rfuser = JSON.parse(msg["display"]);
    //                                 remoteFeed.rfuser.rfid = msg["id"];
    //                                 remoteFeed.talk = talk;
    //                                 feeds[i] = remoteFeed;
    //                                 users[remoteFeed.rfuser.id] = remoteFeed.rfuser;
    //                                 break;
    //                             }
    //                         }
    //                         this.setState({feeds,users});
    //                         Janus.log("Successfully attached to feed " + remoteFeed.rfid + " (" + remoteFeed.rfuser + ") in room " + msg["room"]);
    //                     } else if(event === "event") {
    //                         // Check if we got an event on a simulcast-related event from this publisher
    //                         let substream = msg["substream"];
    //                         let temporal = msg["temporal"];
    //                         if((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
    //                             if(!remoteFeed.simulcastStarted) {
    //                                 remoteFeed.simulcastStarted = true;
    //                                 // Add some new buttons
    //                                 //addSimulcastButtons(remoteFeed.rfindex, remoteFeed.videoCodec === "vp8");
    //                             }
    //                             // We just received notice that there's been a switch, update the buttons
    //                             //updateSimulcastButtons(remoteFeed.rfindex, substream, temporal);
    //                         }
    //                     } else {
    //                         // What has just happened?
    //                     }
    //                 }
    //                 if(jsep !== undefined && jsep !== null) {
    //                     Janus.debug("Handling SDP as well...");
    //                     Janus.debug(jsep);
    //                     // Answer and attach
    //                     remoteFeed.createAnswer(
    //                         {
    //                             jsep: jsep,
    //                             // Add data:true here if you want to subscribe to datachannels as well
    //                             // (obviously only works if the publisher offered them in the first place)
    //                             media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
    //                             success: (jsep) => {
    //                                 Janus.debug("Got SDP!");
    //                                 Janus.debug(jsep);
    //                                 let body = { "request": "start", "room": 1234 };
    //                                 remoteFeed.send({"message": body, "jsep": jsep});
    //                             },
    //                             error: (error) => {
    //                                 Janus.error("WebRTC error:", error);
    //                             }
    //                         });
    //                 }
    //             },
    //             webrtcState: (on) => {
    //                 Janus.log("Janus says this WebRTC PeerConnection (feed #" + remoteFeed.rfindex + ") is " + (on ? "up" : "down") + " now");
    //             },
    //             onlocalstream: (stream) => {
    //                 // The subscriber stream is recvonly, we don't expect anything here
    //             },
    //             onremotestream: (stream) => {
    //                 Janus.debug("Remote feed #" + remoteFeed.rfindex, handle);
    //                 let node = handle === "preview" ? "remoteVideo" : "programVideo";
    //                 //let remotevideo = this.refs[node + remoteFeed.rfindex];
    //                 let remotevideo = this.refs[node + remoteFeed.rfid];
    //                 // if(remotevideo.length === 0) {
    //                 //     // No remote video yet
    //                 // }
    //                 Janus.attachMediaStream(remotevideo, stream);
    //                 var videoTracks = stream.getVideoTracks();
    //                 if(videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
    //                     // No remote video
    //                 } else {
    //                     // Yes remote video
    //                 }
    //                 // if(Janus.webRTCAdapter.browserDetails.browser === "chrome" || Janus.webRTCAdapter.browserDetails.browser === "firefox" ||
    //                 //     Janus.webRTCAdapter.browserDetails.browser === "safari") {
    //                 //     $('#curbitrate'+remoteFeed.rfindex).removeClass('hide').show();
    //                 //     bitrateTimer[remoteFeed.rfindex] = setInterval(function() {
    //                 //         // Display updated bitrate, if supported
    //                 //         var bitrate = remoteFeed.getBitrate();
    //                 //         $('#curbitrate'+remoteFeed.rfindex).text(bitrate);
    //                 //         // Check if the resolution changed too
    //                 //         var width = $("#remotevideo"+remoteFeed.rfindex).get(0).videoWidth;
    //                 //         var height = $("#remotevideo"+remoteFeed.rfindex).get(0).videoHeight;
    //                 //         if(width > 0 && height > 0)
    //                 //             $('#curres'+remoteFeed.rfindex).removeClass('hide').text(width+'x'+height).show();
    //                 //     }, 1000);
    //                 // }
    //             },
    //             oncleanup: () => {
    //                 Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
    //             }
    //         });
    // };

    // publishOwnFeed = (useAudio) => {
    //     // Publish our stream
    //     let {videoroom} = this.state;
    //
    //     videoroom.createOffer(
    //         {
    //             // Add data:true here if you want to publish datachannels as well
    //             //media: { audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: true, video: "lowres" },	// Publishers are sendonly
    //             media: { audioRecv: false, videoRecv: false, audioSend: false, videoSend: false },	// Publishers are sendonly
    //             // If you want to test simulcasting (Chrome and Firefox only), then
    //             // pass a ?simulcast=true when opening this demo page: it will turn
    //             // the following 'simulcast' property to pass to janus.js to true
    //             simulcast: false,
    //             success: (jsep) => {
    //                 Janus.debug("Got publisher SDP!");
    //                 Janus.debug(jsep);
    //                 let publish = { "request": "configure", "audio": useAudio, "video": true };
    //                 // You can force a specific codec to use when publishing by using the
    //                 // audiocodec and videocodec properties, for instance:
    //                 // 		publish["audiocodec"] = "opus"
    //                 // to force Opus as the audio codec to use, or:
    //                 // 		publish["videocodec"] = "vp9"
    //                 // to force VP9 as the videocodec to use. In both case, though, forcing
    //                 // a codec will only work if: (1) the codec is actually in the SDP (and
    //                 // so the browser supports it), and (2) the codec is in the list of
    //                 // allowed codecs in a room. With respect to the point (2) above,
    //                 // refer to the text in janus.plugin.videoroom.cfg for more details
    //                 videoroom.send({"message": publish, "jsep": jsep});
    //             },
    //             error: (error) => {
    //                 Janus.error("WebRTC error:", error);
    //                 if (useAudio) {
    //                     this.publishOwnFeed(false);
    //                 } else {
    //                     Janus.error("WebRTC error... " + JSON.stringify(error));
    //                 }
    //             }
    //         });
    // };

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
                    //let feeds_list = list.filter(feeder => JSON.parse(feeder.display).role === "user");
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.debug(list);
                    let feeds = list.filter(f => !/_/.test(f.display));
                    this.setState({feeds});
                    // for(let f in feeds_list) {
                    //     let id = list[f]["id"];
                    //     let display = JSON.parse(feeds_list[f]["display"]);
                    //     let talk = list[f]["talking"];
                    //     Janus.debug("  >> [" + id + "] " + display);
                    //     this.newRemoteFeed(id, talk);
                    // }
                }
            } else if(event === "talking") {
                // let {feeds} = this.state;
                // let id = msg["id"];
                // //let room = msg["room"];
                // Janus.log("User: "+id+" - start talking");
                // for(let i=1; i<MAX_FEEDS; i++) {
                //     if(feeds[i] !== null && feeds[i] !== undefined && feeds[i].rfid === id) {
                //         feeds[i].talk = true;
                //     }
                // }
                // this.setState({feeds});
            } else if(event === "stopped-talking") {
                // let {feeds} = this.state;
                // let id = msg["id"];
                // //let room = msg["room"];
                // Janus.log("User: "+id+" - stop talking");
                // for(let i=1; i<MAX_FEEDS; i++) {
                //     if(feeds[i] !== null && feeds[i] !== undefined && feeds[i].rfid === id) {
                //         feeds[i].talk = false;
                //     }
                // }
                // this.setState({feeds});
            } else if(event === "destroyed") {
                // The room has been destroyed
                Janus.warn("The room has been destroyed!");
            } else if(event === "event") {
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.debug(list[0]);
                    let {feeds} = this.state;
                    feeds.push(list[0]);
                    this.setState({feeds});
                    // for(let f in list) {
                    //     let id = list[f]["id"];
                    //     let display = JSON.parse(list[f]["display"]);
                    //     Janus.debug("  >> [" + id + "] " + display);
                    //     if(display.role === "user")
                    //         this.newRemoteFeed(id, false);
                    // }
                } else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
                    // One of the publishers has gone away?
                    let {feeds,feeds_queue,pgm_state} = this.state;
                    let leaving = msg["leaving"];
                    Janus.log("Publisher left: " + leaving);
                    for(let i=0; i<feeds.length; i++){
                        if(feeds[i].id === leaving) {
                            feeds.splice(i, 1);
                            this.setState({feeds, feeds_queue: feeds_queue--});
                            //Check if feed in program and switch to next in queue
                            for(let i=0; i<4; i++) {
                                if(pgm_state[i].id === leaving) {
                                    this.switchNext(i);
                                    break
                                }
                            }
                            break
                        }
                    }
                } else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                    // One of the publishers has unpublished?
                    let {feeds,feeds_queue,pgm_state} = this.state;
                    let unpublished = msg["unpublished"];
                    Janus.log("Publisher left: " + unpublished);
                    if(unpublished === 'ok') {
                        // That's us
                        this.state.gxyhandle.hangup();
                        return;
                    }
                    for(let i=0; i<feeds.length; i++){
                        if(feeds[i].id === unpublished) {
                            feeds.splice(i, 1);
                            this.setState({feeds, feeds_queue: feeds_queue--});
                            //Check if feed in program and switch to next in queue
                            for(let i=0; i<4; i++) {
                                if(pgm_state[i].id === unpublished) {
                                    this.switchNext(i);
                                    break
                                }
                            }
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

    newSwitchFeed = (id, program, i) => {
        let pre = null;
        this.state.janus.attach(
            {
                plugin: "janus.plugin.videoroom",
                opaqueId: "switchfeed_user",
                success: (pluginHandle) => {
                    pre = pluginHandle;
                    pre.simulcastStarted = false;
                    //this.setState({remotefeed});
                    Janus.log("Plugin attached! (" + pre.getPlugin() + ", id=" + pre.getId() + ")");
                    Janus.log("  -- This is a subscriber");
                    // We wait for the plugin to send us an offer
                    let listen = { "request": "join", "room": 1234, "ptype": "listener", "feed": id };
                    pre.send({"message": listen});
                    if(program) {
                        let {pr1} = this.state;
                        pr1.push(pre);
                        this.setState({pr1})
                    } else {
                        this.setState({pre});
                    }
                },
                error: (error) => {
                    Janus.error("  -- Error attaching plugin...", error);
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
                            Janus.log("Successfully attached to feed " + pre);
                        } else {
                            // What has just happened?
                        }
                    }
                    if(jsep !== undefined && jsep !== null) {
                        Janus.debug("Handling SDP as well...");
                        Janus.debug(jsep);
                        // Answer and attach
                        pre.createAnswer(
                            {
                                jsep: jsep,
                                media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
                                success: (jsep) => {
                                    Janus.debug("Got SDP!");
                                    Janus.debug(jsep);
                                    let body = { "request": "start", "room": 1234 };
                                    pre.send({"message": body, "jsep": jsep});
                                },
                                error: (error) => {
                                    Janus.error("WebRTC error:", error);
                                }
                            });
                    }
                },
                webrtcState: (on) => {
                    Janus.log("Janus says this WebRTC PeerConnection (feed #" + pre + ") is " + (on ? "up" : "down") + " now");
                },
                onlocalstream: (stream) => {
                    // The subscriber stream is recvonly, we don't expect anything here
                },
                onremotestream: (stream) => {
                    Janus.debug("Remote feed #" + pre);
                    let switchvideo = program ? this.refs["programVideo" + i] : this.refs.prevewVideo;
                    Janus.log(" Attach remote stream on video: "+i);
                    Janus.attachMediaStream(switchvideo, stream);
                    //var videoTracks = stream.getVideoTracks();
                },
                oncleanup: () => {
                    Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
                }
            });
    };

    switchPreview = (id, display) => {
        if(!this.state.pre) {
            this.newSwitchFeed(id,false);
        } else {
            let switchfeed = {"request": "switch", "feed": id, "audio": true, "video": true, "data": false};
            this.state.pre.send ({"message": switchfeed,
                success: () => {
                    Janus.log(" :: Preview Switch Feed to: ", display);
                }
            })
        }
    };

    switchProgram = (i) => {
        console.log(" :: Selected program Switch: ",i);
        let {preview,pr1,pgm_state} = this.state;
        if(preview) {
            let switchfeed = {"request": "switch", "feed": preview.id, "audio": true, "video": true, "data": false};
            pr1[i].send ({"message": switchfeed,
                success: () => {
                    Janus.log(" :: Selected program Switch Feed to: ", preview.display);
                    pgm_state[i] = preview;
                    this.setState({program: preview, pgm_state});
                }
            })
        }

    };

    switchFour = () => {
        let {feeds_queue,pr1,feeds,pgm_state} = this.state;

        for(let i=0; i<4; i++) {

            if(feeds_queue >= feeds.length) {
                // End round here!
                feeds_queue = 0;
                this.setState({feeds_queue});
                console.log(" -- ROUND END --");
            }

            console.log("---------- i: "+i+" queue: "+feeds_queue);
            let feed_id = feeds[feeds_queue].id;
            let feed_display = feeds[feeds_queue].display;
            pgm_state[i] = feeds[feeds_queue];

            if(!pr1[i]) {
                this.newSwitchFeed(feed_id,true,i);
            } else {
                let switchfeed = {"request": "switch", "feed": feed_id, "audio": true, "video": true, "data": false};
                pr1[i].send ({"message": switchfeed,
                    success: () => {
                        Janus.log(" :: Program Switch Feed to: ", feed_display);
                    }
                })
            }

            feeds_queue++;
        }

        // Here current number in feeds queue and program state
        this.setState({feeds_queue, pgm_state});
    };

    switchNext = (i) => {
        let {feeds_queue,feeds,pr1,pgm_state} = this.state;
        let next_feed = feeds[feeds_queue];

        if(!pr1[i]) {
            this.newSwitchFeed(next_feed.id,true,i);
        } else {
            let switchfeed = {"request": "switch", "feed": next_feed.id, "audio": true, "video": true, "data": false};
            pr1[i].send ({"message": switchfeed,
                success: () => {
                    Janus.log(" :: Program Switch Feed to: ", next_feed.display);
                    pgm_state[i] = next_feed;
                }
            })
        }

        feeds_queue++;

    // Here current number in feeds queue and program state
    this.setState({feeds_queue, pgm_state});
    };

    // attachToPreview = (group, index) => {
    //     const {feeds} = this.state;
    //     Janus.log(" :: Attaching to Preview: ",group);
    //     let room = group.room;
    //     let name = group.description;
    //     if(this.state.preview_room === room)
    //         return;
    //     feeds.preview.forEach(feed => {
    //         if(feed) {
    //             Janus.log("-- :: Remove Feed: ", feed);
    //             feed.detach();
    //         }
    //     });
    //
    //     feeds.preview = [];
    //     this.setState({index, preview_room: room, preview_name: name, feeds});
    //     this.initVideoRoom(room, "preview");
    // };

    // attachToProgram = () => {
    //     // const {feeds} = this.state;
    //     // let {preview_room, preview_name, group, rooms} = this.state;
    //     // if(!preview_name)
    //     //     return;
    //     // feeds.program.forEach(feed => {
    //     //     if(feed) {
    //     //         Janus.log("-- :: Remove Feed: ", feed);
    //     //         feed.detach();
    //     //     }
    //     // });
    //     //
    //     // feeds.program = [];
    //     // this.setState({program_room: preview_room, program_name: preview_name, feeds});
    //     // this.initVideoRoom(preview_room, "program");
    //     //
    //     // // Save Program State
    //     // let pgm_state = { index: 0, room: preview_room, name: preview_name};
    //     // this.setState({pgm_state});
    //     // Janus.log(" :: Attaching to Program: ",preview_name,pgm_state);
    //     // putData(`state/galaxy/pr1`, pgm_state, (cb) => {
    //     //     Janus.log(":: Save to state: ",cb);
    //     // });
    //     //
    //     // // Select next group
    //     // let i = rooms.length-1 < group.index+1 ? 0 :  group.index+1;
    //     // this.selectGroup(rooms[i], i)
    // };

    clickPreview = () => {
        console.log("You clicked on preview :-|");
    };

    selectGroup = (preview) => {
        // group.index = i;
        this.setState({preview});
        Janus.log(preview);
        this.switchPreview(preview.id, preview.display);
    };

    disableGroup = (e, data, i) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            let {disabled_groups} = this.state;
            disabled_groups.push(data);
            this.setState({disabled_groups});
        }
    };

    restoreGroup = (e, data, i) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            let {disabled_groups} = this.state;
            for(let i = 0; i < disabled_groups.length; i++){
                if ( disabled_groups[i].room === data.room) {
                    disabled_groups.splice(i, 1);
                    this.setState({disabled_groups});
                }
            }
        }
    };


  render() {
      //Janus.log(" --- ::: RENDER ::: ---");
      const { feeds,preview_room,preview_name,program_name,disabled_groups,rooms,quistions_queue,pgm_state } = this.state;
      const width = "180";
      const height = "90";
      const autoPlay = true;
      const controls = false;
      const muted = true;
      const q = (<Icon color='red' name='question circle' />);

      let group_options = feeds.map((feed,i) => {
          const {display} = feed;
          return ({ key: i, value: feed, text: display })
      });

      let disabled_list = disabled_groups.map((data,i) => {
          const {room, num_participants, description} = data;
          return (
              <Table.Row key={room} warning
                         onClick={() => this.selectGroup(data, i)}
                         onContextMenu={(e) => this.restoreGroup(e, data, i)} >
                  <Table.Cell width={5}>{description}</Table.Cell>
                  <Table.Cell width={1}>{num_participants}</Table.Cell>
                  <Table.Cell width={1}></Table.Cell>
              </Table.Row>
          )
      });

      // let program = feeds.map((feed) => {
      //     if(feed) {
      //         let id = feed.rfid;
      //         let talk = feed.talk;
      //         return (<div className="video"
      //                      key={"prov" + id}
      //                      ref={"provideo" + id}
      //                      id={"provideo" + id}>
      //             <video className={talk ? "talk" : ""}
      //                    key={id}
      //                    ref={"programVideo" + id}
      //                    id={"programVideo" + id}
      //                    width={width}
      //                    height={height}
      //                    autoPlay={autoPlay}
      //                    controls={controls}
      //                    muted={muted}
      //                    playsInline={true}/>
      //         </div>);
      //     }
      //     return true;
      // });

    return (

        <Segment className="segment_conteiner" raised>
          
          <Segment attached className="program_segment" color='red'>
              {/*<div className="shidur_overlay">{pgm_state.name}</div>*/}
              {/*{program}*/}
              {/*<div className="shidur_overlay"><span>{pgm_state.name}</span></div>*/}
              <Grid columns={2} stretched>
                  <Grid.Row stretched>
                      <Grid.Column>
                          <video onClick={() => this.switchProgram("0")}
                              ref={"programVideo0"}
                              id={"programVideo0"}
                              width={width}
                              height={height}
                              autoPlay={autoPlay}
                              controls={controls}
                              muted={muted}
                              playsInline={true}/>
                      </Grid.Column>
                      <Grid.Column>
                          <video onClick={() => this.switchProgram("1")}
                              ref={"programVideo1"}
                              id={"programVideo1"}
                              width={width}
                              height={height}
                              autoPlay={autoPlay}
                              controls={controls}
                              muted={muted}
                              playsInline={true}/>
                      </Grid.Column>
                  </Grid.Row>

                  <Grid.Row stretched>
                      <Grid.Column>
                          <video onClick={() => this.switchProgram("2")}
                                 ref={"programVideo2"}
                                 id={"programVideo2"}
                                 width={width}
                                 height={height}
                                 autoPlay={autoPlay}
                                 controls={controls}
                                 muted={muted}
                                 playsInline={true}/>
                      </Grid.Column>
                      <Grid.Column>
                          <video onClick={() => this.switchProgram("3")}
                                 ref={"programVideo3"}
                                 id={"programVideo3"}
                                 width={width}
                                 height={height}
                                 autoPlay={autoPlay}
                                 controls={controls}
                                 muted={muted}
                                 playsInline={true}/>
                      </Grid.Column>
                  </Grid.Row>
              </Grid>
          </Segment>

            <Button attached='bottom' color='red' size='mini' onClick={this.switchFour}>Next four</Button>

          <Segment className="preview_segment" color='green' onClick={this.clickPreview} >
              {/*<div className="shidur_overlay">{preview_name}</div>*/}
              {/*{preview}*/}
              <div className="shidur_overlay"><span>{preview_name}</span></div>
              <video
                     ref={"prevewVideo"}
                     id="prevewVideo"
                     width="400"
                     height="220"
                     autoPlay={autoPlay}
                     controls={controls}
                     muted={muted}
                     playsInline={true}/>
          </Segment>

            <Dropdown
                placeholder='Select Group'
                fluid
                search
                selection
                options={group_options}
                onChange={(e,{value}) => this.selectGroup(value)} />

          {/*<Segment textAlign='center' className="group_list" raised>*/}
              {/*<Table selectable compact='very' basic structured className="admin_table" unstackable>*/}
                  {/*<Table.Body>*/}
                  {/*</Table.Body>*/}
              {/*</Table>*/}
          {/*</Segment>*/}
            <Segment textAlign='center' className="disabled_list" raised>
                <Table selectable compact='very' basic structured className="admin_table" unstackable>
                    <Table.Body>
                        {disabled_list}
                    </Table.Body>
                </Table>
            </Segment>

        </Segment>
    );
  }
}

export default ShidurGroups;

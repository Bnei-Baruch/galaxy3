import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Segment, Table, Icon} from "semantic-ui-react";
import {getState, putData, initJanus} from "../../shared/tools";
import {MAX_FEEDS} from "../../shared/consts";
import './ShidurUsers.css'
import './VideoConteiner.scss'
import nowebcam from './nowebcam.jpeg';
import {initGxyProtocol} from "../../shared/protocol";
import classNames from "classnames";

class ShidurUsers extends Component {

    state = {
        janus: null,
        feeds: {
            preview: [],
            program: [],
        },
        rooms: [],
        index: 0,
        preview_room: null,
        program_room: null,
        preview_name: null,
        program_name: null,
        room: "",
        name: "",
        disabled_rooms: [],
        group: null,
        preview: null,
        program: null,
        protocol: null,
        pgm_state: {
            name: "",
            room: null,
            index: null
        },
        quistions_queue: [],
        questions: {},
        videoroom: null,
        remotefeed: null,
        myid: null,
        mypvtid: null,
        mystream: null,
        audio: null,
        muted: true,
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
        initJanus(janus => {
            let {user} = this.state;
            user.session = janus.getSessionId();
            this.setState({janus,user});
            this.initVideoRoom(null, "preview");

            initGxyProtocol(janus, user, protocol => {
                this.setState({protocol});
            }, ondata => {
                Janus.log("-- :: It's protocol public message: ", ondata);
                this.onProtocolData(ondata);
            });

            getState('state/galaxy/pr5', (pgm_state) => {
                Janus.log(" :: Get State: ", pgm_state);
                this.setState({program_room: pgm_state.room, program_name: pgm_state.name, pgm_state});
                this.initVideoRoom(pgm_state.room, "program");
            });
        });
        setInterval(() => this.getRoomList(), 10000 );

    };

    onProtocolData = (data) => {
        let {feeds,users,user,questions,quistions_queue,preview_room,program_room} = this.state;
        if(data.type === "question" && data.status) {
            questions[data.user.id] = data.user;
            quistions_queue.push(data);
            this.setState({quistions_queue,questions});
        } else if(data.type === "question" && !data.status) {
            if(questions[data.user.id]) {
                delete questions[data.user.id];
                this.setState({questions});
            }
            for(let i = 0; i < quistions_queue.length; i++){
                if(quistions_queue[i].user.id === data.user.id) {
                    quistions_queue.splice(i, 1);
                    this.setState({quistions_queue});
                    break
                }
            }
        }

        if (data.type === "question" && data.status && data.room === program_room && user.id !== data.user.id) {
            let rfid = users[data.user.id].rfid;
            for (let i = 1; i < feeds.program.length; i++) {
                if (feeds.program[i] !== null && feeds.program[i] !== undefined && feeds.program[i].rfid === rfid) {
                    feeds.program[i].question = true;
                    break
                }
            }
            this.setState({feeds});
        } else if (data.type === "question" && !data.status && data.room === program_room && user.id !== data.user.id) {
            let rfid = users[data.user.id].rfid;
            for (let i = 1; i < feeds.program.length; i++) {
                if (feeds.program[i] !== null && feeds.program[i] !== undefined && feeds.program[i].rfid === rfid) {
                    feeds.program[i].question = false;
                    break
                }
            }
            this.setState({feeds});
        }

        if(data.type === "question" && data.status && data.room === preview_room && user.id !== data.user.id) {
            let rfid = users[data.user.id].rfid;
            for (let i = 1; i < feeds.preview.length; i++) {
                if (feeds.preview[i] !== null && feeds.preview[i] !== undefined && feeds.preview[i].rfid === rfid) {
                    feeds.preview[i].question = true;
                    break
                }
            }
           this.setState({feeds});
        } else if(data.type === "question" && !data.status && data.room === preview_room && user.id !== data.user.id) {
            let rfid = users[data.user.id].rfid;
            for (let i = 1; i < feeds.preview.length; i++) {
                if (feeds.preview[i] !== null && feeds.preview[i] !== undefined && feeds.preview[i].rfid === rfid) {
                    feeds.preview[i].question = false;
                    break
                }
            }
            this.setState({feeds});
        }
    };

    componentWillUnmount() {
        this.state.janus.destroy();
    };

    getRoomList = () => {
        const {preview, disabled_rooms, program_room, preview_room} = this.state;
        if (preview) {
            preview.send({message: {request: "list"},
                success: (data) => {
                    let usable_rooms = data.list.filter(room => room.num_participants > 0);
                    var newarray = usable_rooms.filter((room) => !disabled_rooms.find(droom => room.room === droom.room));
                    newarray.sort((a, b) => {
                        // if (a.num_participants > b.num_participants) return -1;
                        // if (a.num_participants < b.num_participants) return 1;
                        if (a.description > b.description) return 1;
                        if (a.description < b.description) return -1;
                        return 0;
                    });
                    this.setState({rooms: newarray});
                    this.getFeedsList(newarray)
                }
            });
        }
    };

    //FIXME: tmp solution to show count without service users in room list
    getFeedsList = (rooms) => {
        let {preview} = this.state;
        rooms.forEach((room,i) => {
            if(room.num_participants > 0) {
                preview.send({
                    message: {request: "listparticipants", "room": room.room},
                    success: (data) => {
                        let count = data.participants.filter(p => JSON.parse(p.display).role === "user");
                        rooms[i].num_participants = count.length;
                        this.setState({rooms});
                    }
                });
            }
        })
    };

    initVideoRoom = (roomid, handle) => {
        // if(!this.state.room)
        //     return;
        if(this.state[handle])
            this.state[handle].detach();
        this.state.janus.attach({
            plugin: "janus.plugin.videoroom",
            opaqueId: "preview_shidur",
            success: (hdl) => {
                Janus.log(hdl);
                hdl.room = roomid;
                this.setState({[handle]: hdl});
                Janus.log("Plugin attached! (" + hdl.getPlugin() + ", id=" + hdl.getId() + ")");
                Janus.log("  -- This is a publisher/manager");
                let {user} = this.state;

                if(roomid) {
                    let register = { "request": "join", "room": roomid, "ptype": "publisher", "display": JSON.stringify(user) };
                    hdl.send({"message": register});
                } else {
                    // Get list rooms
                    this.getRoomList();
                }

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
                this.onMessage(handle, msg, jsep, false);
            },
            onlocalstream: (mystream) => {
                // We don't going to show us yet
                Janus.debug(" ::: Got a local stream :::", mystream);
            },
            onremotestream: (stream) => {
                // The publisher stream is sendonly, we don't expect anything here
            },
            oncleanup: () => {
                Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
            }
        });
    };

    newRemoteFeed = (id, handle, talk) => {
        // A new feed has been published, create a new plugin handle and attach to it as a subscriber
        var remoteFeed = null;
        this.state.janus.attach(
            {
                plugin: "janus.plugin.videoroom",
                opaqueId: "remotefeed_shidur",
                success: (pluginHandle) => {
                    remoteFeed = pluginHandle;
                    remoteFeed.simulcastStarted = false;
                    //this.setState({remotefeed});
                    Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
                    Janus.log("  -- This is a subscriber");
                    // We wait for the plugin to send us an offer
                    let listen = { "request": "join", "room": this.state[handle].room, "ptype": "subscriber", "feed": id, "private_id": this.state.mypvtid };
                    remoteFeed.send({"message": listen});
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
                            let {feeds,users,questions} = this.state;
                            for(let i=1;i<MAX_FEEDS;i++) {
                                if(feeds[handle][i] === undefined || feeds[handle][i] === null) {
                                    remoteFeed.rfindex = i;
                                    remoteFeed.rfid = msg["id"];
                                    remoteFeed.rfuser = JSON.parse(msg["display"]);
                                    remoteFeed.rfuser.rfid = msg["id"];
                                    if(questions[remoteFeed.rfuser.id]) {
                                        remoteFeed.question = true;
                                    }
                                    remoteFeed.talk = talk;
                                    feeds[handle][i] = remoteFeed;
                                    users[remoteFeed.rfuser.id] = remoteFeed.rfuser;
                                    break;
                                }
                            }
                            this.setState({feeds,users});
                            Janus.log("Successfully attached to feed " + remoteFeed.rfid + " (" + remoteFeed.rfuser + ") in room " + msg["room"]);
                        } else if(event === "event") {
                            // Check if we got an event on a simulcast-related event from this publisher
                            let substream = msg["substream"];
                            let temporal = msg["temporal"];
                            if((substream !== null && substream !== undefined) || (temporal !== null && temporal !== undefined)) {
                                if(!remoteFeed.simulcastStarted) {
                                    remoteFeed.simulcastStarted = true;
                                    // Add some new buttons
                                    //addSimulcastButtons(remoteFeed.rfindex, remoteFeed.videoCodec === "vp8");
                                }
                                // We just received notice that there's been a switch, update the buttons
                                //updateSimulcastButtons(remoteFeed.rfindex, substream, temporal);
                            }
                        } else {
                            // What has just happened?
                        }
                    }
                    if(jsep !== undefined && jsep !== null) {
                        Janus.debug("Handling SDP as well...");
                        Janus.debug(jsep);
                        // Answer and attach
                        remoteFeed.createAnswer(
                            {
                                jsep: jsep,
                                // Add data:true here if you want to subscribe to datachannels as well
                                // (obviously only works if the publisher offered them in the first place)
                                media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
                                success: (jsep) => {
                                    Janus.debug("Got SDP!");
                                    Janus.debug(jsep);
                                    let body = { "request": "start", "room": this.state[handle].room };
                                    remoteFeed.send({"message": body, "jsep": jsep});
                                },
                                error: (error) => {
                                    Janus.error("WebRTC error:", error);
                                }
                            });
                    }
                },
                webrtcState: (on) => {
                    Janus.log("Janus says this WebRTC PeerConnection (feed #" + remoteFeed.rfindex + ") is " + (on ? "up" : "down") + " now");
                },
                onlocalstream: (stream) => {
                    // The subscriber stream is recvonly, we don't expect anything here
                },
                onremotestream: (stream) => {
                    Janus.debug("Remote feed #" + remoteFeed.rfindex, handle);
                    let node = handle === "preview" ? "remoteVideo" : "programVideo";
                    //let remotevideo = this.refs[node + remoteFeed.rfindex];
                    let remotevideo = this.refs[node + remoteFeed.rfid];
                    // if(remotevideo.length === 0) {
                    //     // No remote video yet
                    // }
                    Janus.attachMediaStream(remotevideo, stream);
                    var videoTracks = stream.getVideoTracks();
                    if(videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
                        // No remote video
                    } else {
                        // Yes remote video
                    }
                    // if(Janus.webRTCAdapter.browserDetails.browser === "chrome" || Janus.webRTCAdapter.browserDetails.browser === "firefox" ||
                    //     Janus.webRTCAdapter.browserDetails.browser === "safari") {
                    //     $('#curbitrate'+remoteFeed.rfindex).removeClass('hide').show();
                    //     bitrateTimer[remoteFeed.rfindex] = setInterval(function() {
                    //         // Display updated bitrate, if supported
                    //         var bitrate = remoteFeed.getBitrate();
                    //         $('#curbitrate'+remoteFeed.rfindex).text(bitrate);
                    //         // Check if the resolution changed too
                    //         var width = $("#remotevideo"+remoteFeed.rfindex).get(0).videoWidth;
                    //         var height = $("#remotevideo"+remoteFeed.rfindex).get(0).videoHeight;
                    //         if(width > 0 && height > 0)
                    //             $('#curres'+remoteFeed.rfindex).removeClass('hide').text(width+'x'+height).show();
                    //     }, 1000);
                    // }
                },
                oncleanup: () => {
                    Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
                }
            });
    };

    publishOwnFeed = (useAudio) => {
        // Publish our stream
        let {videoroom} = this.state;

        videoroom.createOffer(
            {
                // Add data:true here if you want to publish datachannels as well
                //media: { audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: true, video: "lowres" },	// Publishers are sendonly
                media: { audioRecv: false, videoRecv: false, audioSend: false, videoSend: false },	// Publishers are sendonly
                // If you want to test simulcasting (Chrome and Firefox only), then
                // pass a ?simulcast=true when opening this demo page: it will turn
                // the following 'simulcast' property to pass to janus.js to true
                simulcast: false,
                success: (jsep) => {
                    Janus.debug("Got publisher SDP!");
                    Janus.debug(jsep);
                    let publish = { "request": "configure", "audio": useAudio, "video": true };
                    // You can force a specific codec to use when publishing by using the
                    // audiocodec and videocodec properties, for instance:
                    // 		publish["audiocodec"] = "opus"
                    // to force Opus as the audio codec to use, or:
                    // 		publish["videocodec"] = "vp9"
                    // to force VP9 as the videocodec to use. In both case, though, forcing
                    // a codec will only work if: (1) the codec is actually in the SDP (and
                    // so the browser supports it), and (2) the codec is in the list of
                    // allowed codecs in a room. With respect to the point (2) above,
                    // refer to the text in janus.plugin.videoroom.cfg for more details
                    videoroom.send({"message": publish, "jsep": jsep});
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

    onMessage = (handle, msg, jsep, initdata) => {
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
                //this.publishOwnFeed(true);
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    let feeds_list = list.filter(feeder => JSON.parse(feeder.display).role === "user");
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.debug(list);
                    for(let f in feeds_list) {
                        let id = list[f]["id"];
                        let display = JSON.parse(feeds_list[f]["display"]);
                        let talk = list[f]["talking"];
                        Janus.debug("  >> [" + id + "] " + display);
                        this.newRemoteFeed(id, handle, talk);
                    }
                }
            } else if(event === "talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                //let room = msg["room"];
                Janus.log("User: "+id+" - start talking");
                for(let i=1; i<MAX_FEEDS; i++) {
                    if(feeds[handle][i] !== null && feeds[handle][i] !== undefined && feeds[handle][i].rfid === id) {
                        feeds[handle][i].talk = true;
                    }
                }
                this.setState({feeds});
            } else if(event === "stopped-talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                //let room = msg["room"];
                Janus.log("User: "+id+" - stop talking");
                for(let i=1; i<MAX_FEEDS; i++) {
                    if(feeds[handle][i] !== null && feeds[handle][i] !== undefined && feeds[handle][i].rfid === id) {
                        feeds[handle][i].talk = false;
                    }
                }
                this.setState({feeds});
            } else if(event === "destroyed") {
                // The room has been destroyed
                Janus.warn("The room has been destroyed!");
            } else if(event === "event") {
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.debug(list);
                    for(let f in list) {
                        let id = list[f]["id"];
                        let display = JSON.parse(list[f]["display"]);
                        Janus.debug("  >> [" + id + "] " + display);
                        if(display.role === "user")
                            this.newRemoteFeed(id, handle, false);
                    }
                } else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
                    // One of the publishers has gone away?
                    let {feeds} = this.state;
                    let leaving = msg["leaving"];
                    Janus.log("Publisher left: " + leaving);
                    var remoteFeed = null;
                    for(let i=1; i<MAX_FEEDS; i++) {
                        if(feeds[handle][i] != null && feeds[handle][i] !== undefined && feeds[handle][i].rfid === leaving) {
                            remoteFeed = feeds[handle][i];
                            break;
                        }
                    }
                    if(remoteFeed !== null) {
                        Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfuser + ") has left the room, detaching");
                        // $('#remote'+remoteFeed.rfindex).empty().hide();
                        // $('#videoremote'+remoteFeed.rfindex).empty();
                        feeds[handle][remoteFeed.rfindex] = null;
                        remoteFeed.detach();
                    }
                    this.setState({feeds});
                } else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                    // One of the publishers has unpublished?
                    let {feeds} = this.state;
                    let unpublished = msg["unpublished"];
                    Janus.log("Publisher left: " + unpublished);
                    if(unpublished === 'ok') {
                        // That's us
                        this.state[handle].hangup();
                        return;
                    }
                    var remoteFeed = null;
                    for(let i=1; i<MAX_FEEDS; i++) {
                        if(feeds[handle][i] !== null && feeds[handle][i] !== undefined && feeds[handle][i].rfid === unpublished) {
                            remoteFeed = feeds[handle][i];
                            break;
                        }
                    }
                    if(remoteFeed !== null) {
                        Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfuser + ") has left the room, detaching");
                        // $('#remote'+remoteFeed.rfindex).empty().hide();
                        // $('#videoremote'+remoteFeed.rfindex).empty();
                        feeds[handle][remoteFeed.rfindex] = null;
                        remoteFeed.detach();
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
            this.state[handle].handleRemoteJsep({jsep: jsep});
            // Check if any of the media we wanted to publish has
            // been rejected (e.g., wrong or unsupported codec)
            // var audio = msg["audio_codec"];
            // if(mystream && mystream.getAudioTracks() && mystream.getAudioTracks().length > 0 && !audio) {
            //     // Audio has been rejected
            //     toastr.warning("Our audio stream has been rejected, viewers won't hear us");
            // }
            // var video = msg["video_codec"];
            // if(mystream && mystream.getVideoTracks() && mystream.getVideoTracks().length > 0 && !video) {
            //     // Video has been rejected
            //     toastr.warning("Our video stream has been rejected, viewers won't see us");
            //     // Hide the webcam video
            //     $('#myvideo').hide();
            //     $('#videolocal').append(
            //         '<div class="no-video-container">' +
            //         '<i class="fa fa-video-camera fa-5 no-video-icon" style="height: 100%;"></i>' +
            //         '<span class="no-video-text" style="font-size: 16px;">Video rejected, no webcam</span>' +
            //         '</div>');
            // }
        }
    };

    attachToPreview = (group, index) => {
        const {feeds} = this.state;
        Janus.log(" :: Attaching to Preview: ",group);
        let room = group.room;
        let name = group.description;
        if(this.state.preview_room === room)
            return;
        feeds.preview.forEach(feed => {
            if(feed) {
                Janus.log("-- :: Remove Feed: ", feed);
                feed.detach();
            }
        });

        feeds.preview = [];
        this.setState({index, preview_room: room, preview_name: name, feeds});
        this.initVideoRoom(room, "preview");
    };

    attachToProgram = () => {
        const {feeds} = this.state;
        let {preview_room, preview_name, group, rooms} = this.state;
        if(!preview_name)
            return;
        feeds.program.forEach(feed => {
            if(feed) {
                Janus.log("-- :: Remove Feed: ", feed);
                feed.detach();
            }
        });

        feeds.program = [];
        this.setState({program_room: preview_room, program_name: preview_name, feeds});
        this.initVideoRoom(preview_room, "program");

        // Save Program State
        let pgm_state = { index: 0, room: preview_room, name: preview_name};
        this.setState({pgm_state});
        Janus.log(" :: Attaching to Program: ",preview_name,pgm_state);
        putData(`state/galaxy/pr5`, pgm_state, (cb) => {
            Janus.log(":: Save to state: ",cb);
        });

        // Select next group
        let i = rooms.length-1 < group.index+1 ? 0 :  group.index+1;
        this.selectGroup(rooms[i], i)
    };

    selectGroup = (group, i) => {
        group.index = i;
        this.setState({group});
        Janus.log(group);
        this.attachToPreview(group);
    };

    disableRoom = (e, data, i) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            let {disabled_rooms} = this.state;
            disabled_rooms.push(data);
            this.setState({disabled_rooms});
            this.getRoomList();
        }
    };

    restoreRoom = (e, data, i) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            let {disabled_rooms} = this.state;
            for(let i = 0; i < disabled_rooms.length; i++){
                if ( disabled_rooms[i].room === data.room) {
                    disabled_rooms.splice(i, 1);
                    this.setState({disabled_rooms});
                    this.getRoomList();
                }
            }
        }
    };


  render() {
      //Janus.log(" --- ::: RENDER ::: ---");
      const { feeds,preview_room,preview_name,program_name,disabled_rooms,rooms,quistions_queue,pgm_state } = this.state;
      const width = "400";
      const height = "300";
      const autoPlay = true;
      const controls = false;
      const muted = true;
      const q = (<Icon color='red' name='question circle' />);

      let rooms_list = rooms.map((data,i) => {
          const {room, num_participants, description} = data;
          let chk = quistions_queue.filter(q => q.room === room);
          return (
              <Table.Row negative={program_name === description}
                         positive={preview_name === description}
                         disabled={num_participants === 0}
                         className={preview_room === room ? 'active' : 'no'}
                         key={room} onClick={() => this.selectGroup(data, i)}
                         onContextMenu={(e) => this.disableRoom(e, data, i)} >
                  <Table.Cell width={5}>{description}</Table.Cell>
                  <Table.Cell width={1}>{num_participants}</Table.Cell>
                  <Table.Cell width={1}>{chk.length > 0 ? q : ""}</Table.Cell>
              </Table.Row>
          )
      });

      let disabled_list = disabled_rooms.map((data,i) => {
          const {room, num_participants, description} = data;
          return (
              <Table.Row key={room} warning
                         onClick={() => this.selectGroup(data, i)}
                         onContextMenu={(e) => this.restoreRoom(e, data, i)} >
                  <Table.Cell width={5}>{description}</Table.Cell>
                  <Table.Cell width={1}>{num_participants}</Table.Cell>
                  <Table.Cell width={1}></Table.Cell>
              </Table.Row>
          )
      });

      let program = feeds.program.map((feed) => {
          if(feed) {
              let id = feed.rfid;
              let talk = feed.talk;
              let question = feed.question;
              return (<div className="video"
                           key={"prov" + id}
                           ref={"provideo" + id}
                           id={"provideo" + id}>
                  <div className={classNames('video__overlay', {'talk' : talk})}>
                      {question ? <div className="question"><Icon name="question circle" size="massive"/></div>:''}
                      {/*<div className="video__title">{!talk ? <Icon name="microphone slash" size="small" color="red"/> : ''}{name}</div>*/}
                  </div>
                  <video className={talk ? "talk" : ""}
                         key={id}
                         ref={"programVideo" + id}
                         id={"programVideo" + id}
                         width={width}
                         height={height}
                         autoPlay={autoPlay}
                         controls={controls}
                         muted={muted}
                         playsInline={true}/>
              </div>);
          }
          return true;
      });

      let preview = feeds.preview.map((feed) => {
          if(feed) {
              let id = feed.rfid;
              let talk = feed.talk;
              let question = feed.question;
              return (<div className="video"
                           key={"prev" + id}
                           ref={"prevideo" + id}
                           id={"prevideo" + id}>
                  <div className={classNames('video__overlay', {'talk' : talk})}>
                      {question ? <div className="question"><Icon name="question circle" size="massive"/></div>:''}
                      {/*<div className="video__title">{!talk ? <Icon name="microphone slash" size="small" color="red"/> : ''}{name}</div>*/}
                  </div>
                  <video className={talk ? "talk" : ""}
                         key={id}
                         ref={"remoteVideo" + id}
                         id={"remoteVideo" + id}
                         poster={nowebcam}
                         width={width}
                         height={height}
                         autoPlay={autoPlay}
                         controls={controls}
                         muted={muted}
                         playsInline={true}/>
              </div>);
          }
          return true;
      });

    return (

        <Segment className="segment_conteiner">
          
          <Segment className="program_segment" color='red'>
              {/*<div className="shidur_overlay">{pgm_state.name}</div>*/}
              {/*{program}*/}
              <div className="shidur_overlay"><span>{pgm_state.name}</span></div>
              <div className="videos-panel">
                  <div className="videos">
                      <div className="videos__wrapper">{program}</div>
                  </div>
              </div>
          </Segment>

          <Segment className="preview_segment" color='green' onClick={this.attachToProgram} >
              {/*<div className="shidur_overlay">{preview_name}</div>*/}
              {/*{preview}*/}
              <div className="shidur_overlay"><span>{preview_name}</span></div>
              <div className="videos-panel">
                  <div className="videos">
                      <div className="videos__wrapper">{preview}</div>
                  </div>
              </div>
          </Segment>

          <Segment textAlign='center' className="group_list" raised>
              <Table selectable compact='very' basic structured className="admin_table" unstackable>
                  <Table.Body>
                      {rooms_list}
                  </Table.Body>
              </Table>
          </Segment>
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

export default ShidurUsers;

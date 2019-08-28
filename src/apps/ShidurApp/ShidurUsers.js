import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Segment, Table, Icon} from "semantic-ui-react";
import {getState, putData, initJanus} from "../../shared/tools";
//import {MAX_FEEDS} from "../../shared/consts";
import './ShidurUsers.css'
import './VideoConteiner.scss'
//import nowebcam from './nowebcam.jpeg';
import {initGxyProtocol} from "../../shared/protocol";
import classNames from "classnames";

class ShidurUsers extends Component {

    state = {
        janus: null,
        rooms: [],
        index: 0,
        disabled_rooms: [],
        group: null,
        preview: {
            feeds: [],
            feedStreams: {},
            mids: [],
            name: "",
            room: "",
            users: {}
            },
        program: {
            feeds: [],
            feedStreams: {},
            mids: [],
            name: "",
            room: "",
            users: {}
            },
        protocol: null,
        questions_queue: [],
        questions: {},
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

            getState('state/galaxy/pr4', (state) => {
                Janus.log(" :: Get State: ", state);
                let {room, name} = state;
                this.setState({program: {...this.state.program, room, name, state}});
                this.initVideoRoom(room, "program");
            });
        },er => {}, true);
        setInterval(() => this.getRoomList(), 10000 );

    };

    componentWillUnmount() {
        this.state.janus.destroy();
    };

    getRoomList = () => {
        const {preview, disabled_rooms} = this.state;
        if (preview && preview.videoroom) {
            preview.videoroom.send({message: {request: "list"},
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
                    //this.setState({rooms: newarray});
                    this.getFeedsList(newarray)
                }
            });
        }
    };

    //FIXME: tmp solution to show count without service users in room list
    getFeedsList = (rooms) => {
        rooms.forEach((room,i) => {
            if(room.num_participants > 0) {
                this.state.preview.videoroom.send({
                    message: {request: "listparticipants", "room": room.room},
                    success: (data) => {
                        Janus.debug("Feeds: ", data.participants);
                        let count = data.participants.filter(p => JSON.parse(p.display).role === "user");
                        rooms[i].num_participants = count.length;
                        this.setState({rooms});
                    }
                });
            }
        })
    };

    newRemoteFeed = (h, subscription) => {
        this.state.janus.attach(
            {
                plugin: "janus.plugin.videoroom",
                opaqueId: "remotefeed_user",
                success: (pluginHandle) => {
                    let remoteFeed = pluginHandle;
                    Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
                    Janus.log("  -- This is a multistream subscriber",remoteFeed);
                    this.setState({ [h]:{...this.state[h], remoteFeed, creatingFeed: false}});
                    // We wait for the plugin to send us an offer
                    let subscribe = {request: "join", room: this.state[h].room, ptype: "subscriber", streams: subscription};
                    remoteFeed.send({ message: subscribe });
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
                    Janus.log(" ::: Got a message (subscriber) :::");
                    Janus.log(msg);
                    let event = msg["videoroom"];
                    Janus.log("Event: " + event);
                    if(msg["error"] !== undefined && msg["error"] !== null) {
                        Janus.debug("-- ERROR: " + msg["error"]);
                    } else if(event !== undefined && event !== null) {
                        if(event === "attached") {
                            //this.setState({creatingFeed: false});
                            Janus.log("Successfully attached to feed in room " + msg["room"]);
                        } else if(event === "event") {
                            // Check if we got an event on a simulcast-related event from this publisher
                        } else {
                            // What has just happened?
                        }
                    }
                    if(msg["streams"]) {
                        // Update map of subscriptions by mid
                        let {mids} = this.state[h];
                        for(let i in msg["streams"]) {
                            let mindex = msg["streams"][i]["mid"];
                            //let feed_id = msg["streams"][i]["feed_id"];
                            mids[mindex] = msg["streams"][i];
                        }
                        this.setState({[h]: {...this.state[h], mids}});
                    }
                    if(jsep !== undefined && jsep !== null) {
                        Janus.debug("Handling SDP as well...");
                        Janus.debug(jsep);
                        // Answer and attach
                        this.state[h].remoteFeed.createAnswer(
                            {
                                jsep: jsep,
                                // Add data:true here if you want to subscribe to datachannels as well
                                // (obviously only works if the publisher offered them in the first place)
                                media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
                                success: (jsep) => {
                                    Janus.debug("Got SDP!");
                                    Janus.debug(jsep);
                                    let body = { request: "start", room: this.state[h].room };
                                    this.state[h].remoteFeed.send({ message: body, jsep: jsep });
                                },
                                error: (error) => {
                                    Janus.error("WebRTC error:", error);
                                    Janus.debug("WebRTC error... " + JSON.stringify(error));
                                }
                            });
                    }
                },
                onlocaltrack: (track, on) => {
                    // The subscriber stream is recvonly, we don't expect anything here
                },
                onremotetrack: (track, mid, on) => {
                    Janus.log(" ::: Got a remote track event ::: (remote feed)");
                    Janus.log("Remote track (mid=" + mid + ") " + (on ? "added" : "removed") + ":", track);
                    // Which publisher are we getting on this mid?
                    let {mids,feedStreams} = this.state[h];
                    let feed = mids[mid].feed_id;
                    Janus.log(" >> This track is coming from feed " + feed + ":", mid);
                    // If we're here, a new track was added
                    if(track.kind === "video" && on) {
                        // New video track: create a stream out of it
                        let stream = new MediaStream();
                        stream.addTrack(track.clone());
                        Janus.log("Created remote video stream:", stream);
                        feedStreams[feed].stream = stream;
                        this.setState({[h]:{...this.state[h], feedStreams}});
                        let node = h === "preview" ? "remoteVideo" : "programVideo";
                        let remotevideo = this.refs[node + feed];
                        Janus.attachMediaStream(remotevideo, stream);
                    } else {
                        Janus.log("Created remote data channel");
                    }
                },
                ondataopen: (data) => {
                    Janus.log("The DataChannel is available!(feed)");
                },
                ondata: (data) => {
                    Janus.debug("We got data from the DataChannel! (feed) " + data);
                    let msg = JSON.parse(data);
                    this.onRoomData(msg);
                    Janus.log(" :: We got msg via DataChannel: ",msg)
                },
                oncleanup: () => {
                    Janus.log(" ::: Got a cleanup notification (remote feed) :::");
                }
            });
    };

    subscribeTo = (h, subscription) => {
        // New feeds are available, do we need create a new plugin handle first?
        if (this.state[h].remoteFeed) {
            this.state[h].remoteFeed.send({message:
                    {request: "subscribe", streams: subscription}
            });
            return;
        }
        // We don't have a handle yet, but we may be creating one already
        if (this.state[h].creatingFeed) {
            // Still working on the handle
            setTimeout(() => {
                this.subscribeTo(h, subscription);
            }, 500);
        } else {
            // We don't creating, so let's do it
            this.setState({[h]: {...this.state[h], creatingFeed: true}});
            this.newRemoteFeed(h, subscription);
        }
    };

    unsubscribeFrom = (h, id) => {
        // Unsubscribe from this publisher
        let {feeds,users,feedStreams} = this.state[h];
        let {questions,questions_queue} = this.state;
        let {remoteFeed} = this.state[h];
        for (let i=0; i<feeds.length; i++) {
            if (feeds[i].id === id) {
                Janus.log("Feed " + feeds[i] + " (" + id + ") has left the room, detaching");
                //TODO: remove mids
                delete users[feeds[i].display.id];
                delete feedStreams[id];
                if(questions[feeds[i].display.id]) {
                    delete questions[feeds[i].display.id];
                    this.setState({questions});
                    for(let q = 0; q < questions_queue.length; q++){
                        if(questions_queue[q].user.id === feeds[i].display.id) {
                            questions_queue.splice(q, 1);
                            this.setState({questions_queue});
                            break
                        }
                    }
                }
                feeds.splice(i, 1);
                // Send an unsubscribe request
                let unsubscribe = {
                    request: "unsubscribe",
                    streams: [{ feed: id }]
                };
                if(remoteFeed !== null)
                    remoteFeed.send({ message: unsubscribe });
                this.setState({[h]:{...this.state[h], feeds,users,feedStreams}});
                break
            }
        }
    };

    onProtocolData = (data) => {
        let {questions,questions_queue} = this.state;
        if(data.type === "question" && data.status) {
            questions[data.user.id] = data.user;
            questions_queue.push(data);
            this.setState({questions_queue,questions});
        } else if(data.type === "question" && !data.status) {
            if(questions[data.user.id]) {
                delete questions[data.user.id];
                this.setState({questions});
            }
            for(let i=0; i<questions_queue.length; i++) {
                if(questions_queue[i].user.id === data.user.id) {
                    questions_queue.splice(i, 1);
                    this.setState({questions_queue});
                    break
                }
            }
        } else if(data.type === "sound-test") {
            let {users} = this.state;
            if(users[data.id]) {
                users[data.id].sound_test = true;
                this.setState({users});
            } else {
                users[data.id] = {sound_test: true};
                this.setState({users});
            }
        }

        let {preview,program} = this.state;
        if (data.type === "question" && data.room === preview.room) {
            let rfid = preview.users[data.user.id].rfid;
            for (let i = 0; i < preview.feeds.length; i++) {
                if (preview.feeds[i].id === rfid) {
                    preview.feeds[i].question = data.status;
                    this.setState({preview: {...preview}});
                    break
                }
            }
        }

        if (data.type === "question" && data.room === program.room) {
            let rfid = program.users[data.user.id].rfid;
            for (let i = 0; i < program.feeds.length; i++) {
                if (program.feeds[i].id === rfid) {
                    program.feeds[i].question = data.status;
                    this.setState({program: {...program}});
                    break
                }
            }

        }
    };

    initVideoRoom = (roomid, h) => {
        if(this.state[h] && this.state[h].videoroom)
            this.state[h].videoroom.detach();
        if(this.state[h] && this.state[h].remoteFeed)
            this.state[h].remoteFeed.detach();
        this.state.janus.attach({
            plugin: "janus.plugin.videoroom",
            opaqueId: "preview_shidur",
            success: (videoroom) => {
                Janus.log(videoroom,this.state[h]);
                // hdl.room = roomid;
                this.setState({[h]: {...this.state[h], videoroom, remoteFeed: null}});
                Janus.log("Plugin attached! (" + videoroom.getPlugin() + ", id=" + videoroom.getId() + ")", this.state[h]);
                Janus.log("  -- This is a publisher/manager");
                let {user} = this.state;

                if(roomid) {
                    let register = { "request": "join", "room": roomid, "ptype": "publisher", "display": JSON.stringify(user) };
                    videoroom.send({"message": register});
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
                this.onMessage(h, msg, jsep, false);
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

    onMessage = (h, msg, jsep, initdata) => {
        Janus.log(" ::: Got a message (publisher) :::");
        Janus.log(msg);
        let event = msg["videoroom"];
        if(event !== undefined && event !== null) {
            if(event === "joined") {
                // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
                let myid = msg["id"];
                let mypvtid = msg["private_id"];
                this.setState({myid ,mypvtid});
                Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    let feeds = list.filter(feeder => JSON.parse(feeder.display).role === "user");
                    let {feedStreams,users} = this.state[h];
                    Janus.log(":: Got Pulbishers list: ", feeds);
                    Janus.debug("Got a list of available publishers/feeds:");
                    let subscription = [];
                    for(let f in feeds) {
                        let id = feeds[f]["id"];
                        let display = JSON.parse(feeds[f]["display"]);
                        //let talk = feeds[f]["talking"];
                        let streams = feeds[f]["streams"];
                        feeds[f].display = display;
                        feeds[f].question = this.state.questions[display.id] !== undefined;
                        let subst = {feed: id};
                        for (let i in streams) {
                            let stream = streams[i];
                            stream["id"] = id;
                            stream["display"] = display;
                            if(stream.type === "video") {
                                subst.mid = stream.mid;
                            }
                        }
                        feedStreams[id] = {id, display, streams};
                        users[display.id] = display;
                        users[display.id].rfid = id;
                        subscription.push(subst);
                    }
                    this.setState({[h]:{...this.state[h], feeds,feedStreams,users}});
                    if(subscription.length > 0)
                        this.subscribeTo(h, subscription);
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
                // Any info on our streams or a new feed to attach to?
                let {feedStreams,user,myid} = this.state;
                if(msg["streams"] !== undefined && msg["streams"] !== null) {
                    let streams = msg["streams"];
                    for (let i in streams) {
                        let stream = streams[i];
                        stream["id"] = myid;
                        stream["display"] = user;
                    }
                    feedStreams[myid] = {id: myid, display: user, streams: streams};
                    this.setState({feedStreams})
                } else if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let feed = msg["publishers"];
                    let {feeds,feedStreams,users} = this.state[h];
                    Janus.debug("Got a list of available publishers/feeds:");
                    let subscription = [];
                    for(let f in feed) {
                        let id = feed[f]["id"];
                        let display = JSON.parse(feed[f]["display"]);
                        if(display.role !== "user")
                            return;
                        //let talk = feed[f]["talking"];
                        let streams = feed[f]["streams"];
                        feed[f].display = display;
                        let subst = {feed: id};
                        for (let i in streams) {
                            let stream = streams[i];
                            stream["id"] = id;
                            stream["display"] = display;
                            if(stream.type === "video") {
                                subst.mid = stream.mid;
                            }
                        }
                        feedStreams[id] = {id, display, streams};
                        users[display.id] = display;
                        users[display.id].rfid = id;
                        subscription.push(subst);
                    }
                    feeds.push(feed[0]);
                    this.setState({ [h]:{...this.state[h], feeds,feedStreams,users}});
                    if(subscription.length > 0)
                        this.subscribeTo(h, subscription);
                } else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
                    // One of the publishers has gone away?
                    var leaving = msg["leaving"];
                    Janus.log("Publisher left: " + leaving);
                    this.unsubscribeFrom(h, leaving);

                } else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                    let unpublished = msg["unpublished"];
                    Janus.log("Publisher left: " + unpublished);
                    if(unpublished === 'ok') {
                        // That's us
                        this.state[h].videoroom.hangup();
                        return;
                    }
                    this.unsubscribeFrom(h, unpublished);

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
            this.state[h].videoroom.handleRemoteJsep({jsep: jsep});
        }
    };

    attachToPreview = (group, index) => {
        let room = group.room;
        let name = group.description;
        let h = "preview";
        if(this.state.preview.room === room)
            return;
        let leave_room = {request : "leave", "room": this.state.preview.room};
        this.state.preview.videoroom.send({"message": leave_room});
        Janus.log(" :: Attaching to Preview: ",group);
        this.setState({[h]:{...this.state[h], feeds: [], room, name, index}});
        this.initVideoRoom(room, "preview");
    };

    attachToProgram = () => {
        const {room, name, index} = this.state.preview;
        let h = "program";
        if(this.state.program.room === room)
            return;
        let leave_room = {request : "leave", "room": this.state.program.room};
        this.state.program.videoroom.send({"message": leave_room});
        let state = {room, name, index};
        this.setState({[h]:{...this.state[h], room, name, state}});
        this.initVideoRoom(room, "program");

        // Save state
        putData(`state/galaxy/pr4`, state, (cb) => {
            Janus.log(":: Save to state: ",cb);
        });

        // Select next group
        let {rooms,group} = this.state;
        let i = rooms.length-1 < group.index+1 ? 0 :  group.index+1;
        this.selectGroup(rooms[i], i)
    };

    selectGroup = (group, i) => {
        group.index = i;
        this.setState({group});
        Janus.log(group);
        this.attachToPreview(group, i);
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
      const {program,preview,disabled_rooms,rooms,questions_queue,users} = this.state;
      const width = "400";
      const height = "300";
      const autoPlay = true;
      const controls = false;
      const muted = true;
      const q = (<b style={{color: 'red', fontSize: '20px', fontFamily: 'Verdana', fontWeight: 'bold'}}>?</b>);

      let rooms_list = rooms.map((data,i) => {
          const {room, num_participants, description} = data;
          let chk = questions_queue.filter(q => q.room === room);
          return (
              <Table.Row negative={program.name === description}
                         positive={preview.name === description}
                         disabled={num_participants === 0}
                         className={preview.room === room ? 'active' : 'no'}
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

      let program_feeds = program.feeds.map((feed) => {
          if(feed) {
              let id = feed.id;
              let talk = feed.talk;
              let question = feed.question;
              let st = users[feed.display.id] && users[feed.display.id].sound_test;
              return (<div className="video"
                           key={"prov" + id}
                           ref={"provideo" + id}
                           id={"provideo" + id}>
                  <div className={classNames('video__overlay', {'talk' : talk})}>
                      {question ? <div className="question">
                          <svg viewBox="0 0 50 50">
                              <text x="25" y="25" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">&#xF128;</text>
                          </svg>
                          {st ? <Icon name="checkmark" size="small" color="green"/> : ''}
                      </div>:''}
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

      let preview_feeds = preview.feeds.map((feed) => {
          if(feed) {
              let id = feed.id;
              let talk = feed.talk;
              let question = feed.question;
              let st = users[feed.display.id] && users[feed.display.id].sound_test;
              return (<div className="video"
                           key={"prev" + id}
                           ref={"prevideo" + id}
                           id={"prevideo" + id}>
                  <div className={classNames('video__overlay', {'talk' : talk})}>
                      {question ? <div className="question">
                          <svg viewBox="0 0 50 50">
                              <text x="25" y="25" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">&#xF128;</text>
                          </svg>
                          {st ? <Icon name="checkmark" size="small" color="green"/> : ''}
                      </div>:''}
                  </div>
                  <video className={talk ? "talk" : ""}
                         key={id}
                         ref={"remoteVideo" + id}
                         id={"remoteVideo" + id}
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
              <div className="shidur_overlay"><span>{program.name}</span></div>
              <div className="videos-panel">
                  <div className="videos">
                      <div className="videos__wrapper">{program_feeds}</div>
                  </div>
              </div>
          </Segment>

          <Segment className="preview_segment" color='green' onClick={this.attachToProgram} >
              <div className="shidur_overlay"><span>{preview.name}</span></div>
              <div className="videos-panel">
                  <div className="videos">
                      <div className="videos__wrapper">{preview_feeds}</div>
                  </div>
              </div>
          </Segment>

          <Segment textAlign='center' className="users_list" raised>
              <Table selectable compact='very' basic structured className="admin_table" unstackable>
                  <Table.Body>
                      {rooms_list}
                  </Table.Body>
              </Table>
          </Segment>
            <Segment textAlign='center' className="disabled_users">
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

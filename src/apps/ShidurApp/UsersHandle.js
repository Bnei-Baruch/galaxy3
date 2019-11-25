import React, {Component, Fragment} from 'react';
import './UsersHandle.scss'
import { Janus } from "../../lib/janus";
import {Segment, Icon} from "semantic-ui-react";
import {putData} from "../../shared/tools";
import classNames from "classnames";

class UsersHandle extends Component {

    state = {
        janus: null,
        rooms: [],
        index: 0,
        disabled_rooms: [],
        group: null,
        program: {feeds: [], feedStreams: {}, mids: [], name: "", room: "", users: {}},
        protocol: null,
        myid: null,
        mypvtid: null,
        mystream: null,
        audio: null,
        muted: true,
        users: {},
    };

    componentDidMount() {
        // setTimeout(() => {
        //     this.initVideoRoom(1051, "program")
        // }, 3000);
    };

    componentWillUnmount() {
    };

    initVideoRoom = (roomid, h) => {
        if(this.state[h] && this.state[h].videoroom) {
            let leave_room = {request : "leave", "room": this.state.program.room};
            this.state.program.videoroom.send({"message": leave_room});
            this.state[h].videoroom.detach();
        }
        if(this.state[h] && this.state[h].remoteFeed)
            this.state[h].remoteFeed.detach();
        this.props.janus.attach({
            plugin: "janus.plugin.videoroom",
            opaqueId: "preview_shidur",
            success: (videoroom) => {
                Janus.log(videoroom,this.state[h]);
                this.setState({[h]: {...this.state[h], room: roomid, videoroom, remoteFeed: null}});
                Janus.log("Plugin attached! (" + videoroom.getPlugin() + ", id=" + videoroom.getId() + ")", this.state[h]);
                Janus.log("  -- This is a publisher/manager");
                let {user} = this.props;

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

    exitVideoRoom = (roomid, h) => {
        if(this.state[h] && this.state[h].videoroom) {
            let leave_room = {request : "leave", "room": roomid};
            this.state.program.videoroom.send({"message": leave_room});
            this.state[h].videoroom.detach();
        }
        if(this.state[h] && this.state[h].remoteFeed)
            this.state[h].remoteFeed.detach();
        this.setState({[h]:{...this.state[h], feeds: []}});
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
                    let {feedStreams} = this.state[h];
                    let {users} = this.props;
                    Janus.log(":: Got Pulbishers list: ", feeds);
                    Janus.debug("Got a list of available publishers/feeds:");
                    let subscription = [];
                    for(let f in feeds) {
                        let id = feeds[f]["id"];
                        let display = JSON.parse(feeds[f]["display"]);
                        //let talk = feeds[f]["talking"];
                        let streams = feeds[f]["streams"];
                        feeds[f].display = display;
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
                        users[display.id] = {...display, ...users[display.id], rfid: id};
                        subscription.push(subst);
                    }
                    this.setState({[h]:{...this.state[h], feeds,feedStreams,users}});
                    if(subscription.length > 0) {
                        this.props.setProps({users});
                        this.subscribeTo(h, subscription);
                    }
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
                    let {feeds,feedStreams} = this.state[h];
                    let {users} = this.props;
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
                        users[display.id] = {...display, ...users[display.id], rfid: id};
                        subscription.push(subst);
                    }
                    feeds.push(feed[0]);
                    this.setState({ [h]:{...this.state[h], feeds,feedStreams,users}});
                    if(subscription.length > 0) {
                        this.subscribeTo(h, subscription);
                        this.props.setProps({users});
                    }
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

    newRemoteFeed = (h, subscription) => {
        this.props.janus.attach(
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
                    Janus.debug(" ::: Got a remote track event ::: (remote feed)");
                    Janus.debug("Remote track (mid=" + mid + ") " + (on ? "added" : "removed") + ":", track);
                    // Which publisher are we getting on this mid?
                    let {mids,feedStreams} = this.state[h];
                    let feed = mids[mid].feed_id;
                    Janus.debug(" >> This track is coming from feed " + feed + ":", mid);
                    // If we're here, a new track was added
                    if(track.kind === "video" && on) {
                        // New video track: create a stream out of it
                        let stream = new MediaStream();
                        stream.addTrack(track.clone());
                        Janus.log("Created remote video stream:", stream);
                        feedStreams[feed].stream = stream;
                        this.setState({[h]:{...this.state[h], feedStreams}});
                        let node = h === "program" ? "pv" : "program0" ? "pv0" : "program1" ? "pv1" : "program2" ? "pv2" : "program3" ? "pv3" : "";
                        let remotevideo = this.refs[node + feed];
                        Janus.attachMediaStream(remotevideo, stream);
                    }
                },
                ondataopen: (data) => {
                    Janus.log("The DataChannel is available!(feed)");
                },
                ondata: (data) => {
                    Janus.debug("We got data from the DataChannel! (feed) " + data);
                    // let msg = JSON.parse(data);
                    // this.onRoomData(msg);
                    // Janus.log(" :: We got msg via DataChannel: ",msg)
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
        let {remoteFeed} = this.state[h];
        for (let i=0; i<feeds.length; i++) {
            if (feeds[i].id === id) {
                Janus.log("Feed " + feeds[i] + " (" + id + ") has left the room, detaching");
                delete users[feeds[i].display.id];
                delete feedStreams[id];

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

    attachToPreview = (group, index) => {
        let room = group.room;
        let name = group.description;
        let h = "preview";
        if(this.state.preview.room === room)
            return;
        if(this.state.preview.videoroom) {
            let leave_room = {request : "leave", "room": this.state.preview.room};
            this.state.preview.videoroom.send({"message": leave_room});
        }
        Janus.log(" :: Attaching to Preview: ",group);
        this.setState({[h]:{...this.state[h], feeds: [], room, name, index}});
        this.initVideoRoom(room, "preview");
    };

    attachToProgram = () => {
        const {room, name, index} = this.state.program;
        let h = "program";
        if(this.state.program.room === room)
            return;
        if(this.state.program.videoroom) {
            let leave_room = {request : "leave", "room": this.state.program.room};
            this.state.program.videoroom.send({"message": leave_room});
        }
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


  render() {
      const {program} = this.state;
      const {users} = this.props;
      const width = "400";
      const height = "300";
      const autoPlay = true;
      const controls = false;
      const muted = true;
      const q = (<b style={{color: 'red', fontSize: '20px', fontFamily: 'Verdana', fontWeight: 'bold'}}>?</b>);

      let program_feeds = program.feeds.map((feed) => {
          if(feed) {
              let id = feed.id;
              let talk = feed.talk;
              let question = users[feed.display.id] && users[feed.display.id].question;
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
                         ref={"pv" + id}
                         id={"pv" + id}
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


          
          <Fragment>
              <div className="videos-panel">
                  <div className="videos">
                      <div className="videos__wrapper">
                          {program_feeds}
                      </div>
                  </div>
              </div>
          </Fragment>

    );
  }
}

export default UsersHandle;

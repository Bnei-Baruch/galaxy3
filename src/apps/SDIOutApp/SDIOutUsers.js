import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Segment} from "semantic-ui-react";
import {getState, initJanus} from "../../shared/tools";
import './SDIOutUsers.css';
import './VideoConteiner.scss'
import {initGxyProtocol} from "../../shared/protocol";
import classNames from "classnames";

class SDIOutUsers extends Component {

    state = {
        devices: [],
        protocol: null,
        program: {room: null, name: ""},
        janus: null,
        feeds: [],
        feedStreams: {},
        mids: [],
        rooms: [],
        room: "",
        videoroom: null,
        remotefeed: null,
        myid: null,
        mypvtid: null,
        mystream: null,
        audio: null,
        muted: true,
        question: false,
        user: {
            session: 0,
            handle: 0,
            role: "sdiout",
            display: "sdiout",
            id: Janus.randomString(10),
            name: "sdiout"
        },
        users: {},
    };

    componentDidMount() {
        initJanus(janus => {
            let {user} = this.state;
            user.session = janus.getSessionId();
            this.setState({janus,user});
            this.initVideoRoom();

            initGxyProtocol(janus, user, protocol => {
                this.setState({protocol});
            }, ondata => {
                Janus.log("-- :: It's protocol public message: ", ondata);
                this.onProtocolData(ondata);
            });
        }, er => {}, true);
        setInterval(() => getState('state/galaxy/pr4', (program) => {
            //Janus.log(" :: Get State: ", program);
            if(JSON.stringify(program) !== JSON.stringify(this.state.program)) {
                this.setState({program});
                this.attachToPreview(program.room);
            }
        }), 1000 );
    };

    componentWillUnmount() {
        this.state.janus.destroy();
    };

    onProtocolData = (data) => {
        //TODO: Need to add transaction handle (filter and acknowledge)
        let {room,users,feedStreams} = this.state;

        // Set status in users list
        if(data.type.match(/^(camera|question)$/)) {
            if(users[data.user.id]) {
                users[data.user.id][data.type] = data.status;
                this.setState({users});
            } else {
                users[data.user.id] = {[data.type]: data.status};
                this.setState({users});
            }
        }

        // User is turn on his camera we can show him
        if(data.type === "camera" && users[data.user.id] && room === data.room && data.status) {
            let rfid = users[data.user.id].rfid;
            let remotevideo = this.refs["remoteVideo" + rfid];
            Janus.attachMediaStream(remotevideo, feedStreams[rfid].stream);
        }
    };

    initVideoRoom = (roomid) => {
        if(this.state.videoroom)
            this.state.videoroom.detach();
        if(this.state.remoteFeed)
            this.state.remoteFeed.detach();
        this.state.janus.attach({
            plugin: "janus.plugin.videoroom",
            opaqueId: "videoroom_sdiout",
            success: (videoroom) => {
                this.setState({videoroom, remoteFeed: null});
                Janus.log("Plugin attached! (" + videoroom.getPlugin() + ", id=" + videoroom.getId() + ")");
                Janus.log("  -- This is a publisher/manager");
                let {user} = this.state;
                if(roomid) {
                    let register = { "request": "join", "room": roomid, "ptype": "publisher", "display": JSON.stringify(user) };
                    videoroom.send({"message": register});
                } else {
                    videoroom.send({"message": { "request":"list" },
                        success: (data) => {
                            Janus.log(" :: Got list of all rooms: ",data);
                            this.setState({rooms: data.list});
                        }
                    });
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
                this.onMessage(this.state.videoroom, msg, jsep, false);
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

    newRemoteFeed = (subscription) => {
        this.state.janus.attach(
            {
                plugin: "janus.plugin.videoroom",
                opaqueId: "remotefeed_user",
                success: (pluginHandle) => {
                    let remoteFeed = pluginHandle;
                    Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
                    Janus.log("  -- This is a multistream subscriber",remoteFeed);
                    this.setState({remoteFeed, creatingFeed: false});
                    // We wait for the plugin to send us an offer
                    let subscribe = {request: "join", room: this.state.room, ptype: "subscriber", streams: subscription};
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
                        let {mids} = this.state;
                        for(let i in msg["streams"]) {
                            let mindex = msg["streams"][i]["mid"];
                            //let feed_id = msg["streams"][i]["feed_id"];
                            mids[mindex] = msg["streams"][i];
                        }
                        this.setState({mids});
                    }
                    if(jsep !== undefined && jsep !== null) {
                        Janus.debug("Handling SDP as well...");
                        Janus.debug(jsep);
                        // Answer and attach
                        this.state.remoteFeed.createAnswer(
                            {
                                jsep: jsep,
                                // Add data:true here if you want to subscribe to datachannels as well
                                // (obviously only works if the publisher offered them in the first place)
                                media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
                                success: (jsep) => {
                                    Janus.debug("Got SDP!");
                                    Janus.debug(jsep);
                                    let body = { request: "start", room: this.state.room };
                                    this.state.remoteFeed.send({ message: body, jsep: jsep });
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
                    let {mids,feedStreams} = this.state;
                    let feed = mids[mid].feed_id;
                    Janus.log(" >> This track is coming from feed " + feed + ":", mid);
                    // If we're here, a new track was added
                    if(track.kind === "video" && on) {
                        // New video track: create a stream out of it
                        let stream = new MediaStream();
                        stream.addTrack(track.clone());
                        Janus.log("Created remote video stream:", stream);
                        feedStreams[feed].stream = stream;
                        this.setState({feedStreams});
                        let remotevideo = this.refs["remoteVideo" + feed];
                        Janus.attachMediaStream(remotevideo, stream);
                    }
                },
                ondataopen: (data) => {
                    Janus.log("The DataChannel is available!(feed)");
                },
                ondata: (data) => {
                    Janus.debug("We got data from the DataChannel! (feed) " + data);
                },
                oncleanup: () => {
                    Janus.log(" ::: Got a cleanup notification (remote feed) :::");
                }
            });
    };


    subscribeTo = (subscription) => {
        // New feeds are available, do we need create a new plugin handle first?
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
            return
        }

        // We don't creating, so let's do it
        this.setState({creatingFeed: true});
        this.newRemoteFeed(subscription);
    };

    unsubscribeFrom = (id) => {
        // Unsubscribe from this publisher
        let {feeds,users,feedStreams} = this.state;
        let {remoteFeed} = this.state;
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
                this.setState({feeds,users,feedStreams});
                break
            }
        }
    };

    publishOwnFeed = (useAudio) => {
        // Publish our stream
        let {videoroom} = this.state;

        videoroom.createOffer(
            {
                // Add data:true here if you want to publish datachannels as well
                //media: { audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: true, video: "lowres" },	// Publishers are sendonly
                media: { audioRecv: false, videoRecv: false, audioSend: useAudio, videoSend: true },	// Publishers are sendonly
                // If you want to test simulcasting (Chrome and Firefox only), then
                // pass a ?simulcast=true when opening this demo page: it will turn
                // the following 'simulcast' property to pass to janus.js to true
                simulcast: false,
                success: (jsep) => {
                    Janus.debug("Got publisher SDP!");
                    Janus.debug(jsep);
                    let publish = { "request": "configure", "audio": useAudio, "video": true };
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

    onMessage = (videoroom, msg, jsep, initdata) => {
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
                    let {feedStreams,users} = this.state;
                    let list = msg["publishers"];

                    // Filter service and camera muted feeds
                    let feeds = list.filter(feeder => JSON.parse(feeder.display).role === "user");

                    Janus.log(":: Got Pulbishers list: ", feeds);
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.log(list);
                    let subscription = [];
                    for(let f in feeds) {
                        let id = feeds[f]["id"];
                        let display = JSON.parse(feeds[f]["display"]);
                        let talk = feeds[f]["talking"];
                        let streams = feeds[f]["streams"];
                        feeds[f].display = display;
                        feeds[f].talk = talk;
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
                        users[display.id] = {...users[display.id],...display,rfid: id};
                        subscription.push(subst);
                    }
                    this.setState({feeds,feedStreams,users});
                    if(subscription.length > 0)
                        this.subscribeTo(subscription);
                }
            } else if(event === "talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                Janus.log("User: "+id+" - start talking");
                for(let i=0; i<feeds.length; i++) {
                    if(feeds[i] && feeds[i].id === id) {
                        feeds[i].talk = true;
                        this.setState({feeds});
                    }
                }
            } else if(event === "stopped-talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                Janus.log("User: "+id+" - stop talking");
                for(let i=0; i<feeds.length; i++) {
                    if(feeds[i] && feeds[i].id === id) {
                        feeds[i].talk = false;
                        this.setState({feeds});
                    }
                }
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
                    let {feeds,feedStreams,users} = this.state;
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.log(feed);
                    let subscription = [];
                    for(let f in feed) {
                        let id = feed[f]["id"];
                        let display = JSON.parse(feed[f]["display"]);
                        if(display.role !== "user")
                            return;
                        //let talk = feed[f]["talking"];
                        let streams = feed[f]["streams"];
                        feed[f].display = display;
                        //feeds[f].talk = talk;
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
                        users[display.id] = {...users[display.id],...display,rfid: id};
                        subscription.push(subst);
                    }
                    feeds.push(feed[0]);
                    this.setState({feeds,feedStreams,users});
                    if(subscription.length > 0)
                        this.subscribeTo(subscription);
                } else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
                    // One of the publishers has gone away?
                    var leaving = msg["leaving"];
                    Janus.log("Publisher left: " + leaving);
                    this.unsubscribeFrom(leaving);

                } else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                    let unpublished = msg["unpublished"];
                    Janus.log("Publisher left: " + unpublished);
                    if(unpublished === 'ok') {
                        // That's us
                        videoroom.hangup();
                        return;
                    }
                    this.unsubscribeFrom(unpublished);

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
            videoroom.handleRemoteJsep({jsep: jsep});
        }
    };

    attachToPreview = (room) => {
        if(this.state.room === room)
            return;
        Janus.log(" :: Attaching to Preview: ",room);
        if(this.state.videoroom) {
            let leave_room = {request : "leave", "room": this.state.room};
            this.state.videoroom.send({"message": leave_room});
        }
        this.setState({feeds: [], room});
        this.initVideoRoom(room);
    };

  render() {
      const { users } = this.state;
      const { name } = this.state.program;
      const width = "400";
      const height = "300";
      const autoPlay = true;
      const controls = false;
      const muted = true;

      let questions = this.state.feeds.find(p => users[p.display.id] ? users[p.display.id].question : null);

      let preview = this.state.feeds.map((feed) => {
          let camera = users[feed.display.id] && users[feed.display.id].camera !== false;
          if(feed && camera) {
              let id = feed.id;
              let talk = feed.talk;
              return (<div className="video"
                  key={"v" + id}
                  ref={"video" + id}
                  id={"video" + id}>
                  <div className={classNames('video__overlay', {'talk' : talk})}>
                      {/*{question ? <div className="question"><Icon name="question circle" size="massive"/></div>:''}*/}
                      {/*<div className="video__title">{!talk ? <Icon name="microphone slash" size="small" color="red"/> : ''}{name}</div>*/}
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
          <div>
          <Segment className="preview_sdi">
              <div className="videos-panel">
                  <div className="title"><span>{name}</span></div>
                  {questions ? <div className='qst_users'>?</div> : ""}
                  <div className="videos">
                      <div className="videos__wrapper">{preview}</div>
                  </div>
              </div>
          </Segment>
          </div>
      );
  }
}

export default SDIOutUsers;

import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Icon, Segment} from "semantic-ui-react";
import {getState, initJanus} from "../../shared/tools";
import './SDIOutUsers.css';
import './VideoConteiner.scss'
import {MAX_FEEDS} from "../../shared/consts";
import {initGxyProtocol} from "../../shared/protocol";
import classNames from "classnames";

class SDIOutUsers extends Component {

    state = {
        devices: [],
        questions: {},
        cammuteds: {},
        protocol: null,
        program: {room: null, name: ""},
        janus: null,
        feeds: [],
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
                //this.props.setProps({protocol});
            }, ondata => {
                Janus.log("-- :: It's protocol public message: ", ondata);
                this.onProtocolData(ondata);
            });
        }, er => {});
        setInterval(() => getState('state/galaxy/pr5', (program) => {
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
        let {room,feeds,users,user,cammuteds,questions} = this.state;
        if(data.type === "camera" && !data.status) {
            cammuteds[data.user.id] = data.user;
            this.setState({cammuteds});
        } else if(data.type === "camera" && data.status) {
            let {cammuteds} = this.state;
            if(cammuteds[data.user.id]) {
                delete cammuteds[data.user.id];
                this.setState({cammuteds});
            }
            if(room === data.room && users[data.user.id]) {
                let chk = feeds.filter(f => {
                    return (f !== null && f !== undefined && f.rfid === users[data.user.id].rfid)
                });
                if(chk.length === 0)
                    this.newRemoteFeed(users[data.user.id].rfid, false);
            }
        }
        if(data.type === "question" && data.status) {
            questions[data.user.id] = data.user;
            this.setState({questions});
        } else if(data.type === "question" && !data.status) {
            let {questions} = this.state;
            if(questions[data.user.id]) {
                delete questions[data.user.id];
                this.setState({questions});
            }
        }
        if (data.type === "question" && data.status && data.room === room && user.id !== data.user.id) {
            let rfid = users[data.user.id].rfid;
            for (let i = 1; i < feeds.length; i++) {
                if (feeds[i] !== null && feeds[i] !== undefined && feeds[i].rfid === rfid) {
                    feeds[i].question = true;
                    break
                }
            }
            this.setState({feeds});
        } else if (data.type === "question" && !data.status && data.room === room && user.id !== data.user.id) {
            let rfid = users[data.user.id].rfid;
            for (let i = 1; i < feeds.length; i++) {
                if (feeds[i] !== null && feeds[i] !== undefined && feeds[i].rfid === rfid) {
                    feeds[i].question = false;
                    break
                }
            }
            this.setState({feeds});
        }

    };

    initVideoRoom = (roomid) => {
        if(this.state.videoroom)
            this.state.videoroom.detach();
        this.state.janus.attach({
            plugin: "janus.plugin.videoroom",
            opaqueId: "videoroom_sdiout",
            success: (videoroom) => {
                Janus.log(videoroom);
                let {user} = this.state;
                this.setState({videoroom,user});
                Janus.log("Plugin attached! (" + videoroom.getPlugin() + ", id=" + videoroom.getId() + ")");
                Janus.log("  -- This is a publisher/manager");

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
                Janus.debug(" ::: Got a local stream :::");
            },
            onremotestream: (stream) => {
                // The publisher stream is sendonly, we don't expect anything here
            },
            ondataopen: (data) => {
                Janus.log("The DataChannel is available!(publisher)");
            },
            ondata: (data) => {
                Janus.debug("We got data from the DataChannel! (publisher) " + data);
            },
            oncleanup: () => {
                Janus.log(" ::: Got a cleanup notification: we are unpublished now :::");
            }
        });
    };

    newRemoteFeed = (id, talk) => {
        // A new feed has been published, create a new plugin handle and attach to it as a subscriber
        var remoteFeed = null;
        this.state.janus.attach(
            {
                plugin: "janus.plugin.videoroom",
                opaqueId: "remotefeed_sdiout",
                success: (pluginHandle) => {
                    remoteFeed = pluginHandle;
                    remoteFeed.simulcastStarted = false;
                    //this.setState({remotefeed});
                    Janus.log("Plugin attached! (" + remoteFeed.getPlugin() + ", id=" + remoteFeed.getId() + ")");
                    Janus.log("  -- This is a subscriber");
                    // We wait for the plugin to send us an offer
                    let listen = { "request": "join", "room": this.state.room, "ptype": "subscriber", "feed": id, "private_id": this.state.mypvtid };
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
                                if(feeds[i] === undefined || feeds[i] === null) {
                                    remoteFeed.rfindex = i;
                                    remoteFeed.rfid = msg["id"];
                                    remoteFeed.rfuser = JSON.parse(msg["display"]);
                                    remoteFeed.rfuser.rfid = msg["id"];
                                    if(questions[remoteFeed.rfuser.id]) {
                                        remoteFeed.question = true;
                                    }
                                    remoteFeed.talk = talk;
                                    feeds[i] = remoteFeed;
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
                                }
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
                                media: { audioSend: false, videoSend: false, data: true },	// We want recvonly audio/video
                                success: (jsep) => {
                                    Janus.debug("Got SDP!");
                                    Janus.debug(jsep);
                                    let body = { "request": "start", "room": this.state.room };
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
                    Janus.debug("Remote feed #" + remoteFeed.rfindex);
                    let remotevideo = this.refs["remoteVideo" + remoteFeed.rfid];
                    Janus.attachMediaStream(remotevideo, stream);
                    var videoTracks = stream.getVideoTracks();
                    if(videoTracks === null || videoTracks === undefined || videoTracks.length === 0) {
                        // No remote video
                    } else {
                        // Yes remote video
                    }
                },
                ondataopen: (data) => {
                    Janus.log("The DataChannel is available!(feed)");
                },
                ondata: (data) => {
                    Janus.debug("We got data from the DataChannel! (feed) " + data);
                    let msg = JSON.parse(data);
                    this.onRoomData(msg);
                },
                oncleanup: () => {
                    Janus.log(" ::: Got a cleanup notification (remote feed " + id + ") :::");
                }
            });
    };

    onRoomData = (data) => {
        let {feeds,users} = this.state;
        let rfid = users[data.id].rfid;
        let camera = data.camera;
        // let remotevideo = this.refs["video" + rfid];
        // remotevideo.remove();
        if(camera === false) {
            for (let i = 1; i < feeds.length; i++) {
                if (feeds[i] !== null && feeds[i] !== undefined && feeds[i].rfid === rfid) {
                    let feed = feeds[i];
                    feeds[i] = null;
                    feed.detach();
                    this.setState({feeds});
                    break
                }
            }
        }
        // for(let i=1; i<feeds.length; i++) {
        //     if(feeds[i] !== null && feeds[i] !== undefined && feeds[i].rfid === rfid) {
        //         feeds[i].rfcam = camera;
        //         this.setState({feeds});
        //         break
        //     }
        // }
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
        Janus.debug(" ::: Got a message (publisher) :::");
        Janus.debug(msg);
        let event = msg["videoroom"];
        Janus.debug("Event: " + event);
        if(event !== undefined && event !== null) {
            if(event === "joined") {
                // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
                let myid = msg["id"];
                let mypvtid = msg["private_id"];
                const {cammuteds} = this.state;
                this.setState({myid ,mypvtid});
                Janus.log("Successfully joined room " + msg["room"] + " with ID " + myid);
                //this.publishOwnFeed(true);
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.debug(list);
                    for(let f in list) {
                        let id = list[f]["id"];
                        //let display = list[f]["display"];
                        let display = JSON.parse(list[f]["display"]);
                        let talk = list[f]["talking"];
                        let audio = list[f]["audio_codec"];
                        let video = list[f]["video_codec"];
                        Janus.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");
                        if(display.role === "user" && video && !cammuteds[display.id])
                            this.newRemoteFeed(id, talk);
                    }
                }
            } else if(event === "talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                //let room = msg["room"];
                Janus.log("User: "+id+" - start talking");
                for(let i=1; i<MAX_FEEDS; i++) {
                    if(feeds[i] !== null && feeds[i] !== undefined && feeds[i].rfid === id) {
                        feeds[i].talk = true;
                    }
                }
                this.setState({feeds});
            } else if(event === "stopped-talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                //let room = msg["room"];
                Janus.log("User: "+id+" - stop talking");
                for(let i=1; i<MAX_FEEDS; i++) {
                    if(feeds[i] !== null && feeds[i] !== undefined && feeds[i].rfid === id) {
                        feeds[i].talk = false;
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
                        //let display = list[f]["display"];
                        let display = JSON.parse(list[f]["display"]);
                        let audio = list[f]["audio_codec"];
                        let video = list[f]["video_codec"];
                        Janus.debug("  >> [" + id + "] " + display + " (audio: " + audio + ", video: " + video + ")");
                        if(display.role === "user" && video)
                            this.newRemoteFeed(id, false);
                    }
                } else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
                    // One of the publishers has gone away?
                    let {feeds} = this.state;
                    let leaving = msg["leaving"];
                    Janus.log("Publisher left: " + leaving);
                    let remoteFeed = null;
                    for(let i=1; i<MAX_FEEDS; i++) {
                        if(feeds[i] != null && feeds[i] !== undefined && feeds[i].rfid === leaving) {
                            remoteFeed = feeds[i];
                            break;
                        }
                    }
                    //let rf = feeds.filter(f => f.rfid === id)[0];
                    if(remoteFeed !== null) {
                        Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfuser + ") has left the room, detaching");
                        let remotevideo = this.refs["remoteVideo" + remoteFeed.rfid];
                        remotevideo.remove();
                        feeds[remoteFeed.rfindex] = null;
                        remoteFeed.detach();
                        this.setState({feeds});
                    }
                } else if(msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                    // One of the publishers has unpublished?
                    let {feeds} = this.state;
                    let unpublished = msg["unpublished"];
                    Janus.log("Publisher left: " + unpublished);
                    if(unpublished === 'ok') {
                        // That's us
                        videoroom.hangup();
                        return;
                    }
                    let remoteFeed = null;
                    for(let i=1; i<MAX_FEEDS; i++) {
                        if(feeds[i] != null && feeds[i] !== undefined && feeds[i].rfid === unpublished) {
                            remoteFeed = feeds[i];
                            break;
                        }
                    }
                    // let rf = feeds.filter(f => f.rfid === id)[0];
                    if(remoteFeed !== null) {
                        Janus.debug("Feed " + remoteFeed.rfid + " (" + remoteFeed.rfuser + ") has left the room, detaching");
                        let remotevideo = this.refs["remoteVideo" + remoteFeed.rfid];
                        remotevideo.remove();
                        feeds[remoteFeed.rfindex] = null;
                        remoteFeed.detach();
                        this.setState({feeds});
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
            videoroom.handleRemoteJsep({jsep: jsep});
        }
    };

    registerUsername = (room) => {
        const {videoroom} = this.state;
        let register = { "request": "join", "room": room, "ptype": "publisher", "display": "user_"+Janus.randomString(4) };
        videoroom.send({"message": register});
        this.setState({room});
    };

    attachToPreview = (room) => {
        const {feeds} = this.state;
        if (this.state.room === room)
            return;
        Janus.log(" :: Attaching to Preview: ", room);
        feeds.forEach(feed => {
            if (feed !== null && feed !== undefined) {
                Janus.log("-- :: Remove Feed: ",feed);
                feed.detach();
            }
        });
        this.setState({room, feeds: []});
        this.initVideoRoom(room);
    };


  render() {
      //Janus.log(" --- ::: RENDER ::: ---");
      const { name } = this.state.program;
      const width = "400";
      const height = "300";
      const autoPlay = true;
      const controls = false;
      const muted = true;

      let preview = this.state.feeds.map((feed) => {
          if(feed) {
              let id = feed.rfid;
              let talk = feed.talk;
              let rfcam = feed.rfcam;
              let question = feed.question;
              return (<div className="video"
                  key={"v" + id}
                  ref={"video" + id}
                  id={"video" + id}>
                  <div className={classNames('video__overlay', {'talk' : talk})}>
                      {question ? <div className="question"><Icon name="question circle" size="massive"/></div>:''}
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
          {/*<Segment className="segment_sdi" color='blue' raised>*/}
          <Segment className="preview_sdi" color='red'>
              <div className="videos-panel">
                  <div className="title"><span>{name}</span></div>
                  <div className="videos">
                      <div className="videos__wrapper">{preview}</div>
                  </div>
              </div>
          </Segment>
            {/*</Segment>*/}
          </div>
      );
  }
}

export default SDIOutUsers;

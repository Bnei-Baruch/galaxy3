import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Segment, Table, Icon, Dropdown, Dimmer, Button} from "semantic-ui-react";
import {getState, putData, initGXYJanus} from "../../shared/tools";
// import {initGxyProtocol} from "../shared/protocol";
import './ShidurGroups.css'

class ShidurGroups extends Component {

    state = {
        janus: null,
        feeds: [],
        gxyhandle: null,
        index: 0,
        name: "",
        disabled_groups: [],
        group: null,
        pr1: [],
        pre: null,
        program: null,
        pre_feed: null,
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
        zoom: false,
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
                }
            } else if(event === "talking") {
                let id = msg["id"];
                Janus.log("User: "+id+" - start talking");
            } else if(event === "stopped-talking") {
                let id = msg["id"];
                Janus.log("User: "+id+" - stop talking");
            } else if(event === "destroyed") {
                // The room has been destroyed
                Janus.warn("The room has been destroyed!");
            } else if(event === "event") {
                // Any new feed to attach to?
                if(msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    Janus.debug("Got a list of available publishers/feeds:");
                    Janus.debug(list[0]);
                    if(!/_/.test(list[0].display)) {
                        let {feeds} = this.state;
                        feeds.push(list[0]);
                        this.setState({feeds});
                    }
                } else if(msg["leaving"] !== undefined && msg["leaving"] !== null) {
                    // One of the publishers has gone away?
                    let leaving = msg["leaving"];
                    Janus.log("Publisher left: " + leaving);
                    this.removeFeed(leaving);
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
                        pr1[i] = pre;
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
        Janus.log(" :: Selected program Switch: ",i);
        let {pre_feed,feeds,pr1,pgm_state,feeds_queue} = this.state;

        //If someone in preview take him else take next in queue
        if(pre_feed) {
            let switchfeed = {"request": "switch", "feed": pre_feed.id, "audio": true, "video": true, "data": false};
            pr1[i].send ({"message": switchfeed,
                success: () => {
                    Janus.log(" :: Selected program Switch Feed to: ", pre_feed.display);
                    pgm_state[i] = pre_feed;
                    this.setState({program: pre_feed, pgm_state, pre_feed: null});
                }
            })
        } else {
            let feed = feeds[feeds_queue];
            pgm_state[i] = feed;
            this.switchNext(i, feed);
            feeds_queue++;
            if(feeds_queue >= feeds.length) {
                // End round here!
                feeds_queue = 0;
                Janus.log(" -- ROUND END --");
            }
            this.setState({feeds_queue, pgm_state, pre_feed: null});
        }

    };

    switchFour = () => {
        let {feeds_queue,pr1,feeds,pgm_state} = this.state;

        for(let i=0; i<4; i++) {

            if(feeds_queue >= feeds.length) {
                // End round here!
                feeds_queue = 0;
                this.setState({feeds_queue});
                Janus.log(" -- ROUND END --");
            }

            Janus.log("---------- i: "+i+" queue: "+feeds_queue);
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

    switchNext = (i ,feed) => {
        Janus.log(" :: switchNext params: ", i, feed);
        if(!feed) return;
        let {pr1,pgm_state} = this.state;
        if(!pr1[i]) {
            this.newSwitchFeed(feed.id,true,i);
            pgm_state[i] = feed;
            this.setState({pgm_state});
        } else {
            let switchfeed = {"request": "switch", "feed": feed.id, "audio": true, "video": true, "data": false};
            pr1[i].send ({"message": switchfeed,
                success: () => {
                    Janus.log(" :: Next Switch Feed to: ", feed.display);
                    pgm_state[i] = feed;
                    this.setState({pgm_state});
                }
            })
        }
    };

    selectGroup = (pre_feed) => {
        // group.index = i;
        this.setState({pre_feed});
        Janus.log(pre_feed);
        this.switchPreview(pre_feed.id, pre_feed.display);
    };

    removeFeed = (id) => {
        let {feeds,feeds_queue,pgm_state} = this.state;
        Janus.log(" :: Remove Feed: " + id);
        for(let i=0; i<feeds.length; i++){
            if(feeds[i].id === id) {
                feeds.splice(i, 1);
                this.setState({feeds});
                //Check if feed in program and switch to next in queue
                for(let a=0; a<4; a++) {
                    if(pgm_state[a].id === id) {
                        feeds_queue--;
                        let feed = feeds[feeds_queue];
                        this.switchNext(a, feed);
                        break
                    }
                }
                break
            }
        }
    };

    disableGroup = () => {
        let {pre_feed,disabled_groups} = this.state;
        Janus.log(" :: Disable Feed: " + pre_feed.display);
        disabled_groups.push(pre_feed);
        this.removeFeed(pre_feed.id);
        this.setState({disabled_groups,pre_feed: null});
    };

    zoominGroup = (e, i) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            let {zoom} = this.state;
            this.setState({zoom: !zoom},() => {
                let switchvideo = this.refs["programVideo" + i];
                let zoomvideo = this.refs.zoomVideo;
                var stream = switchvideo.captureStream();
                zoomvideo.srcObject = stream;
            });
        }
    };

    handleClose = () => this.setState({ zoom: false })

    restoreGroup = (e, data, i) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            let {disabled_groups,feeds} = this.state;
            for(let i = 0; i < disabled_groups.length; i++){
                if ( disabled_groups[i].id === data.id) {
                    disabled_groups.splice(i, 1);
                    feeds.push(data);
                    this.setState({disabled_groups,feeds});
                }
            }
        }
    };


  render() {
      //Janus.log(" --- ::: RENDER ::: ---");
      const { feeds,pre_feed,disabled_groups,feeds_queue,quistions_queue,pgm_state,zoom } = this.state;
      const width = "100%";
      const height = "100%";
      const autoPlay = true;
      const controls = false;
      const muted = true;
      const q = (<Icon color='red' name='question circle' />);

      let group_options = feeds.map((feed,i) => {
          const {display} = feed;
          return ({ key: i, value: feed, text: display })
      });

      let disabled_list = disabled_groups.map((data,i) => {
          const {id, display} = data;
          return (
              <Table.Row key={id} warning
                         onClick={() => this.selectGroup(data, i)}
                         onContextMenu={(e) => this.restoreGroup(e, data, i)} >
                  <Table.Cell width={5}>{display}</Table.Cell>
                  <Table.Cell width={1}>{id}</Table.Cell>
              </Table.Row>
          )
      });

      let preview = (<div className={pre_feed ? "" : "hidden"}>
          <div className="video_title"><span>{pre_feed ? pre_feed.display : ""}</span></div>
              <video ref = {"prevewVideo"}
                     id = "prevewVideo"
                     width = "400"
                     height = "220"
                     autoPlay = {autoPlay}
                     controls = {controls}
                     muted = {muted}
                     playsInline = {true} />
              <Button className='close_button'
                      size='mini'
                      color='red'
                      icon='close'
                      onClick={() => this.disableGroup()} />
          </div>
      );

      let program = pgm_state.map((feed,i) => {
          if(feed) {
              let id = feed.rfid;
              let talk = feed.talk;
              return (<div className="video_box"
                           key={"prov" + i}
                           ref={"provideo" + i}
                           id={"provideo" + i}>
                  <div className="video_title">{feed.display}</div>
                  <video className={talk ? "talk" : ""}
                         onContextMenu={(e) => this.zoominGroup(e, i)}
                         key={id}
                         ref={"programVideo" + i}
                         id={"programVideo" + i}
                         width={width}
                         height={height}
                         autoPlay={autoPlay}
                         controls={controls}
                         muted={muted}
                         playsInline={true}/>
                  <Button className='video_button'
                          size='mini'
                          color='green'
                          icon='arrow right'
                          onClick={() => this.switchProgram(i)} />
              </div>);
          }
          return true;
      });

    return (

        <Segment className="segment_conteiner" raised>
          
          <Segment attached className="program_segment" color='red'>
              <div className="video_grid">
                  {program}
              </div>
          </Segment>

            <Button attached='bottom' color='red' size='mini' onClick={this.switchFour}>Next</Button>

          <Segment className="preview_segment" color='green'>
              {preview}
          </Segment>

            <Dropdown
                placeholder='Select Group'
                fluid
                search
                selection
                options={group_options}
                onChange={(e,{value}) => this.selectGroup(value)} />

            <hr/>
            <p>Current queue value: {feeds_queue}</p>
            <p>Group in queue: {feeds.length > 0 ? feeds[feeds_queue].display : ""}</p>
            <p>Feeds sum: {feeds.length}</p>
            <hr/>
            <Segment textAlign='center' className="disabled_groups" raised>
                <Table selectable compact='very' basic structured className="admin_table" unstackable>
                    <Table.Body>
                        {disabled_list}
                    </Table.Body>
                </Table>
            </Segment>

            <Dimmer active={zoom} onClickOutside={this.handleClose} page>
                <video ref={"zoomVideo"}
                       id={"zoomVideo"}
                       width="1280"
                       height="720"
                       autoPlay={autoPlay}
                       controls={false}
                       muted={muted}
                       playsInline={true}/>
            </Dimmer>

        </Segment>
    );
  }
}

export default ShidurGroups;

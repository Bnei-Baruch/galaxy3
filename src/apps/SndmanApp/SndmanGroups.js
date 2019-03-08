import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Segment, Table, Icon, Button, Label} from "semantic-ui-react";
import './SndmanGroups.css'
import {DANTE_IN_IP, SECRET} from "../../shared/consts";

class SndmanGroups extends Component {

    state = {
        col: null,
        disabled_groups: [],
        forward: false,
        forward_feed: {},
        full_feed: null,
        fullscr: false,
        room: 1234,
        port: null,
    };

    componentDidMount() {
        document.addEventListener("keydown", this.onKeyPressed);
        const { index } = this.props;
        if(index === 0) {
            this.setState({col: 1, port: 5102});
        } else if(index === 4) {
            this.setState({col: 2, port: 5103});
        } else if(index === 8) {
            this.setState({col: 3, port: 5104});
        }
    };

    componentWillUnmount() {
        document.removeEventListener("keydown", this.onKeyPressed);
    };

    newSwitchFeed = (id, program, i) => {
        let pre = null;
        this.props.janus.attach(
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
                    let listen = { "request": "join", "room": 1234, "ptype": "subscriber", "feed": id };
                    pre.send({"message": listen});
                    if(program) {
                        let {pr1} = this.props;
                        pr1[i] = pre;
                        //this.setState({pr1})
                        this.props.setProps({pr1});
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
                onremotetrack: (track,mid,on) => {
                    Janus.debug(" - Remote track "+mid+" is: "+on,track);
                    if(mid !== "video" || !on || !track.muted)
                        return;
                    let stream = new MediaStream();
                    stream.addTrack(track.clone());
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
        let {feeds,feeds_queue,round} = this.props;
        let {pre_feed} = this.state;

        //If someone in preview take him else take next in queue
        if(pre_feed) {
            Janus.log(" :: Selected program Switch Feed to: ", pre_feed.display);
            this.switchNext(i, pre_feed);
            this.setState({pre_feed: null});
            this.props.setProps({program: pre_feed, pre_feed: null});

        } else {
            let feed = feeds[feeds_queue];
            this.switchNext(i, feed);
            feeds_queue++;

            if(feeds_queue >= feeds.length) {
                // End round here!
                feeds_queue = 0;
                round++;
                Janus.log(" -- ROUND END --");
            }

            this.props.setProps({feeds_queue,round,pre_feed: null});
        }
    };

    switchFour = () => {
        let {feeds_queue,feeds,index} = this.props;

        for(let i=index; i<index+4; i++) {

            // Don't switch if nobody in queue
            if(i === feeds.length) {
                console.log("Queue is END");
                break;
            }

            if(feeds_queue >= feeds.length) {
                // End round here!
                Janus.log(" -- ROUND END --");
                feeds_queue = 0;
                this.props.setProps({feeds_queue});
            }

            // If program is not full avoid using feeds_queue
            if(feeds.length < 13) {
                this.switchNext(i,feeds[i]);
            } else {
                this.switchNext(i,feeds[feeds_queue]);
                feeds_queue++;
                this.props.setProps({feeds_queue});
            }

        }
    };

    switchNext = (i ,feed, r) => {
        Janus.log(" ---- switchNext params: ", i, feed);
        if(!feed) return;
        let {pr1,pgm_state} = this.props;

        //Detch previous feed
        if(pr1[i] && r !== true) {
            pr1[i].detach();
            pr1[i] = null;
        }

        if(!pr1[i]) {
            this.newSwitchFeed(feed.id,true,i);
            pgm_state[i] = feed;
            this.props.setProps({pgm_state});
        } else {
            let switchfeed = {"request": "switch", "feed": feed.id, "audio": true, "video": true, "data": false};
            pr1[i].send ({"message": switchfeed,
                success: () => {
                    Janus.log(" :: Next Switch Feed to: ", feed.display);
                    pgm_state[i] = feed;
                    this.props.setProps({pgm_state});
                    // putData(`state/galaxy/pr1`, pgm_state, (cb) => {
                    //     Janus.log(":: Save to state: ",cb);
                    // });
                }
            })
        }
    };

    selectGroup = (pre_feed) => {
        this.setState({pre_feed});
        Janus.log(pre_feed);
        this.switchPreview(pre_feed.id, pre_feed.display);
    };

    disableGroup = () => {
        let {disabled_groups} = this.props;
        let {pre_feed} = this.state;
        let chk = disabled_groups.find(g => g.id === pre_feed.id);
        if(chk)
            return;
        disabled_groups.push(pre_feed);
        this.props.removeFeed(pre_feed.id);
        this.setState({pre_feed: null});
        this.props.setProps({disabled_groups});
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

    handleClose = () => this.setState({ zoom: false });

    restoreGroup = (data, i) => {
        let {disabled_groups,feeds,users} = this.props;
        for(let i = 0; i < disabled_groups.length; i++){
            if(JSON.parse(disabled_groups[i].display).id === JSON.parse(data.display).id) {
                disabled_groups.splice(i, 1);
                feeds.push(data);
                let user = JSON.parse(data.display);
                user.rfid = data.id;
                users[user.id] = user;
                this.props.setProps({disabled_groups,feeds,users});
            }
        }
    };

    fullScreenGroup = (i,full_feed) => {
        Janus.log(":: Make Full Screen Group: ",JSON.parse(full_feed.display));
        this.setState({fullscr: !this.state.fullscr,full_feed});
        let fourvideo = this.refs["programVideo" + i];
        let fullvideo = this.refs.fullscreenVideo;
        var stream = fourvideo.captureStream();
        fullvideo.srcObject = stream;
    };

    toFourGroup = () => {
        Janus.log(":: Back to four: ");
        if(this.state.forward)
            this.forwardStream();
        //FIXME: Does we need setState on forwardStream callback?
        this.setState({fullscr: !this.state.fullscr, full_feed: null});
    };

    forwardStream = () => {
        const {full_feed,fullscr,forward_feed,room,forward,port} = this.state;
        const {gxyhandle} = this.props;
        if (!fullscr) {
            return;
        }
        if(forward) {
            Janus.log(" :: Stop forward from room: ", room);
            this.setState({forward: false});
            this.sendMessage(JSON.parse(forward_feed.display), false);
            let stopfw = { "request":"stop_rtp_forward","stream_id":forward_feed.streamid,"publisher_id":forward_feed.id,"room":room,"secret":`${SECRET}` };
            gxyhandle.send({"message": stopfw,
                success: (data) => {
                    Janus.log(":: Forward callback: ", data);
                    this.setState({forward_feed: {}});
                },
            });
        } else {
            Janus.log(" :: Start forward from room: ", room);
            this.setState({forward: true});
            this.sendMessage(JSON.parse(full_feed.display), true);
            let forward = { "request": "rtp_forward","publisher_id":full_feed.id,"room":room,"secret":`${SECRET}`,"host":`${DANTE_IN_IP}`,"audio_port":port};
            gxyhandle.send({"message": forward,
                success: (data) => {
                    Janus.log(":: Forward callback: ", data);
                    forward_feed.streamid = data["rtp_stream"]["audio_stream_id"];
                    forward_feed.id = full_feed.id;
                    forward_feed.display = full_feed.display;
                    this.setState({forward_feed});
                },
            });
        }
    };

    sendMessage = (user, talk) => {
        let {room,col} = this.state;
        let message = `{"talk":${talk},"name":"${user.display}","ip":"${user.ip}","col":${col},"room":${room}}`;
        Janus.log(":: Sending message: ",message);
        this.props.gxyhandle.data({ text: message });
    };

    onKeyPressed = (e) => {
        if(e.code === "Numpad"+this.state.col && this.state.fullscr)
            this.forwardStream();
    };


  render() {
      const { pre_feed,full_feed,zoom,fullscr,forward } = this.state;
      const {users,index,feeds,pgm_state,feeds_queue,quistions_queue,disabled_groups} = this.props;
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
          <div className="fullscrvideo_title"><span>{pre_feed ? pre_feed.display : ""}</span></div>
              <video ref = {"prevewVideo"}
                     id = "prevewVideo"
                     width = "640"
                     height = "360"
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
          if(feed && i >= index && i < index+4) {
              // Does it help here?
              if(pgm_state[i] === null)
                  return;
              let user = JSON.parse(feed.display);
              let qst = users[user.id] ? users[user.id].question : false;
              let talk = feed.talk;
              return (<div className={fullscr ? "hidden" : ""} key={"prf" + i}><div className="video_box"
                           key={"prov" + i}
                           ref={"provideo" + i}
                           id={"provideo" + i}>
                  <div className="video_title">{JSON.parse(feed.display).display}</div>
                  {qst ? <div className='qst_title'>?</div> : ""}
                  <video className={talk ? "talk" : ""}
                         // onClick={() => this.fullScreenGroup(i,feed)}
                         // onContextMenu={(e) => this.zoominGroup(e, i)}
                         key={i}
                         ref={"programVideo" + i}
                         id={"programVideo" + i}
                         width={width}
                         height={height}
                         autoPlay={autoPlay}
                         controls={controls}
                         muted={muted}
                         playsInline={true}/>
              </div></div>);
          }
          return true;
      });

      let fullscreen = (<div className={fullscr ? "" : "hidden"}>
              <div className="fullscrvideo_title"><span>{full_feed ? JSON.parse(full_feed.display).display : ""}</span></div>
              <div className={
                  //TODO: Fix this ugly shit!
                  full_feed ? users[JSON.parse(full_feed.display).id] ? users[JSON.parse(full_feed.display).id].question ? 'qst_fullscreentitle' : 'hidden' : 'hidden' : 'hidden'
              }>?</div>
              <video ref = {"fullscreenVideo"}
                     // onClick={() => this.toFourGroup()}
                     id = "fullscreenVideo"
                     width = "360"
                     height = "200"
                     autoPlay = {autoPlay}
                     controls = {controls}
                     muted = {muted}
                     playsInline = {true} />
          </div>
      );

      return (
          <Segment className="sndman_segment">
          <Segment attached className="preview_sdi" color='red'>
              <div className="video_grid">
                  {program}
                  {fullscreen}
              </div>
          </Segment>
              <Button className='fours_button'
                      disabled={!fullscr}
                      attached='bottom'
                      positive={!forward}
                      negative={forward}
                      onKeyDown={(e) => this.onKeyPressed(e)}
                      onClick={this.forwardStream}>
                  <Icon size='large' name={forward ? 'microphone' : 'microphone slash' } />
                  <Label attached='top left' color='grey'>{this.state.col}</Label>
              </Button>
          </Segment>
      );
  }
}

export default SndmanGroups;

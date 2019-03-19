import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Segment, Icon, Dropdown, Dimmer, Button} from "semantic-ui-react";
//import {getState, putData} from "../../shared/tools";
import './ShidurGroups.css'
import {sendProtocolMessage} from "../../shared/protocol";

class ShidurGroups extends Component {

    state = {
        col: null,
        disabled_groups: [],
    };

    componentDidMount() {
        const { index } = this.props;
        if(index === 0) {
            this.setState({col: 1});
        } else if(index === 4) {
            this.setState({col: 2});
        } else if(index === 8) {
            this.setState({col: 3});
        }
    };

    // subscribeTo = (subscription) => {
    //     // New feeds are available, do we need create a new plugin handle first?
    //     if (this.props.remoteFeed) {
    //         this.props.remoteFeed.send({message:
    //                 {request: "subscribe", streams: subscription}
    //         });
    //         return;
    //     }
    //
    //     // We don't have a handle yet, but we may be creating one already
    //     if (this.props.creatingFeed) {
    //         // Still working on the handle
    //         setTimeout(() => {
    //             this.subscribeTo(subscription);
    //         }, 500);
    //         return;
    //     }
    //
    //     // We don't creating, so let's do it
    //     this.props.setProps({creatingFeed: true});
    //     this.props.newRemoteFeed(subscription);
    // };

    // newSwitchFeed = (id, program, i) => {
    //     let pre = null;
    //     this.props.janus.attach(
    //         {
    //             plugin: "janus.plugin.videoroom",
    //             opaqueId: "switchfeed_user",
    //             success: (pluginHandle) => {
    //                 pre = pluginHandle;
    //                 pre.simulcastStarted = false;
    //                 Janus.log("Plugin attached! (" + pre.getPlugin() + ", id=" + pre.getId() + ")");
    //                 Janus.log("  -- This is a subscriber");
    //                 let listen = { "request": "join", "room": 1234, "ptype": "subscriber", streams: [{feed: id, mid: "1"}] };
    //                 pre.send({"message": listen});
    //                 if(program) {
    //                     let {pr1} = this.props;
    //                     pr1[i] = pre;
    //                     this.props.setProps({pr1});
    //                 } else {
    //                     this.setState({pre});
    //                 }
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
    //                         Janus.log("Successfully attached to feed " + pre);
    //                     } else {
    //                         // What has just happened?
    //                     }
    //                 }
    //                 if(msg["streams"]) {
    //                     // Update map of subscriptions by mid
    //                     Janus.log(" :: Streams updated! : ",msg["streams"]);
    //                     let {mids} = this.state;
    //                     for(let i in msg["streams"]) {
    //                         let mindex = msg["streams"][i]["mid"];
    //                         //let feed_id = msg["streams"][i]["feed_id"];
    //                         mids[mindex] = msg["streams"][i];
    //                     }
    //                     this.setState({mids});
    //                 }
    //                 if(jsep !== undefined && jsep !== null) {
    //                     Janus.debug("Handling SDP as well...");
    //                     Janus.debug(jsep);
    //                     // Answer and attach
    //                     pre.createAnswer(
    //                         {
    //                             jsep: jsep,
    //                             media: { audioSend: false, videoSend: false },	// We want recvonly audio/video
    //                             success: (jsep) => {
    //                                 Janus.debug("Got SDP!");
    //                                 Janus.debug(jsep);
    //                                 let body = { "request": "start", "room": 1234 };
    //                                 pre.send({"message": body, "jsep": jsep});
    //                             },
    //                             error: (error) => {
    //                                 Janus.error("WebRTC error:", error);
    //                             }
    //                         });
    //                 }
    //             },
    //             webrtcState: (on) => {
    //                 Janus.log("Janus says this WebRTC PeerConnection (feed #" + pre + ") is " + (on ? "up" : "down") + " now");
    //             },
    //             onlocalstream: (stream) => {
    //                 // The subscriber stream is recvonly, we don't expect anything here
    //             },
    //             onremotetrack: (track,mid,on) => {
    //                 Janus.debug(" - Remote track "+mid+" is: "+on,track);
    //                 if(!on) {
    //                     console.log(" :: Going to stop track :: " + track + ":", mid);
    //                     //FIXME: Remove callback for audio track does not come
    //                     track.stop();
    //                     //FIXME: does we really need to stop all track for feed id?
    //                     return;
    //                 }
    //                 if(track.kind !== "video" || !on || !track.muted)
    //                     return;
    //                 let stream = new MediaStream();
    //                 stream.addTrack(track.clone());
    //                 Janus.debug("Remote feed #" + pre);
    //                 let switchvideo = program ? this.refs["programVideo" + i] : this.refs.prevewVideo;
    //                 Janus.log(" Attach remote stream on video: "+i);
    //                 Janus.attachMediaStream(switchvideo, stream);
    //             },
    //             oncleanup: () => {
    //                 Janus.log(" ::: Got a cleanup notification (remote feed "+id+" : "+i+") :::");
    //                 console.log(" :: Cleanup handle! - " + id + " - index: " + i);
    //             }
    //         });
    // };

    checkPreview = (id) => {
        let {pre_feed} = this.state;
        if(pre_feed && pre_feed.id === id) {
            this.hidePreview()
        }
    };

    switchPreview = (id, display) => {
        if(!this.state.pre) {
            this.newSwitchFeed(id,false);
        } else {
            let streams = [{feed: id, mid: "1", sub_mid: "0"}];
            let switchfeed = {"request": "switch", streams};
            this.state.pre.send ({"message": switchfeed,
                success: () => {
                    Janus.log(" :: Preview Switch Feed to: ", display);
                }
            })
        }
    };

    switchProgram = (i) => {
        Janus.log(" :: Selected program Switch: ",i);
        let {feeds,feeds_queue,round,pre_feed} = this.props;

        //If someone in preview take him else take next in queue
        if(pre_feed) {
            Janus.log(" :: Selected program Switch Feed to: ", pre_feed);
            this.switchNext(i, pre_feed);
            //this.hidePreview();
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
        let {feeds_queue,feeds,index,round} = this.props;

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
                round++;
                this.props.setProps({feeds_queue,round});
            }

            // If program is not full avoid using feeds_queue
            if(feeds.length < 13) {
                this.switchNext(i,feeds[i],true);
            } else {
                this.switchNext(i,feeds[feeds_queue],true);
                feeds_queue++;
                this.props.setProps({feeds_queue});
            }

        }
    };

    sdiAction = (action, status, i, feed) => {
        //FIXME: Must be removed in production mode
        return;
        const { protocol, user, index } = this.props;
        let col = null;
        if(index === 0) {
            col = 1;
        } else if(index === 4) {
            col = 2;
        } else if(index === 8) {
            col = 3;
        }
        let msg = { type: "sdi-"+action, status, room: 1234, col, i, feed};
        sendProtocolMessage(protocol, user, msg );
    };

    switchNext = (i ,feed, r) => {
        Janus.log(" -- GOT NEXT: ", feed)
        if(!feed) return;
        let {pr1,pgm_state,mids,qam,qfeeds,quistions_queue,feedStreams} = this.props;
        //let mid = qam[i];
        // Add to group search if removed from program with question status
        if(mids[i]) {
            // let cur_feed = pgm_state[i];
            // let chk = pgm_state.filter(p => {
            //     return (p !== null && p !== undefined && p.id === cur_feed.id)
            // });
            let chk = mids.filter(g => g.active && g.feed_id === mids[i].feed_id);
            let qf_chk = qfeeds.filter(qf => qf.rfid === mids[i].feed_id).length === 0;
            if (qf_chk) {
                let qq_chk = quistions_queue.filter(qs => qs.rfid === mids[i].feed_id).length > 0;
                if (qq_chk) {
                    if (chk.length < 2) {
                        qfeeds.push(feedStreams[mids[i].id]);
                        this.props.setProps({qfeeds});
                    }
                }
            }
        }

        // Remove question status from group search list if add to program
        for (let q = 0; q < qfeeds.length; q++) {
            if (qfeeds[q] && qfeeds[q].id === feed.id) {
                console.log(" - Remove QFEED: ", qfeeds[q]);
                qfeeds.splice(q, 1);
                this.props.setProps({qfeeds});
                break
            }
        }

        // Tmp fix
        // if(r === "fix") {
        //     this.sdiAction("fix", true, i, feed)
        // }

        // Unsubscribe from previous mid
        this.props.unsubscribeFrom(mids[i].feed_id, mids[i].mid);

        // Subscribe to new feed
        let streams = [{feed: feed.id, mid: "1"}];
        //FIXME: Let's see if it's fix for sure reuse empty m-line
        setTimeout(() => {
            this.props.subscribeTo(streams);
        }, 500);

        // Send sdi action
        //this.sdiAction("switch" , false, i, feed);

        // DEPRICATED
        //Detch previous feed
        // if(pr1[i] && r !== true) {
        //     pr1[i].detach();
        //     pr1[i] = null;
        // }

        // if(!pr1[i]) {
        //     console.log(" :: New handle! - " + feed.id);
        //     this.newSwitchFeed(feed.id,true,i);
        //     pgm_state[i] = feed;
        //     this.props.setProps({pgm_state});
        //     this.sdiAction("switch" , false, i, feed);
        // } else {
        //     console.log(" :: Switch handle! - " + feed.id);
        //     let streams = [{feed: feed.id, mid: "1", sub_mid: "0"}];
        //     let switchfeed = {"request": "switch", streams};
        //     pr1[i].send ({"message": switchfeed,
        //         success: () => {
        //             Janus.log(" :: Next Switch Feed to: ", feed.display);
        //             pgm_state[i] = feed;
        //             this.props.setProps({pgm_state});
        //             this.sdiAction("switch", true, i, feed)
        //             // putData(`state/galaxy/pr1`, pgm_state, (cb) => {
        //             //     Janus.log(":: Save to state: ",cb);
        //             // });
        //         }
        //     })
        // }
    };

    // selectGroup = (pre_feed) => {
    //     this.setState({pre_feed});
    //     Janus.log(pre_feed);
    //     // We can show in preview feed stream object
    //     if(this.props.feedStreams[pre_feed.id]) {
    //         let {stream} = this.props.feedStreams[pre_feed.id];
    //         let video = this.refs.prevewVideo;
    //         Janus.log(" Attach mid to preview: "+pre_feed.id);
    //         Janus.attachMediaStream(video, stream);
    //     } else {
    //         //TODO: Make new remoteFeed
    //         //this.switchPreview(pre_feed.id, pre_feed.display);
    //     }
    // };

    // disableGroup = () => {
    //     let {disabled_groups} = this.props;
    //     let {pre_feed} = this.state;
    //     let chk = disabled_groups.find(g => g.id === pre_feed.id);
    //     if(chk)
    //         return;
    //     this.sdiAction("disable", true, null, pre_feed);
    //     disabled_groups.push(pre_feed);
    //     this.props.removeFeed(pre_feed.id);
    //     this.hidePreview();
    //     this.props.setProps({disabled_groups});
    // };

    // hidePreview = () => {
    //     //this.state.pre.detach();
    //     this.setState({pre_feed: null, pre: null});
    // };

    zoominGroup = (e, i ,s) => {
        e.preventDefault();
        console.log(i,s)
        if (e.type === 'contextmenu') {
            let {zoom} = this.state;
            this.setState({zoom: !zoom},() => {
                let switchvideo = (s === "pro") ? this.refs["programVideo" + i] : this.refs.prevewVideo;
                let zoomvideo = this.refs.zoomVideo;
                var stream = switchvideo.captureStream();
                zoomvideo.srcObject = stream;
            });
        }
    };

    handleClose = () => this.setState({ zoom: false });

    // restoreGroup = (e, data, i) => {
    //     e.preventDefault();
    //     if (e.type === 'contextmenu') {
    //         let {disabled_groups,feeds,users} = this.props;
    //         for(let i = 0; i < disabled_groups.length; i++) {
    //             if(JSON.parse(disabled_groups[i].display).id === JSON.parse(data.display).id) {
    //                 //TODO: check if we got question while feed was disable
    //                 disabled_groups.splice(i, 1);
    //                 feeds.push(data);
    //                 let user = JSON.parse(data.display);
    //                 user.rfid = data.id;
    //                 users[user.id] = user;
    //                 this.props.setProps({disabled_groups,feeds,users});
    //                 this.sdiAction("restore", true, i, data);
    //             }
    //         }
    //     }
    // };

    fullScreenGroup = (i,full_feed) => {
        Janus.log(":: Make Full Screen Group: ",full_feed);
        full_feed.display = JSON.parse(full_feed.feed_display);
        this.setState({fullscr: !this.state.fullscr,full_feed});
        let fourvideo = this.refs["programVideo" + i];
        let fullvideo = this.refs.fullscreenVideo;
        var stream = fourvideo.captureStream();
        fullvideo.srcObject = stream;
        this.sdiAction("fullscreen" , true, i, full_feed);
    };

    toFourGroup = () => {
        Janus.log(":: Back to four: ");
        this.sdiAction("fullscreen" , false, null, this.state.full_feed);
        this.setState({fullscr: !this.state.fullscr, full_feed: null});
    };


  render() {
      console.log(" --- RENDER ---")
      const { full_feed,zoom,fullscr,col } = this.state;
      const {index,feeds,pre_feed,pgm_state,users,qfeeds} = this.props;
      const width = "100%";
      const height = "100%";
      const autoPlay = true;
      const controls = false;
      const muted = true;
      const q = (<Icon color='red' name='question circle' />);

      // let queue_options = qfeeds.map((feed,i) => {
      //     const {display} = JSON.parse(feed.display);
      //     return ({ key: feed.id+i, value: feed, text: display, icon: 'help'})
      // });

      // let group_options = feeds.map((feed,i) => {
      //     const display = feed.display.display;
      //     return ({ key: i, value: feed, text: display })
      // });

      // let preview = (<div className={pre_feed ? "" : "hidden"}>
      //     <div className="fullscrvideo_title"><span>{pre_feed ? pre_feed.display.display : ""}</span></div>
      //         <div className={
      //             //TODO: Fix this ugly shit!
      //             pre_feed ? users[pre_feed.display.id] ? users[pre_feed.display.id].question ? 'qst_fullscreentitle' : 'hidden' : 'hidden' : 'hidden'
      //         }>?</div>
      //         <video
      //             onContextMenu={(e) => this.zoominGroup(e, null, "pre")}
      //                ref = {"prevewVideo"}
      //                id = "prevewVideo"
      //                width = "400"
      //                height = "220"
      //                autoPlay = {autoPlay}
      //                controls = {controls}
      //                muted = {muted}
      //                playsInline = {true} />
      //         <Button className='close_button'
      //                 size='mini'
      //                 color='red'
      //                 icon='close'
      //                 onClick={() => this.disableGroup()} />
      //         <Button className='hide_button'
      //                 size='mini'
      //                 color='orange'
      //                 icon='window minimize'
      //                 onClick={() => this.hidePreview()} />
      //     </div>
      // );

      let program = this.props.mids.map((feed,i) => {
          if(feed && this.props.qam[i] === col) {
          //if(feed && i >= index && i < index+4) {
              if(!feed.active) {
                  return (this.props.mids.length > 12 ?
                      <div className={fullscr ? "hidden" : ""} key={"prf" + i}>
                      <div className="video_box"
                           key={"prov" + i}
                           ref={"provideo" + i}
                           id={"provideo" + i}>
                          <div className="video_title"></div>
                          <video
                                 key={i}
                                 ref={"programVideo" + i}
                                 id={"programVideo" + i}
                                 width={width}
                                 height={height}
                                 autoPlay={autoPlay}
                                 controls={controls}
                                 muted={muted}
                                 playsInline={true}/>
                      </div></div> : false)
              }
              let user = JSON.parse(feed.feed_display);
              let qst = users[user.id] ? users[user.id].question : false;
              let talk = feed.talk;
              let id = feed.feed_id;
              return (<div className={fullscr ? "hidden" : ""} key={"prf" + i}>
                        <div className="video_box"
                           key={"prov" + i}
                           ref={"provideo" + i}
                           id={"provideo" + i}>
                  <div className="video_title">{user.display}</div>
                            {qst ? <div className='qst_title'>?</div> : ""}
                  <video className={talk ? "talk" : ""}
                         onClick={() => this.fullScreenGroup(i,feed)}
                         onContextMenu={(e) => this.zoominGroup(e, i, "pro")}
                         key={i}
                         ref={"programVideo" + i}
                         id={"programVideo" + i}
                         width={width}
                         height={height}
                         autoPlay={autoPlay}
                         controls={controls}
                         muted={muted}
                         playsInline={true}/>
                  <Button className='next_button'
                          disabled={feeds.length < 1}
                          size='mini'
                          color='green'
                          icon={pre_feed ? 'arrow up' : 'share'}
                          onClick={() => this.switchProgram(i)} />
              </div></div>);
          }
          return true;
      });

      let fullscreen = (<div className={fullscr ? "" : "hidden"}>
              <div className="fullscrvideo_title"><span>{full_feed ? full_feed.display.display : ""}</span></div>
              <div className={
                  full_feed ? users[full_feed.display.id] ? users[full_feed.display.id].question ? 'qst_fullscreentitle' : 'hidden' : 'hidden' : 'hidden'
              }>?</div>
              <video ref = {"fullscreenVideo"}
                     onClick={() => this.toFourGroup()}
                     id = "fullscreenVideo"
                     width = "400"
                     height = "220"
                     autoPlay = {autoPlay}
                     controls = {controls}
                     muted = {muted}
                     playsInline = {true} />
          </div>
      );

      return (
          <Segment className="group_conteiner">
              <Segment attached className="program_segment" color='red'>
                  <div className="video_grid">
                      {program}
                      {fullscreen}
                  </div>
              </Segment>
              <Button className='fours_button'
                      disabled={feeds.length < 13}
                      attached='bottom'
                      color='blue'
                      size='mini'
                      onClick={this.switchFour}>
                  <Icon name='share' />
                  <Icon name='th large' />
                  <Icon name='share' />
              </Button>
              {/*<Segment className="group_segment" color='green'>*/}
                  {/*{preview}*/}
              {/*</Segment>*/}
              {/*<Dropdown className='select_group' error={qfeeds.length > 0}*/}
                        {/*placeholder='Select Group'*/}
                        {/*fluid*/}
                        {/*search*/}
                        {/*selection*/}
                        {/*options={queue_options.concat(group_options)}*/}
                        {/*onChange={(e,{value}) => this.selectGroup(value)} />*/}
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

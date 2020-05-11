import React, {Component} from 'react';
import './UsersHandle.scss'
import { Janus } from "../../lib/janus";
import classNames from "classnames";
import {Button} from "semantic-ui-react";

class UsersPreview extends Component {

    state = {
        feeds: [],
        feedStreams: {},
        mids: [],
        name: "",
        room: "",
        users: {},
        myid: null,
        mystream: null
    };

    componentDidMount() {
        this.attachPreview(this.props.pg);
    }

    componentDidUpdate(prevProps) {
        let {pg} = this.props;
        let {room} = this.state;
        if(pg && JSON.stringify(pg) !== JSON.stringify(prevProps.pg) && pg.room !== room) {
            if(this.state.remoteFeed)
                this.state.remoteFeed.detach();
            this.setState({remoteFeed: null, mids: [], feeds: [], feedStreams: {}}, () => {
                this.attachPreview(this.props.pg);
                console.log("ATTACHING PREVIEW:", this.props.pg)
            });
        }
    }

    componentWillUnmount() {
        if(this.state.remoteFeed)
            this.state.remoteFeed.detach();
    };

    attachPreview = (g) => {
        this.setState({room: g.room}, () =>{
            let subscription = [];
            for (let i in g.users) {
                let id = g.users[i].rfid;
                let subst = {feed: id, mid: "1"};
                subscription.push(subst);
            }
            this.subscribeTo(subscription, g.janus);
        });
    };

    newRemoteFeed = (subscription, inst) => {
        const gateway = this.props.gateways[inst];
        gateway.gateway.attach(
            {
                plugin: "janus.plugin.videoroom",
                opaqueId: "remotefeed_user",
                success: (pluginHandle) => {
                    gateway.log("[Preview] [remoteFeed] attach success", pluginHandle.getId());
                    let remoteFeed = pluginHandle;
                    this.setState({remoteFeed, creatingFeed: false});
                    let subscribe = {request: "join", room: this.state.room, ptype: "subscriber", streams: subscription};
                    remoteFeed.send({ message: subscribe });
                },
                error: (err) => {
                    gateway.error("[Preview] [remoteFeed] attach error", err);
                },
                iceState: (state) => {
                    gateway.log("[Preview] [remoteFeed] ICE state changed to", state);
                },
                webrtcState: (on) => {
                    gateway.log(`[Preview] [remoteFeed] Janus says this WebRTC PeerConnection is ${on ? "up" : "down"} now`);
                },
                slowLink: (uplink, nacks) => {
                    gateway.warn("[Preview] [remoteFeed] Janus reports problems " + (uplink ? "sending" : "receiving") +
                        " packets on this PeerConnection (remote feed, " + nacks + " NACKs/s " + (uplink ? "received" : "sent") + ")");
                },
                onmessage: (msg, jsep) => {
                    let event = msg["videoroom"];
                    if(msg["error"] !== undefined && msg["error"] !== null) {
                        console.error("[Shidur] [Preview] [remoteFeed] error", msg["error"]);
                    } else if(event !== undefined && event !== null) {
                        if(event === "attached") {
                            console.debug("[Shidur] [Preview] [remoteFeed] successfully attached to feed in room");
                        } else if(event === "event") {
                            // Check if we got an event on a simulcast-related event from this publisher
                        } else {
                            // What has just happened?
                        }
                    }
                    if(msg["streams"]) {
                        let {mids} = this.state;
                        for(let i in msg["streams"]) {
                            let mindex = msg["streams"][i]["mid"];
                            mids[mindex] = msg["streams"][i];
                        }
                        this.setState({mids});
                    }
                    if(jsep !== undefined && jsep !== null) {
                        gateway.debug("[Preview] [remoteFeed] Handling SDP as well...", jsep);
                        // Answer and attach
                        this.state.remoteFeed.createAnswer(
                            {
                                jsep: jsep,
                                media: { audioSend: false, videoSend: false },
                                success: (jsep) => {
                                    gateway.debug("[Preview] [remoteFeed] Got SDP!", jsep);
                                    let body = { request: "start", room: this.state.room };
                                    this.state.remoteFeed.send({ message: body, jsep: jsep });
                                },
                                error: (err) => {
                                    gateway.error("[Preview][remoteFeed]  WebRTC error", err);
                                }
                            });
                    }
                },
                onremotetrack: (track, mid, on) => {
                    if(!mid) {
                        mid = track.id.split("janus")[1];
                    }
                    let {mids} = this.state;
                    let feed = mids[mid].feed_id;
                    if(track.kind === "video" && on) {
                        let stream = new MediaStream();
                        stream.addTrack(track.clone());
                        let remotevideo = this.refs["pv" + feed];
                        Janus.attachMediaStream(remotevideo, stream);
                    }
                },
                ondataopen: (data) => {
                    gateway.debug("[Preview] [remoteFeed] The DataChannel is available!");
                },
                ondata: (data) => {
                    gateway.debug("[Preview] [remoteFeed] We got data from the DataChannel!", data);
                },
                oncleanup: () => {
                    gateway.debug("[Preview] [remoteFeed] ::: Got a cleanup notification :::");
                }
            });
    };

    subscribeTo = (subscription, inst) => {
        if (this.state.remoteFeed) {
            this.state.remoteFeed.send({message:
                    {request: "subscribe", streams: subscription}
            });
            return;
        }
        if (this.state.creatingFeed) {
            setTimeout(() => {
                this.subscribeTo(subscription, inst);
            }, 500);
        } else {
            this.setState({creatingFeed: true});
            this.newRemoteFeed(subscription, inst);
        }
    };

  render() {
      const {mids} = this.state;
      const width = "400";
      const height = "300";
      const autoPlay = true;
      const controls = false;
      const muted = true;

      let program_feeds = mids.map((mid) => {
          if(mid) {
              let id = mid.feed_id;
              let talk = mid.talk;
              return (<div className="video"
                           key={"prov" + id}
                           ref={"provideo" + id}
                           id={"provideo" + id}>
                  <div className={classNames('video__overlay', {'talk' : talk})}>
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
          <div className="videos-panel">
              <div className="videos">
                  {this.props.next ?
                      <Button className='close_button'
                              size='mini'
                              color='green'
                              icon='share'
                              onClick={this.props.nextInQueue} />
                              :
                      <div>
                          <Button className='close_button'
                                  size='mini'
                                  color='red'
                                  icon='close'
                                  onClick={() => this.props.closePopup({disable: true})} />
                          <Button className='hide_button'
                                  size='mini'
                                  color='orange'
                                  icon='window minimize'
                                  onClick={() => this.props.closePopup()} />
                      </div>
                  }
                  <div className="videos__wrapper">
                      {program_feeds}
                  </div>
              </div>
          </div>
      );
  }
}

export default UsersPreview;

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
            this.subscribeTo(subscription);
        });
    };

    newRemoteFeed = (subscription) => {
        this.props.janus.attach(
            {
                plugin: "janus.plugin.videoroom",
                opaqueId: "remotefeed_user",
                success: (pluginHandle) => {
                    let remoteFeed = pluginHandle;
                    this.setState({remoteFeed, creatingFeed: false});
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
                    let event = msg["videoroom"];
                    if(msg["error"] !== undefined && msg["error"] !== null) {
                        Janus.debug("-- ERROR: " + msg["error"]);
                    } else if(event !== undefined && event !== null) {
                        if(event === "attached") {
                            Janus.log("Successfully attached to feed in room " + msg["room"]);
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
                        Janus.debug("Handling SDP as well...");
                        Janus.debug(jsep);
                        // Answer and attach
                        this.state.remoteFeed.createAnswer(
                            {
                                jsep: jsep,
                                media: { audioSend: false, videoSend: false },
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
        if (this.state.remoteFeed) {
            this.state.remoteFeed.send({message:
                    {request: "subscribe", streams: subscription}
            });
            return;
        }
        if (this.state.creatingFeed) {
            setTimeout(() => {
                this.subscribeTo(subscription);
            }, 500);
        } else {
            this.setState({creatingFeed: true});
            this.newRemoteFeed(subscription);
        }
    };

    unsubscribeFrom = (id) => {
        let {feeds,users,feedStreams} = this.state;
        let {remoteFeed} = this.state;
        for (let i=0; i<feeds.length; i++) {
            if (feeds[i].id === id) {
                Janus.log("Feed " + feeds[i] + " (" + id + ") has left the room, detaching");
                delete users[feeds[i].display.id];
                delete feedStreams[id];
                feeds.splice(i, 1);
                let unsubscribe = {request: "unsubscribe", streams: [{ feed: id }]};
                if(remoteFeed !== null)
                    remoteFeed.send({ message: unsubscribe });
                this.setState({feeds,users,feedStreams});
                break
            }
        }
    };

  render() {
      const {mids} = this.state;
      const {users} = this.props;
      const width = "400";
      const height = "300";
      const autoPlay = true;
      const controls = false;
      const muted = true;
      //const q = (<b style={{color: 'red', fontSize: '20px', fontFamily: 'Verdana', fontWeight: 'bold'}}>?</b>);

      let program_feeds = mids.map((mid) => {
          //let camera = users[feed.display.id] && users[feed.display.id].camera !== false;
          if(mid) {
              let id = mid.feed_id;
              let talk = mid.talk;
              //let question = users[mid.display.id] && users[mid.display.id].question;
              //let st = users[mid.display.id] && users[mid.display.id].sound_test;
              return (<div className="video"
                           key={"prov" + id}
                           ref={"provideo" + id}
                           id={"provideo" + id}>
                  <div className={classNames('video__overlay', {'talk' : talk})}>
                      {/*{question ? <div className="question">*/}
                      {/*    <svg viewBox="0 0 50 50">*/}
                      {/*        <text x="25" y="25" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">&#xF128;</text>*/}
                      {/*    </svg>*/}
                      {/*    {st ? <Icon name="checkmark" size="small" color="green"/> : ''}*/}
                      {/*</div>:''}*/}
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
                  <div className="videos__wrapper">
                      {program_feeds}
                  </div>
              </div>
          </div>
      );
  }
}

export default UsersPreview;

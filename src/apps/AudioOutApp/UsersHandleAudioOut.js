import React, {Component} from "react";
import "./UsersHandleAudioOut.scss";
import {Janus} from "../../lib/janus";

class UsersHandleAudioOut extends Component {
  state = {
    feeds: [],
    mids: [],
    name: "",
    room: null,
    myid: null,
  };

  componentDidUpdate(prevProps) {
    let {g} = this.props;
    let {room} = this.state;
    if (g && JSON.stringify(g) !== JSON.stringify(prevProps.g) && g.room !== room) {
      if (room) {
        this.exitVideoRoom(room, () => {
          this.initVideoRoom(g.room, g.janus);
        });
      } else {
        this.initVideoRoom(g.room, g.janus);
      }
    }
    if (g === null && room) {
      this.exitVideoRoom(room, () => {});
    }
  };

  componentWillUnmount() {
    this.exitVideoRoom(this.state.room, () => {});
  };

  initVideoRoom = (roomid, inst) => {
    const gateway = this.props.gateways[inst];
    gateway.gateway.attach({
      plugin: "janus.plugin.videoroom",
      opaqueId: "preview_shidur",
      success: (videoroom) => {
        gateway.log(`[room ${roomid}] attach success`, videoroom.getId());
        this.setState({room: roomid, videoroom, remoteFeed: null});
        let {user} = this.props;
        let register = {request: "join", room: roomid, ptype: "publisher", display: JSON.stringify(user)};
        videoroom.send({message: register});
      },
      error: (err) => {
        gateway.error(`[room ${roomid}] attach error`, err);
      },
      consentDialog: (on) => {
        gateway.debug(`[room ${roomid}] consent dialog should be ${on ? "on" : "off"} now`);
      },
      mediaState: (medium, on) => {
        gateway.log(`[room ${roomid}] Janus ${on ? "started" : "stopped"} receiving our ${medium}`);
      },
      webrtcState: (on) => {
        gateway.log(`[room ${roomid}] Janus says our WebRTC PeerConnection is ${on ? "up" : "down"} now`);
      },
      slowLink: (uplink, lost, mid) => {
        gateway.warn(
          `[room ${roomid}] Janus reports problems ${
            uplink ? "sending" : "receiving"
          } packets on mid ${mid} (${lost} lost packets)`
        );
      },
      onmessage: (msg, jsep) => {
        this.onMessage(gateway, roomid, msg, jsep);
      },
      onlocalstream: (mystream) => {
        gateway.log(`[room ${roomid}] ::: Got a local stream :::`, mystream);
      },
      oncleanup: () => {
        gateway.log(`[room ${roomid}] ::: Got a cleanup notification: we are unpublished now :::`);
      },
    });
  };

  exitVideoRoom = (roomid, callback) => {
    if (this.state.videoroom) {
      let leave_room = {request: "leave", room: roomid};
      this.state.videoroom.send({
        message: leave_room,
        success: () => {
          this.setState({feeds: [], mids: [], room: null});
          this.state.videoroom.detach();
          if (this.state.remoteFeed) this.state.remoteFeed.detach();
          callback();
        },
        error: () => {
          this.setState({feeds: [], mids: [], room: null});
          callback();
        },
      });
    }
  };

  onMessage = (gateway, roomid, msg, jsep) => {
    gateway.debug(`[room ${roomid}] ::: Got a message (publisher) :::`, msg);
    let event = msg["videoroom"];
    if (event !== undefined && event !== null) {
      if (event === "joined") {
        let myid = msg["id"];
        let mypvtid = msg["private_id"];
        this.setState({myid, mypvtid});
        console.debug(`[AudioOut] [room ${roomid}] Successfully joined room`, myid);
        if (msg["publishers"] !== undefined && msg["publishers"] !== null) {
          let list = msg["publishers"];
          //FIXME: Tmp fix for black screen in room caoused by feed with video_codec = none
          let feeds = list
            .sort((a, b) => JSON.parse(a.display).timestamp - JSON.parse(b.display).timestamp)
            .filter((feeder) => JSON.parse(feeder.display).role === "user");
          console.log(`[AudioOut] [room ${roomid}] :: Got publishers list: `, feeds);
          let subscription = [];
          for (let f in feeds) {
            let id = feeds[f]["id"];
            let display = JSON.parse(feeds[f]["display"]);
            let talk = feeds[f]["talking"];
            let streams = feeds[f]["streams"];
            feeds[f].display = display;
            feeds[f].talk = talk;
            for (let i in streams) {
              let stream = streams[i];
              stream["id"] = id;
              stream["display"] = display;
              if (stream.type === "audio" && stream.codec === "opus") {
                subscription.push({feed: id, mid: stream.mid});
              }
            }
          }
          this.setState({feeds});
          if (subscription.length > 0) {
            this.subscribeTo(gateway, roomid, subscription);
          }
        }
      } else if (event === "talking") {
        let {feeds} = this.state;
        let id = msg["id"];
        console.log(`[AudioOut] [room ${roomid}] started talking`, id);
        for (let i = 0; i < feeds.length; i++) {
          if (feeds[i] && feeds[i].id === id) {
            feeds[i].talk = true;
            this.setState({feeds});
          }
        }
      } else if (event === "stopped-talking") {
        let {feeds} = this.state;
        let id = msg["id"];
        console.log(`[AudioOut] [room ${roomid}] stopped talking`, id);
        for (let i = 0; i < feeds.length; i++) {
          if (feeds[i] && feeds[i].id === id) {
            feeds[i].talk = false;
            this.setState({feeds});
          }
        }
      } else if (event === "destroyed") {
        console.warn(`[AudioOut] [room ${roomid}] room destroyed!`);
      } else if (event === "event") {
        let {user, myid} = this.state;
        if (msg["streams"] !== undefined && msg["streams"] !== null) {
          let streams = msg["streams"];
          for (let i in streams) {
            let stream = streams[i];
            stream["id"] = myid;
            stream["display"] = user;
          }
        } else if (msg["publishers"] !== undefined && msg["publishers"] !== null) {
          let feed = msg["publishers"];
          let {feeds} = this.state;
          gateway.log(`[AudioOut] [room ${roomid}] :: Got publishers list: `, feeds);
          let subscription = [];
          for (let f in feed) {
            let id = feed[f]["id"];
            let display = JSON.parse(feed[f]["display"]);
            if (display.role !== "user") return;
            let streams = feed[f]["streams"];
            feed[f].display = display;
            for (let i in streams) {
              let stream = streams[i];
              stream["id"] = id;
              stream["display"] = display;
              if (stream.type === "audio" && stream.codec === "opus") {
                subscription.push({feed: id, mid: stream.mid});
              }
            }
          }
          const isExistFeed = feeds.find((f) => f.id === feed[0].id);
          if (!isExistFeed) {
            feeds.push(feed[0]);
            this.setState({feeds});
          }
          if (subscription.length > 0) {
            this.subscribeTo(gateway, roomid, subscription);
          }
        } else if (msg["leaving"] !== undefined && msg["leaving"] !== null) {
          let leaving = msg["leaving"];
          console.log(`[AudioOut] [room ${roomid}] Publisher left`, leaving);
          this.unsubscribeFrom(leaving);
        } else if (msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
          let unpublished = msg["unpublished"];
          console.log(`[AudioOut] [room ${roomid}] Publisher left`, unpublished);
          if (unpublished === "ok") {
            this.state.videoroom.hangup();
            return;
          }
          this.unsubscribeFrom(unpublished);
        } else if (msg["error"] !== undefined && msg["error"] !== null) {
          if (msg["error_code"] === 426) {
            console.error(`[AudioOut] [room ${roomid}] no such room`);
          } else {
            console.error(`[AudioOut] [room ${roomid}] no such room`, msg["error"]);
          }
        }
      }
    }
    if (jsep !== undefined && jsep !== null) {
      gateway.debug(`[room ${roomid}] Handling SDP as well...`, jsep);
      this.state.videoroom.handleRemoteJsep({jsep});
    }
  };

  newRemoteFeed = (gateway, roomid, subscription) => {
    gateway.gateway.attach({
      plugin: "janus.plugin.videoroom",
      opaqueId: "remotefeed_user",
      success: (pluginHandle) => {
        gateway.log(`[room ${roomid}] [remoteFeed] attach success`, pluginHandle.getId());
        let remoteFeed = pluginHandle;
        this.setState({remoteFeed, creatingFeed: false});
        let subscribe = {request: "join", room: this.state.room, ptype: "subscriber", streams: subscription};
        remoteFeed.send({message: subscribe});
      },
      error: (err) => {
        gateway.error(`[room ${roomid}] [remoteFeed] attach error`, err);
      },
      iceState: (state) => {
        gateway.log(`[room ${roomid}] [remoteFeed] ICE state changed to`, state);
      },
      webrtcState: (on) => {
        gateway.log(`[room ${roomid}] [remoteFeed] Janus says this WebRTC PeerConnection is ${on ? "up" : "down"} now`);
      },
      slowLink: (uplink, nacks) => {
        gateway.warn(
          `[room ${roomid}] [remoteFeed] Janus reports problems ` +
            (uplink ? "sending" : "receiving") +
            " packets on this PeerConnection (remote feed, " +
            nacks +
            " NACKs/s " +
            (uplink ? "received" : "sent") +
            ")"
        );
      },
      onmessage: (msg, jsep) => {
        let event = msg["videoroom"];
        if (msg["error"] !== undefined && msg["error"] !== null) {
          console.error(`[AudioOut] [room ${roomid}] [remoteFeed] error`, msg["error"]);
        } else if (event !== undefined && event !== null) {
          if (event === "attached") {
            console.debug(`[AudioOut] [room ${roomid}] [remoteFeed] successfully attached to feed in room`);
          } else if (event === "event") {
            // Check if we got an event on a simulcast-related event from this publisher
          } else {
            // What has just happened?
          }
        }
        if (msg["streams"]) {
          let {mids} = this.state;
          for (let i in msg["streams"]) {
            let mindex = msg["streams"][i]["mid"];
            mids[mindex] = msg["streams"][i];
          }
          this.setState({mids});
        }
        if (jsep !== undefined && jsep !== null) {
          gateway.debug(`[room ${roomid}] [remoteFeed] Handling SDP as well...`, jsep);
          // Answer and attach
          this.state.remoteFeed.createAnswer({
            jsep: jsep,
            media: {audioSend: false, videoSend: false},
            success: (jsep) => {
              gateway.debug(`[room ${roomid}] [remoteFeed] Got SDP!`, jsep);
              let body = {request: "start", room: this.state.room};
              this.state.remoteFeed.send({message: body, jsep: jsep});
            },
            error: (err) => {
              gateway.error(`[room ${roomid}][remoteFeed]  WebRTC error`, err);
            },
          });
        }
      },
      onremotetrack: (track, mid, on) => {
        let {mids} = this.state;
        let feed = mids[mid].feed_id;
        if (track.kind === "audio" && on) {
          // New audio track: create a stream out of it, and use a hidden <audio> element
          let stream = new MediaStream();
          stream.addTrack(track.clone());
          console.log(`[AudioOut] [room ${roomid}] [remoteFeed] Created remote audio stream`, stream);
          let remoteaudio = this.refs["pa" + feed];
          if (remoteaudio) Janus.attachMediaStream(remoteaudio, stream);
        }
      },
      ondataopen: (data) => {
        gateway.debug(`[room ${roomid}] [remoteFeed] The DataChannel is available!`);
      },
      ondata: (data) => {
        gateway.debug(`[room ${roomid}] [remoteFeed] We got data from the DataChannel!`, data);
      },
      oncleanup: () => {
        gateway.debug(`[room ${roomid}] [remoteFeed] ::: Got a cleanup notification :::`);
      },
    });
  };

  subscribeTo = (gateway, roomid, subscription) => {
    if (this.state.remoteFeed) {
      this.state.remoteFeed.send({message: {request: "subscribe", streams: subscription}});
      return;
    }
    if (this.state.creatingFeed) {
      setTimeout(() => {
        this.subscribeTo(gateway, roomid, subscription);
      }, 500);
    } else {
      this.setState({creatingFeed: true});
      this.newRemoteFeed(gateway, roomid, subscription);
    }
  };

  unsubscribeFrom = (id) => {
    let {feeds} = this.state;
    let {remoteFeed} = this.state;
    for (let i = 0; i < feeds.length; i++) {
      if (feeds[i].id === id) {
        console.log("[AudioOut] Feed " + feeds[i] + " (" + id + ") has left the room, detaching");
        feeds.splice(i, 1);
        let unsubscribe = {request: "unsubscribe", streams: [{feed: id}]};
        if (remoteFeed !== null) remoteFeed.send({message: unsubscribe});
        this.setState({feeds});
        break;
      }
    }
  };

  render() {
    const {feeds} = this.state;
    const {audio} = this.props;

    let program_feeds = feeds.map((feed) => {
      //let name = users[feed.display.id] && users[feed.display.id].display ? users[feed.display.id].display : "";
      let name = "";
      if (feed) {
        let id = feed.id;
        let talk = feed.talk;
        return (
          <div key={"t" + id} className="title">
            {name}
            <audio
              className={talk ? "talk" : ""}
              key={"a" + id}
              ref={"pa" + id}
              id={"pa" + id}
              autoPlay={true}
              controls={true}
              muted={!audio}
              playsInline={true}
            />
          </div>
        );
      }
      return true;
    });

    return <div>{program_feeds}</div>;
  }

}

export default UsersHandleAudioOut;

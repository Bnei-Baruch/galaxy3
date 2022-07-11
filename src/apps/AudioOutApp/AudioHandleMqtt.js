import React, {Component} from "react";
import "./AudioHandle.scss";
import log from "loglevel";
import {JanusMqtt} from "../../lib/janus-mqtt";
import {PublisherPlugin} from "../../lib/publisher-plugin";
import {SubscriberPlugin} from "../../lib/subscriber-plugin";
import ConfigStore from "../../shared/ConfigStore";

class AudioHandleMqtt extends Component {
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
      this.exitVideoRoom(room);
    }
  };

  initVideoRoom = (room, inst) => {
    log.info("[audio] Init room: ", room, inst, ConfigStore.globalConfig)
    const {user} = this.props;
    const token = ConfigStore.globalConfig.gateways.rooms[inst].token

    log.info("[audio] token", user, token)

    let janus = new JanusMqtt(user, inst)

    janus.onStatus = (srv, status) => {
      if(status !== "online") {
        setTimeout(() => {
          this.initVideoRoom(room, inst);
        }, 5000)
      }
    }

    let videoroom = new PublisherPlugin();
    videoroom.subTo = this.onJoinFeed;
    videoroom.unsubFrom = this.unsubscribeFrom
    videoroom.talkEvent = this.handleTalking

    let subscriber = new SubscriberPlugin();
    subscriber.onTrack = this.onRemoteTrack;
    subscriber.onUpdate = this.onUpdateStreams;

    janus.init(token).then(data => {
      log.info("[audio] Janus init", data)

      janus.attach(videoroom).then(data => {
        log.info('[audio] Publisher Handle: ', data)

        videoroom.join(room, user).then(data => {
          log.info('[audio] Joined respond :', data)
          this.setState({janus, videoroom, user, room, remoteFeed: null});
          this.onJoinMe(data.publishers, room)
        }).catch(err => {
          log.error('[audio] Join error :', err);
        })
      })

      janus.attach(subscriber).then(data => {
        this.setState({subscriber});
        log.info('[audio] Subscriber Handle: ', data)
      })

    }).catch(err => {
      log.error("[audio] Janus init", err);
      this.exitRoom(/* reconnect= */ true, () => {
        log.error("[audio] error initializing janus", err);
        this.reinitClient(retry);
      });
    })
  }

  onJoinMe = (list, room) => {
    let feeds = list
      .sort((a, b) => JSON.parse(a.display).timestamp - JSON.parse(b.display).timestamp)
      .filter((feeder) => JSON.parse(feeder.display).role === "user");
    log.info(`[AudioOut] Got publishers list: `, feeds);
    let subscription = [];
    for (let f in feeds) {
      let id = feeds[f]["id"];
      let display = JSON.parse(feeds[f]["display"]);
      let talking = feeds[f]["talking"];
      let streams = feeds[f]["streams"];
      feeds[f].display = display;
      feeds[f].talking = talking;
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
      this.subscribeTo(room, subscription);
    }
  }

  onJoinFeed = (feed) => {
    let {feeds, room} = this.state;
    log.info(`[AudioOut] Feed enter: `, feeds);
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
      this.subscribeTo(room, subscription);
    }
  }



  exitVideoRoom = (roomid, callback) => {
    const {videoroom, janus} = this.state;
    this.setState({feeds: [], mids: [], room: null, remoteFeed: false,});

    videoroom.leave().then(r => {
      log.info("[audio] leave respond:", r);

      janus.destroy().then(() => {
        if(typeof callback === "function") callback();
      })
    });
  };

  subscribeTo = (room, subscription) => {
    const {creatingFeed, remoteFeed, subscriber} = this.state

    if (remoteFeed) {
      subscriber.sub(subscription);
      return;
    }

    if (creatingFeed) {
      setTimeout(() => {
        this.subscribeTo(subscription);
      }, 500);
      return;
    }

    subscriber.join(subscription, room).then(data => {
      log.info('[audio] Subscriber join: ', data)
      this.onUpdateStreams(data.streams);
      this.setState({remoteFeed: true, creatingFeed: false});
    });
  };

  unsubscribeFrom = (id) => {
    id = id[0]
    log.info("[audio] unsubscribeFrom", id);
    const {feeds, subscriber} = this.state;
    for (let i = 0; i < feeds.length; i++) {
      if (feeds[i].id === id) {
        log.info("[audio] unsubscribeFrom feed", feeds[i]);

        feeds.splice(i, 1);

        const streams = [{feed: id}]

        const {remoteFeed} = this.state;
        if (remoteFeed !== null && streams.length > 0) {
          subscriber.unsub(streams);
        }

        this.setState({feeds});
        break;
      }
    }
  };

  handleTalking = (id, talking) => {
    const feeds = Object.assign([], this.state.feeds);
    for (let i = 0; i < feeds.length; i++) {
      if (feeds[i] && feeds[i].id === id) {
        feeds[i].talking = talking;
      }
    }
    this.setState({feeds});
  }

  onUpdateStreams = (streams) => {
    const mids = Object.assign([], this.state.mids);
    for (let i in streams) {
      let mindex = streams[i]["mid"];
      //let feed_id = streams[i]["feed_id"];
      mids[mindex] = streams[i];
    }
    this.setState({mids});
  }

  onRemoteTrack = (track, mid, on) => {
    if (!mid) mid = track.id.split("janus")[1];
    log.info("[audio] Remote track (mid=" + mid + ") " + (on ? "added" : "removed") + ":", track);

    let {mids} = this.state;
    let feed = mids[mid].feed_id;
    log.info(" >> This track is coming from feed " + feed + ":", mid);

    if (track.kind === "audio" && on) {
      let stream = new MediaStream([track]);
      log.info(`[audio] Created remote audio stream`, stream);
      let remoteaudio = this.refs["pa" + feed];
      if (remoteaudio) remoteaudio.srcObject = stream;
    }

  }

  render() {
    const {feeds} = this.state;
    const {audio} = this.props;

    let program_feeds = feeds.map((feed) => {
      //let name = users[feed.display.id] && users[feed.display.id].display ? users[feed.display.id].display : "";
      let name = "";
      if (feed) {
        let id = feed.id;
        let talking = feed.talking;
        return (
          <div key={"t" + id} className="title">
            {name}
            <audio
              className={talking ? "talk" : ""}
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

export default AudioHandleMqtt;

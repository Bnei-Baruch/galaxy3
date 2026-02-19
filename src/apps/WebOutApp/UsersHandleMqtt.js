import React, {Component} from "react";
import "./VideoConteiner.scss";
import classNames from "classnames";
import log from "loglevel";
import ConfigStore from "../../shared/ConfigStore";
import {PublisherPlugin} from "../../lib/publisher-plugin";
import {SubscriberPlugin} from "../../lib/subscriber-plugin";

class UsersHandle extends Component {
  state = {
    feeds: [],
    inst: null,
    mids: [],
    name: "",
    room: "",
    num_videos: 0,
    remoteFeed: null,
    janus: null,
    videoroom: null,
    subscriber: null
  };

  componentDidMount() {
    let {g} = this.props;
    let num_videos = g?.users?.filter((u) => u.camera).length;
    if (num_videos > 25) num_videos = 25;
    this.setState({num_videos});
  }

  componentDidUpdate(prevProps) {
    let {g, index, group} = this.props;
    let {room} = this.state;
    if (g && index === 13 && g.room !== room && group) {
      this.setState({room: g.room}, () => {
        this.initVideoRoom(g.room, g.janus);
      });
    }
    if (g && g.room !== room && index !== 13) {
      this.setState({room: g.room}, () => {
        if (room) {
          this.exitVideoRoom(room, () => {
            this.initVideoRoom(g.room, g.janus);
          });
        } else {
          this.initVideoRoom(g.room, g.janus);
        }
      });
    }
    if (g && g.users && JSON.stringify(g) !== JSON.stringify(prevProps.g)) {
      let num_videos = g.users.filter((u) => u.camera && u.role === "user").length;
      if (num_videos > 25) num_videos = 25;
      this.setState({num_videos});
    }
  }

  componentWillUnmount() {
    this.exitVideoRoom(this.state.room, () => {});
  }

  initVideoRoom = (room, inst) => {
    const {user, q, col} = this.props;
    const mit = "col" + col + "_q" + (q+1) + "_" + inst

    log.info("["+mit+"] Init room: ", room, inst, ConfigStore.globalConfig)
    log.info("["+mit+"] mit", mit)

    this.initVideoHandles(room, user, inst)
  }

  initVideoHandles = (room, user, mit) => {
    const {gateways} = this.props;
    const janus = gateways[mit]
    if(janus?.isConnected !== true) {
      setTimeout(() => {
        log.info("["+mit+"] Not connected, waiting... ", janus)
        this.initVideoHandles(room, user, mit)
      }, 1000)
      return
    }
    this.setState({mit, janus});
    let videoroom = new PublisherPlugin();
    videoroom.subTo = this.onJoinFeed;
    videoroom.unsubFrom = this.unsubscribeFrom
    videoroom.talkEvent = this.handleTalking

    janus.attach(videoroom).then(data => {
      log.info("["+mit+"] Publisher Handle: ", data)

      videoroom.join(room, user).then(data => {
        log.info("["+mit+"] Joined respond :", data)
        this.setState({videoroom, user, room, remoteFeed: null});
        this.onJoinMe(data.publishers, room)
      }).catch(err => {
        log.error("["+mit+"] Join error :", err);
      })
    })
  }

  onJoinMe = (list, room) => {
    const {mit} = this.state;
    let feeds = list
      .sort((a, b) => a.metadata.timestamp - b.metadata.timestamp)
      .filter((feeder) => feeder.metadata.role === "user");
    log.info("["+mit+"] Got publishers list: ", feeds);
    let subscription = [];
    for (let f in feeds) {
      let id = feeds[f]["id"];
      let display = feeds[f].metadata;
      let talking = feeds[f]["talking"];
      let streams = feeds[f]["streams"];
      feeds[f].talking = talking;
      for (let i in streams) {
        let stream = streams[i];
        stream["id"] = id;
        stream["display"] = display;
        if (stream.type === "video" && stream.codec === "h264") {
          if(stream?.h264_profile) {
            if(stream?.h264_profile === "42e01f")
              subscription.push({feed: id, mid: stream.mid});
          } else {
            subscription.push({feed: id, mid: stream.mid});
          }
        }
      }
    }
    this.setState({feeds});
    if (subscription.length > 0) {
      this.subscribeTo(room, subscription);
    }
  }

  onJoinFeed = (feed) => {
    let {feeds, room, mit} = this.state;
    log.info("["+mit+"] Feed enter: ", feeds);
    let subscription = [];
    for (let f in feed) {
      let id = feed[f]["id"];
      let display = feed[f].metadata;
      if (display.role !== "user") return;
      let streams = feed[f]["streams"];
      for (let i in streams) {
        let stream = streams[i];
        stream["id"] = id;
        stream["display"] = display;
        if (stream.type === "video" && stream.codec === "h264") {
          if(stream?.h264_profile) {
            if(stream?.h264_profile === "42e01f")
              subscription.push({feed: id, mid: stream.mid});
          } else {
            subscription.push({feed: id, mid: stream.mid});
          }
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

  exitPlugins = (callback) => {
    const {subscriber, videoroom, janus, mit} = this.state;
    if(janus) {
      if(subscriber) janus.detach(subscriber)
      janus.detach(videoroom).then(() => {
        log.info("["+mit+"] plugin detached:");
        this.setState({feeds: [], mids: [], remoteFeed: false, videoroom: null, subscriber: null, janus: null});
        if(typeof callback === "function") callback();
      })
    } else {
      this.setState({feeds: [], mids: [], remoteFeed: false, videoroom: null, subscriber: null, janus: null});
      if(typeof callback === "function") callback();
    }
  }

  exitVideoRoom = (roomid, callback) => {
    const {videoroom, mit, feeds} = this.state;
    feeds.forEach(f => {
      let e = this.refs["pv" + f.id];
      if (e) {
        e.src = "";
        e.srcObject = null;
        e.remove();
      }
    })
    if(videoroom) {
      videoroom.leave().then(r => {
        log.info("["+mit+"] leave respond:", r);
        this.exitPlugins(callback)
      }).catch(e => {
        log.error("["+mit+"] leave error:", e);
        this.exitPlugins(callback)
      });
    } else {
      this.exitPlugins(callback)
    }
  };

  subscribeTo = (room, subscription) => {
    let {janus, creatingFeed, remoteFeed, subscriber, mit} = this.state

    if (remoteFeed && subscriber) {
      subscriber.sub(subscription);
      return;
    }

    if (creatingFeed) {
      setTimeout(() => {
        this.subscribeTo(subscription);
      }, 500);
      return;
    }

    subscriber = new SubscriberPlugin();
    subscriber.onTrack = this.onRemoteTrack;
    subscriber.onUpdate = this.onUpdateStreams;

    janus.attach(subscriber).then(data => {
      this.setState({subscriber});
      log.info("["+mit+"] Subscriber Handle: ", data)
      subscriber.join(subscription, room).then(data => {
        log.info("["+mit+"] Subscriber join: ", data)
        this.onUpdateStreams(data.streams);
        this.setState({remoteFeed: true, creatingFeed: false});
      });
    })
  };

  unsubscribeFrom = (id) => {
    id = id[0]
    const {feeds, subscriber, mit} = this.state;
    log.info("["+mit+"] unsubscribeFrom", id);
    for (let i = 0; i < feeds.length; i++) {
      if (feeds[i].id === id) {
        log.info("["+mit+"] unsubscribeFrom feed", feeds[i]);

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

  onRemoteTrack = (track, stream, on) => {
    const feed = stream.id;
    if (track.kind === "video" && on) {
      let remotevideo = this.refs["pv" + feed];
      if (remotevideo) remotevideo.srcObject = stream;
    }
  }

  render() {
    const {feeds, num_videos} = this.state;
    const {g} = this.props;
    const width = "400";
    const height = "300";
    const autoPlay = true;
    const controls = false;
    const muted = true;
    //const q = (<b style={{color: 'red', fontSize: '20px', fontFamily: 'Verdana', fontWeight: 'bold'}}>?</b>);

    let program_feeds = feeds.map((feed) => {
      let camera = g && g.users && !!g.users.find((u) => feed.id === u.rfid && u.camera);
      if (feed) {
        let id = feed.id;
        let talk = feed.talk;
        return (
          <div className={camera ? "video" : "hidden"} key={"prov" + id} ref={"provideo" + id} id={"provideo" + id}>
            <div className={classNames("video__overlay", {talk: talk})}>
              {/*{question ? <div className="question">*/}
              {/*    <svg viewBox="0 0 50 50">*/}
              {/*        <text x="25" y="25" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">&#xF128;</text>*/}
              {/*    </svg>*/}
              {/*    {st ? <Icon name="checkmark" size="small" color="green"/> : ''}*/}
              {/*</div>:''}*/}
            </div>
            <video
              key={id}
              ref={"pv" + id}
              id={"pv" + id}
              width={width}
              height={height}
              autoPlay={autoPlay}
              controls={controls}
              muted={muted}
              playsInline={true}
            />
          </div>
        );
      }
      return true;
    });

    return (
      <div className={`vclient__main-wrapper no-of-videos-${num_videos} layout--equal broadcast--off`}>
        <div className="videos-panel">
          <div className="videos">
            <div className="videos__wrapper">{program_feeds}</div>
          </div>
        </div>
      </div>
    );
  }
}

export default UsersHandle;

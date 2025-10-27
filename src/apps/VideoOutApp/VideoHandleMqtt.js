import React, {Component} from "react";
import "./VideoHandle.scss";
import classNames from "classnames";
import log from "loglevel";
import ConfigStore from "../../shared/ConfigStore";
import {PublisherPlugin} from "../../lib/publisher-plugin";
import {SubscriberPlugin} from "../../lib/subscriber-plugin";

class VideoHandleMqtt extends Component {
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

  getShownCount = (feeds) => {
    const {g} = this.props;
    if (!g || !g.users) return feeds.length;
    const shown = feeds.filter((f) => g.users.find((u) => u.rfid === f.id && u.camera));
    return shown.length;
  }

  componentDidMount() {
    let {g} = this.props;
    let num_videos = g?.users?.filter((u) => u.camera && u.role === "user").length || 0;
    if (num_videos > 25) num_videos = 25; // Cap at 25 like the original
    
    this.setState({num_videos});
  }

  componentDidUpdate(prevProps) {
    let {g, index, group} = this.props;
    const {room} = this.state;
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
      if (num_videos > 25) num_videos = 25; // Cap at 25 like the original
      
      this.setState({num_videos});
    }
  }

  componentWillUnmount() {
    this.exitVideoRoom(this.state.room, () => {});
  }

  initVideoRoom = (room, inst) => {
    const {gateways, user, q, col} = this.props;
    let janus = gateways[inst];
    const mit = "col" + col + "_q" + (q+1) + "_" + inst

    log.info("["+mit+"] Init room: ", room, inst, ConfigStore.globalConfig)
    log.info("["+mit+"] mit", mit)

    this.setState({mit, janus});

    this.initVideoHandles(janus, room, user)
  }

  initVideoHandles = (janus, room, user, mit) => {
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
      .sort((a, b) => JSON.parse(a.display).timestamp - JSON.parse(b.display).timestamp)
      .filter((feeder) => JSON.parse(feeder.display).role === "user");
    log.info("["+mit+"] Got publishers list: ", feeds);
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
    const shown = this.getShownCount(feeds);
    const layoutCount = shown >= 10 ? 10 : shown;
    this.setState({feeds, num_videos: layoutCount});
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
      let display = JSON.parse(feed[f]["display"]);
      if (display.role !== "user") return;
      let streams = feed[f]["streams"];
      feed[f].display = display;
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
      const shown = this.getShownCount(feeds);
      const layoutCount = shown >= 10 ? 10 : shown;
      this.setState({feeds, num_videos: layoutCount});
    }
    if (subscription.length > 0) {
      this.subscribeTo(room, subscription);
    }
  }

  exitPlugins = (callback) => {
    const {subscriber, videoroom, janus, mit} = this.state;
    if(subscriber) janus.detach(subscriber)
    janus.detach(videoroom).then(() => {
      log.info("["+mit+"] plugin detached:");
      this.setState({feeds: [], mids: [], remoteFeed: false, videoroom: null, subscriber: null, janus: null});
      if(typeof callback === "function") callback();
    })
  }

  exitVideoRoom = (roomid, callback) => {
    const {videoroom, mit} = this.state;
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
      if (feeds[i] && feeds[i].id === id && feeds[i].display?.is_desktop) {
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
    const {g, qst_group, q} = this.props;
    const width = "400";
    const height = "300";
    const autoPlay = true;
    const controls = false;
    const muted = true;
    //const q = (<b style={{color: "red", fontSize: "20px", fontFamily: "Verdana", fontWeight: "bold"}}>?</b>);

    // Check if there are any real groups in this room
    const hasAnyGroup = g && g.users && g.users.some((u) => u.camera && u.role === "user" && u.extra?.isGroup);

    // Sort feeds: group first, then others
    const sortedFeeds = [...feeds].sort((a, b) => {
      const aUser = g?.users?.find((u) => u.rfid === a.id);
      const bUser = g?.users?.find((u) => u.rfid === b.id);
      const aIsGroup = aUser?.extra?.isGroup;
      const bIsGroup = bUser?.extra?.isGroup;
      if (aIsGroup && !bIsGroup) return -1; // a (group) comes first
      if (!aIsGroup && bIsGroup) return 1;  // b (group) comes first
      return 0; // maintain original order for non-groups
    });

    // Count visible videos (not hidden)
    const visibleVideoCount = sortedFeeds.filter((feed) => {
      return g && g.users && !!g.users.find((u) => feed.id === u.rfid && u.camera);
    }).length;

    // When there's a group, limit regular users to 4 (plus the group itself)
    let regularUserCount = 0;
    const maxRegularUsers = 4;

    let program_feeds = sortedFeeds.map((feed) => {
      let camera = g && g.users && !!g.users.find((u) => feed.id === u.rfid && u.camera);
      if (feed) {
        let id = feed.id;
        let talk = feed.talking && qst_group;
        // Check if this user has the real group flag
        const user = g?.users?.find((u) => u.rfid === id);
        let isGroup = user?.extra?.isGroup;
        
        // If there's a group in the room, limit regular users to 4
        if (hasAnyGroup && !isGroup && camera) {
          regularUserCount++;
          if (regularUserCount > maxRegularUsers) {
            camera = false; // Hide users beyond the 4th
          }
        }
        
        // If this is the group and it's the only visible video, add video--alone class
        let isAlone = isGroup && visibleVideoCount === 1;
        
        return (
          <div 
            className={classNames(camera ? "video" : "hidden", {
              "video--group": isGroup,
              "video--alone": isAlone
            })} 
            key={"prov" + id} 
            ref={"provideo" + id} 
            id={"provideo" + id}
          >
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
            <div className={classNames("videos__wrapper", {"has-group": hasAnyGroup})}>
              {program_feeds}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default VideoHandleMqtt;

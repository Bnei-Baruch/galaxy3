import React, {Component} from "react";
import "./JanusHandle.scss";
import classNames from "classnames";
import log from "loglevel";
import {Button} from "semantic-ui-react";
import ConfigStore from "../../shared/ConfigStore";
import {PublisherPlugin} from "../../lib/publisher-plugin";
import {SubscriberPlugin} from "../../lib/subscriber-plugin";

class JanusHandleMqtt extends Component {
  state = {
    feeds: [],
    inst: null,
    mids: [],
    name: "",
    room: "",
    myid: null,
    mystream: null,
    num_videos: 0,
  };

  getShownCount = (feeds) => {
    const {g} = this.props;
    if (!g || !g.users) return feeds.length;
    const shown = feeds.filter((f) => g.users.find((u) => u.rfid === f.id && u.camera));
    return shown.length;
  }

  hasGroup = () => {
    const {g} = this.props;
    if (!g || !g.users) return false;
    return g.users.some((u) => u.camera && u.role === "user" && u.extra?.isGroup);
  }

  getLayoutCount = (feeds) => {
    const shown = this.getShownCount(feeds);
    const cap = this.hasGroup() ? 10 : 25;
    return shown >= cap ? cap : shown;
  }

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
    // Recompute grid size when feeds or the live user/camera list changed.
    // Guard against loops by only updating when the value actually differs.
    const num_videos = this.getLayoutCount(this.state.feeds);
    if (num_videos !== this.state.num_videos) {
      this.setState({num_videos});
    }
  }

  componentWillUnmount() {
    this.exitVideoRoom(this.state.room, () => {});
  }

  initVideoRoom = (room, inst) => {
    const {gateways, user, q, col} = this.props;
    const mit = "col" + col + "_q" + (q+1) + "_" + inst;
    log.info("["+mit+"] Init room: ", room, inst, ConfigStore.globalConfig);

    const janus = gateways[inst];
    if (janus?.isConnected) {
      this.setState({mit, janus});
      this.initVideoHandles(janus, room, user, mit);
      return;
    }

    // Not connected yet — ask the parent to init the gateway and wait for it.
    const p = this.props.initJanus(inst);
    if (p && typeof p.then === "function") {
      p.then((ready) => {
        // Room may have changed while we were waiting.
        if (this.state.room && this.state.room !== room) return;
        // Parent's initJanus resolves to null on failure (it retries internally).
        // Reschedule locally so this component keeps trying without dying.
        if (!ready || !ready.isConnected) {
          log.warn("["+mit+"] gateway not ready, will retry");
          setTimeout(() => this.initVideoRoom(room, inst), 5000);
          return;
        }
        this.setState({mit, janus: ready});
        this.initVideoHandles(ready, room, user, mit);
      }).catch((err) => {
        log.error("["+mit+"] initJanus rejected unexpectedly: ", err);
        setTimeout(() => this.initVideoRoom(room, inst), 5000);
      });
    } else {
      // Backwards-compat: parent's initJanus did not return a promise.
      setTimeout(() => {
        log.info("["+mit+"] Not connected, waiting... ", gateways[inst]);
        this.initVideoRoom(room, inst);
      }, 1000);
    }
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
    }).catch(err => {
      log.error("["+mit+"] Publisher attach error :", err);
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
    const num_videos = this.getLayoutCount(feeds);
    this.setState({feeds, num_videos});
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
      const num_videos = this.getLayoutCount(feeds);
      this.setState({feeds, num_videos});
    }
    if (subscription.length > 0) {
      this.subscribeTo(room, subscription);
    }
  }

  exitPlugins = (callback) => {
    const {subscriber, videoroom, janus, mit} = this.state;
    const finalize = () => {
      log.info("["+mit+"] plugin detached");
      this.setState({feeds: [], mids: [], remoteFeed: false, videoroom: null, subscriber: null, janus: null});
      if(typeof callback === "function") callback();
    };
    if(janus) {
      // Best-effort detach: never let a dead/disconnected gateway block teardown.
      const detachSub = subscriber
        ? Promise.resolve(janus.detach(subscriber)).catch(err => {
            log.error("["+mit+"] subscriber detach error:", err);
          })
        : Promise.resolve();
      const detachPub = videoroom
        ? Promise.resolve(janus.detach(videoroom)).catch(err => {
            log.error("["+mit+"] publisher detach error:", err);
          })
        : Promise.resolve();
      Promise.allSettled([detachSub, detachPub]).then(finalize);
    } else {
      finalize();
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
      const p = subscriber.sub(subscription);
      if (p && typeof p.catch === "function") {
        p.catch(err => log.error("["+mit+"] subscriber.sub error:", err));
      }
      return;
    }

    if (creatingFeed) {
      setTimeout(() => {
        this.subscribeTo(subscription);
      }, 500);
      return;
    }

    if (!janus || janus.isConnected !== true) {
      log.warn("["+mit+"] subscribeTo: gateway not connected, skipping");
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
        if (data && data.streams) this.onUpdateStreams(data.streams);
        this.setState({remoteFeed: true, creatingFeed: false});
      }).catch(err => {
        log.error("["+mit+"] Subscriber join error:", err);
        this.setState({creatingFeed: false});
      });
    }).catch(err => {
      log.error("["+mit+"] Subscriber attach error:", err);
      this.setState({creatingFeed: false});
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
        if (remoteFeed !== null && streams.length > 0 && subscriber) {
          const p = subscriber.unsub(streams);
          if (p && typeof p.catch === "function") {
            p.catch(err => log.error("["+mit+"] subscriber.unsub error:", err));
          }
        }

        const num_videos = this.getLayoutCount(feeds);
        this.setState({feeds, num_videos});
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
    let feed = stream.id;
    if (on && track.kind === "video") {
        log.debug("[client] Created remote video stream:", stream);
        const remotevideo = this.refs["pv" + feed];
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

    const groupUsers = g && g.users ? g.users.filter((u) => u.camera && u.role === "user" && u.extra?.isGroup) : [];
    const groupCount = Math.min(groupUsers.length, 2);
    const hasAnyGroup = groupCount > 0;

    const allowedGroupIds = groupUsers
      .sort((a, b) => String(a.rfid).localeCompare(String(b.rfid)))
      .slice(0, 2)
      .map(u => u.rfid);

    const sortedFeeds = [...feeds].sort((a, b) => {
      const aUser = g?.users?.find((u) => u.rfid === a.id);
      const bUser = g?.users?.find((u) => u.rfid === b.id);
      const aIsGroup = aUser?.extra?.isGroup && allowedGroupIds.includes(a.id);
      const bIsGroup = bUser?.extra?.isGroup && allowedGroupIds.includes(b.id);
      if (aIsGroup && !bIsGroup) return -1;
      if (!aIsGroup && bIsGroup) return 1;
      return 0;
    });

    const visibleVideoCount = sortedFeeds.filter((feed) => {
      return g && g.users && !!g.users.find((u) => feed.id === u.rfid && u.camera);
    }).length;

    let regularUserCount = 0;
    const maxRegularUsers = 4;

    let program_feeds = sortedFeeds.map((feed) => {
      let camera = g && g.users && !!g.users.find((u) => feed.id === u.rfid && u.camera);
      if (feed) {
        let id = feed.id;
        let talk = feed.talk;
        const user = g?.users?.find((u) => u.rfid === id);
        let isGroup = user?.extra?.isGroup && allowedGroupIds.includes(id);

        if (hasAnyGroup && !isGroup && camera) {
          regularUserCount++;
          if (regularUserCount > maxRegularUsers) {
            camera = false;
          }
        }

        let isAlone = isGroup && visibleVideoCount === 1;

        return (
          <div
            className={classNames(camera ? "video" : "hidden", {
              "video--group": isGroup,
              "video--group--multiple": isGroup && groupCount > 1,
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
              className={talk ? "talk" : ""}
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
            <div className={classNames("videos__wrapper", {"has-group": hasAnyGroup})}>
              {program_feeds}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default JanusHandleMqtt;

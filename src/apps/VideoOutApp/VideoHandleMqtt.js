import React, {Component} from "react";
import "./VideoHandle.scss";
import classNames from "classnames";
import log from "loglevel";
import ConfigStore from "../../shared/ConfigStore";
import {JanusMqtt} from "../../lib/janus-mqtt";
import {PublisherPlugin} from "../../lib/publisher-plugin";
import {SubscriberPlugin} from "../../lib/subscriber-plugin";

class VideoHandleMqtt extends Component {
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
    log.info("[VideoHandle] Init room: ", room, inst, ConfigStore.globalConfig)
    const {user} = this.props;
    let {janus} = this.state;
    const token = ConfigStore.globalConfig.gateways.rooms[inst].token

    log.info("[VideoHandle] token", user, token)

    if(janus) {
      this.initVideoHandles(janus);
    } else {
      janus = new JanusMqtt(user, inst)
      janus.init(token).then(data => {
        log.info("[VideoHandle] Janus init", data)
        this.initVideoHandles(janus)

      }).catch(err => {
        log.error("[VideoHandle] Janus init", err);
        this.exitRoom(/* reconnect= */ true, () => {
          log.error("[VideoHandle] error initializing janus", err);
          this.reinitClient(retry);
        });
      })
    }

  }

  initVideoHandles = (janus) => {
    let videoroom = new PublisherPlugin();
    videoroom.subTo = this.onJoinFeed;
    videoroom.unsubFrom = this.unsubscribeFrom
    videoroom.talkEvent = this.handleTalking

    let subscriber = new SubscriberPlugin();
    subscriber.onTrack = this.onRemoteTrack;
    subscriber.onUpdate = this.onUpdateStreams;

    janus.attach(videoroom).then(data => {
      log.info('[VideoHandle] Publisher Handle: ', data)

      videoroom.join(room, user).then(data => {
        log.info('[VideoHandle] Joined respond :', data)
        this.setState({janus, videoroom, user, room, remoteFeed: null});
        this.onJoinMe(data.publishers, room)
      }).catch(err => {
        log.error('[VideoHandle] Join error :', err);
      })
    })

    janus.attach(subscriber).then(data => {
      this.setState({subscriber});
      log.info('[VideoHandle] Subscriber Handle: ', data)
    })
  }

  onJoinMe = (list, room) => {
    let feeds = list
      .sort((a, b) => JSON.parse(a.display).timestamp - JSON.parse(b.display).timestamp)
      .filter((feeder) => JSON.parse(feeder.display).role === "user");
    log.info(`[VideoHandle] Got publishers list: `, feeds);
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
    log.info(`[VideoHandle] Feed enter: `, feeds);
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
      log.info("[VideoHandle] leave respond:", r);

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
      log.info('[VideoHandle] Subscriber join: ', data)
      this.onUpdateStreams(data.streams);
      this.setState({remoteFeed: true, creatingFeed: false});
    });
  };

  unsubscribeFrom = (id) => {
    id = id[0]
    log.info("[VideoHandle] unsubscribeFrom", id);
    const {feeds, subscriber} = this.state;
    for (let i = 0; i < feeds.length; i++) {
      if (feeds[i].id === id) {
        log.info("[VideoHandle] unsubscribeFrom feed", feeds[i]);

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
    let {mids} = this.state;
    let feed = mids[mid].feed_id;
    if (track.kind === "video" && on) {
      let stream = new MediaStream();
      stream.addTrack(track.clone());
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

export default VideoHandleMqtt;

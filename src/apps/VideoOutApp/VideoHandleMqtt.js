import React, {useRef, useEffect, useState} from "react";
import "./VideoHandle.scss";
import classNames from "classnames";
import log from "loglevel";
import ConfigStore from "../../shared/ConfigStore";
import {PublisherPlugin} from "../../lib/publisher-plugin";
import {SubscriberPlugin} from "../../lib/subscriber-plugin";
import chalk from "chalk";

const VideoHandleMqtt = (props) => {
  // state = {
  //   feeds: [],
  //   inst: null,
  //   mids: [],
  //   name: "",
  //   room: "",
  //   vcount: 0,
  //   remoteFeed: null,
  //   janus: null,
  //   videoroom: null,
  //   subscriber: null
  //
  // };

  const {g, index, group, gateways, user, q, col} = props;

  const [vcount, setVcount] = useState(0);
  const [feeds, setFeeds] = useState([]);
  const [janus, setJanus] = useState(null);

  let mit = "col" + col + "_q" + (q+1) + "_"
  let videoroom = null
  let subscriber = null
  let room = null
  let mids = []

  useEffect(() => {
    let {g} = props;
    let vcount = g?.users?.filter((u) => u.camera).length;
    if (vcount > 25) setVcount(25)
    setVcount(vcount)
  }, [g]);

  useEffect(() => {
    log.info(g)
    if(g && g?.room !== room) {
      room = g.room
      log.info(chalk.magenta("[VideoHandleMqtt] First IF : ", g, index, g.room, group));
      initVideoRoom(g.room, g.janus);
      return () => {
        exitVideoRoom(g.room, () => {});
      }
    }
  }, [g && g?.room]);

  // componentDidMount() {
  //   let {g} = this.props;
  //   let vcount = g?.users?.filter((u) => u.camera).length;
  //   if (vcount > 25) vcount = 25;
  //   this.setState({vcount});
  // }
  //
  // componentDidUpdate(prevProps) {
  //   let {g, index, group} = this.props;
  //   const {room} = this.state;
  //   if (g && index === 13 && g.room !== room && group) {
  //     log.info(chalk.magenta("[VideoHandleMqtt] First IF : ", g, index, g.room, room, group));
  //     this.setState({room: g.room}, () => {
  //       this.initVideoRoom(g.room, g.janus);
  //     });
  //   }
  //   if (g && g.room !== room && index !== 13) {
  //     log.info(chalk.magenta("[VideoHandleMqtt] Second IF : ", g, index, g.room, room));
  //     this.setState({room: g.room}, () => {
  //       if (room) {
  //         this.exitVideoRoom(room, () => {
  //           this.initVideoRoom(g.room, g.janus);
  //         });
  //       } else {
  //         this.initVideoRoom(g.room, g.janus);
  //       }
  //     });
  //   }
  //   if (g && g.users && JSON.stringify(g) !== JSON.stringify(prevProps.g)) {
  //     let vcount = g.users.filter((u) => u.camera && u.role === "user").length;
  //     if (vcount > 25) vcount = 25;
  //     this.setState({vcount});
  //   }
  // }
  //
  // componentWillUnmount() {
  //   this.exitVideoRoom(this.state.room, () => {});
  // }

  const initVideoRoom = (roomid, inst) => {
    room = roomid
    let janus = gateways[inst];
    mit = mit + inst

    log.info("["+mit+"] Init room: ", room, inst, ConfigStore.globalConfig)
    log.info("["+mit+"] mit", mit)

    setJanus(janus)

    videoroom = new PublisherPlugin();
    videoroom.subTo = onJoinFeed;
    videoroom.unsubFrom = unsubscribeFrom
    videoroom.talkEvent = handleTalking

    janus.attach(videoroom).then(data => {
      log.info("["+mit+"] Publisher Handle: ", data)

      videoroom.join(room, user).then(data => {
        log.info("["+mit+"] Joined respond :", data)
        onJoinMe(data.publishers, room)
      }).catch(err => {
        log.error("["+mit+"] Join error :", err);
      })
    })
  }

  const onJoinMe = (list, room) => {
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
          subscription.push({feed: id, mid: stream.mid});
        }
      }
    }
    setFeeds(feeds);
    if (subscription.length > 0) {
      subscribeTo(room, subscription);
    }
  }

  const onJoinFeed = (feed) => {
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
          subscription.push({feed: id, mid: stream.mid});
        }
      }
    }
    const isExistFeed = feeds.find((f) => f.id === feed[0].id);
    if (!isExistFeed) {
      feeds.push(feed[0]);
      setFeeds(feeds);
    }
    if (subscription.length > 0) {
      subscribeTo(room, subscription);
    }
  }

  const cleanState = (callback) => {
    setFeeds([]);
    setJanus(null)
    videoroom = null
    subscriber = null
    mids = []
    //this.setState({feeds: [], mids: [], remoteFeed: false, videoroom: null, subscriber: null, janus: null});
    if(typeof callback === "function") callback();
  }

  const exitVideoRoom = (roomid, callback) => {
    if(videoroom) {
      videoroom.leave().then(r => {
        log.info("["+mit+"] leave respond:", r);
        janus.detach(videoroom).then(() => {
          log.info("["+mit+"] plugin detached:");
          cleanState(callback)
        })
      }).catch(e => {
        log.error("["+mit+"] leave error:", e);
        cleanState(callback)
      });
    } else {
      cleanState(callback)
    }

  };

  const subscribeTo = (room, subscription) => {

    if (subscriber) {
      subscriber.sub(subscription);
      return;
    }

    // if (creatingFeed) {
    //   setTimeout(() => {
    //     subscribeTo(subscription);
    //   }, 500);
    //   return;
    // }

    subscriber = new SubscriberPlugin();
    subscriber.onTrack = onRemoteTrack;
    subscriber.onUpdate = onUpdateStreams;

    janus.attach(subscriber).then(data => {
      log.info("["+mit+"] Subscriber Handle: ", data)
      subscriber.join(subscription, room).then(data => {
        log.info("["+mit+"] Subscriber join: ", data)
        onUpdateStreams(data.streams);
      });
    })
  };

  const unsubscribeFrom = (id) => {
    id = id[0]
    log.info("["+mit+"] unsubscribeFrom", id);
    for (let i = 0; i < feeds.length; i++) {
      if (feeds[i].id === id) {
        log.info("["+mit+"] unsubscribeFrom feed", feeds[i]);
        feeds.splice(i, 1);
        const streams = [{feed: id}]
        if (streams.length > 0) {
          subscriber.unsub(streams);
        }
        setFeeds(feeds);
        break;
      }
    }
  };

  const handleTalking = (id, talking) => {
    for (let i = 0; i < feeds.length; i++) {
      if (feeds[i] && feeds[i].id === id) {
        feeds[i].talking = talking;
      }
    }
    setFeeds(feeds);
  }

  const onUpdateStreams = (streams) => {
    for (let i in streams) {
      let mindex = streams[i]["mid"];
      //let feed_id = streams[i]["feed_id"];
      mids[mindex] = streams[i];
    }
  }

  const onRemoteTrack = (track, mid, on) => {
    log.info("got track", track)
    let feed = mids[mid].feed_id;
    if (track.kind === "video" && on) {
      let stream = new MediaStream();
      stream.addTrack(track.clone());
      feed = useRef();
      log.info(feed.current)
      if (feed.current.srcObject) feed.current.srcObject = stream;
    }
  }

  const render = () => {
    const width = "400";
    const height = "300";
    const autoPlay = true;
    const controls = false;
    const muted = true;
    //const q = (<b style={{color: "red", fontSize: "20px", fontFamily: "Verdana", fontWeight: "bold"}}>?</b>);

    return (feeds.map((feed) => {
      let camera = g && g.users && !!g.users.find((u) => feed.id === u.rfid && u.camera);
      if (feed) {
        let id = feed.id;
        let talk = feed.talking;
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
              ref={id}
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
    }))
  }

    return (
      <div className={`vclient__main-wrapper no-of-videos-${vcount} layout--equal broadcast--off`}>
        <div className="videos-panel">
          <div className="videos">
            <div className="videos__wrapper">{render()}</div>
          </div>
        </div>
      </div>
    );

}

export default VideoHandleMqtt;

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

  cleanState = (callback) => {
    this.setState({feeds: [], mids: [], remoteFeed: false, videoroom: null, subscriber: null, janus: null});
    if(typeof callback === "function") callback();
  }

  exitVideoRoom = (roomid, callback) => {
    const {janus, videoroom, mit} = this.state;
    if(videoroom) {
      videoroom.leave().then(r => {
        log.info("["+mit+"] leave respond:", r);
        janus.detach(videoroom).then(() => {
          log.info("["+mit+"] plugin detached:");
          this.cleanState(callback)
        })
      }).catch(e => {
        log.error("["+mit+"] leave error:", e);
        this.cleanState(callback)
      });
    } else {
      this.cleanState(callback)
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
    const {feeds} = this.state;
    const width = "400";
    const height = "300";
    const autoPlay = true;
    const controls = false;
    const muted = true;
    //const q = (<b style={{color: 'red', fontSize: '20px', fontFamily: 'Verdana', fontWeight: 'bold'}}>?</b>);

    let program_feeds = feeds.map((feed) => {
      //let camera = users[feed.display.id] && users[feed.display.id].camera !== false;
      if (feed) {
        let id = feed.id;
        let talk = feed.talk;
        //let question = users[feed.display.id] && users[feed.display.id].question;
        //let st = users[feed.display.id] && users[feed.display.id].sound_test;
        return (
          <div className="video" key={"prov" + id} ref={"provideo" + id} id={"provideo" + id}>
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
      <div className={`vclient__main-wrapper no-of-videos-${feeds.length} layout--equal broadcast--off`}>
        <div className="videos-panel">
          <div className="videos">
            <div className="videos__wrapper">
              {this.props.next ? (
                <div>
                  <Button
                    className="close_button"
                    size="mini"
                    color="red"
                    icon="close"
                    onClick={() => this.props.closePopup({disable: true}, this.props.g)}
                  />
                  <Button
                    className="hide_button"
                    size="mini"
                    color="grey"
                    icon="share"
                    onClick={this.props.nextInQueue}
                  />
                </div>
              ) : this.props.preview ? (
                <div>
                  <Button
                    className="close_button"
                    size="mini"
                    color="red"
                    icon="close"
                    onClick={() => this.props.closePopup({disable: true}, false)}
                  />
                  <Button
                    className="hide_button"
                    size="mini"
                    color="orange"
                    icon="window minimize"
                    onClick={() => this.props.closePopup()}
                  />
                </div>
              ) : null}
              {program_feeds}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default JanusHandleMqtt;

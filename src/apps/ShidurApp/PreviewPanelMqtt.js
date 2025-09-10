import React, {Component} from "react";
import "./JanusHandle.scss";
import {Button} from "semantic-ui-react";
import api from "../../shared/Api";
import {SubscriberPlugin} from "../../lib/subscriber-plugin";
import log from "loglevel";

class PreviewPanelMqtt extends Component {
  state = {
    delay: false,
    subscriber: null,
    mids: [],
    name: "",
    room: "",
  };

  componentDidMount() {
    this.attachPreview(this.props.pg);
  }

  componentWillUnmount() {
    this.cleanUp()
  }

  componentDidUpdate(prevProps) {
    let {pg} = this.props;
    let {room} = this.state;
    if (pg && JSON.stringify(pg) !== JSON.stringify(prevProps.pg) && pg.room !== room) {
      this.cleanUp(() => {
        this.attachPreview(this.props.pg);
      })
    }
  }

  cleanUp = (callback) => {
    let {mids, subscriber} = this.state;
    mids.forEach(f => {
      let e = this.refs["pv" + f.feed_id];
      if (e) {
        e.src = "";
        e.srcObject = null;
        e.remove();
      }
    })
    if (subscriber) {
      subscriber.detach();
      this.setState({mids: [], subscriber: null}, () => {
        if(typeof callback === "function") callback();
      });
    } else {
      if(typeof callback === "function") callback();
    }
  }

  setDelay = () => {
    this.setState({delay: true});
    setTimeout(() => {
      this.setState({delay: false});
    }, 1000);
  };

  nextGroup = () => {
    this.setDelay()
    this.cleanUp(() => {
      this.props.nextInQueue();
    })
  };

  attachPreview = (g) => {
    if(!g) return
    api.adminListParticipants({request: "listparticipants", room: g.room}, g.janus).then((data) => {
      let list = data.response.participants.filter((p) => p.publisher && JSON.parse(p.display).role === "user");
      if (list.length === 0) {
        log.error("- No feeds to show -");
      }
      log.info("[preview] feeds: ", list)
      this.setState({room: g.room}, () => {
        let subscription = [];
        //FIXME: If user not found in DB we can not know which mid is video from this request
        // We skip these users
        let mid = "1";
        for (let i in list) {
          let feed = list[i].id;
          // Check if feed is in DB
          let user = g.users && g.users.find((u) => u.rfid === feed);
          // User not in DB - skip
          if (!user) continue;
          // Check which mid is video
          if (user?.extra?.streams) {
            let mids = user.extra.streams;
            if (mids.length === 1 && mids[0].type === "audio")
              continue; // User does not have video - skip
            if (mids.length === 1 && mids[0].type === "video" && mids[0]?.h264_profile && mids[0]?.h264_profile !== "42e01f")
              continue;
            mid = mids[0].type === "audio" ? "1" : "0";
          }
          let subst = {feed, mid};
          if (user && user.camera) {
            subscription.push(subst);
          }
        }
        if (subscription.length > 0) {
          this.subscribeTo(subscription, g.janus);
        }
      });
    });
  };

  subscribeTo = (subscription, inst) => {
    const {gateways} = this.props;
    let janus = gateways[inst];
    let {subscriber, room} = this.state

    if(!janus) {
      setTimeout(() => {
        log.info("["+inst+"] Not connected, waiting... ", janus)
        this.subscribeTo(subscription, inst)
      }, 1000)
      return
    }

    subscriber = new SubscriberPlugin();
    subscriber.onTrack = this.onRemoteTrack;
    subscriber.onUpdate = this.onUpdateStreams;

    janus.attach(subscriber).then(data => {
      this.setState({subscriber});
      log.info("["+inst+"] Subscriber Handle: ", data)
      subscriber.join(subscription, room).then(data => {
        log.info("["+inst+"] Subscriber join: ", data)
        this.onUpdateStreams(data.streams);
      });
    })
  };

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
    const mid = stream.id;
    if (track.kind === "video" && on) {
      let remotevideo = this.refs["pv" + mid];
      if (remotevideo) remotevideo.srcObject = stream;
    }
  }

  handleButton = (c, pg) => {
    this.cleanUp(() => {
      this.props.closePopup(c, pg)
    })
  }

  render() {
    const {mids, delay} = this.state;
    const width = "400";
    const height = "300";
    const autoPlay = true;
    const controls = false;
    const muted = true;

    let program_feeds = mids.map((mid) => {
      if (mid && mid.feed_id) {
        let id = mid.feed_id;
        return (
          <div className="video" key={"prov" + id} ref={"provideo" + id} id={"provideo" + id}>
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
      <div className={`vclient__main-wrapper no-of-videos-${mids.length} layout--equal broadcast--off`}>
        <div className="videos-panel">
          <div className="videos">
            {this.props.next ? (
              <div>
                <Button
                  className="close_button"
                  size="mini"
                  color="red"
                  icon="close"
                  onClick={() => this.handleButton(true, this.props.pg)}
                />
                <Button
                  className="hide_button"
                  disabled={delay}
                  size="mini"
                  color="grey"
                  icon="share"
                  onClick={this.nextGroup}
                />
              </div>
            ) : (
              <div>
                <Button
                  className="close_button"
                  size="mini"
                  color="red"
                  icon="close"
                  onClick={() => this.handleButton(true, this.props.pg)}
                />
                <Button
                  className="hide_button"
                  size="mini"
                  color="orange"
                  icon="window minimize"
                  onClick={() => this.handleButton(false, this.props.pg)}
                />
              </div>
            )}
            <div className="videos__wrapper">{program_feeds}</div>
          </div>
        </div>
      </div>
    );
  }
}

export default PreviewPanelMqtt;

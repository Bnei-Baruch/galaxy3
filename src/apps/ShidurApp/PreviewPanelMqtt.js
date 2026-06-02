import React, {Component} from "react";
import "./JanusHandle.scss";
import classNames from "classnames";
import {Button} from "semantic-ui-react";
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

  getShownCount = (mids) => {
    const {pg} = this.props;
    const real = mids.filter((m) => m && m.feed_id);
    if (!pg || !pg.users) return real.length;
    return real.filter((m) => pg.users.find((u) => u.rfid === m.feed_id && u.camera)).length;
  }

  hasGroup = () => {
    const {pg} = this.props;
    if (!pg || !pg.users) return false;
    return pg.users.some((u) => u.camera && u.role === "user" && u.extra?.isGroup);
  }

  getLayoutCount = (mids) => {
    const shown = this.getShownCount(mids);
    const cap = this.hasGroup() ? 10 : 25;
    return shown >= cap ? cap : shown;
  }

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
    if (!g || !g.users) return;
    this.ensureGateway(g.janus).then((janus) => {
      if (!janus) return;
      this.doAttach(g, janus);
    }).catch((err) => {
      log.error("[preview] gateway not ready for: ", g.janus, err);
    });
  };

  ensureGateway = (name) => {
    const {gateways, initJanus} = this.props;
    const existing = gateways && gateways[name];
    if (existing && existing.isConnected) return Promise.resolve(existing);
    if (typeof initJanus === "function") {
      const p = initJanus(name);
      if (p && typeof p.then === "function") return p;
    }
    return existing
      ? Promise.resolve(existing)
      : Promise.reject(new Error("no gateway: " + name));
  };

  doAttach = (g, janus) => {
    const subscriber = new SubscriberPlugin();
    subscriber.onTrack = this.onRemoteTrack;
    subscriber.onUpdate = this.onUpdateStreams;

    janus.attach(subscriber).then((sub) => {
      this.setState({subscriber: sub, room: g.room});
      log.info("[preview] Subscriber Handle: ", sub);
      this.listParticipants(sub, g.room).then((participants) => {
        const liveIds = new Set(
          participants
            .filter((p) => p.publisher)
            .map((p) => p.id)
        );
        log.info("[preview] live publishers: ", liveIds);

        const list = g.users.filter((u) =>
          u.role === "user" && u.camera && u.rfid && liveIds.has(u.rfid)
        );
        if (list.length === 0) {
          log.error("- No feeds to show -");
          return;
        }
        log.info("[preview] feeds: ", list);

        const subscription = [];
        for (const user of list) {
          const feed = user.rfid;
          let mid = "0";
          if (user?.extra?.streams) {
            const mids = user.extra.streams;
            if (mids.length === 1 && mids[0].type === "audio") continue;
            if (mids.length === 1 && mids[0].type === "video" && mids[0]?.h264_profile && mids[0]?.h264_profile !== "42e01f") continue;
            mid = mids[0].type === "audio" ? "1" : "0";
          }
          subscription.push({feed, mid});
        }

        if (subscription.length === 0) return;
        return sub.join(subscription, g.room).then((data) => {
          log.info("[preview] Subscriber join: ", data);
          if (data && data.streams) this.onUpdateStreams(data.streams);
        }).catch((err) => {
          log.error("[preview] join error: ", err);
        });
      }).catch((err) => {
        log.error("[preview] listparticipants error: ", err);
      });
    }).catch((err) => {
      log.error("[preview] attach error: ", err);
    });
  };

  listParticipants = (subscriber, room) => {
    const body = {request: "listparticipants", room};
    return subscriber.transaction("message", {body}, "success").then((param) => {
      const participants = (param && param.data && param.data.participants) || [];
      return participants;
    });
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
    const {pg} = this.props;
    const width = "400";
    const height = "300";
    const autoPlay = true;
    const controls = false;
    const muted = true;

    const realMids = mids.filter((m) => m && m.feed_id);

    // Group users from the room data. A group only switches the layout when it
    // actually has a live feed on screen — a group flagged in the DB that isn't
    // publishing must not shrink a lone regular client into the small group grid.
    const groupUserIds = (pg && pg.users ? pg.users.filter((u) => u.camera && u.role === "user" && u.extra?.isGroup) : [])
      .sort((a, b) => String(a.rfid).localeCompare(String(b.rfid)))
      .slice(0, 2)
      .map(u => u.rfid);

    const allowedGroupIds = realMids
      .map((m) => m.feed_id)
      .filter((fid) => groupUserIds.includes(fid));
    const groupCount = Math.min(allowedGroupIds.length, 2);
    const hasAnyGroup = groupCount > 0;

    const sortedMids = [...realMids].sort((a, b) => {
      const aUser = pg?.users?.find((u) => u.rfid === a.feed_id);
      const bUser = pg?.users?.find((u) => u.rfid === b.feed_id);
      const aIsGroup = aUser?.extra?.isGroup && allowedGroupIds.includes(a.feed_id);
      const bIsGroup = bUser?.extra?.isGroup && allowedGroupIds.includes(b.feed_id);
      if (aIsGroup && !bIsGroup) return -1;
      if (!aIsGroup && bIsGroup) return 1;
      return 0;
    });

    const visibleVideoCount = sortedMids.filter((mid) => {
      return pg && pg.users && !!pg.users.find((u) => mid.feed_id === u.rfid && u.camera);
    }).length;

    let regularUserCount = 0;
    const maxRegularUsers = 4;

    const num_videos = this.getLayoutCount(mids);

    let program_feeds = sortedMids.map((mid) => {
      let camera = pg && pg.users && !!pg.users.find((u) => mid.feed_id === u.rfid && u.camera);
      let id = mid.feed_id;
      const user = pg?.users?.find((u) => u.rfid === id);
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
    });

    return (
      <div className={`vclient__main-wrapper no-of-videos-${num_videos} layout--equal broadcast--off`}>
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
            <div className={classNames("videos__wrapper", {"has-group": hasAnyGroup})}>{program_feeds}</div>
          </div>
        </div>
      </div>
    );
  }
}

export default PreviewPanelMqtt;

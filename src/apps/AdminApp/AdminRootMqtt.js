import React, {Component, Fragment} from "react";
import {Button, Confirm, Dropdown, Grid, Header, Icon, List, Popup, Segment, Table} from "semantic-ui-react";
import "./AdminRoot.css";
import "./AdminRootVideo.scss";
import classNames from "classnames";
import platform from "platform";
import LoginPage from "../../components/LoginPage";
import GxyJanus from "../../shared/janus-utils";
import ChatBox from "./components/ChatBox";
import api from "../../shared/Api";
import ConfigStore from "../../shared/ConfigStore";
import StatNotes from "./components/StatNotes";
import {updateSentryUser} from "../../shared/sentry";
import mqtt from "../../shared/mqtt";
import {JanusMqtt} from "../../lib/janus-mqtt";
import {PublisherPlugin} from "../../lib/publisher-plugin";
import {SubscriberPlugin} from "../../lib/subscriber-plugin";
import log from "loglevel";

const sortAndFilterFeeds = (feeds) =>
  feeds
    .filter((feed) => !feed.display.role.match(/^(ghost|guest)$/))
    .sort((a, b) => a.display.timestamp - b.display.timestamp);

class AdminRootMqtt extends Component {
  state = {
    audio: null,
    chatRoomsInitialized: false,
    chatRoomsInitializedError: null,
    current_room: "",
    current_janus: "",
    feedStreams: {},
    feed_id: null,
    feed_info: null,
    feed_rtcp: {},
    feed_talk: false,
    feed_user: null,
    feeds: [],
    gateways: {},
    gatewaysInitialized: false,
    mids: [],
    muted: true,
    myid: null,
    mypvtid: null,
    mystream: null,
    rooms: [],
    users: [],
    rooms_question: [],
    user: null,
    appInitError: null,
    users_count: 0,
    command_status: true,
    premodStatus: false,
    showConfirmReloadAll: false,
    android_count: 0,
    ios_count: 0,
    web_count: 0,
  };

  componentDidMount() {
    this.initApp(this.props.user);
  }

  componentWillUnmount() {
    if(this.state.janus) this.state.janus.destroy()
  }

  isAllowed = (level) => {
    const {user} = this.props;
    if (!user) {
      return false;
    }

    const {role} = user;
    switch (level) {
      case "root":
        return role === "root";
      case "admin":
        return role === "admin" || role === "root";
      case "viewer":
        return role === "viewer" || role === "admin" || role === "root";
      default:
        return false;
    }
  };

  withAudio = () => this.isAllowed("admin");

  initApp = (user) => {
    this.setState({user});
    updateSentryUser(user);

    api
      .fetchConfig()
      .then((data) => {
        ConfigStore.setGlobalConfig(data);
        this.setState({
          premodStatus: ConfigStore.dynamicConfig(ConfigStore.PRE_MODERATION_KEY) === "true",
        });
        GxyJanus.setGlobalConfig(data);
      })
      .then(() => this.setState({gatewaysInitialized: true}))
      .then(this.pollRooms)
      .catch((error) => {
        log.error("[admin] error initializing app", error);
        this.setState({appInitError: error});
      });
  };

  initJanus = (user, gxy) => {
    log.info("["+gxy+"] Janus init")
    const {gateways} = this.state;
    const token = ConfigStore.globalConfig.gateways.rooms[gxy].token
    gateways[gxy] = new JanusMqtt(user, gxy, gxy);
    gateways[gxy].onStatus = (srv, status) => {
      if (status !== "online") {
        log.error("["+srv+"] Janus: ", status);
      }
    }
    return new Promise((resolve, reject) => {
      gateways[gxy].init(token).then(janus => {
        log.info("["+gxy+"] Janus init success", janus)
        resolve(janus);
      }).catch(err => {
        log.error("["+gxy+"] Janus init", err);
        reject(err)
      })
    })
  };

  initPlugins = (gateways, inst, user, room) => {
    let videoroom = new PublisherPlugin();
    videoroom.subTo = this.makeSubscription;
    videoroom.unsubFrom = this.unsubscribeFrom
    videoroom.talkEvent = this.handleTalking

    let subscriber = new SubscriberPlugin();
    subscriber.onTrack = this.onRemoteTrack;
    subscriber.onUpdate = this.onUpdateStreams;

    gateways[inst].attach(videoroom).then(data => {
      this.setState({gateways, janus: gateways[inst], videoroom, user, current_room: room, inst});
      log.info('[admin] Publisher Handle: ', data)

      videoroom.join(room, user).then(data => {
        log.info('[admin] Joined respond :', data)
        mqtt.join("galaxy/room/" + room);
        mqtt.join("galaxy/room/" + room + "/chat", true);
        this.makeSubscription(data.publishers, room)
      }).catch(err => {
        log.error('[admin] Join error :', err);
      })

    })

    gateways[inst].attach(subscriber).then(data => {
      this.setState({subscriber});
      log.info('[admin] Subscriber Handle: ', data)
    })
  };

  cleanSession = (inst) => {
    const {gateways} = this.state;
    Object.keys(gateways).forEach(key => {
      const session = gateways[key];
      const sessionEmpty = Object.keys(session.pluginHandles).length === 0;
      if(sessionEmpty && key !== inst) {
        session.destroy();
        delete gateways[key]
      }
    })
  }

  joinRoom = (data) => {
    const {user, current_room, gateways} = this.state;
    const {users, description, room, janus: inst} = data;

    if (current_room === room) return;

    log.info("%c[admin] -- join room: " + room + " (" + description + ")" + " | on srv : " + inst + " -- ", "color: blue");
    this.setState({users, current_group: description});

    if(!gateways[inst]?.isConnected) {
      this.initJanus(user, inst).then(() => {
        this.initPlugins(gateways, inst, user, room);
      }).catch(() => {
        setTimeout(() => {
          this.initPlugins(gateways, inst, user, room);
        }, 5000)
      })
    } else {
      this.initPlugins(gateways, inst, user, room);
      this.cleanSession(inst);
    }

  };

  exitRoom = (data) => {
    const {current_room, videoroom, janus} = this.state;

    if(!janus) {
      this.joinRoom(data)
      return
    }

    this.setState({remoteFeed: false, feeds: []})

    videoroom.leave().then(r => {
      log.info("[admin] leave respond:", r);
      this.switchRoom(data, current_room);
    }).catch(() => {
      this.switchRoom(data, current_room);
    });

  };

  switchRoom = (data, current_room) => {
    mqtt.exit("galaxy/room/" + current_room);
    mqtt.exit("galaxy/room/" + current_room + "/chat");
    const {janus, videoroom, subscriber, inst} = this.state;

    if(subscriber) janus.detach(subscriber)
    janus.detach(videoroom).then(() => {
      log.info("["+inst+"] plugin detached:");
      this.setState({feeds: [], mids: [], remoteFeed: false, videoroom: null, subscriber: null, janus: null});
      this.joinRoom(data)
    })
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
    log.debug("[admin]  ::: Got a remote track event ::: (remote feed)");
    if (!mid) {
      mid = track.id.split("janus")[1];
    }
    let {mids} = this.state;
    let feed = mids[mid].feed_id;
    log.info("[admin] >> This track is coming from feed " + feed + ":", mid);
    if (on) {
      // If we're here, a new track was added
      if (track.kind === "audio") {
        // New audio track: create a stream out of it, and use a hidden <audio> element
        let stream = new MediaStream([track]);
        log.info("[admin] Created remote audio stream:", stream);
        let remoteaudio = this.refs["remoteAudio" + feed];
        remoteaudio.srcObject = stream;
      } else if (track.kind === "video") {
        const remotevideo = this.refs["remoteVideo" + feed];
        // New video track: create a stream out of it
        const stream = new MediaStream([track]);
        log.info("[admin] Created remote video stream:", stream);
        remotevideo.srcObject = stream;
      }
    }
  }

  makeSubscription = (newFeeds) => {
    log.info("[admin] makeSubscription", newFeeds);
    const subscription = [];
    const {feeds: pf} = this.state;
    const pfMap = new Map(pf.map((f) => [f.id, f]));

    newFeeds.forEach(f => {
      const {id, streams} = f;
      f.display = JSON.parse(f.display)
      f.video = !!streams.find(v => v.type === "video" && v.codec === "h264");
      f.audio = !!streams.find(a => a.type === "audio" && a.codec === "opus");
      f.data = !!streams.find(d => d.type === "data");
      f.cammute = !f.video;

      const pf = pfMap.get(f.id);
      const pv = !!pf && pf.streams?.find((v) => v.type === "video" && v.codec === "h264");
      const pa = !!pf && pf.streams?.find((a) => a.type === "audio" && a.codec === "opus");

      streams.forEach(s => {
        const hasVideo = s.type === "video" && s.codec === "h264" && !pv;
        const hasAudio = s.type === "audio" && s.codec === "opus" && !pa;

        if (hasVideo) {
          pfMap.set(f.id, f);
          subscription.push({feed: id, mid: s.mid});
        }

        if (this.withAudio() && hasAudio) {
          pfMap.set(f.id, f);
          subscription.push({feed: id, mid: s.mid});
        }

      });
    });
    const feeds = Array.from(pfMap, ([k, v]) => v);
    this.setState({feeds: sortAndFilterFeeds(feeds)});
    if (subscription.length > 0)
      this.subscribeTo(subscription);
  }

  subscribeTo = (subscription) => {
    // New feeds are available, do we need create a new plugin handle first?
    if (this.state.remoteFeed) {
      this.state.subscriber.sub(subscription);
      return;
    }

    // We don't have a handle yet, but we may be creating one already
    if (this.state.creatingFeed) {
      // Still working on the handle
      setTimeout(() => {
        this.subscribeTo(subscription);
      }, 500);
      return;
    }

    // We don't creating, so let's do it
    this.setState({creatingFeed: true});

    // We wait for the plugin to send us an offer
    this.state.subscriber.join(subscription, this.state.current_room).then(data => {
      log.info('[admin] Subscriber join: ', data)

      this.onUpdateStreams(data.streams);

      this.setState({remoteFeed: true, creatingFeed: false});
    });

  };

  pollRooms = () => {
    this.fetchRooms();
    setInterval(this.fetchRooms, 10 * 1000);
  };

  fetchRooms = () => {
    api
      .fetchActiveRooms()
      .then((data) => {
        let {current_room} = this.state;
        let ios_count = 0,
          android_count = 0,
          web_count = 0;
        const users_count = data.map((r) => r.num_users).reduce((su, cur) => su + cur, 0);
        for (let i = 0; i < data.length; i++) {
          for (let j = 0; j < data[i]["users"].length; j++) {
            if (data[i]["users"][j]["system"] === "iOS") ios_count++;
            if (data[i]["users"][j]["system"] === "Android") android_count++;
          }
        }
        web_count = users_count - (ios_count + android_count);
        const room = data.find((r) => r.room === current_room);
        const rooms_question = data.filter((r) => r.questions);
        let users = current_room && room ? room.users : [];
        data.sort((a, b) => {
          if (a.description > b.description) return 1;
          if (a.description < b.description) return -1;
          return 0;
        });
        this.setState({rooms: data, users, users_count, rooms_question, web_count, ios_count, android_count});
      })
      .catch((err) => {
        log.error("[admin] error fetching active rooms", err);
      });
  };

  unsubscribeFrom = (id) => {
    id = id[0]
    log.info("[admin] unsubscribeFrom", id);
    const {feeds, feed_user} = this.state;
    for (let i = 0; i < feeds.length; i++) {
      if (feeds[i].id === id) {
        log.info("[admin] unsubscribeFrom feed", feeds[i]);

        // Remove from feeds list
        feeds.splice(i, 1);

        const streams = [{feed: id}]

        const {remoteFeed} = this.state;
        if (remoteFeed !== null && streams.length > 0) {
          this.state.subscriber.unsub(streams);
        }

        if (feed_user && feed_user.rfid === id) {
          this.setState({feed_user: null});
        }

        this.setState({feeds});
        break;
      }
    }
  };

  sendCommandMessage = (command_type) => {
    const {feed_user, current_room, command_status} = this.state;
    const cmd = {
      type: command_type,
      room: current_room,
      status: command_status,
      id: feed_user?.id,
      user: feed_user,
    };

    let topic = command_type.match(/^(reload-config|client-reload-all)$/)
      ? "galaxy/users/broadcast"
      : "galaxy/room/" + current_room;
    mqtt.send(JSON.stringify(cmd), false, topic);

    if (command_type === "audio-out") {
      this.setState({command_status: !command_status});
    }
  };

  sendRemoteCommand = (command_type) => {
    this.sendCommandMessage(command_type);

    // const {gateways, feed_user, current_janus, current_room, command_status, gdm} = this.state;
    //
    // if (command_type === "premoder-mode") {
    //     const value = !this.state.premodStatus;
    //     api.adminSetConfig(ConfigStore.PRE_MODERATION_KEY, value)
    //         .then(() => {
    //             ConfigStore.setDynamicConfig(ConfigStore.PRE_MODERATION_KEY, JSON.stringify(value));
    //             this.setState({premodStatus: value});
    //
    //             const msg = {type: "reload-config", status: value, id: null, user: null, room: null};
    //             Object.values(gateways).forEach(gateway =>
    //                 gateway.sendProtocolMessage(msg)
    //                     .catch(alert));
    //         })
    //         .catch(err => {
    // 					alert(err);
    // 				});
    //     return;
    // }
    // if (command_type === "client-reload-all") {
    //     const msg = {
    //         type: "client-reload-all",
    //         status: true,
    //         id: null,
    //         user: null,
    //         room: null,
    //     };
    //     Object.values(gateways).forEach(gateway =>
    //         gateway.sendProtocolMessage(msg)
    //             .catch(alert));
    //     return;
    // }
    //
    // if (!feed_user) {
    //     alert("Choose user");
    //     return;
    // }
    //
    // if (command_type === "sound_test") {
    //     feed_user.sound_test = true;
    // }
    //
    // const gateway = gateways[current_janus];
    // const msg = {type: command_type, room: current_room, status: command_status, id: feed_user.id, user: feed_user};
    // const toAck = [feed_user.id];
    //
    // if(command_type === "audio-out") {
    //     gdm.send(msg, toAck, (msg) => gateway.sendProtocolMessage(msg).catch(alert)).
    //     then(() => {
    //         log.info(`MIC delivered to ${toAck}.`);
    //     }).catch((error) => {
    //         log.error(`MIC not delivered to ${toAck} due to ` , error);
    //     });
    // } else {
    //     const gateway = gateways[current_janus];
    //     gateway.sendProtocolMessage({type: command_type, room: current_room, status: command_status, id: feed_user.id, user: feed_user})
    //         .catch(alert);
    // }
    //
    // if (command_type === "audio-out") {
    //     this.setState({command_status: !command_status})
    // }
  };

  getUserInfo = (selected_user) => {
    const {feed_user} = this.state;
    if (feed_user) mqtt.exit("galaxy/users/" + feed_user.id);
    log.info("[admin] getUserInfo", selected_user);
    if (selected_user) {
      mqtt.join("galaxy/users/" + selected_user.id);
      const feed_info = selected_user.system ? platform.parse(selected_user.system) : null;
      this.setState({feed_id: selected_user.rfid, feed_user: selected_user, feed_info});
    }
  };

  getFeedInfo = () => {
    const {feed_user} = this.state;
    if (feed_user) {
      const {janus, session, handle} = this.state.feed_user;
      if (janus && session && handle) {
        api
          .fetchHandleInfo(janus, session, handle)
          .then((data) => {
            log.debug("[admin] Publisher info", data);
            const m0 = data.info.webrtc.media[0];
            const m1 = data.info.webrtc.media[1];
            let video = null;
            let audio = null;
            if (m0 && m1) {
              audio = data.info.webrtc.media[0].rtcp.main;
              video = data.info.webrtc.media[1].rtcp.main;
            } else if (m0.type === "audio") {
              audio = data.info.webrtc.media[0].rtcp.main;
            } else if (m0.type === "video") {
              video = data.info.webrtc.media[0].rtcp.main;
            }
            this.setState({feed_rtcp: {video, audio}});
          })
          .catch((err) => {
            alert("Error fetching handle_info: " + err);
          });
      }
    }
  };

  onConfirmReloadAllCancel = (e, data) => {
    this.setState({showConfirmReloadAll: false});
  };

  onConfirmReloadAllConfirm = (e, data) => {
    this.setState({showConfirmReloadAll: false});
    this.sendRemoteCommand("client-reload-all");
  };

  render() {
    const {user} = this.props;
    const {current_room, current_group, feed_id, feed_info, feed_rtcp, feed_user, feeds, users, rooms_question, gatewaysInitialized, rooms, users_count, appInitError, command_status, showConfirmReloadAll,} = this.state;

    if (appInitError) {
      return (
        <Fragment>
          <h1>Error Initializing Application</h1>
          {`${appInitError}`}
        </Fragment>
      );
    }

    if (!!user && !gatewaysInitialized) {
      return "Initializing connections to janus instances...";
    }

    const width = "134";
    const height = "100";
    const autoPlay = true;
    const controls = false;
    const muted = true;

    //const f = (<Icon name='volume up' />);
    const q = <Icon color="red" name="help" />;
    //const v = (<Icon name='checkmark' />);
    //const x = (<Icon name='close' />);

    let group_options = rooms.map((feed, i) => {
      const display = feed.description;
      return {key: i, value: feed, text: display};
    });

    let rooms_question_grid = rooms_question.map((data, i) => {
      const {room, num_users, description, questions} = data;
      return (
        <Table.Row active={current_room === room} key={i + "q"} onClick={() => this.exitRoom(data)}>
          <Table.Cell width={5}>
            {questions ? q : ""}
            {description}
          </Table.Cell>
          <Table.Cell width={1}>{num_users}</Table.Cell>
        </Table.Row>
      );
    });

    let rooms_grid = rooms.map((data, i) => {
      const {room, num_users, description, questions} = data;
      return (
        <Table.Row active={current_room === room} key={i + "r"} onClick={() => this.exitRoom(data)}>
          <Table.Cell width={5}>
            {questions ? q : ""}
            {description}
          </Table.Cell>
          <Table.Cell width={1}>{num_users}</Table.Cell>
        </Table.Row>
      );
    });

    const users_grid = feeds.map((feed, i) => {
      if (!feed) {
        return null;
      }
      //let qt = users[feed.display.id].question;
      //let st = users[feed.display.id].sound_test;
      let feed_user = users.find((u) => feed.id === u.rfid);
      let qt = feed_user && !!feed_user.question;
      return (
        <Table.Row active={feed.id === this.state.feed_id} key={i + "u"} onClick={() => this.getUserInfo(feed_user)}>
          <Table.Cell width={10}>
            {qt ? q : ""}
            {feed.display.display}
          </Table.Cell>
          {/*<Table.Cell positive={st} width={1}>{st ? v : ""}</Table.Cell>*/}
          <Table.Cell width={1}></Table.Cell>
        </Table.Row>
      );
    });

    let videos = feeds.map((feed) => {
      if (feed) {
        let id = feed.id;
        let talk = feed.talking;
        let selected = id === feed_id;
        return (
          <div className="video" key={"v" + id} ref={"video" + id} id={"video" + id}>
            <div className={classNames("video__overlay", {talk: talk}, {selected: selected})} key={"t" + id} />
            <video
              key={id}
              ref={"remoteVideo" + id}
              id={"remoteVideo" + id}
              width={width}
              height={height}
              autoPlay={autoPlay}
              controls={controls}
              muted={muted}
              playsInline={true}
            />
            {this.withAudio() ? (
              <audio
                key={"a" + id}
                ref={"remoteAudio" + id}
                id={"remoteAudio" + id}
                autoPlay={autoPlay}
                controls={controls}
                playsInline={true}
              />
            ) : null}
          </div>
        );
      }
      return true;
    });

    let login = <LoginPage user={user} checkPermission={this.checkPermission} />;

    const infoPopup = (
      <Popup
        trigger={<Button positive icon="info" onClick={this.getFeedInfo} />}
        position="bottom left"
        content={
          <List as="ul">
            <List.Item as="li">
              System
              <List.List as="ul">
                <List.Item as="li">OS: {feed_info ? feed_info.os.toString() : ""}</List.Item>
                <List.Item as="li">Browser: {feed_info ? feed_info.name : ""}</List.Item>
                <List.Item as="li">Version: {feed_info ? feed_info.version : ""}</List.Item>
              </List.List>
            </List.Item>
            {feed_rtcp.video ? (
              <List.Item as="li">
                Video
                <List.List as="ul">
                  <List.Item as="li">in-link-quality: {feed_rtcp.video["in-link-quality"]}</List.Item>
                  <List.Item as="li">in-media-link-quality: {feed_rtcp.video["in-media-link-quality"]}</List.Item>
                  <List.Item as="li">jitter-local: {feed_rtcp.video["jitter-local"]}</List.Item>
                  <List.Item as="li">jitter-remote: {feed_rtcp.video["jitter-remote"]}</List.Item>
                  <List.Item as="li">lost: {feed_rtcp.video["lost"]}</List.Item>
                </List.List>
              </List.Item>
            ) : null}
            {feed_rtcp.audio ? (
              <List.Item as="li">
                Audio
                <List.List as="ul">
                  <List.Item as="li">in-link-quality: {feed_rtcp.audio["in-link-quality"]}</List.Item>
                  <List.Item as="li">in-media-link-quality: {feed_rtcp.audio["in-media-link-quality"]}</List.Item>
                  <List.Item as="li">jitter-local: {feed_rtcp.audio["jitter-local"]}</List.Item>
                  <List.Item as="li">jitter-remote: {feed_rtcp.audio["jitter-remote"]}</List.Item>
                  <List.Item as="li">lost: {feed_rtcp.audio["lost"]}</List.Item>
                </List.List>
              </List.Item>
            ) : null}
          </List>
        }
        on="click"
        hideOnScroll
      />
    );

    const rootControlPanel = [];
    if (this.isAllowed("root")) {
      rootControlPanel.push(
        ...[
          <Popup
            trigger={
              <Button color="yellow" icon="question" onClick={() => this.sendRemoteCommand("client-question")} />
            }
            content="Set/Unset question"
            inverted
          />,
          <Popup
            trigger={
              <Button
                color="brown"
                icon="sync alternate"
                alt="test"
                onClick={() => this.sendRemoteCommand("client-reconnect")}
              />
            }
            content="Reconnect"
            inverted
          />,
          <Popup
            trigger={
              <Button color="olive" icon="redo alternate" onClick={() => this.sendRemoteCommand("client-reload")} />
            }
            content="Reload page(LOST FEED HERE!)"
            inverted
          />,
          <Popup
            trigger={<Button color="teal" icon="microphone" onClick={() => this.sendRemoteCommand("client-mute")} />}
            content="Mic Mute/Unmute"
            inverted
          />,
          <Popup
            trigger={<Button color="pink" icon="eye" onClick={() => this.sendRemoteCommand("video-mute")} />}
            content="Cam Mute/Unmute"
            inverted
          />,
          <Popup
            trigger={
              <Button
                color="orange"
                icon={command_status ? "volume off" : "volume up"}
                onClick={() => this.sendRemoteCommand("audio-out")}
              />
            }
            content="Talk event"
            inverted
          />,
          <Popup
            trigger={<Button negative icon="user x" onClick={() => this.sendRemoteCommand("client-kicked")} />}
            content="Kick"
            inverted
          />,
          /*<Popup trigger={<Button color="pink" icon='eye' onClick={() => this.sendDataMessage("video-mute")} />} content='Cam Mute/Unmute' inverted />,*/
          /*<Popup trigger={<Button color="blue" icon='power off' onClick={() => this.sendRemoteCommand("client-disconnect")} />} content='Disconnect(LOST FEED HERE!)' inverted />,*/
          // <Popup inverted
          //        content={`${premodStatus ? 'Disable' : 'Enable'} Pre Moderation Mode`}
          //        trigger={
          //            <Button color="blue"
          //                    icon='copyright'
          //                    inverted={premodStatus}
          //                    onClick={() => this.sendRemoteCommand("premoder-mode")}/>
          //        }/>,
          <Popup
            trigger={
              <Button color="blue" icon="cloud download" onClick={() => this.sendRemoteCommand("reload-config")} />
            }
            content="Silently reload dynamic config on ALL clients"
            inverted
          />,
          <Popup
            trigger={
              <Button
                color="red"
                icon="redo"
                onClick={() => this.setState({showConfirmReloadAll: !showConfirmReloadAll})}
              />
            }
            content="RELOAD ALL"
            inverted
          />,
          // <Dropdown icon='plug' className='button icon' inline item text={tcp === "mqtt" ? 'MQTT' : 'WebRTC'} >
          //   <Dropdown.Menu>
          //     <Dropdown.Item onClick={this.setProtocol}>MQTT</Dropdown.Item>
          //     <Dropdown.Item onClick={this.setProtocol}>WebRTC</Dropdown.Item>
          //   </Dropdown.Menu>
          // </Dropdown>
        ]
      );
    }

    let adminContent = (
      <Grid>
        <Grid.Row>
          <Grid.Column>
            {this.isAllowed("admin") ? (
              <Segment textAlign="center" className="ingest_segment">
                {/*<Button color='blue' icon='sound' onClick={() => this.sendRemoteCommand("sound_test")} />*/}
                {infoPopup}
                {rootControlPanel}
                <StatNotes
                  data={rooms}
                  android_count={this.state.android_count}
                  ios_count={this.state.ios_count}
                  web_count={this.state.web_count}
                  root={this.isAllowed("root")}
                />
              </Segment>
            ) : null}
          </Grid.Column>
        </Grid.Row>
        <Grid.Row columns="equal">
          <Grid.Column width={4}>
            <Segment.Group className="user_list">
              <Segment textAlign="center" raised>
                <Table selectable compact="very" basic structured className="admin_table" unstackable>
                  <Table.Body>
                    <Table.Row disabled positive>
                      <Table.Cell colSpan={3} textAlign="center">
                        Users:
                      </Table.Cell>
                    </Table.Row>
                    <Table.Row disabled>
                      <Table.Cell width={10}>Title</Table.Cell>
                      <Table.Cell width={1}>ST</Table.Cell>
                    </Table.Row>
                    {users_grid}
                  </Table.Body>
                </Table>
              </Segment>
            </Segment.Group>
          </Grid.Column>
          <Grid.Column largeScreen={9}>
            <div className={`vclient__main-wrapper no-of-videos-${feeds.length} layout--equal broadcast--off`}>
              <div className="videos-panel">
                <div className="videos">
                  <div className="videos__wrapper">{videos}</div>
                </div>
              </div>
            </div>
          </Grid.Column>
          <Grid.Column width={3}>
            <Dropdown
              placeholder="Search.."
              fluid
              search
              selection
              options={group_options}
              onClick={this.sortGroups}
              onChange={(e, {value}) => this.exitRoom(value)}
            />
            <Segment textAlign="center" className="group_list">
              <Table selectable compact="very" basic structured className="admin_table" unstackable>
                <Table.Body>
                  <Table.Row disabled positive>
                    <Table.Cell width={5}>Rooms: {rooms.length}</Table.Cell>
                    <Table.Cell width={1}>{users_count}</Table.Cell>
                  </Table.Row>
                  {rooms_grid}
                </Table.Body>
              </Table>
            </Segment>
          </Grid.Column>
        </Grid.Row>

        {this.isAllowed("admin") ? (
          <Grid.Row>
            <Grid.Column width={13}>
              <ChatBox
                onRef={(ref) => (this.chat = ref)}
                user={user}
                rooms={rooms}
                selected_room={current_room}
                selected_group={current_group}
                selected_user={feed_user}
              />
            </Grid.Column>
            <Grid.Column width={3}>
              <Segment textAlign="center" className="vip_list">
                <Table selectable compact="very" basic structured className="admin_table" unstackable>
                  <Table.Body>
                    <Table.Row disabled positive>
                      <Table.Cell width={5}>Question Rooms: {rooms_question.length}</Table.Cell>
                      <Table.Cell width={1}>{}</Table.Cell>
                    </Table.Row>
                    {rooms_question_grid}
                  </Table.Body>
                </Table>
              </Segment>
            </Grid.Column>
          </Grid.Row>
        ) : null}

        {this.isAllowed("root") ? (
          <Confirm
            open={showConfirmReloadAll}
            header={
              <Header>
                <Icon name="warning circle" color="red" />
                Caution
              </Header>
            }
            content="Are you sure you want to force ALL USERS to reload their page ?!"
            onCancel={this.onConfirmReloadAllCancel}
            onConfirm={this.onConfirmReloadAllConfirm}
          />
        ) : null}
      </Grid>
    );

    return <div>{user ? adminContent : login}</div>;
  }
}

export default AdminRootMqtt;

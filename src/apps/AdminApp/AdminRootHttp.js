import React, {Component, Fragment} from "react";
import {Janus} from "../../lib/janus";
import {Button, Confirm, Dropdown, Grid, Header, Icon, List, Popup, Segment, Select, Table} from "semantic-ui-react";
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

class AdminRootHttp extends Component {
  state = {
    audio: null,
    bitrate: 64000,
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
    Object.values(this.state.gateways).forEach((x) => x.destroy());
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
      .then(() => this.initGateways(user))
      .then(this.pollRooms)
      .catch((error) => {
        console.error("[Admin] error initializing app", error);
        this.setState({appInitError: error});
      });
  };

  initGateways = () => {
    const gateways = GxyJanus.makeGateways("rooms");
    this.setState({gateways});

    const gatewayToInitPromise = (gateway) =>
      gateway.init().catch((error) => {
        throw error;
      });

    return Promise.all(Object.values(gateways).map(gatewayToInitPromise)).then(() => {
      console.info("[Admin] gateways initialization complete");
      this.setState({gatewaysInitialized: true});
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
        console.error("[Admin] error fetching active rooms", err);
      });
  };

  newVideoRoom = (gateway, room) => {
    console.log("[Admin] newVideoRoom", room);

    return gateway.initVideoRoom({
      onmessage: (msg, jsep) => {
        this.onVideoroomMessage(gateway, msg, jsep);
      },
      ondataerror: (error) => {
        console.error("[Admin] video room on data error", error);
      },
    });
  };

  publishOwnFeed = (gateway) => {
    console.log("[Admin] publishOwnFeed", gateway.name);
    gateway.videoroom.createOffer({
      media: {audio: false, video: false, data: false},
      simulcast: false,
      success: (jsep) => {
        gateway.debug("Got publisher SDP!", jsep);
        gateway.videoroom.send({
          jsep,
          message: {request: "configure", audio: false, video: false, data: false},
          error: (err) => {
            gateway.error("videoroom configure error:", err);
          },
        });
      },
      error: (err) => {
        gateway.error("videoroom createOffer error:", err);
      },
    });
  };

  onVideoroomMessage = (gateway, msg, jsep) => {
    const event = msg["videoroom"];
    if (event !== undefined && event !== null) {
      if (event === "joined") {
        // Publisher/manager created, negotiate WebRTC and attach to existing feeds, if any
        let myid = msg["id"];
        let mypvtid = msg["private_id"];
        this.setState({myid, mypvtid});
        console.log("[Admin] Successfully joined room " + msg["room"] + " with ID " + myid + " on " + gateway.name);
        //this.publishOwnFeed(gateway);
        // Any new feed to attach to?
        if (msg["publishers"] !== undefined && msg["publishers"] !== null) {
          let list = msg["publishers"];
          console.log("[Admin] Got Publishers (joined)", list);

          // Filter service feeds and sort by timestamp
          let feeds = list
            .sort((a, b) => JSON.parse(a.display).timestamp - JSON.parse(b.display).timestamp)
            .filter((feeder) => JSON.parse(feeder.display).role.match(/^(user|guest|ghost)$/));

          mqtt.join("galaxy/room/" + msg["room"]);
          mqtt.join("galaxy/room/" + msg["room"] + "/chat", true);

          console.log("[Admin] available feeds", feeds);
          const subscription = [];
          for (let f in feeds) {
            let id = feeds[f]["id"];
            let display = JSON.parse(feeds[f]["display"]);
            let talk = feeds[f]["talking"];
            let streams = feeds[f]["streams"];
            feeds[f].display = display;
            feeds[f].talk = talk;
            feeds[f].janus = gateway.name;
            for (let i in streams) {
              let stream = streams[i];
              stream["id"] = id;
              stream["display"] = display;
              if (stream.type === "video" && stream.codec === "h264") {
                subscription.push({feed: id, mid: stream.mid});
              }
              if (this.withAudio() && stream.type === "audio" && stream.codec === "opus") {
                subscription.push({feed: id, mid: stream.mid});
              }
            }
          }
          this.setState({feeds});
          if (subscription.length > 0) this.subscribeTo(subscription, gateway.name);
        }
      } else if (event === "talking") {
        let {feeds} = this.state;
        let id = msg["id"];
        //console.debug("[Admin] User start talking", id);
        for (let i = 0; i < feeds.length; i++) {
          if (feeds[i] && feeds[i].id === id) {
            feeds[i].talk = true;
          }
        }
        this.setState({feeds});
      } else if (event === "stopped-talking") {
        let {feeds} = this.state;
        let id = msg["id"];
        //console.debug("[Admin] User stop talking", id);
        for (let i = 0; i < feeds.length; i++) {
          if (feeds[i] && feeds[i].id === id) {
            feeds[i].talk = false;
          }
        }
        this.setState({feeds});
      } else if (event === "destroyed") {
        console.warn("[Admin] The room has been destroyed!");
      } else if (event === "event") {
        // Any info on our streams or a new feed to attach to?
        let {user, myid} = this.state;
        if (msg["streams"] !== undefined && msg["streams"] !== null) {
          let streams = msg["streams"];
          for (let i in streams) {
            let stream = streams[i];
            stream["id"] = myid;
            stream["display"] = user;
          }
        } else if (msg["publishers"] !== undefined && msg["publishers"] !== null) {
          let new_feed = msg["publishers"];
          console.log("[Admin] Got Publishers (event)", new_feed);

          let {feeds} = this.state;
          let subscription = [];
          for (let f in new_feed) {
            let id = new_feed[f]["id"];
            let display = JSON.parse(new_feed[f]["display"]);
            if (!display.role.match(/^(user|guest|ghost)$/)) return;
            let streams = new_feed[f]["streams"];
            new_feed[f].display = display;
            new_feed[f].janus = gateway.name;
            for (let i in streams) {
              let stream = streams[i];
              stream["id"] = id;
              stream["display"] = display;
              if (stream.type === "video" && stream.codec === "h264") {
                subscription.push({feed: id, mid: stream.mid});
              }
              if (this.withAudio() && stream.type === "audio" && stream.codec === "opus") {
                subscription.push({feed: id, mid: stream.mid});
              }
            }
          }
          const isExistFeed = feeds.find((f) => f.id === new_feed[0].id);
          if (!isExistFeed) {
            feeds.push(new_feed[0]);
            this.setState({feeds});
          }
          if (subscription.length > 0) this.subscribeTo(subscription, gateway.name);
        } else if (msg["leaving"] !== undefined && msg["leaving"] !== null) {
          // One of the publishers has gone away?
          const leaving = msg["leaving"];
          console.log("[Admin] leaving", leaving);
          this.unsubscribeFrom(leaving, gateway.name);
        } else if (msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
          let unpublished = msg["unpublished"];
          console.log("[Admin] unpublished", unpublished);
          if (unpublished === "ok") {
            console.log("[Admin] videoroom.hangup()", gateway.name);
            gateway.videoroom.hangup(); // That's us
          } else {
            this.unsubscribeFrom(unpublished, gateway.name);
          }
        } else if (msg["error"] !== undefined && msg["error"] !== null) {
          if (msg["error_code"] === 426) {
            console.error("[Admin] no such room", gateway.name, msg);
          } else {
            console.error("[Admin] videoroom error message", msg);
          }
        }
      }
    }

    if (jsep !== undefined && jsep !== null) {
      gateway.debug("[videoroom] Handling SDP as well...", jsep);
      gateway.videoroom.handleRemoteJsep({
        jsep,
        error: (err) => {
          gateway.error("videoroom handleRemoteJsep error:", err);
        },
      });
    }
  };

  newRemoteFeed = (gateway, subscription) => {
    console.log("[Admin] newRemoteFeed", gateway.name);
    gateway
      .newRemoteFeed({
        onmessage: (msg, jsep) => {
          let event = msg["videoroom"];
          if (msg["error"] !== undefined && msg["error"] !== null) {
            gateway.error("[remoteFeed] error message:", msg["error"]);
          } else if (event !== undefined && event !== null) {
            if (event === "attached") {
              gateway.log("[remoteFeed] Successfully attached to feed in room " + msg["room"]);
            } else if (event === "event") {
              // Check if we got an event on a simulcast-related event from this publisher
            } else {
              // What has just happened?
            }
          }
          if (msg["streams"]) {
            // Update map of subscriptions by mid
            let {mids} = this.state;
            for (let i in msg["streams"]) {
              let mindex = msg["streams"][i]["mid"];
              mids[mindex] = msg["streams"][i];
              if (msg["streams"][i]["feed_display"]) {
                mids[mindex].feed_user = JSON.parse(msg["streams"][i]["feed_display"]);
              }
            }
            this.setState({mids});
          }
          if (jsep !== undefined && jsep !== null) {
            gateway.debug("[remoteFeed] Handling SDP as well...", jsep);
            gateway.remoteFeed.createAnswer({
              jsep: jsep,
              media: {audioSend: false, videoSend: false, data: false}, // We want recvonly audio/video
              success: (jsep) => {
                gateway.debug("[remoteFeed] Got SDP", jsep);
                gateway.remoteFeed.send({
                  jsep,
                  message: {request: "start", room: this.state.current_room, data: false},
                  error: (err) => {
                    gateway.error("[remoteFeed] start error", err);
                  },
                });
              },
              error: (err) => {
                gateway.error("[remoteFeed] createAnswer error", err);
              },
            });
          }
        },
        onremotetrack: (track, mid, on) => {
          // Which publisher are we getting on this mid?
          let {mids} = this.state;
          let feed = mids[mid].feed_id;
          console.log("[Admin] This track is coming from feed " + feed + ":", mid);
          // If we're here, a new track was added
          if (track.kind === "audio" && on && this.withAudio()) {
            // New audio track: create a stream out of it, and use a hidden <audio> element
            let stream = new MediaStream();
            stream.addTrack(track.clone());
            console.log("[Admin] Created remote audio stream:", stream);
            let remoteaudio = this.refs["remoteAudio" + feed];
            Janus.attachMediaStream(remoteaudio, stream);
          } else if (track.kind === "video" && on) {
            // New video track: create a stream out of it
            let stream = new MediaStream();
            stream.addTrack(track.clone());
            console.log("[Admin] Created remote video stream:", stream);
            let remotevideo = this.refs["remoteVideo" + feed];
            Janus.attachMediaStream(remotevideo, stream);
          } else if (track.kind === "data") {
            console.debug("[Admin] It's data channel");
          } else {
            console.debug("[Admin] Track already attached: ", track);
          }
        },
        ondataerror: (error) => {
          console.error(error);
        },
      })
      .then(() => {
        const subscribe = {
          request: "join",
          room: this.state.current_room,
          ptype: "subscriber",
          streams: subscription,
        };
        console.log("[Admin] newRemoteFeed join", subscribe);
        gateway.remoteFeed.send({
          message: subscribe,
          success: () => {
            gateway.log("[remoteFeed] join as subscriber success", subscribe);
          },
          error: (err) => {
            gateway.error("[remoteFeed] error join as subscriber", subscribe, err);
          },
        });
      })
      .catch((err) => {
        console.error("[Admin] gateway.newRemoteFeed error", err);
      });
  };

  subscribeTo = (subscription, inst) => {
    const gateway = this.state.gateways[inst];

    // New feeds are available, do we need create a new plugin handle first?
    if (gateway.remoteFeed) {
      const subscribe = {request: "subscribe", streams: subscription};
      console.log("[Admin] subscribeTo subscribe", subscribe);
      gateway.remoteFeed.send({
        message: subscribe,
        success: () => {
          gateway.log("[remoteFeed] subscribe success", subscribe);
        },
        error: (err) => {
          gateway.error("[remoteFeed] error subscribe", subscribe, err);
        },
      });
    } else {
      this.newRemoteFeed(gateway, subscription);
    }
  };

  unsubscribeFrom = (id, inst) => {
    console.log("[Admin] unsubscribeFrom", inst, id);
    const {feeds, feed_user, gateways} = this.state;
    const gateway = gateways[inst];
    for (let i = 0; i < feeds.length; i++) {
      if (feeds[i].id === id) {
        console.log("[Admin] unsubscribeFrom feed", feeds[i]);

        // Remove from feeds list
        feeds.splice(i, 1);

        // Send an unsubscribe request
        const unsubscribe = {request: "unsubscribe", streams: [{feed: id}]};
        console.log("[Admin] unsubscribeFrom unsubscribe", unsubscribe);
        gateway.remoteFeed.send({
          message: unsubscribe,
          success: () => {
            gateway.log("[remoteFeed] unsubscribe success", unsubscribe);
          },
          error: (err) => {
            gateway.error("[remoteFeed] error unsubscribe", unsubscribe, err);
          },
        });

        if (feed_user && feed_user.rfid === id) {
          this.setState({feed_user: null});
        }

        this.setState({feeds});
        break;
      }
    }
  };

  sendRemoteCommand = (command_type, value) => {
    const {feed_user, current_room, command_status} = this.state;
    const cmd = {
      type: command_type,
      room: current_room,
      status: command_status,
      id: feed_user?.id,
      user: feed_user,
    };

    if(feed_user && command_type === "client-bitrate")
      cmd.bitrate = value;

    let topic = command_type.match(/^(reload-config|client-reload-all)$/)
      ? "galaxy/users/broadcast"
      : "galaxy/room/" + current_room;
    mqtt.send(JSON.stringify(cmd), false, topic);

    if (command_type === "audio-out") {
      this.setState({command_status: !command_status});
    }
  };

  joinRoom = (data) => {
    console.log("[Admin] joinRoom", data);
    const {user, current_room} = this.state;
    const {room, janus: inst} = data;

    if (current_room === room) return;

    console.log("[Admin] joinRoom", room, inst);
    this.setState({users: data.users});

    let promise;
    if (current_room) {
      promise = this.exitRoom(current_room);
      mqtt.exit("galaxy/room/" + current_room);
      mqtt.exit("galaxy/room/" + current_room + "/chat");
    } else {
      promise = new Promise((resolve, _) => {
        resolve();
      });
    }

    promise
      .then(() => {
        this.setState(
          {
            current_room: room,
            current_group: data.description,
            current_janus: inst,
            feeds: [],
            feed_user: null,
            feed_id: null,
            command_status: true,
            chatRoomsInitialized: false,
            chatRoomsInitializedError: null,
          },
          () => {
            const gateway = this.state.gateways[inst];

            this.newVideoRoom(gateway, room)
              .then(() => gateway.videoRoomJoin(room, user))
              .catch((err) => console.error(err));

            this.setState({chatRoomsInitialized: true});

            // if (this.isAllowed("admin")) {
            //   gateway
            //     .chatRoomJoin(room, user)
            //     .catch((err) => {
            //       this.setState({chatRoomsInitializedError: err});
            //     })
            //     .finally(() => this.setState({chatRoomsInitialized: true}));
            // }
          }
        );
      })
      .catch((err) => console.error(err));
  };

  exitRoom = (room) => {
    console.log("[Admin] exitRoom", room);

    const {rooms, gateways} = this.state;
    const room_data = rooms.find((x) => x.room === room);
    if (!room_data) {
      console.warn("[Admin] exitRoom. no room data in state");
      return Promise.resolve();
    }

    const gateway = gateways[room_data.janus];
    console.log("[Admin] exitRoom janus instance", gateway.name);

    const promises = [];
    if (gateway.remoteFeed) {
      console.log("[Admin] exitRoom detach remoteFeed");
      promises.push(gateway.detachRemoteFeed().finally(() => (gateway.remoteFeed = null)));
    }

    if (gateway.videoroom) {
      console.log("[Admin] exitRoom leave and detach videoroom");
      promises.push(
        gateway
          .videoRoomLeave(room)
          .then(() => gateway.detachVideoRoom(false))
          .finally(() => (gateway.videoroom = null))
      );
    }

    if (this.isAllowed("admin")) {
      const {feed_user} = this.state;
      if (feed_user) mqtt.exit("galaxy/users/" + feed_user.id);
      //promises.push(gateway.chatRoomLeave(room));
    }

    return Promise.all(promises);
  };

  getUserInfo = (selected_user) => {
    const {feed_user} = this.state;
    if (feed_user) mqtt.exit("galaxy/users/" + feed_user.id);
    console.log("[Admin] getUserInfo", selected_user);
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
            console.debug("[Admin] Publisher info", data);
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

  onChatRoomsInitialized = (error) => {
    this.setState({chatRoomsInitialized: true, chatRoomsInitializedError: error});
  };

  onConfirmReloadAllCancel = (e, data) => {
    this.setState({showConfirmReloadAll: false});
  };

  onConfirmReloadAllConfirm = (e, data) => {
    this.setState({showConfirmReloadAll: false});
    this.sendRemoteCommand("client-reload-all");
  };

  // setProtocol = () => {
  //   let {tcp} = this.state;
  //   const value = tcp === "mqtt" ? "webrtc" : "mqtt";
  //   api
  //     .adminSetConfig("galaxy_protocol", value)
  //     .then(() => {
  //       this.setState({tcp: value});
  //       const msg = {type: "reload-config", status: value, id: null, user: null, room: null};
  //       mqtt.send(JSON.stringify(msg), false, "galaxy/users/broadcast");
  //     })
  //     .catch((err) => alert(err));
  // };

  render() {
    const {user} = this.props;
    const {
      bitrate,
      current_room,
      current_group,
      feed_id,
      feed_info,
      feed_rtcp,
      feed_user,
      feeds,
      users,
      rooms_question,
      gatewaysInitialized,
      rooms,
      users_count,
      appInitError,
      command_status,
      showConfirmReloadAll,
    } = this.state;

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

    const bitrate_options = [
      {key: 1, text: "64 KBit", value: 64000},
      {key: 2, text: "128 KBit", value: 128000},
      {key: 3, text: "256 KBit", value: 256000},
      {key: 4, text: "512 KBit", value: 512000},
      {key: 5, text: "1024 KBit", value: 102400},
      {key: 6, text: "2048 KBit", value: 204800},
    ];

    let rooms_question_grid = rooms_question.map((data, i) => {
      const {room, num_users, description, questions} = data;
      return (
        <Table.Row active={current_room === room} key={i + "q"} onClick={() => this.joinRoom(data)}>
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
        <Table.Row active={current_room === room} key={i + "r"} onClick={() => this.joinRoom(data)}>
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
        let talk = feed.talk;
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
            trigger={<Button color="purple" icon="upload" />}
            position="bottom left"
            content={
              <List as="ul">
                <List.Item as="li">
                  Set user bitrate:
                  <br />  <br />
                  <Select
                    options={bitrate_options}
                    value={bitrate}
                    onChange={(e, {value}) => this.setState({bitrate: value})}
                  />
                </List.Item>
                <List.Item as="li">
                  <br />
                  <Button color="green" content="Set" fluid onClick={() => this.sendRemoteCommand("client-bitrate", bitrate)} />
                </List.Item>
              </List>
            }
            on="click"
            hideOnScroll
          />,
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
              onChange={(e, {value}) => this.joinRoom(value)}
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

export default AdminRootHttp;

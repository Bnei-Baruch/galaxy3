import React, {Component, Fragment} from 'react';
import {Janus} from "../../lib/janus";
import {Button, Grid, Icon, Label, List, Menu, Popup, Segment, Tab, Table} from "semantic-ui-react";
import './AdminRoot.css';
import './AdminRootVideo.scss'
import classNames from "classnames";
import platform from "platform";
import {kc} from "../../components/UserManager";
import LoginPage from "../../components/LoginPage";
import GxyJanus from "../../shared/janus-utils";
import ChatBox from "./components/ChatBox";
import MonitoringAdmin from "./components/MonitoringAdmin";
import MonitoringUser from "./components/MonitoringUser";
import RoomManager from "./components/RoomManager";
import api from "../../shared/Api";

class AdminRoot extends Component {

    state = {
        activeTab: 0,
        audio: null,
        chatRoomsInitialized: false,
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
        user: null,
        usersTabs: [],
        appInitError: null,
        users_count: 0,
        gxy1_count: 0,
        gxy2_count: 0,
        gxy3_count: 0,
        gxy4_count: 0,
        command_status: true,
    };

    componentWillUnmount() {
        Object.values(this.state.gateways).forEach(x => x.destroy());
    };

    shouldComponentUpdate(nextProps, nextState) {
      const {
        activeTab,
        gatewaysInitialized,
        user,
        usersTabs,
      } = this.state;
      return user === null ||
             gatewaysInitialized === false ||
             activeTab === 0 ||
             nextState.activeTab === 0 ||
             activeTab !== nextState.activeTab ||
             nextState.usersTabs.length !== usersTabs.length;
    }

    checkPermission = (user) => {
        const roles = new Set(user.roles || []);

        let role = null;
        if (roles.has("gxy_root")) {
            role = "root";
        } else if (roles.has("gxy_admin")) {
            role = "admin";
        } else if (roles.has("gxy_viewer")) {
            role = "viewer";
        }

        if (role) {
            console.log("[Admin] checkPermission role is", role);
            delete user.roles;
            user.role = role;
            this.initApp(user);
        } else {
            alert("Access denied!");
            kc.logout();
        }
    };

    isAllowed = (level) => {
        const {user} = this.state;
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

    withAudio = () => (this.isAllowed("admin"));

    initApp = (user) => {
        this.setState({user});

        api.fetchConfig()
            .then(data => GxyJanus.setGlobalConfig(data))
            .then(() => this.initGateways(user))
            .then(this.pollRooms)
            .catch(err => {
                console.error("[Admin] error initializing app", err);
                this.setState({appInitError: err});
            });
    }

    initGateways = (user) => {
        const gateways = GxyJanus.makeGateways("rooms");
        this.setState({gateways});

        return Promise.all(Object.values(gateways).map(gateway => (this.initGateway(user, gateway))))
            .then(() => {
                console.info("[Admin] gateways initialization complete");
                this.setState({gatewaysInitialized: true});
            });
    };

    initGateway = (user, gateway) => {
        console.info("[Admin] initializing gateway", gateway.name);

        gateway.addEventListener("reinit", () => {
                this.postInitGateway(user, gateway)
                    .catch(err => {
                        console.error("[Admin] postInitGateway error after reinit. Reloading", gateway.name, err);
                        window.location.reload();
                    });
            }
        );

        gateway.addEventListener("reinit_failure", (e) => {
            if (e.detail > 10) {
                console.error("[Admin] too many reinit_failure. Reloading", gateway.name, e);
                window.location.reload();
            }
        });

        return gateway.init()
            .then(() => this.postInitGateway(user, gateway));
    }

    postInitGateway = (user, gateway) => {
        console.info("[Admin] gateway post initialization", gateway.name);
        if (this.isAllowed("admin")) {
            return gateway.initGxyProtocol(user, data => this.onProtocolData(gateway, data))
        } else {
            return Promise.resolve();
        }
    }

    pollRooms = () => {
        this.fetchRooms();
        setInterval(this.fetchRooms, 10 * 1000)
    }

    fetchRooms = () => {
        api.fetchActiveRooms()
            .then((data) => {
                const {current_room} = this.state;
                const users_count = data.map(r => r.num_users).reduce((su, cur) => su + cur, 0);
                const gxy1_count = data.filter(r => r.janus === "gxy1").map(r => r.num_users).reduce((su, cur) => su + cur, 0);
                const gxy2_count = data.filter(r => r.janus === "gxy2").map(r => r.num_users).reduce((su, cur) => su + cur, 0);
                const gxy3_count = data.filter(r => r.janus === "gxy3").map(r => r.num_users).reduce((su, cur) => su + cur, 0);
                const gxy4_count = data.filter(r => r.janus === "gxy4").map(r => r.num_users).reduce((su, cur) => su + cur, 0);
                const room = data.find(r => r.room === current_room);
                let users = current_room && room ? room.users : [];
                data.sort((a, b) => {
                    if (a.description > b.description) return 1;
                    if (a.description < b.description) return -1;
                    return 0;
                });
                this.setState({rooms: data, users, users_count, gxy1_count, gxy2_count, gxy3_count, gxy4_count});
            })
            .catch(err => {
                console.error("[Admin] error fetching active rooms", err);
            })
    }

    newVideoRoom = (gateway, room) => {
        console.log("[Admin] newVideoRoom", room);

        return gateway.initVideoRoom({
            onmessage: (msg, jsep) => {
                this.onVideoroomMessage(gateway, msg, jsep);
            }
        });
    };

    publishOwnFeed = (gateway) => {
        gateway.videoroom.createOffer({
            media: {audio: false, video: false, data: true},
            simulcast: false,
            success: (jsep) => {
                Janus.debug('Got publisher SDP!');
                Janus.debug(jsep);
                let publish = { request: 'configure', audio: false, video: false, data: true };
                gateway.videoroom.send({ 'message': publish, 'jsep': jsep });
            },
            error: (error) => {
                Janus.error('WebRTC error:', error);
            }
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
                this.publishOwnFeed(gateway);
                // Any new feed to attach to?
                if (msg["publishers"] !== undefined && msg["publishers"] !== null) {
                    let list = msg["publishers"];
                    console.log("[Admin] Got Publishers (joined)", list);

                    // Filter service feeds and sort by timestamp
                    let feeds = list.sort((a, b) => JSON.parse(a.display).timestamp - JSON.parse(b.display).timestamp)
                        .filter(feeder => JSON.parse(feeder.display).role.match(/^(user|guest|ghost)$/) && feeder.video_codec !== 'none');

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
                        let subst = {feed: id};
                        for (let i in streams) {
                            let stream = streams[i];
                            stream["id"] = id;
                            stream["display"] = display;
                            if (!this.withAudio() && stream.type === "video") {
                                subst.mid = stream.mid;
                            }
                        }
                        subscription.push(subst);
                    }
                    this.setState({feeds});
                    if (subscription.length > 0)
                        this.subscribeTo(subscription, gateway.name);
                }
            } else if (event === "talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                console.debug("[Admin] User start talking", id);
                for (let i = 0; i < feeds.length; i++) {
                    if (feeds[i] && feeds[i].id === id) {
                        feeds[i].talk = true;
                    }
                }
                this.setState({feeds});
            } else if (event === "stopped-talking") {
                let {feeds} = this.state;
                let id = msg["id"];
                console.debug("[Admin] User stop talking", id);
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
                    let feed = msg["publishers"];
                    console.log("[Admin] Got Publishers (event)", feed);

                    let {feeds} = this.state;
                    let subscription = [];
                    for (let f in feed) {
                        let id = feed[f]["id"];
                        let display = JSON.parse(feed[f]["display"]);
                        if (!display.role.match(/^(user|guest|ghost)$/))
                            return;
                        let streams = feed[f]["streams"];
                        feed[f].display = display;
                        feed[f].janus = gateway.name;
                        let subst = {feed: id};
                        for (let i in streams) {
                            let stream = streams[i];
                            stream["id"] = id;
                            stream["display"] = display;
                            if (!this.withAudio() && stream.type === "video") {
                                subst.mid = stream.mid;
                            }
                        }
                        subscription.push(subst);
                    }
                    feeds.push(feed[0]);
                    feeds.sort((a, b) => {
                        if (a.display.username > b.display.username) return 1;
                        if (a.display.username < b.display.username) return -1;
                        return 0;
                    });
                    this.setState({feeds});
                    if (subscription.length > 0)
                        this.subscribeTo(subscription, gateway.name);
                } else if (msg["leaving"] !== undefined && msg["leaving"] !== null) {
                    // One of the publishers has gone away?
                    const leaving = msg["leaving"];
                    console.log("[Admin] leaving", leaving);
                    this.unsubscribeFrom(leaving, gateway.name);
                } else if (msg["unpublished"] !== undefined && msg["unpublished"] !== null) {
                    let unpublished = msg["unpublished"];
                    console.log("[Admin] unpublished", unpublished);
                    if (unpublished === 'ok') {
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
            gateway.videoroom.handleRemoteJsep({jsep});
        }
    };

    newRemoteFeed = (gateway, subscription) => {
        gateway.newRemoteFeed({
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
                    gateway.remoteFeed.createAnswer(
                        {
                            jsep: jsep,
                            media: {audioSend: false, videoSend: false, data: false},	// We want recvonly audio/video
                            success: (jsep) => {
                                gateway.debug("[remoteFeed] Got SDP", jsep);
                                let body = {request: "start", room: this.state.current_room, data: false};
                                gateway.remoteFeed.send({message: body, jsep: jsep});
                            },
                            error: (error) => {
                                gateway.error("[remoteFeed] createAnswer error", error);
                            }
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
        })
            .then(() => {
                const subscribe = {
                    request: "join",
                    room: this.state.current_room,
                    ptype: "subscriber",
                    streams: subscription
                };
                console.log("[Admin] newRemoteFeed join", subscribe);
                gateway.remoteFeed.send({
                    message: subscribe,
                    success: () => {
                        gateway.log('[remoteFeed] join as subscriber success', subscribe)
                    },
                    error: (err) => {
                        gateway.error('[remoteFeed] error join as subscriber', subscribe, err)
                    }
                });
            })
            .catch(err => {
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
                    gateway.log('[remoteFeed] subscribe success', subscribe)
                },
                error: (err) => {
                    gateway.error('[remoteFeed] error subscribe', subscribe, err)
                }
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
                        gateway.log('[remoteFeed] unsubscribe success', unsubscribe)
                    },
                    error: (err) => {
                        gateway.error('[remoteFeed] error unsubscribe', unsubscribe, err)
                    }
                });

                if (feed_user && feed_user.rfid === id) {
                    this.setState({feed_user: null});
                }

                this.setState({feeds});
                break
            }
        }
    };

    onProtocolData = (gateway, data) => {
        // let {users} = this.state;
        //
        // // Set status in users list
        // if (data.type.match(/^(camera|question|sound_test)$/)) {
        //     gateway.log("[protocol] user", data.type, data.status, data.user.id);
        //     if (users[data.user.id]) {
        //         users[data.user.id][data.type] = data.status;
        //         this.setState({users});
        //     } else {
        //         users[data.user.id] = {[data.type]: data.status};
        //         this.setState({users});
        //     }
        // }
        //
        // // Save user on enter
        // if (data.type.match(/^(enter)$/)) {
        //     gateway.log("[protocol] user entered", data.user);
        //     users[data.user.id] = data.user;
        //     this.setState({users});
        // }
    };

    sendRemoteCommand = (command_type) => {
        const {gateways, feed_user, current_janus, current_room, command_status} = this.state;

        if(command_type === "premoder-mode") {
            for(let i=1; i<5; i++) {
                const gateway = gateways["gxy"+i];
                gateway.sendProtocolMessage({type: command_type, room: null, status: command_status, id: null, user: null})
                    .catch(alert);
            }
            //TODO: DB request
            return ;
        }

        if (!feed_user) {
            alert("Choose user");
            return;
        }

        if (command_type === "sound_test") {
            feed_user.sound_test = true;
        }

        const gateway = gateways[current_janus];
        gateway.sendProtocolMessage({type: command_type, room: current_room, status: command_status, id: feed_user.id, user: feed_user})
            .catch(alert);

        if (command_type === "audio-out") {
            this.setState({command_status: !command_status})
        }
    };

    sendDataMessage = (msg) => {
        const {gateways, feed_user, current_janus} = this.state;
        const gateway = gateways[current_janus];
        const cmd = {type: msg, rcmd: true, id: feed_user.id}
        const message = JSON.stringify(cmd);
        console.log(':: Sending message: ', message);
        gateway.videoroom.data({ text: message });
    };

    joinRoom = (data, i) => {
        console.log("[Admin] joinRoom", data, i);
        const {rooms, user, current_room} = this.state;
        const {room, janus: inst} = rooms[i];

        if (current_room === room)
            return;

        console.log("[Admin] joinRoom", room, inst);
        this.setState({users: rooms[i].users})

        let promise;

        if (current_room) {
            promise = this.exitRoom(current_room);
        } else {
            promise = new Promise((resolve, _) => {
                resolve()
            })
        }

        promise
            .then(() => {
                this.setState({
                    current_room: room,
                    current_janus: inst,
                    feeds: [],
                    feed_user: null,
                    feed_id: null,
                    command_status: true,
                });

                const gateway = this.state.gateways[inst];

                this.newVideoRoom(gateway, room)
                    .then(() => {
                        gateway.videoRoomJoin(room, user);
                    });

                if (this.isAllowed("admin")) {
                    gateway.chatRoomJoin(room, user);
                }
            })
    };

    exitRoom = (room) => {
        console.log("[Admin] exitRoom", room);

        const {rooms, gateways} = this.state;
        const room_data = rooms.find(x => x.room === room);
        if (!room_data) {
            console.warn("[Admin] exitRoom. no room data in state");
            return;
        }

        const gateway = gateways[room_data.janus];
        console.log('[Admin] exitRoom janus instance', gateway.name);

        const promises = [];
        if (gateway.remoteFeed) {
            console.log('[Admin] exitRoom detach remoteFeed');
            promises.push(
                gateway.detachRemoteFeed()
                    .finally(() => gateway.remoteFeed = null));
        }

        if (gateway.videoroom) {
            console.log('[Admin] exitRoom leave and detach videoroom');
            promises.push(
                gateway.videoRoomLeave(room)
                    .then(() => gateway.detachVideoRoom(false))
                    .finally(() => gateway.videoroom = null));
        }

        if (this.isAllowed("admin")) {
            promises.push(gateway.chatRoomLeave(room));
        }

        return Promise.all(promises);
    };

    getUserInfo = (feed_user) => {
        console.log("[Admin] getUserInfo", feed_user);
        if(feed_user) {
            const feed_info = feed_user.system ? platform.parse(feed_user.system) : null;
            this.setState({feed_id: feed_user.rfid, feed_user, feed_info});
        }
    };

    getFeedInfo = () => {
        const {feed_user} = this.state;
        if (feed_user) {
            const {janus, session, handle} = this.state.feed_user;
            if (janus && session && handle) {
                api.fetchHandleInfo(janus, session, handle)
                    .then(data => {
                            console.debug("[Admin] Publisher info", data);
                            const video = data.info.webrtc.media[1].rtcp.main;
                            const audio = data.info.webrtc.media[0].rtcp.main;
                            this.setState({feed_rtcp: {video, audio}});
                        }
                    )
                    .catch(err => alert("Error fetching handle_info: " + err))
            }
        }
    };

    onChatRoomsInitialized = () => {
        this.setState({chatRoomsInitialized: true});
    };

  addUserTab(user, stats) {
    const { usersTabs } = this.state;
    if (!usersTabs.find(u => u.id === user.id)) {
      const newUsersTabs = usersTabs.slice();
      newUsersTabs.push({user, stats});
      this.setState({usersTabs: newUsersTabs, activeTab: 2 + newUsersTabs.length - 1});
    }
  }

  removeUserTab(index) {
    const { usersTabs } = this.state;
    if (index < usersTabs.length) {
      const newUsersTabs = usersTabs.slice();
      newUsersTabs.splice(index, 1);
      this.setState({usersTabs: newUsersTabs, activeTab: 1});
    }
  }

  render() {
      const {
        activeTab,
        current_room,
        feed_id,
        feed_info,
        feed_rtcp,
        feed_user,
        feeds,
        users,
        gateways,
        gatewaysInitialized,
        rooms,
        user,
        usersTabs,
          users_count,
          gxy1_count,
          gxy2_count,
          gxy3_count,
          gxy4_count,
        chatRoomsInitialized,
          appInitError,
          command_status,
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
      const q = (<Icon color='red' name='help' />);
      //const v = (<Icon name='checkmark' />);
      //const x = (<Icon name='close' />);

      let rooms_grid = rooms.map((data,i) => {
          const {room, num_users, description, questions} = data;
          return (
              <Table.Row active={current_room === room}
                         key={i} onClick={() => this.joinRoom(data, i)} >
                  <Table.Cell width={5}>{questions ? q : ""}{description}</Table.Cell>
                  <Table.Cell width={1}>{num_users}</Table.Cell>
              </Table.Row>
          )
      });

      let users_grid = feeds.map((feed,i) => {
          if(feed) {
              //let qt = users[feed.display.id].question;
              //let st = users[feed.display.id].sound_test;
              let feed_user = users.find(u => feed.id === u.rfid);
              let qt = feed_user && !!feed_user.question;
              return (
                  <Table.Row active={feed.id === this.state.feed_id} key={i} onClick={() => this.getUserInfo(feed_user)} >
                      <Table.Cell width={10}>{qt ? q : ""}{feed.display.display}</Table.Cell>
                      {/*<Table.Cell positive={st} width={1}>{st ? v : ""}</Table.Cell>*/}
                      <Table.Cell width={1}></Table.Cell>
                  </Table.Row>
              )
          }
      });

      let videos = this.state.feeds.map((feed) => {
          if(feed) {
              let id = feed.id;
              let talk = feed.talk;
              let selected = id === feed_id;
              return (
                  <div className="video"
                       key={"v" + id}
                       ref={"video" + id}
                       id={"video" + id}>
                      <div className={classNames('video__overlay', {'talk': talk}, {'selected': selected})}/>
                      <video key={id}
                             ref={"remoteVideo" + id}
                             id={"remoteVideo" + id}
                             width={width}
                             height={height}
                             autoPlay={autoPlay}
                             controls={controls}
                             muted={muted}
                             playsInline={true}/>
                      {
                          this.withAudio() ?
                              <audio
                                  key={"a" + id}
                                  ref={"remoteAudio" + id}
                                  id={"remoteAudio" + id}
                                  autoPlay={autoPlay}
                                  controls={controls}
                                  playsInline={true}/>
                              : null
                      }
                  </div>
              );
          }
          return true;
      });

      let login = (<LoginPage user={user} checkPermission={this.checkPermission} />);

      let adminContent = (
          <Fragment>

              {
                  this.isAllowed("admin") ?
                      <Segment textAlign='center' className="ingest_segment">
                          {/*<Button color='blue' icon='sound' onClick={() => this.sendRemoteCommand("sound_test")} />*/}
                          <Popup
                              trigger={<Button positive icon='info' onClick={this.getFeedInfo} />}
                              position='bottom left'
                              content={
                                  <List as='ul'>
                                      <List.Item as='li'>System
                                          <List.List as='ul'>
                                              <List.Item as='li'>OS: {feed_info ? feed_info.os.toString() : ""}</List.Item>
                                              <List.Item as='li'>Browser: {feed_info ? feed_info.name : ""}</List.Item>
                                              <List.Item as='li'>Version: {feed_info ? feed_info.version : ""}</List.Item>
                                          </List.List>
                                      </List.Item>
                                      <List.Item as='li'>Video
                                          <List.List as='ul'>
                                              <List.Item as='li'>in-link-quality: {feed_rtcp.video ? feed_rtcp.video["in-link-quality"] : ""}</List.Item>
                                              <List.Item as='li'>in-media-link-quality: {feed_rtcp.video ? feed_rtcp.video["in-media-link-quality"] : ""}</List.Item>
                                              <List.Item as='li'>jitter-local: {feed_rtcp.video ? feed_rtcp.video["jitter-local"] : ""}</List.Item>
                                              <List.Item as='li'>jitter-remote: {feed_rtcp.video ? feed_rtcp.video["jitter-remote"] : ""}</List.Item>
                                              <List.Item as='li'>lost: {feed_rtcp.video ? feed_rtcp.video["lost"] : ""}</List.Item>
                                          </List.List>
                                      </List.Item>
                                      <List.Item as='li'>Audio
                                          <List.List as='ul'>
                                              <List.Item as='li'>in-link-quality: {feed_rtcp.audio ? feed_rtcp.audio["in-link-quality"] : ""}</List.Item>
                                              <List.Item as='li'>in-media-link-quality: {feed_rtcp.audio ? feed_rtcp.audio["in-media-link-quality"] : ""}</List.Item>
                                              <List.Item as='li'>jitter-local: {feed_rtcp.audio ? feed_rtcp.audio["jitter-local"] : ""}</List.Item>
                                              <List.Item as='li'>jitter-remote: {feed_rtcp.audio ? feed_rtcp.audio["jitter-remote"] : ""}</List.Item>
                                              <List.Item as='li'>lost: {feed_rtcp.audio ? feed_rtcp.audio["lost"] : ""}</List.Item>
                                          </List.List>
                                      </List.Item>
                                  </List>
                              }
                              on='click'
                              hideOnScroll
                          />
                          <Popup trigger={<Button color="yellow" icon='question' onClick={() => this.sendRemoteCommand("client-question")} />} content='Set/Unset question' inverted />
                          <Label attached='top right'>
                              <List>
                                  <List.Item>GXY1: {gxy1_count}</List.Item>
                                  <List.Item>GXY2: {gxy2_count}</List.Item>
                                  <List.Item>GXY3: {gxy3_count}</List.Item>
                                  <List.Item>GXY4: {gxy4_count}</List.Item>
                              </List>
                          </Label>
                      </Segment>
                      : null
              }

              <Grid>
                  <Grid.Row columns='equal'>
                      <Grid.Column width={4}>
                          <Segment.Group className="group_list">
                              {
                                  this.isAllowed("root") ?
                                      <Segment textAlign='center'>
                                          <Popup trigger={<Button negative icon='user x' onClick={() => this.sendRemoteCommand("client-kicked")} />} content='Kick' inverted />
                                          <Popup trigger={<Button color="brown" icon='sync alternate' alt="test" onClick={() => this.sendRemoteCommand("client-reconnect")} />} content='Reconnect' inverted />
                                          <Popup trigger={<Button color="olive" icon='redo alternate' onClick={() => this.sendRemoteCommand("client-reload")} />} content='Reload page(LOST FEED HERE!)' inverted />
                                          <Popup trigger={<Button color="teal" icon='microphone' onClick={() => this.sendRemoteCommand("client-mute")} />} content='Mic Mute/Unmute' inverted />
                                          <Popup trigger={<Button color="pink" icon='eye' onClick={() => this.sendRemoteCommand("video-mute")} />} content='Cam Mute/Unmute' inverted />
                                          <Popup trigger={<Button color="orange" icon={command_status ? 'volume off' : 'volume up'} onClick={() => this.sendRemoteCommand("audio-out")} />} content='Talk event' inverted />
                                          {/*<Popup trigger={<Button color="pink" icon='eye' onClick={() => this.sendDataMessage("video-mute")} />} content='Cam Mute/Unmute' inverted />*/}
                                          {/*<Popup trigger={<Button color="blue" icon='power off' onClick={() => this.sendRemoteCommand("client-disconnect")} />} content='Disconnect(LOST FEED HERE!)' inverted />*/}
                                          <Popup trigger={<Button color="blue" icon='copyright' onClick={() => this.sendRemoteCommand("premoder-mode")} />} content='Pre Moderation Mode' inverted />
                                          <Popup trigger={<Button color="yellow" icon='question' onClick={() => this.sendRemoteCommand("client-question")} />} content='Set/Unset question' inverted />
                                      </Segment>
                                      : null
                              }

                              <Segment textAlign='center' raised>
                                  <Table selectable compact='very' basic structured className="admin_table" unstackable>
                                      <Table.Body>
                                          <Table.Row disabled positive>
                                              <Table.Cell colSpan={3} textAlign='center'>Users:</Table.Cell>
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
                          <div className={`vclient__main-wrapper no-of-videos-${feeds.length} layout--equal broadcast--off`} >
                              <div className="videos-panel">
                                  <div className="videos">
                                      <div className="videos__wrapper">
                                          {videos}
                                      </div>
                                  </div>
                              </div>
                          </div>
                      </Grid.Column>
                      <Grid.Column width={3}>

                          <Segment textAlign='center' className="group_list" raised>
                              <Table selectable compact='very' basic structured className="admin_table" unstackable>
                                  <Table.Body>
                                      <Table.Row disabled positive>
                                          <Table.Cell width={5} >Rooms</Table.Cell>
                                          <Table.Cell width={1} >{users_count}</Table.Cell>
                                      </Table.Row>
                                      {rooms_grid}
                                  </Table.Body>
                              </Table>
                          </Segment>

                      </Grid.Column>
                  </Grid.Row>
              </Grid>

              {
                  this.isAllowed("admin") ?
                      <ChatBox user={user}
                               rooms={rooms}
                               selected_room={current_room}
                               selected_user={feed_user}
                               gateways={gateways}
                               onChatRoomsInitialized={this.onChatRoomsInitialized}/>
                      : null
              }

          </Fragment>
      );

      const panes = [
        { menuItem: 'Admin', render: () => <Tab.Pane>{adminContent}</Tab.Pane> },
      ];
      if (this.isAllowed('root')) {
        panes.push({ menuItem: 'Rooms', render: () => <Tab.Pane><RoomManager /></Tab.Pane> });
        panes.push({ menuItem: 'Monitor', render: () => <Tab.Pane><MonitoringAdmin addUserTab={(user, stats) => this.addUserTab(user, stats)}/></Tab.Pane> });
        usersTabs.forEach(({user, stats}, index) => panes.push({
          menuItem: (
            <Menu.Item key={user.id}>
              {user.display || user.name}&nbsp;
              <Icon name='window close' style={{cursor: 'pointer'}} onClick={(e) => { e.stopPropagation(); this.removeUserTab(index); }} />
            </Menu.Item>
          ),
          render: () => <Tab.Pane><MonitoringUser user={user} stats={stats} /></Tab.Pane>,
        }));
      }

      const content = (
        <Tab menu={{ secondary: true, pointing: true, color: "blue" }}
             panes={panes}
             activeIndex={activeTab || 0}
             onTabChange={(e, {activeIndex}) => this.setState({activeTab: activeIndex})}
             renderActiveOnly={true} />
      );

      return (
          <div>
              {user ? content : login}
          </div>
      );
  }
}

export default AdminRoot;

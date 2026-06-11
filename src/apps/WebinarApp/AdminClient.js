import React, {Component, Fragment} from "react";
import {kc} from "../../components/UserManager";
import {Button, Confirm, Grid, Header, Icon, Input, List, Pagination, Popup, Segment, Select, Table} from "semantic-ui-react";
import "./AdminClient.css";
import "./AdminClientVideo.scss";
import classNames from "classnames";
import platform from "platform";
import AdminLogin from "./components/AdminLogin";
import ChatBox from "./components/ChatBox";
import api from "../../shared/Api";
import mqtt from "../../shared/mqtt";
import {JanusMqtt} from "../../lib/janus-mqtt";
import {SubscriberPlugin} from "../../lib/subscriber-plugin";
import log from "loglevel";

// Admin/monitoring client for the simplified WebinarApp.
// Scope of this file: everything related to USERS of a single assigned room.
// - The room is provided by the server via api.fetchAssignedRoom (currently a
//   stub returning 1051); there is no manual room selection here.
// - Rooms management (grouping by language, switching, etc.) will live in a
//   separate file/tab and is intentionally out of scope here.
// - Video is subscriber-only: we never publish. Clicking a user attaches a
//   Janus subscriber and shows just that user's video. All the data we need
//   (rfid/feed id, janus/session/handle, extra.streams) comes from the backend.
class AdminClient extends Component {
  state = {
    bitrate: 64000,
    current_room: "",
    current_janus: "",
    current_group: "",
    gateways: {},
    janus: null,
    subscriber: null,
    remoteFeed: false,
    creatingFeed: false,
    mids: [],
    feed_id: null,
    feed_user: null,
    feed_info: null,
    feed_rtcp: {},
    users: [],
    users_count: 0,
    questions: [],
    total: 0,
    page_no: 1,
    page_size: 50,
    filters: {
      display: "",
      camera: "",
      question: "",
      room_id: "",
      gateway_id: "",
      gateway_feed: "",
      ip_address: "",
    },
    user: null,
    appInitError: null,
    command_status: true,
    showConfirmReloadAll: false,
  };

  // rfid of the feed we are currently subscribed to (single video at a time).
  subscribedFeed = null;

  componentWillUnmount() {
    if (this._usersTimer) clearInterval(this._usersTimer);
    if (this._filterTimer) clearTimeout(this._filterTimer);
    Object.values(this.state.gateways).forEach((g) => g && g.destroy());
  }

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

  checkPermission = (user) => {
    const roles = new Set(user.roles || []);

    let role = null;
    if (roles.has("gxy_root")) {
      role = "root";
    } else if (roles.has("gxy_admin")) {
      role = "admin";
    } else if (roles.has("gxy_viewer")) {
      role = "viewer";
    } else if (roles.has("gxy_notify")) {
      role = "notify";
    }

    delete user.roles;
    user.role = role;

    let gxy_admin = !!role;
    let gxy_monitor = gxy_admin || kc.hasRealmRole("gxy_support");
    let gxy_rooms = kc.hasRealmRole("gxy_root");
    let gxy_notify = kc.hasRealmRole("gxy_notify");

    if (gxy_monitor) {
      this.setState({gxy_admin, gxy_monitor, gxy_rooms, gxy_notify}, () => {
        this.initApp(user);
      });
    } else {
      alert("Access denied!");
      kc.logout();
    }
  };

  withAudio = () => this.isAllowed("admin");

  initApp = (user) => {
    mqtt.init(user, (data) => {
      log.info("[admin] mqtt init: ", data);
      mqtt.join("galaxy/users/broadcast");
      mqtt.join("galaxy/users/" + user.id);
      mqtt.watch(() => {});
      this.setState({user});

      if (!this._inited) {
        this._inited = true;
        this.pollUsers();
      } else if (this.state.current_room) {
        // Re-join the selected user's room topics after an MQTT reconnect.
        mqtt.join("galaxy/room/" + this.state.current_room);
        mqtt.join("galaxy/room/" + this.state.current_room + "/chat", true);
      }
    });
  };

  pollUsers = () => {
    this.fetchUsers();
    this.fetchQuestions();
    this._usersTimer = setInterval(() => {
      this.fetchUsers();
      this.fetchQuestions();
    }, 10 * 1000);
  };

  // Separate list of users who raised their hand (question=true).
  fetchQuestions = () => {
    api
      .fetchSessions({question: true})
      .then((sessions) => {
        const questions = ((sessions && sessions.data) || []).flat();
        this.setState({questions});
      })
      .catch((err) => {
        log.error("[admin] error fetching questions", err);
      });
  };

  // Build the query for /admin/sessions from the active filters + pagination.
  // Only non-empty filters are sent. `display` is a server-side regex (~*), so
  // we escape it to behave as a plain case-insensitive substring search.
  buildSessionParams = () => {
    const {filters, page_no, page_size} = this.state;
    const params = {page_no, page_size};
    Object.entries(filters).forEach(([k, v]) => {
      if (v === "" || v == null) return;
      params[k] = k === "display" ? v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : v;
    });
    return params;
  };

  fetchUsers = () => {
    api
      .fetchSessions(this.buildSessionParams())
      .then((sessions) => {
        const users = ((sessions && sessions.data) || []).flat();
        const total = (sessions && sessions.total) || 0;
        this.setState({users, users_count: total});
        // Keep total in sync; needed for pagination controls.
        this.setState({total});
      })
      .catch((err) => {
        log.error("[admin] error fetching sessions", err);
      });
  };

  setFilter = (name, value) => {
    this.setState((s) => ({filters: {...s.filters, [name]: value}, page_no: 1}), this.fetchUsers);
  };

  // Free-text filters are debounced so we don't hit the backend per keystroke.
  onTextFilter = (name, value) => {
    this.setState((s) => ({filters: {...s.filters, [name]: value}}));
    if (this._filterTimer) clearTimeout(this._filterTimer);
    this._filterTimer = setTimeout(() => {
      this.setState({page_no: 1}, this.fetchUsers);
    }, 400);
  };

  goToPage = (page_no) => {
    this.setState({page_no}, this.fetchUsers);
  };

  setPageSize = (page_size) => {
    this.setState({page_size, page_no: 1}, this.fetchUsers);
  };

  resetFilters = () => {
    this.setState(
      {
        filters: {
          display: "",
          camera: "",
          question: "",
          room_id: "",
          gateway_id: "",
          gateway_feed: "",
          ip_address: "",
        },
        page_no: 1,
      },
      this.fetchUsers
    );
  };

  initJanus = (user, gxy) => {
    log.info("[" + gxy + "] Janus init");
    const {gateways} = this.state;
    gateways[gxy] = new JanusMqtt(user, gxy, gxy);
    gateways[gxy].onStatus = (srv, status) => {
      if (status !== "online") {
        log.error("[" + srv + "] Janus: ", status);
        const g = gateways[srv];
        if (g) {
          g.destroy().then(() => {
            delete gateways[srv];
          });
        }
        this.subscribedFeed = null;
        this.setState({subscriber: null, remoteFeed: false, janus: null});
      }
    };
    return new Promise((resolve, reject) => {
      gateways[gxy]
        .init()
        .then((janus) => {
          log.info("[" + gxy + "] Janus init success", janus);
          this.setState({gateways});
          resolve(janus);
        })
        .catch((err) => {
          log.error("[" + gxy + "] Janus init", err);
          reject(err);
        });
    });
  };

  // Pick the user from the list: bind chat/info and start watching their video.
  // Chat and remote commands target the selected user's own room.
  selectUser = (selected_user) => {
    const {feed_user, current_room} = this.state;
    if (feed_user) mqtt.exit("galaxy/users/" + feed_user.id);
    log.info("[admin] selectUser", selected_user);
    if (!selected_user) return;

    mqtt.join("galaxy/users/" + selected_user.id);

    // Switch room chat/command topics when the selected user is in another room.
    const room = selected_user.room;
    if (room && room !== current_room) {
      if (current_room) {
        mqtt.exit("galaxy/room/" + current_room);
        mqtt.exit("galaxy/room/" + current_room + "/chat");
      }
      mqtt.join("galaxy/room/" + room);
      mqtt.join("galaxy/room/" + room + "/chat", true);
    }

    const feed_info = selected_user.system ? platform.parse(selected_user.system) : null;
    this.setState({
      feed_id: selected_user.rfid,
      feed_user: selected_user,
      feed_info,
      feed_rtcp: {},
      current_room: room || current_room,
      current_janus: selected_user.janus || this.state.current_janus,
      current_group: selected_user.group || selected_user.description || this.state.current_group,
    });
    this.watchUserVideo(selected_user);
  };

  watchUserVideo = (u) => {
    if (!u || !u.rfid) {
      log.warn("[admin] watchUserVideo: user has no rfid (not published yet)", u);
      return;
    }
    const inst = u.janus || this.state.current_janus;
    if (!inst) {
      log.warn("[admin] watchUserVideo: no janus instance for user", u);
      return;
    }

    // Subscriber-only: we only ever watch one user at a time, so there is no
    // point keeping connections to multiple Janus servers. If the selected user
    // lives on a different server than the one we're connected to, drop the old
    // connection before opening the new one.
    if (this.subscriberInst && this.subscriberInst !== inst) {
      this.teardownSubscriber();
    }

    const {gateways} = this.state;
    if (gateways[inst]?.isConnected) {
      this.subscribeUser(u, inst);
    } else {
      this.initJanus(this.state.user, inst)
        .then(() => this.subscribeUser(u, inst))
        .catch((err) => log.error("[admin] watchUserVideo janus init failed", err));
    }
  };

  // Detach the current subscriber and destroy its Janus session/gateway.
  teardownSubscriber = () => {
    const {subscriber, gateways} = this.state;
    const oldInst = this.subscriberInst;
    const gateway = oldInst ? gateways[oldInst] : null;

    if (subscriber && gateway) {
      try {
        gateway.detach(subscriber);
      } catch (err) {
        log.warn("[admin] teardownSubscriber detach failed:", err && err.message);
      }
    }
    if (gateway) {
      gateway.destroy();
      delete gateways[oldInst];
    }

    const v = this.refs.remoteVideo;
    if (v) v.srcObject = null;
    const a = this.refs.remoteAudio;
    if (a) a.srcObject = null;

    this.subscribedFeed = null;
    this.subscriberInst = null;
    this.setState({subscriber: null, remoteFeed: false, creatingFeed: false, janus: null, gateways});
  };

  subscribeUser = (u, inst) => {
    const {current_room, gateways} = this.state;
    const room = u.room || current_room;
    const janus = gateways[inst];
    if (!janus) return;

    // Subscribe to the whole feed (video + audio) by feed id.
    const subscription = [{feed: u.rfid}];

    let {subscriber, remoteFeed, creatingFeed} = this.state;

    // Already have a live subscriber on this gateway: just switch the feed.
    if (subscriber && remoteFeed && this.subscriberInst === inst) {
      if (this.subscribedFeed && this.subscribedFeed !== u.rfid) {
        subscriber.unsub([{feed: this.subscribedFeed}]);
      }
      subscriber.sub(subscription);
      this.subscribedFeed = u.rfid;
      return;
    }

    if (creatingFeed) {
      setTimeout(() => this.subscribeUser(u, inst), 500);
      return;
    }

    subscriber = new SubscriberPlugin();
    subscriber.onTrack = this.onRemoteTrack;
    subscriber.onUpdate = this.onUpdateStreams;

    this.setState({creatingFeed: true});
    janus.attach(subscriber).then((data) => {
      log.info("[admin] Subscriber Handle: ", data);
      subscriber
        .join(subscription, room)
        .then((joined) => {
          log.info("[admin] Subscriber join: ", joined);
          this.onUpdateStreams(joined.streams);
          this.subscribedFeed = u.rfid;
          this.subscriberInst = inst;
          this.setState({subscriber, janus, remoteFeed: true, creatingFeed: false});
        })
        .catch((err) => {
          log.error("[admin] Subscriber join error: ", err);
          this.setState({creatingFeed: false});
        });
    });
  };

  onUpdateStreams = (streams) => {
    const mids = Object.assign([], this.state.mids);
    for (let i in streams) {
      let mindex = streams[i]["mid"];
      mids[mindex] = streams[i];
    }
    this.setState({mids});
  };

  onRemoteTrack = (track, stream, on) => {
    log.info("[admin] >> remote track from feed " + stream.id + ":", track);
    if (!on) return;
    if (track.kind === "video") {
      const remotevideo = this.refs.remoteVideo;
      if (remotevideo) remotevideo.srcObject = stream;
    } else if (track.kind === "audio" && this.withAudio()) {
      const remoteaudio = this.refs.remoteAudio;
      if (remoteaudio) remoteaudio.srcObject = stream;
    }
  };

  sendRemoteCommand = (command_type, value) => {
    const {feed_user, current_room, command_status} = this.state;

    const cmd = {
      type: command_type,
      room: current_room,
      status: command_status,
      id: feed_user?.id,
    };

    if (feed_user) {
      const {camera, question, rfid} = feed_user;
      cmd.user = {camera, question, rfid};
    }

    if (feed_user && command_type === "client-bitrate") cmd.bitrate = value;

    log.info("[admin] sending cmd json", cmd);
    let topic = command_type.match(/^(reload-config|client-reload-all)$/)
      ? "galaxy/users/broadcast"
      : "galaxy/room/" + current_room;
    mqtt.send(JSON.stringify(cmd), false, topic);

    if (command_type === "audio-out") {
      this.setState({command_status: !command_status});
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
            const m0 = data.webrtc.media[0];
            const m1 = data.webrtc.media[1];
            let video = null;
            let audio = null;
            if (m0 && m1) {
              audio = data.webrtc.media[0].rtcp.main;
              video = data.webrtc.media[1].rtcp.main;
            } else if (m0.type === "audio") {
              audio = data.webrtc.media[0].rtcp.main;
            } else if (m0.type === "video") {
              video = data.webrtc.media[0].rtcp.main;
            }
            this.setState({feed_rtcp: {video, audio}});
          })
          .catch((err) => {
            alert("Error fetching handle_info: " + err);
          });
      }
    }
  };

  onConfirmReloadAllCancel = () => {
    this.setState({showConfirmReloadAll: false});
  };

  onConfirmReloadAllConfirm = () => {
    this.setState({showConfirmReloadAll: false});
    this.sendRemoteCommand("client-reload-all");
  };

  renderFilters = () => {
    const {filters, page_size} = this.state;
    const triState = [
      {key: "any", text: "Any", value: ""},
      {key: "on", text: "On", value: "true"},
      {key: "off", text: "Off", value: "false"},
    ];
    const pageSizeOptions = [
      {key: 10, text: "10", value: 10},
      {key: 25, text: "25", value: 25},
      {key: 50, text: "50", value: 50},
      {key: 100, text: "100", value: 100},
      {key: 200, text: "200", value: 200},
    ];

    return (
      <Segment className="ingest_segment">
        <div style={{display: "flex", flexWrap: "wrap", gap: "0.5em", alignItems: "center"}}>
          <Input
            icon="search"
            placeholder="Name"
            value={filters.display}
            onChange={(e, {value}) => this.onTextFilter("display", value)}
          />
          <Input
            placeholder="Room id"
            value={filters.room_id}
            onChange={(e, {value}) => this.onTextFilter("room_id", value)}
          />
          <Input
            placeholder="Gateway id"
            value={filters.gateway_id}
            onChange={(e, {value}) => this.onTextFilter("gateway_id", value)}
          />
          <Input
            placeholder="Feed (rfid)"
            value={filters.gateway_feed}
            onChange={(e, {value}) => this.onTextFilter("gateway_feed", value)}
          />
          <Input
            placeholder="IP address"
            value={filters.ip_address}
            onChange={(e, {value}) => this.onTextFilter("ip_address", value)}
          />
          <span>
            Cam:&nbsp;
            <Select
              compact
              options={triState}
              value={filters.camera}
              onChange={(e, {value}) => this.setFilter("camera", value)}
            />
          </span>
          <span>
            Q:&nbsp;
            <Select
              compact
              options={triState}
              value={filters.question}
              onChange={(e, {value}) => this.setFilter("question", value)}
            />
          </span>
          <span>
            Per page:&nbsp;
            <Select
              compact
              options={pageSizeOptions}
              value={page_size}
              onChange={(e, {value}) => this.setPageSize(value)}
            />
          </span>
          <Button basic icon="undo" content="Reset" onClick={this.resetFilters} />
        </div>
      </Segment>
    );
  };

  renderPagination = () => {
    const {total, page_no, page_size} = this.state;
    const pages = Math.max(1, Math.ceil((total || 0) / page_size));
    return (
      <Segment textAlign="center" basic style={{padding: "0.5em 0"}}>
        <Pagination
          size="mini"
          activePage={page_no}
          totalPages={pages}
          boundaryRange={0}
          siblingRange={1}
          firstItem={null}
          lastItem={null}
          onPageChange={(e, {activePage}) => this.goToPage(activePage)}
        />
        <div style={{marginTop: "0.4em", color: "grey", fontSize: "0.85em"}}>Total: {total}</div>
      </Segment>
    );
  };

  render() {
    const {
      user,
      bitrate,
      feed_id,
      feed_info,
      feed_rtcp,
      feed_user,
      users,
      users_count,
      questions,
      current_room,
      current_group,
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

    const autoPlay = true;
    const controls = false;

    const q = <Icon color="red" name="help" />;
    const g = <Icon color="blue" name="users" />;
    const cam = <Icon name="video camera" size="small" />;

    const bitrate_options = [
      {key: 1, text: "64 KBit", value: 64000},
      {key: 2, text: "128 KBit", value: 128000},
      {key: 3, text: "256 KBit", value: 256000},
      {key: 4, text: "512 KBit", value: 512000},
      {key: 5, text: "1024 KBit", value: 102400},
      {key: 6, text: "2048 KBit", value: 204800},
    ];

    const users_grid = users.map((u, i) => {
      if (!u) return null;
      const qt = !!u.question;
      const gr = !!u?.extra?.isGroup;
      const camera = !!u.camera;
      return (
        <Table.Row active={u.rfid === feed_id} key={u.rfid || i} onClick={() => this.selectUser(u)}>
          <Table.Cell width={10}>
            {gr ? g : ""}
            {qt ? q : ""}
            {u.display}
          </Table.Cell>
          <Table.Cell width={1}>{camera ? cam : ""}</Table.Cell>
        </Table.Row>
      );
    });

    const questions_grid = questions.map((u, i) => {
      if (!u) return null;
      return (
        <Table.Row active={u.rfid === feed_id} key={u.rfid || i} onClick={() => this.selectUser(u)}>
          <Table.Cell width={10}>
            {q}
            {u.display}
          </Table.Cell>
          <Table.Cell width={1}>{u.camera ? cam : ""}</Table.Cell>
        </Table.Row>
      );
    });

    const selectedVideo = (
      <div className={classNames("video", {selected: !!feed_id})} key="selected-video">
        <video
          ref="remoteVideo"
          id="remoteVideo"
          autoPlay={autoPlay}
          controls={controls}
          muted={true}
          playsInline={true}
        />
        {this.withAudio() ? (
          <audio ref="remoteAudio" id="remoteAudio" autoPlay={autoPlay} controls={controls} playsInline={true} />
        ) : null}
      </div>
    );

    let login = <AdminLogin user={user} checkPermission={this.checkPermission} />;

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
            key="bitrate"
            trigger={<Button color="purple" icon="upload" />}
            position="bottom left"
            content={
              <List as="ul">
                <List.Item as="li">
                  Set user bitrate:
                  <br /> <br />
                  <Select
                    options={bitrate_options}
                    value={bitrate}
                    onChange={(e, {value}) => this.setState({bitrate: value})}
                  />
                </List.Item>
                <List.Item as="li">
                  <br />
                  <Button
                    color="green"
                    content="Set"
                    fluid
                    onClick={() => this.sendRemoteCommand("client-bitrate", bitrate)}
                  />
                </List.Item>
              </List>
            }
            on="click"
            hideOnScroll
          />,
          <Popup
            key="question"
            trigger={<Button color="yellow" icon="question" onClick={() => this.sendRemoteCommand("client-question")} />}
            content="Set/Unset question"
            inverted
          />,
          <Popup
            key="reconnect"
            trigger={
              <Button color="brown" icon="sync alternate" onClick={() => this.sendRemoteCommand("client-reconnect")} />
            }
            content="Reconnect"
            inverted
          />,
          <Popup
            key="reload"
            trigger={<Button color="olive" icon="redo alternate" onClick={() => this.sendRemoteCommand("client-reload")} />}
            content="Reload page(LOST FEED HERE!)"
            inverted
          />,
          <Popup
            key="mute"
            trigger={<Button color="teal" icon="microphone" onClick={() => this.sendRemoteCommand("client-mute")} />}
            content="Mic Mute/Unmute"
            inverted
          />,
          <Popup
            key="video-mute"
            trigger={<Button color="pink" icon="eye" onClick={() => this.sendRemoteCommand("video-mute")} />}
            content="Cam Mute/Unmute"
            inverted
          />,
          <Popup
            key="audio-out"
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
            key="kick"
            trigger={<Button negative icon="user x" onClick={() => this.sendRemoteCommand("client-kicked")} />}
            content="Kick"
            inverted
          />,
          <Popup
            key="reload-config"
            trigger={<Button color="blue" icon="cloud download" onClick={() => this.sendRemoteCommand("reload-config")} />}
            content="Silently reload dynamic config on ALL clients"
            inverted
          />,
          <Popup
            key="reload-all"
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
        ]
      );
    }

    let adminContent = (
      <Grid>
        <Grid.Row>
          <Grid.Column>
            {this.isAllowed("admin") ? (
              <Segment textAlign="center" className="ingest_segment">
                {infoPopup}
                {rootControlPanel}
              </Segment>
            ) : null}
            {this.isAllowed("admin") ? this.renderFilters() : null}
          </Grid.Column>
        </Grid.Row>
        <Grid.Row columns="equal">
          <Grid.Column width={4}>
            <Segment.Group className="user_list">
              <Segment textAlign="center" raised>
                <Table selectable compact="very" basic structured className="admin_table" unstackable>
                  <Table.Body>
                    <Table.Row disabled positive>
                      <Table.Cell width={10}>Users: {users_count}</Table.Cell>
                      <Table.Cell width={1}>{users.length}</Table.Cell>
                    </Table.Row>
                    <Table.Row disabled>
                      <Table.Cell width={10}>Title</Table.Cell>
                      <Table.Cell width={1}>Cam</Table.Cell>
                    </Table.Row>
                    {users_grid}
                  </Table.Body>
                </Table>
                {this.renderPagination()}
              </Segment>
            </Segment.Group>
          </Grid.Column>
          <Grid.Column largeScreen={9}>
            <div className="vclient__main-wrapper no-of-videos-1 layout--equal broadcast--off">
              <div className="videos-panel">
                <div className="videos">
                  <div className="videos__wrapper">{selectedVideo}</div>
                </div>
              </div>
            </div>
          </Grid.Column>
          <Grid.Column width={3}>
            <Segment textAlign="center" className="group_list">
              <Table selectable compact="very" basic structured className="admin_table" unstackable>
                <Table.Body>
                  <Table.Row disabled positive>
                    <Table.Cell width={10}>Questions: {questions.length}</Table.Cell>
                    <Table.Cell width={1}></Table.Cell>
                  </Table.Row>
                  {questions_grid}
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
                rooms={[]}
                selected_room={current_room}
                selected_group={current_group}
                selected_user={feed_user}
              />
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

export default AdminClient;

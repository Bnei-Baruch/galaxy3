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
import UserPreview from "./UserPreview";
import log from "loglevel";

// Retained MQTT topic that carries the whole broadcast (air) queue as an array
// of full user objects, so a late-joining consumer (QuadOut) gets the current
// list immediately. TODO: replace with the real topic.
const AIR_QUEUE_TOPIC = "galaxy/room/air_queue";

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
    feed_id: null,
    feed_user: null,
    feed_info: null,
    feed_rtcp: {},
    users: [],
    users_count: 0,
    questions: [],
    air_queue: [],
    on_air_id: null,
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
        this.setState({gateways});
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

  // Admin keeps a single live Janus connection at a time. UserPreview calls this
  // to get a gateway: switching to a user on the SAME server reuses the existing
  // connection, switching servers drops the previous one first. Server name comes
  // from the user object (user.janus).
  ensureGateway = (server) => {
    const {gateways, user} = this.state;
    Object.keys(gateways).forEach((srv) => {
      if (srv !== server && gateways[srv]) {
        try {
          gateways[srv].destroy();
        } catch (err) {
          log.warn("[admin] ensureGateway destroy failed:", err && err.message);
        }
        delete gateways[srv];
      }
    });
    if (gateways[server]?.isConnected) return Promise.resolve(gateways[server]);
    return this.initJanus(user, server);
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
  };

  // Stable key for matching a user across lists (feed id first, user id fallback).
  userKey = (u) => (u ? u.rfid || u.id : null);

  // Publish the current queue (full user objects, each tagged with its on_air
  // state) to the retained topic so consumers always see the latest snapshot.
  publishAirQueue = () => {
    const {air_queue, on_air_id} = this.state;
    const payload = air_queue.map((u) => ({...u, on_air: this.userKey(u) === on_air_id}));
    mqtt.send(JSON.stringify(payload), true, AIR_QUEUE_TOPIC);
  };

  // Add a (hand-raised) user to the operator's broadcast queue. Deduped by
  // userKey so the same person can't be queued twice.
  addToQueue = (u) => {
    if (!u) return;
    const key = this.userKey(u);
    this.setState(
      (s) => {
        if (s.air_queue.some((q) => this.userKey(q) === key)) return null;
        return {air_queue: [...s.air_queue, u]};
      },
      this.publishAirQueue
    );
  };

  // Remove a user from the queue. If they are currently on air, take them off
  // first so we never leave a dangling on-air signal.
  removeFromQueue = (u) => {
    const key = this.userKey(u);
    const wasOnAir = this.state.on_air_id === key;
    this.setState(
      (s) => {
        const on_air_id = s.on_air_id === key ? null : s.on_air_id;
        return {air_queue: s.air_queue.filter((q) => this.userKey(q) !== key), on_air_id};
      },
      this.publishAirQueue
    );
    if (wasOnAir) {
      this.sendRemoteCommand("audio-out", false, u);
    }
  };

  // Toggle a single queued user on/off air. Only one user can be on air at a
  // time, so putting someone on air implicitly takes the previous one off.
  toggleOnAir = (u) => {
    const key = this.userKey(u);
    const turningOn = this.state.on_air_id !== key;
    this.setState({on_air_id: turningOn ? key : null}, this.publishAirQueue);
    this.sendRemoteCommand("audio-out", turningOn, u);
  };

  // `target` defaults to the user we are watching (feed_user) but can be any
  // user (e.g. a person picked from the broadcast queue for an on-air signal).
  // For "audio-out" a boolean `value` sets the on/off status explicitly; the
  // legacy room button omits it and keeps toggling the shared command_status.
  sendRemoteCommand = (command_type, value, target) => {
    const {feed_user, current_room, command_status} = this.state;
    const recipient = target || feed_user;

    const explicitStatus = command_type === "audio-out" && typeof value === "boolean";

    const cmd = {
      type: command_type,
      room: current_room,
      status: explicitStatus ? value : command_status,
      id: recipient?.id,
    };

    if (recipient) {
      const {camera, question, rfid} = recipient;
      cmd.user = {camera, question, rfid};
    }

    if (recipient && command_type === "client-bitrate") cmd.bitrate = value;

    log.info("[admin] sending cmd json", cmd);
    let topic;
    if (command_type.match(/^(reload-config|client-reload-all)$/)) {
      topic = "galaxy/users/broadcast";
    } else if (command_type === "audio-out" && recipient?.id) {
      // On-air signal is per-user now: deliver it to the user's personal topic
      // instead of the whole room.
      topic = "galaxy/users/" + recipient.id;
    } else {
      topic = "galaxy/room/" + current_room;
    }
    mqtt.send(JSON.stringify(cmd), false, topic);

    if (command_type === "audio-out" && !explicitStatus) {
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
      air_queue,
      on_air_id,
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

    const inQueue = (u) => air_queue.some((x) => this.userKey(x) === this.userKey(u));

    // Hide hand-raised users that the operator already moved to the air queue.
    const pending_questions = questions.filter((u) => u && !inQueue(u));

    const questions_grid = pending_questions.map((u, i) => {
      if (!u) return null;
      return (
        <Table.Row active={u.rfid === feed_id} key={u.rfid || i} onClick={() => this.selectUser(u)}>
          <Table.Cell width={10}>
            {q}
            {u.display}
          </Table.Cell>
          <Table.Cell width={1}>{u.camera ? cam : ""}</Table.Cell>
          <Table.Cell width={1} textAlign="center">
            <Button
              compact
              size="mini"
              icon="plus"
              color="blue"
              disabled={inQueue(u)}
              title="Добавить в эфирную очередь"
              onClick={(e) => {
                e.stopPropagation();
                this.addToQueue(u);
              }}
            />
          </Table.Cell>
        </Table.Row>
      );
    });

    const air_queue_grid = air_queue.map((u, i) => {
      if (!u) return null;
      const onAir = this.userKey(u) === on_air_id;
      return (
        <Table.Row
          active={u.rfid === feed_id}
          negative={onAir}
          key={this.userKey(u) || i}
          onClick={() => this.selectUser(u)}
        >
          <Table.Cell width={8}>
            {onAir ? <Icon color="red" name="microphone" /> : ""}
            {u.display}
          </Table.Cell>
          <Table.Cell width={1}>{u.camera ? cam : ""}</Table.Cell>
          <Table.Cell width={2} textAlign="center">
            <Button
              compact
              size="mini"
              icon={onAir ? "microphone slash" : "microphone"}
              color={onAir ? "red" : "green"}
              title={onAir ? "Снять с эфира" : "В эфир"}
              onClick={(e) => {
                e.stopPropagation();
                this.toggleOnAir(u);
              }}
            />
            <Button
              compact
              size="mini"
              icon="trash"
              basic
              title="Убрать из очереди"
              onClick={(e) => {
                e.stopPropagation();
                this.removeFromQueue(u);
              }}
            />
          </Table.Cell>
        </Table.Row>
      );
    });

    const selectedVideo = (
      <div className={classNames("video", {selected: !!feed_id})} key="selected-video">
        <UserPreview
          user={feed_user}
          gateways={this.state.gateways}
          initJanus={this.ensureGateway}
          withAudio={this.withAudio()}
        />
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
            <Segment textAlign="center" className="air_list">
              <Table selectable compact="very" basic structured className="admin_table" unstackable>
                <Table.Body>
                  <Table.Row disabled warning>
                    <Table.Cell width={8}>Эфирная очередь: {air_queue.length}</Table.Cell>
                    <Table.Cell width={1}></Table.Cell>
                    <Table.Cell width={2}></Table.Cell>
                  </Table.Row>
                  {air_queue_grid}
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
            <Grid.Column width={3}>
              <Segment textAlign="center" className="hands_list">
                <Table selectable compact="very" basic structured className="admin_table" unstackable>
                  <Table.Body>
                    <Table.Row disabled positive>
                      <Table.Cell width={8}>Поднятые руки: {pending_questions.length}</Table.Cell>
                      <Table.Cell width={1}></Table.Cell>
                      <Table.Cell width={1}></Table.Cell>
                    </Table.Row>
                    {questions_grid}
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

export default AdminClient;

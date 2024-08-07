import React, {Component} from "react";
import {Button, Dropdown, Grid, Label, Message, Popup, Segment, Table, Divider, Icon, List, Menu} from "semantic-ui-react";
import "./ToranTools.scss";
import PreviewPanelHttp from "./PreviewPanelHttp";
import api from "../../shared/Api";
import {RESET_VOTE} from "../../shared/env";
import {captureException} from "../../shared/sentry";
import mqtt from "../../shared/mqtt";
import {short_regions} from "../../shared/consts";
import log from "loglevel";
import {createContext} from "../../shared/tools";

class ToranToolsHttp extends Component {
  state = {
    galaxy_mode: "lesson",
    delay: false,
    index: 0,
    group: null,
    open: false,
    sorted_feeds: [],
    pg: null,
    vote: false,
    menu_open: false,
    menu_group: null,
    qst_filter: false,
  };

  componentDidUpdate(prevProps) {
    let {group, groups} = this.props;
    if (prevProps.group !== group && group === null) {
      this.setState({open: false});
    }
    if (groups.length !== prevProps.groups.length) {
      setTimeout(() => {
        this.scrollToBottom();
      }, 1000);
    }
  }

  selectGroup = (group, i) => {
    if (this.state.delay) return;
    console.log(group, i);
    this.setState({pg: group, open: true});
    group.queue = i;
    this.props.setProps({group});
  };

  closePopup = (disable = false, group) => {
    if (disable && group) {
      this.disableRoom(group);
    }
    this.props.setProps({group: null});
  };

  selectMenuGroup = (e, data) => {
    e.preventDefault();
    this.contextRef = React.createRef();
    this.contextRef.current = createContext(e)
    this.setState({menu_open: true, menu_group: data})
  };

  shidurMode = (shidur_mode) => {
    this.props.setProps({shidur_mode});
  };

  setRegion = (value) => {
    let {region} = this.props;
    this.setState({qst_filter: false});
    this.props.setProps({region: region === value ? null : value});
  };

  qstFilter = () => {
    this.setState({qst_filter: !this.state.qst_filter});
    this.props.setProps({region: null});
  };

  galaxyMode = (galaxy_mode) => {
    this.setState({galaxy_mode});
  };

  previewMode = (preview_mode) => {
    const galaxy_mode = preview_mode ? "lesson" : "shidur";
    this.props.setProps({preview_mode: !preview_mode});
    this.setState({galaxy_mode});
  };

  getRoomID = (room) => {
    const {admin_rooms} = this.props;
    return admin_rooms.find((r) => r.gateway_uid === room).id;
  };

  disableRoom = (ng) => {
    if (this.state.delay) return;
    let {menu_group, pg} = this.state;
    let group = ng || menu_group || pg;
    group = {...group, extra: {...(group.extra || {}), disabled: true}};
    delete group.users;
    log.info(group);
    let {disabled_rooms} = this.props;
    let exist = disabled_rooms.find((r) => r.room === group.room);
    if (exist) return;
    api.updateRoom(group.room, group);
    this.setDelay();
  };

  vipRoom = (vip) => {
    let {menu_group} = this.state;
    menu_group = {...menu_group, extra: {...(menu_group.extra || {}), [vip]: true}};
    delete menu_group.users;
    api.updateRoom(menu_group.room, menu_group);
  };

  restoreRoom = (e, data, i) => {
    if (this.state.delay) return;
    e.preventDefault();
    if (e.type === "contextmenu") {
      data.extra = null;
      delete data.users;
      api.updateRoom(data.room, data);
      this.setDelay();
    }
  };

  clearGroup = (e, data, i) => {
    if (this.state.delay) return;
    e.preventDefault();
    if (e.type === "contextmenu") {
      if(data.extra?.group) {
        delete data.extra?.group;
        delete data.users;
        api.updateRoom(data.room, data);
      }
      this.setDelay();
    }
  };

  clearVip = (vip_rooms) => {
    if(!confirm("Going to clear selected VIP groups! Are you sure?")) return
    console.log(vip_rooms)
    for (let i = 0; i < vip_rooms.length; i++) {
      vip_rooms[i].extra = null;
      delete vip_rooms[i].users;
      api.updateRoom(vip_rooms[i].room, vip_rooms[i]);
    }
  }

  sortGroups = () => {
    let sorted_feeds = this.props.groups.slice();
    sorted_feeds.sort((a, b) => {
      if (a.description > b.description) return 1;
      if (a.description < b.description) return -1;
      return 0;
    });
    this.setState({sorted_feeds});
  };

  savePreset = (p) => {
    let {presets, group} = this.props;

    // Take to preset from preview
    if (!group) return;

    // First group to preset
    if (presets[p].length === 0) {
      delete group.users;
      presets[p][0] = group;
      mqtt.send(JSON.stringify({type: "state", presets}), true, "galaxy/service/presets");
      this.props.setProps({presets});
      return;
    }

    //Don't allow group be twice in presets
    for (let i = 0; i < presets[p].length; i++) {
      //remove from presets
      if (presets[p][i].room === group.room) {
        presets[p].splice(i, 1);
        mqtt.send(JSON.stringify({type: "state", presets}), true, "galaxy/service/presets");
        this.props.setProps({presets});
        return;
      }
    }

    // Presets is full
    if (presets[p].length === 4) return;

    //Add to presets
    delete group.users;
    presets[p].push(group);
    mqtt.send(JSON.stringify({type: "state", presets}), true, "galaxy/service/presets");
    this.props.setProps({presets});

    console.log(presets);
  };

  removeFromPreset = (p, i) => {
    let {presets} = this.props;
    presets[p].splice(i, 1);
    mqtt.send(JSON.stringify({type: "state", presets}), true, "galaxy/service/presets");
    this.props.setProps({presets});
  };

  previewQuestion = () => {
    let {questions} = this.props;
    if (questions.length > 0) this.selectGroup(questions[0], null);
  };

  sdiAction = (action, status, i, feed) => {
    const {index} = this.props;
    const col = index === 0 ? 1 : index === 4 ? 2 : index === 8 ? 3 : index === 12 ? 4 : null;
    const msg = {type: "sdi-" + action, status, room: null, col, i, feed};
    let retain = action.match(/^(restart_audout|restart_sdiout)$/);
    mqtt.send(JSON.stringify(msg), !retain, "galaxy/service/shidur");
  };

  setDelay = () => {
    this.setState({delay: true});
    setTimeout(() => {
      this.setState({delay: false});
    }, 3000);
  };

  handleVote = () => {
    this.setState({vote: !this.state.vote});
    this.sdiAction("vote", !this.state.vote, 1, null);
  };

  resetVote = () => {
    let request = {auth: "alexmizrachi"};
    fetch(`${RESET_VOTE}`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(request),
    })
      .then()
      .catch((ex) => console.log(`Reset Vote`, ex));
  };

  resetRoomsStatistics = () => {
    api.adminResetRoomsStatistics().catch((err) => {
      console.error("[Shidur] [Toran] error resetting rooms statistics", err);
      captureException(err, {source: "Shidur"});
      alert("Error resetting rooms statistics");
    });
  };

  resetProgramStat = () => {
    this.props.setProps({pnum: {}});
  };

  scrollToBottom = () => {
    this.refs.end.scrollIntoView({behavior: "smooth"});
  };

  filterRegion = (r) => {
    const {region_filter} = this.props;
    region_filter[r] = !region_filter[r]
    console.log(region_filter)
    this.props.setProps({region_filter});
  };

  selectMenu = (c) => {
    if(c === "Disable") {
      this.disableRoom()
    }
    if(c === "Vip1") {
      let {vip1_rooms} = this.props;
      let {menu_group} = this.state;
      let group = vip1_rooms.find((r) => r.room === menu_group.room);
      if (group) return;
      this.vipRoom("vip")
    }
    if(c === "Vip2") {
      let {vip2_rooms} = this.props;
      let {menu_group} = this.state;
      let group = vip2_rooms.find((r) => r.room === menu_group.room);
      if (group) return;
      this.vipRoom("vip2")
    }
    if(c === "Vip3") {
      let {vip3_rooms} = this.props;
      let {menu_group} = this.state;
      let group = vip3_rooms.find((r) => r.room === menu_group.room);
      if (group) return;
      this.vipRoom("vip3")
    }
    if(c === "Vip4") {
      let {vip4_rooms} = this.props;
      let {menu_group} = this.state;
      let group = vip4_rooms.find((r) => r.room === menu_group.room);
      if (group) return;
      this.vipRoom("vip4")
    }
    if(c === "Vip5") {
      let {vip5_rooms} = this.props;
      let {menu_group} = this.state;
      let group = vip5_rooms.find((r) => r.room === menu_group.room);
      if (group) return;
      this.vipRoom("vip5")
    }
    this.setState({menu_open: false})
  };

  render() {
    const {
      group,pre_groups,
      disabled_rooms,
      vip1_rooms,
      vip2_rooms,
      vip3_rooms,
      vip4_rooms,
      vip5_rooms,
      group_user,
      groups,
      groups_queue,
      questions,
      presets,
      sdiout,
      audout,
      shidur_mode,
      users_count,
      preview_mode,
      log_list,
      preusers_count,
      region,
      region_groups,
      region_filter,
      pnum,
      region_list,
      roomsStatistics,
    } = this.props;
    const {open, delay, vote, galaxy_mode, menu_open, qst_filter, pg} = this.state;
    const q = <b style={{color: "red", fontSize: "20px", fontFamily: "Verdana", fontWeight: "bold"}}>?</b>;
    const qf = <b style={{color: "red", backgroundColor: "yellow", fontSize: "20px", fontFamily: "Verdana", fontWeight: "bold"}}>?</b>;
    const next_group = groups[groups_queue] ? groups[groups_queue].description : groups[0] ? groups[0].description : "";
    const ng = groups[groups_queue] || null;

    let action_log = log_list.map((msg, i) => {
      let {user, time, text} = msg;
      return (
        <div key={i}>
          <p>
            <i style={{color: "grey"}}>{time}</i>&nbsp;&nbsp;--&nbsp;&nbsp;
            <i style={{color: "blue"}}>
              {user.description} &nbsp;--&nbsp;&nbsp; {text}
            </i>
          </p>
        </div>
      );
    });

    let question_list = questions.map((data, i) => {
      const {room, num_users, description, questions, extra} = data;
      const qs = !roomsStatistics[room] || roomsStatistics[room]["on_air"] === 0;
      const next = data.description === next_group;
      const active = group && group.room === room;
      const pn = (<Label circular content={pnum[room]} />);
      const vip = extra?.vip || extra?.vip2 || extra?.vip3 || extra?.vip4 || extra?.vip5 ? (<Label size='mini' color='green' circular content="vip1" />) : null;
      //const pr = presets.find(pst => pst.room === room);
      const pr = false;
      const p = pr ? (
        <Label size="mini" color="teal">4</Label>
      ) : (
        ""
      );
      return (
        <Table.Row
          positive={group && group.description === description}
          className={active ? "active" : next ? "warning" : extra?.vip || extra?.vip2 || extra?.vip3 || extra?.vip4 || extra?.vip5 ? "vip" : "no"}
          key={room}
          onClick={() => this.selectGroup(data, i)}
          onContextMenu={(e) => this.selectMenuGroup(e, data)}
        >
          <Table.Cell width={1}>{pn}</Table.Cell>
          <Table.Cell width={5}>{description}&nbsp;&nbsp;{vip}</Table.Cell>
          <Table.Cell width={1}>{p}</Table.Cell>
          <Table.Cell width={1}>{num_users}</Table.Cell>
          <Table.Cell width={1}>{questions && qs ? qf : questions ? q : ""}</Table.Cell>
        </Table.Row>
      );
    });


    let rooms_list = pre_groups.map((data, i) => {
      const {room, num_users, description, questions} = data;
      const qs = !roomsStatistics[room] || roomsStatistics[room]["on_air"] === 0;
      const active = group && group.room === room;
      const pr = false;
      const p = pr ? (
        <Label size="mini" color="teal">
          4
        </Label>
      ) : (
        ""
      );
      return (
        <Table.Row
          positive={group && group.description === description}
          className={active ? "active" : "no"}
          key={room}
          onClick={() => this.selectGroup(data, i)}
          onContextMenu={(e) => this.selectMenuGroup(e, data)}
        >
          <Table.Cell width={5}>{description}</Table.Cell>
          <Table.Cell width={1}>{p}</Table.Cell>
          <Table.Cell width={1}>{num_users}</Table.Cell>
          <Table.Cell width={1}>{questions && qs ? qf : questions ? q : ""}</Table.Cell>
        </Table.Row>
      );
    });

    let groups_list = groups.map((data, i) => {
      const {room, num_users, description, questions, extra} = data;
      const qs = !roomsStatistics[room] || roomsStatistics[room]["on_air"] === 0;
      const next = data.description === next_group;
      const active = group && group.room === room;
      const pn = (<Label circular content={pnum[room]} />);
      const vip = extra?.vip || extra?.vip2 || extra?.vip3 || extra?.vip4 || extra?.vip5 ? (<Label size='mini' color='green' circular content="vip" />) : null;
      //const pr = presets.find(pst => pst.room === room);
      const pr = false;
      const p = pr ? (
        <Label size="mini" color="teal">4</Label>
      ) : (
        ""
      );
      return (
        <Table.Row
          positive={group && group.description === description}
          className={active ? "active" : next ? "warning" : extra?.vip || extra?.vip2 || extra?.vip3 || extra?.vip4 || extra?.vip5 ? "vip" : "no"}
          key={room}
          onClick={() => this.selectGroup(data, i)}
          onContextMenu={(e) => this.selectMenuGroup(e, data)}
        >
          <Table.Cell width={1}>{pn}</Table.Cell>
          <Table.Cell width={5}>{description}&nbsp;&nbsp;{vip}</Table.Cell>
          <Table.Cell width={1}>{p}</Table.Cell>
          <Table.Cell width={1}>{num_users}</Table.Cell>
          <Table.Cell width={1}>{questions && qs ? qf : questions ? q : ""}</Table.Cell>
        </Table.Row>
      );
    });

    let groups_region_list = region_groups.map((data, i) => {
      const {room, num_users, description, questions, extra} = data;
      const qs = !roomsStatistics[room] || roomsStatistics[room]["on_air"] === 0;
      const next = data.description === next_group;
      const active = group && group.room === room;
      const pn = (<Label circular content={pnum[room]} />);
      const vip = extra?.vip || extra?.vip2 || extra?.vip3 || extra?.vip4 || extra?.vip5 ? (<Label size='mini' color='green' circular content="vip" />) : null;
      //const pr = presets.find(pst => pst.room === room);
      const pr = false;
      const p = pr ? (
        <Label size="mini" color="teal">
          4
        </Label>
      ) : (
        ""
      );
      return (
        <Table.Row
          positive={group && group.description === description}
          className={active ? "active" : next ? "warning" : extra?.vip || extra?.vip2 || extra?.vip3 || extra?.vip4 || extra?.vip5 ? "vip" : "no"}
          key={room}
          onClick={() => this.selectGroup(data, i)}
          onContextMenu={(e) => this.selectMenuGroup(e, data)}
        >
          <Table.Cell width={1}>{pn}</Table.Cell>
          <Table.Cell width={5}>{description}&nbsp;&nbsp;{vip}</Table.Cell>
          <Table.Cell width={1}>{p}</Table.Cell>
          <Table.Cell width={1}>{num_users}</Table.Cell>
          <Table.Cell width={1}>{questions && qs ? qf : questions ? q : ""}</Table.Cell>
        </Table.Row>
      );
    });

    let disabled_list = disabled_rooms.map((data, i) => {
      const {room, num_users, description, questions} = data;
      const qs = !roomsStatistics[room] || roomsStatistics[room]["on_air"] === 0;
      return (
        <Table.Row
          key={room}
          error
          onClick={() => this.selectGroup(data, i)}
          onContextMenu={(e) => this.restoreRoom(e, data, i)}
        >
          <Table.Cell width={5}>{description}</Table.Cell>
          <Table.Cell width={1}>{num_users}</Table.Cell>
          <Table.Cell width={1}>{questions && qs ? qf : questions ? q : ""}</Table.Cell>
        </Table.Row>
      );
    });

    let vip1_list = vip1_rooms.map((data, i) => {
      const {room, num_users, description, questions} = data;
      const qs = !roomsStatistics[room] || roomsStatistics[room]["on_air"] === 0;
      const pn = (<Label circular content={pnum[room]} />);
      return (
        <Table.Row
          className="vip"
          key={room}
          onClick={() => this.selectGroup(data, i)}
          onContextMenu={(e) => this.restoreRoom(e, data, i)}
        >
          <Table.Cell width={1}>{pn}</Table.Cell>
          <Table.Cell width={5}>{description}</Table.Cell>
          <Table.Cell width={1}>{num_users}</Table.Cell>
          <Table.Cell width={1}>{questions && qs ? qf : questions ? q : ""}</Table.Cell>
        </Table.Row>
      );
    });

    let vip2_list = vip2_rooms.map((data, i) => {
      const {room, num_users, description, questions} = data;
      const qs = !roomsStatistics[room] || roomsStatistics[room]["on_air"] === 0;
      const pn = (<Label circular content={pnum[room]} />);
      return (
        <Table.Row
          className="vip"
          key={room}
          onClick={() => this.selectGroup(data, i)}
          onContextMenu={(e) => this.restoreRoom(e, data, i)}
        >
          <Table.Cell width={1}>{pn}</Table.Cell>
          <Table.Cell width={5}>{description}</Table.Cell>
          <Table.Cell width={1}>{num_users}</Table.Cell>
          <Table.Cell width={1}>{questions && qs ? qf : questions ? q : ""}</Table.Cell>
        </Table.Row>
      );
    });

    let vip3_list = vip3_rooms.map((data, i) => {
      const {room, num_users, description, questions} = data;
      const qs = !roomsStatistics[room] || roomsStatistics[room]["on_air"] === 0;
      const pn = (<Label circular content={pnum[room]} />);
      return (
        <Table.Row
          className="vip"
          key={room}
          onClick={() => this.selectGroup(data, i)}
          onContextMenu={(e) => this.restoreRoom(e, data, i)}
        >
          <Table.Cell width={1}>{pn}</Table.Cell>
          <Table.Cell width={5}>{description}</Table.Cell>
          <Table.Cell width={1}>{num_users}</Table.Cell>
          <Table.Cell width={1}>{questions && qs ? qf : questions ? q : ""}</Table.Cell>
        </Table.Row>
      );
    });

    let vip4_list = vip4_rooms.map((data, i) => {
      const {room, num_users, description, questions} = data;
      const qs = !roomsStatistics[room] || roomsStatistics[room]["on_air"] === 0;
      const pn = (<Label circular content={pnum[room]} />);
      return (
        <Table.Row
          className="vip"
          key={room}
          onClick={() => this.selectGroup(data, i)}
          onContextMenu={(e) => this.restoreRoom(e, data, i)}
        >
          <Table.Cell width={1}>{pn}</Table.Cell>
          <Table.Cell width={5}>{description}</Table.Cell>
          <Table.Cell width={1}>{num_users}</Table.Cell>
          <Table.Cell width={1}>{questions && qs ? qf : questions ? q : ""}</Table.Cell>
        </Table.Row>
      );
    });

    let vip5_list = vip5_rooms.map((data, i) => {
      const {room, num_users, description, questions} = data;
      const qs = !roomsStatistics[room] || roomsStatistics[room]["on_air"] === 0;
      const pn = (<Label circular content={pnum[room]} />);
      return (
        <Table.Row
          className="vip"
          key={room}
          onClick={() => this.selectGroup(data, i)}
          onContextMenu={(e) => this.restoreRoom(e, data, i)}
        >
          <Table.Cell width={1}>{pn}</Table.Cell>
          <Table.Cell width={5}>{description}</Table.Cell>
          <Table.Cell width={1}>{num_users}</Table.Cell>
          <Table.Cell width={1}>{questions && qs ? qf : questions ? q : ""}</Table.Cell>
        </Table.Row>
      );
    });

    let groups_user_list = group_user.map((data, i) => {
      const {room, num_users, description, questions} = data;
      const qs = !roomsStatistics[room] || roomsStatistics[room]["on_air"] === 0;
      const pn = (<Label circular content={pnum[room]} />);
      return (
        <Table.Row
          className="vip"
          key={room}
          onClick={() => this.selectGroup(data, i)}
          onContextMenu={(e) => this.clearGroup(e, data, i)}
        >
          <Table.Cell width={1}>{pn}</Table.Cell>
          <Table.Cell width={5}>{description}</Table.Cell>
          <Table.Cell width={1}>{num_users}</Table.Cell>
          <Table.Cell width={1}>{questions && qs ? qf : questions ? q : ""}</Table.Cell>
        </Table.Row>
      );
    });

    let group_options = this.state.sorted_feeds.map((feed, i) => {
      const display = feed.description;
      return {key: i, value: feed, text: display};
    });

    let pst_buttons = Object.keys(presets).map((p) => {
      const ps = p === "5" || p === "6" || p === "7" || p === "8" ? "top right" : "top left";
      let preset = presets[p].map((data, i) => {
        const {description} = data;
        return (
          <List.Item>
            <Label horizontal size="big">
              {description}
              <Icon name="delete" onClick={() => this.removeFromPreset(p, i)} />
            </Label>
          </List.Item>
        );
      });
      return (
        <Popup
          flowing
          hoverable
          on="hover"
          position={ps}
          trigger={<Button color="teal" content={p} onClick={() => this.savePreset(p)} />}
          content={<List divided>{preset}</List>}
        />
      );
    });

    return (
      <Grid.Row>
        <Grid.Column>
          <Segment className="preview_conteiner">
            {ng ? (
              <Segment className="group_segment" color="blue">
                <div className="shidur_overlay">
                  <span>{ng.description}</span>
                </div>
                <PreviewPanelHttp pg={ng} {...this.props} next closePopup={() => this.closePopup(true, ng)} />
              </Segment>
            ) : (
              ""
            )}
          </Segment>
          <Popup
            context={this.contextRef}
            onClose={() => this.setState({menu_open: false})}
            open={menu_open}
          >
            <Menu text size='massive' compact
                  items={[
                    { key: 'disable', content: 'Disable', icon: 'window close' },
                    { key: 'vip1', content: 'Vip1', icon: 'star' },
                    { key: 'vip2', content: 'Vip2', icon: 'star' },
                    { key: 'vip3', content: 'Vip3', icon: 'star' },
                    { key: 'vip4', content: 'Vip4', icon: 'star' },
                    { key: 'vip5', content: 'Vip5', icon: 'star' },
                    { key: 'groups', content: 'Groups', icon: 'star' },
                  ]}
                  onItemClick={(e, data) => this.selectMenu(data.content)}
                  secondary
                  vertical
            />
          </Popup>
          <Message attached className="info-panel" color="grey">
            {action_log}
            <div ref="end" />
          </Message>
          <Button.Group attached="bottom">
            <Button
              color={audout ? "green" : "red"}
              disabled={!audout}
              onClick={() => this.sdiAction("restart_audout", false, 1, null)}
            >
              AudOut
            </Button>
            <Button
              color={sdiout ? "green" : "red"}
              disabled={!sdiout}
              onClick={() => this.sdiAction("restart_sdiout", false, 1, null)}
            >
              SdiOut
            </Button>
            <Button color="green" onClick={this.resetRoomsStatistics}>
              Reset QStats
            </Button>
            <Button color="green" onClick={this.resetProgramStat}>
              Reset PStats
            </Button>
          </Button.Group>
        </Grid.Column>
        <Grid.Column>
          <Segment attached textAlign="center">
            <Label attached="top right" color="green">
              Users: {users_count}
            </Label>
            <Dropdown
              className="select_group"
              placeholder="Search.."
              fluid
              search
              selection
              options={group_options}
              onClick={this.sortGroups}
              onChange={(e, {value}) => this.selectGroup(value)}
            />
            <Label attached="top left" color="blue">
              Groups: {groups.length}
            </Label>
          </Segment>
          <Button.Group attached="bottom" size="mini">
            {pst_buttons}
          </Button.Group>
          <Segment textAlign="center" className="group_list" raised disabled={delay}>
            <Table selectable compact="very" basic structured className="admin_table" unstackable>
              <Table.Body>{qst_filter ? question_list : region ? groups_region_list : groups_list}</Table.Body>
            </Table>
          </Segment>
          <Segment textAlign="center">
            <Button.Group attached="bottom" size="mini">
              <Button color={questions.length > 0 ? "red" : "grey"} onClick={this.previewQuestion}>
                Questions: {questions.length}
              </Button>
            </Button.Group>
          </Segment>
        </Grid.Column>
        <Grid.Column>
          <Segment className="preview_conteiner">
            {open ? (
              <Segment className="group_segment" color="green">
                <div className="shidur_overlay">
                  <span>{group ? group.description : ""}</span>
                </div>
                <PreviewPanelHttp pg={pg} {...this.props} closePopup={this.closePopup} />
              </Segment>
            ) : (
              ""
            )}
          </Segment>
          <Segment textAlign="center">
            <Button.Group attached="bottom" size="mini">
              <Button color="green" onClick={this.handleVote}>
                {vote ? "Hide" : "Show"} Vote
              </Button>
              <Button color="blue" onClick={this.resetVote}>
                Reset Vote
              </Button>
            </Button.Group>
          </Segment>
          <Segment attached className="settings_conteiner">
            <Button.Group size="mini" widths='9'>
              <Button
                color={qst_filter ? "" : "grey"}
                content="Questions"
                onClick={this.qstFilter}
              />
            </Button.Group>
            <Button.Group size="mini" widths='9'>
              {Object.keys(short_regions).map((r) => {
                return (
                  <Button
                    color={region === r ? "" : "grey"}
                    content={short_regions[r]}
                    onClick={() => this.setRegion(r)}
                  />
                );
              })}
            </Button.Group>
            <Button.Group size="small" basic widths='9'>
              {Object.keys(short_regions).map((r) => {
                return (<Button content={region_list[r]?.length} />);
              })}
            </Button.Group>
            <Button.Group size="mini" widths='9'>
              {Object.keys(region_filter).map((r) => {
                return (
                  <Button
                    active={region_filter[r]}
                    color={region_filter[r] ? "red" : "teal"}
                    icon='arrow up'
                    onClick={() => this.filterRegion(r)}
                  />
                );
              })}
            </Button.Group>
            <Divider />
          </Segment>
          <Button.Group attached="bottom" size="mini">
            <Button
              disabled={shidur_mode === "gvarim"}
              color="teal"
              content="Gvarim"
              onClick={() => this.shidurMode("gvarim")}
            />
            <Button
              disabled={shidur_mode === "nashim"}
              color="teal"
              content="Nashim"
              onClick={() => this.shidurMode("nashim")}
            />
            <Button
              disabled={shidur_mode === "beyahad" || shidur_mode === ""}
              color="teal"
              content="Beyahad"
              onClick={() => this.shidurMode("beyahad")}
            />
            <Button
              disabled={shidur_mode === "kvutzot"}
              color="teal"
              content="kvutzot"
              onClick={() => this.shidurMode("kvutzot")}
            />
          </Button.Group>
        </Grid.Column>
        <Grid.Column>
          <Button.Group attached="top" size="mini">
            <Button
              disabled={galaxy_mode === "lesson"}
              color="grey"
              content="Preview"
              onClick={() => this.galaxyMode("lesson")}
            />
            <Button
              disabled={galaxy_mode === "groups"}
              color="grey"
              content="Groups"
              onClick={() => this.galaxyMode("groups")}
            />
            <Button
              disabled={galaxy_mode === "shidur"}
              color="grey"
              content="Disabled"
              onClick={() => this.galaxyMode("shidur")}
            />
          </Button.Group>
          <Button.Group attached="top" size="mini">
            <Button
              selected={galaxy_mode === "vip1"}
              color="grey"
              content="VIP1"
              onClick={() => this.galaxyMode("vip1")}
              onDoubleClick={() => this.clearVip(vip1_rooms)}
            />
            <Button
              selected={galaxy_mode === "vip2"}
              color="grey"
              content="VIP2"
              onClick={() => this.galaxyMode("vip2")}
              onDoubleClick={() => this.clearVip(vip2_rooms)}
            />
            <Button
              selected={galaxy_mode === "vip3"}
              color="grey"
              content="VIP3"
              onClick={() => this.galaxyMode("vip3")}
              onDoubleClick={() => this.clearVip(vip3_rooms)}
            />
            <Button
              selected={galaxy_mode === "vip4"}
              color="grey"
              content="VIP4"
              onClick={() => this.galaxyMode("vip4")}
              onDoubleClick={() => this.clearVip(vip4_rooms)}
            />
            <Button
              selected={galaxy_mode === "vip5"}
              color="grey"
              content="VIP5"
              onClick={() => this.galaxyMode("vip5")}
              onDoubleClick={() => this.clearVip(vip5_rooms)}
            />
          </Button.Group>
          <Segment attached textAlign="center" className="disabled_groups">
            <Table selectable compact="very" basic structured className="admin_table" unstackable>
              <Table.Body>
                {galaxy_mode === "lesson" ?
                  rooms_list : galaxy_mode === "vip1" ?
                    vip1_list : galaxy_mode === "vip2" ?
                      vip2_list : galaxy_mode === "vip3" ?
                        vip3_list : galaxy_mode === "vip4" ?
                          vip4_list : galaxy_mode === "vip5" ?
                            vip5_list : galaxy_mode === "groups" ?
                              groups_user_list : disabled_list}
              </Table.Body>
            </Table>
          </Segment>
          <Button.Group attached="bottom" size="mini">
            <Button
              color="green"
              content={"Preview " + (preview_mode ? "ON" : "OFF")}
              onClick={() => this.previewMode(preview_mode)}
            />
            <Button color="green" disabled={preview_mode === "OFF"}>
              <Dropdown className="preusers_count" item text={preusers_count}>
                <Dropdown.Menu>
                  {["Off", 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((c) => {
                    return <Dropdown.Item onClick={() => this.props.setProps({preusers_count: c})}>{c}</Dropdown.Item>;
                  })}
                </Dropdown.Menu>
              </Dropdown>
            </Button>
          </Button.Group>
        </Grid.Column>
      </Grid.Row>
    );
  }
}

export default ToranToolsHttp;

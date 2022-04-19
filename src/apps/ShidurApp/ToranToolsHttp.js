import React, {Component} from "react";
import {Button, Dropdown, Grid, Label, Message, Popup, Segment, Table, Divider, Icon, List} from "semantic-ui-react";
import "./ToranTools.scss";
import PreviewPanelHttp from "./PreviewPanelHttp";
import api from "../../shared/Api";
import {RESET_VOTE} from "../../shared/env";
import {captureException} from "../../shared/sentry";
import mqtt from "../../shared/mqtt";
import {short_regions} from "../../shared/consts";

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

  closePopup = ({disable = false} = {}, next) => {
    const g = next || this.props.group;
    if (disable) {
      this.disableRoom(g);
    }
    if (!next) this.props.setProps({group: null});
  };

  handleDisableRoom = (e, data) => {
    e.preventDefault();
    if (e.type === "contextmenu") {
      this.disableRoom(data);
    }
  };

  handlePreviewRoom = (e, data) => {
    e.preventDefault();
    if (e.type === "contextmenu") {
      this.vipRoom(data);
    }
  };

  shidurMode = (shidur_mode) => {
    this.props.setProps({shidur_mode});
  };

  setRegion = (value) => {
    let {region} = this.props;
    this.props.setProps({region: region === value ? null : value});
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

  disableRoom = (data) => {
    if (this.state.delay) return;
    data = {...data, extra: {...(data.extra || {}), disabled: true}};
    delete data.users;
    console.log(data);
    let {disabled_rooms} = this.props;
    let group = disabled_rooms.find((r) => r.room === data.room);
    if (group) return;
    api.updateRoom(data.room, data);
    this.setDelay();
  };

  vipRoom = (data) => {
    let {groups} = this.props;
    let group = groups.find((r) => r.room === data.room);
    if (group) return;
    data = {...data, extra: {...(data.extra || {}), vip: true}};
    delete data.users;
    console.log(data);
    api.updateRoom(data.room, data);
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
      this.props.setProps({presets});
      return;
    }

    //Don't allow group be twice in presets
    for (let i = 0; i < presets[p].length; i++) {
      //remove from presets
      if (presets[p][i].room === group.room) {
        presets[p].splice(i, 1);
        this.props.setProps({presets});
        return;
      }
    }

    // Presets is full
    if (presets[p].length === 4) return;

    //Add to presets
    delete group.users;
    presets[p].push(group);
    this.props.setProps({presets});

    console.log(presets);
  };

  removeFromPreset = (p, i) => {
    let {presets} = this.props;
    presets[p].splice(i, 1);
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

  render() {
    const {
      group,
      pre_groups,
      disabled_rooms,
      vip_rooms,
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
    } = this.props;
    const {open, delay, vote, galaxy_mode} = this.state;
    const q = <b style={{color: "red", fontSize: "20px", fontFamily: "Verdana", fontWeight: "bold"}}>?</b>;
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

    let rooms_list = pre_groups.map((data, i) => {
      const {room, num_users, description, questions} = data;
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
          onContextMenu={(e) => this.handlePreviewRoom(e, data)}
        >
          <Table.Cell width={5}>{description}</Table.Cell>
          <Table.Cell width={1}>{p}</Table.Cell>
          <Table.Cell width={1}>{num_users}</Table.Cell>
          <Table.Cell width={1}>{questions ? q : ""}</Table.Cell>
        </Table.Row>
      );
    });

    let groups_list = groups.map((data, i) => {
      const {room, num_users, description, questions} = data;
      const next = data.description === next_group;
      const active = group && group.room === room;
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
          className={active ? "active" : next ? "warning" : "no"}
          key={room}
          onClick={() => this.selectGroup(data, i)}
          onContextMenu={(e) => this.handleDisableRoom(e, data)}
        >
          <Table.Cell width={1}>
            <Label circular content={pnum[room]} />
          </Table.Cell>
          <Table.Cell width={5}>{description}</Table.Cell>
          <Table.Cell width={1}>{p}</Table.Cell>
          <Table.Cell width={1}>{num_users}</Table.Cell>
          <Table.Cell width={1}>{questions ? q : ""}</Table.Cell>
        </Table.Row>
      );
    });

    let groups_region_list = region_groups.map((data, i) => {
      const {room, num_users, description, questions} = data;
      const next = data.description === next_group;
      const active = group && group.room === room;
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
          className={active ? "active" : next ? "warning" : "no"}
          key={room}
          onClick={() => this.selectGroup(data, i)}
          onContextMenu={(e) => this.handleDisableRoom(e, data)}
        >
          <Table.Cell width={1}>
            <Label circular content={pnum[room]} />
          </Table.Cell>
          <Table.Cell width={5}>{description}</Table.Cell>
          <Table.Cell width={1}>{p}</Table.Cell>
          <Table.Cell width={1}>{num_users}</Table.Cell>
          <Table.Cell width={1}>{questions ? q : ""}</Table.Cell>
        </Table.Row>
      );
    });

    let disabled_list = disabled_rooms.map((data, i) => {
      const {room, num_users, description, questions} = data;
      return (
        <Table.Row
          key={room}
          error
          onClick={() => this.selectGroup(data, i)}
          onContextMenu={(e) => this.restoreRoom(e, data, i)}
        >
          <Table.Cell width={5}>{description}</Table.Cell>
          <Table.Cell width={1}>{num_users}</Table.Cell>
          <Table.Cell width={1}>{questions ? q : ""}</Table.Cell>
        </Table.Row>
      );
    });

    let vip_list = vip_rooms.map((data, i) => {
      const {room, num_users, description, questions} = data;
      return (
        <Table.Row
          key={room}
          onClick={() => this.selectGroup(data, i)}
          onContextMenu={(e) => this.restoreRoom(e, data, i)}
        >
          <Table.Cell width={5}>{description}</Table.Cell>
          <Table.Cell width={1}>{num_users}</Table.Cell>
          <Table.Cell width={1}>{questions ? q : ""}</Table.Cell>
        </Table.Row>
      );
    });

    let group_options = this.state.sorted_feeds.map((feed, i) => {
      const display = feed.description;
      return {key: i, value: feed, text: display};
    });

    let pst_buttons = Object.keys(presets).map((p) => {
      const ps = p === "3" || p === "4" ? "top right" : "top left";
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
                <PreviewPanelHttp pg={ng} {...this.props} next closePopup={this.closePopup} />
              </Segment>
            ) : (
              ""
            )}
          </Segment>
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
              <Table.Body>{region ? groups_region_list : groups_list}</Table.Body>
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
                <PreviewPanelHttp pg={this.state.pg} {...this.props} closePopup={this.closePopup} />
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
              disabled={galaxy_mode === "vip"}
              color="grey"
              content="Disabled"
              onClick={() => this.galaxyMode("vip")}
            />
            <Button
              disabled={galaxy_mode === "shidur"}
              color="grey"
              content="Disabled"
              onClick={() => this.galaxyMode("shidur")}
            />
          </Button.Group>
          <Segment attached textAlign="center" className="disabled_groups">
            <Table selectable compact="very" basic structured className="admin_table" unstackable>
              <Table.Body>{galaxy_mode === "lesson" ? rooms_list : galaxy_mode === "vip" ? vip_list : disabled_list}</Table.Body>
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

import React, {Component} from "react";
import {Segment} from "semantic-ui-react";
import UsersHandle from "./UsersHandle";

class UsersQuad extends Component {
  state = {
    col: null,
    vquad: [null, null, null, null],
  };

  componentDidMount() {
    let {index} = this.props;
    let col = index === 0 ? 1 : index === 4 ? 2 : index === 8 ? 3 : index === 12 ? 4 : null;
    this.setState({col});
    this.autoSwitch(0);
    setTimeout(() => {
      this.switchFour();
    }, col * 1000);
  }

  autoSwitch = (i) => {
    i++;
    setTimeout(() => {
      const {col} = this.state;
      if (col === i) this.switchFour();
      if (i === 4) i = 0;
      this.autoSwitch(i);
    }, 60 * 1000);
  };

  quadGroup = (queue) => {
    let {groups} = this.props;
    let group = groups[queue];
    if (group && group.users) {
      //delete group.users;
      group.queue = queue;
      return group;
    } else {
      return null;
    }
  };

  switchFour = () => {
    let {groups_queue, groups, round, pnum} = this.props;
    let {vquad, col} = this.state;

    for (let i = 0; i < 4; i++) {
      // Don't switch if nobody in queue
      if (i === groups.length) {
        console.log("[Shidur] Queue is END");
        break;
      }

      if (groups_queue >= groups.length) {
        // End round here!
        console.log("[Shidur] -- ROUND END --");
        groups_queue = 0;
        round++;
        this.props.setProps({groups_queue, round});
      }

      vquad[i] = this.quadGroup(groups_queue);
      groups_queue++;
      pnum[vquad[i].room] ? pnum[vquad[i].room]++ : (pnum[vquad[i].room] = 1);
      this.props.setProps({groups_queue, pnum});
    }
    this.setState({vquad});

    // Disable queue until program full
    if (groups.length < 4) {
      this.props.setProps({groups_queue: 0});
    }
  };

  toFullGroup = (i, g) => {
    this.setState({fullscr: true, full_feed: i});
  };

  toFourGroup = (i, g) => {
    this.setState({fullscr: false, full_feed: null});
  };

  render() {
    const {full_feed, fullscr, vquad = [null, null, null, null]} = this.state;
    const {roomsStatistics = {}, qst} = this.props;

    let program = vquad.map((g, i) => {
      let qst_group = g && g.room === qst?.room;
      let qst_mark = "";
      let name = "";
      if (g) {
        name = g.description;
        if (g.questions) {
          let className = fullscr ? "qst_fullscreentitle" : "qst_title";
          if (!roomsStatistics[g.room] || roomsStatistics[g.room]["on_air"] === 0) {
            className += ` ${className}__first_time`;
          }
          qst_mark = <div className={className}>?</div>;
        }
      }

      return (
        <div
          className={
            fullscr && full_feed === i
              ? "video_full"
              : fullscr && full_feed !== i
              ? "hidden"
              : qst_group
              ? "usersvideo_qst"
              : "usersvideo_box"
          }
          key={"pr" + i}
        >
          {qst_mark}
          <div className={fullscr ? "fullscrvideo_title" : "video_title"}>{name}</div>
          <UsersHandle key={"q" + i} g={g} index={i} {...this.props} />
        </div>
      );
    });

    return (
      <Segment className="preview_sdi">
        <div className="usersvideo_grid">{program}</div>
      </Segment>
    );
  }
}

export default UsersQuad;

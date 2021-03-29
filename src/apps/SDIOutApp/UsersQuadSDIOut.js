import React, {Component} from "react";
import {Segment} from "semantic-ui-react";
import UsersHandleSDIOut from "./UsersHandleSDIOut";

class UsersQuadSDIOut extends Component {
  state = {
    col: null,
  };

  componentDidMount() {
    let {index} = this.props;
    let col = index === 0 ? 1 : index === 4 ? 2 : index === 8 ? 3 : index === 12 ? 4 : null;
    this.setState({col});
  }

  toFullGroup = (i, g) => {
    this.setState({fullscr: true, full_feed: i});
  };

  toFourGroup = (i, g) => {
    this.setState({fullscr: false, full_feed: null});
  };

  render() {
    const {full_feed, fullscr} = this.state;
    const {vquad = [null, null, null, null], roomsStatistics = {}, qst} = this.props;

    let program = vquad.map((g, i) => {
      let qst_group = g?.room === qst?.room;
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
          <UsersHandleSDIOut key={"q" + i} g={g} index={i} {...this.props} />
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

export default UsersQuadSDIOut;

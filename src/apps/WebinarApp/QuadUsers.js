import React, {Component} from "react";
import {Segment} from "semantic-ui-react";
import QuadJanus from "./QuadJanus";

// Screen = 16 slots (4 columns x 4 quads). Deterministic layout: global slot N
// shows groups[page * 16 + N], so a single group can never land in two slots —
// no duplication across columns. A column owns 4 consecutive slots:
// base = page * 16 + (col - 1) * 4.
class QuadUsers extends Component {
  render() {
    const {index, groups = [], round = 0, roomsStatistics = {}, qst} = this.props;

    // Column number (1..4) derived from the start index passed by QuadOut.
    const col = index === 0 ? 1 : index === 4 ? 2 : index === 8 ? 3 : index === 12 ? 4 : 1;
    const base = round * 16 + (col - 1) * 4;

    let program = [0, 1, 2, 3].map((i) => {
      const g = groups[base + i] || null;
      let qst_group = g && g.room === qst?.room;
      let qst_mark = "";
      let name = "";
      if (g) {
        name = g.description;
        if (g.questions) {
          let className = "qst_title";
          if (!roomsStatistics[g.room] || roomsStatistics[g.room]["on_air"] === 0) {
            className += ` ${className}__first_time`;
          }
          qst_mark = <div className={className}>?</div>;
        }
      }

      return (
        <div className={qst_group ? "usersvideo_qst" : "usersvideo_box"} key={"pr" + i}>
          {qst_mark}
          <div className="video_title">{name}</div>
          <QuadJanus key={"q" + i} g={g} q={i} col={col} index={i} {...this.props} />
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

export default QuadUsers;

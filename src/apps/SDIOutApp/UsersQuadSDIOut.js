import React, { Component } from 'react';
import {Segment} from "semantic-ui-react";
import UsersHandleSDIOut from "./UsersHandleSDIOut";
import {getState} from "../../shared/tools";

class UsersQuadSDIOut extends Component {

    state = {
        col: null,
        vquad: [null,null,null,null],
    };

    componentDidMount() {
        let { index } = this.props;
        let col = index === 0 ? 1 : index === 4 ? 2 : index === 8 ? 3 : index === 12 ? 4 : null;
        this.setState({col});
        setInterval(() => {
            getState(`galaxy/qids/q`+col, ({vquad}) => {
                this.setState({vquad});
            });
        }, 1000);
    };

    toFullGroup = (i,g) => {
        this.setState({fullscr: true, full_feed: i});
    };

    toFourGroup = (i,g) => {
        this.setState({fullscr: false, full_feed: null});
    };

  render() {
      const {full_feed,fullscr,vquad} = this.state;

      let program = vquad.map((g,i) => {
          let qst = g && g.questions;
          let name = g ? g.description : "";
          //let room = groups[g] ? groups[g].room : "";
          return (
              <div className={fullscr && full_feed === i ? "video_full" : fullscr && full_feed !== i ? "hidden" : "usersvideo_box"}
                   key={"pr" + i} >
                  {qst ? <div className={fullscr ? "qst_fullscreentitle" : "qst_title"}>?</div> : ""}
                  <div className={fullscr ? "fullscrvideo_title" : "video_title"} >{name}</div>
                  <UsersHandleSDIOut key={"q"+i} g={g} index={i} {...this.props} />
              </div>);
      });

      return (
          <Segment className="preview_sdi">
              <div className="usersvideo_grid">
                  {program}
              </div>
          </Segment>
    );
  }
}

export default UsersQuadSDIOut;

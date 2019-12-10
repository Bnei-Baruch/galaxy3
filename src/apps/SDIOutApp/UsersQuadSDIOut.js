import React, { Component } from 'react';
import {Segment} from "semantic-ui-react";
import './UsersQuadSDIOut.scss'
import UsersHandleSDIOut from "./UsersHandleSDIOut";
import {getState} from "../../shared/tools";

class UsersQuadSDIOut extends Component {

    state = {
        col: 4,
        quad: [null,null,null,null],
    };

    componentDidMount() {
        setInterval(() => {
            getState('galaxy/program', ({quad}) => {
                this.setState({quad});
            });
        }, 3000);
    };

    switchFullScreen = (i,feed) => {
        let {fullscr} = this.state;
        this.setState({fullscr: !fullscr, full_feed: i});
    };

  render() {
      const {full_feed,fullscr,col,quad} = this.state;

      let program = quad.map((g,i) => {
          let qst = g && g.questions;
          let name = g ? g.description : "";
          //let room = groups[g] ? groups[g].room : "";
          return (
              <div className={fullscr && full_feed === i ? "video_full" : fullscr && full_feed !== i ? "hidden" : "usersvideo_box"}
                   key={"pr" + i} >
                  <div className={fullscr ? "fullscrvideo_title" : "video_title"} >{name}</div>
                  {qst ? <div className={fullscr ? "qst_fullscreentitle" : "qst_title"}>?</div> : ""}
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

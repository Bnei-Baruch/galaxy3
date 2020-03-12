import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Segment} from "semantic-ui-react";
import './SDIOutGroups.css'

class QuestionSDIOut extends Component {

    state = {};

    toFullGroup = (i,full_feed) => {
        Janus.log(":: Make Full Screen Group: ",full_feed);
        full_feed.display = JSON.parse(full_feed.feed_display);
        this.setState({fullscr: true,full_feed});
    };

    toFourGroup = () => {
        Janus.log(":: Back to four: ");
        this.setState({fullscr: false, full_feed: null});
    };


  render() {
      const { full_feed,fullscr } = this.state;
      const {users} = this.props;
      const autoPlay = true;
      const controls = false;
      const muted = true;
      const full_question = full_feed && users[full_feed.display.id] ? users[full_feed.display.id].question : null;

      let fullscreen = (<div className={fullscr ? "" : "hidden"}>
              <div className="fullscrvideo_title">
                  <span>{full_feed ? full_feed.display.display : ""}</span>
              </div>
              <div className={full_question ? 'qst_fullscreentitle' : 'hidden'}>?</div>
              <video ref = {"fullscreenVideo"}
                     onClick={() => this.toFourGroup()}
                     id = "fullscreenVideo"
                     width = "640"
                     height = "360"
                     autoPlay = {autoPlay}
                     controls = {controls}
                     muted = {muted}
                     playsInline = {true} />
          </div>
      );

      return (
          <Segment attached className="preview_sdi">
              <div className="video_grid">
                  {fullscreen}
              </div>
          </Segment>
      );
  }
}

export default QuestionSDIOut;

import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Segment} from "semantic-ui-react";
import './SDIOutGroups.css'

class SDIOutGroups extends Component {

    state = {
        col: null,
        quad: [
            "0","3","6","9",
            "1","4","7","10",
            "2","5","8","11"
        ],
    };

    componentDidMount() {
        let { index } = this.props;
        let col = index === 0 ? 1 : index === 4 ? 2 : index === 8 ? 3 : null;
        this.setState({col});
    };

    toFullGroup = (i,full_feed) => {
        Janus.log(":: Make Full Screen Group: ",full_feed);
        full_feed.display = JSON.parse(full_feed.feed_display);
        this.setState({fullscr: true,full_feed});
        let fourvideo = this.refs["programVideo" + i];
        let fullvideo = this.refs.fullscreenVideo;
        fullvideo.srcObject = fourvideo.captureStream();
    };

    toFourGroup = () => {
        Janus.log(":: Back to four: ");
        this.setState({fullscr: false, full_feed: null});
    };


  render() {
      const { full_feed,fullscr,col } = this.state;
      const {users} = this.props;
      const width = "320px";
      const height = "180px";
      const autoPlay = true;
      const controls = false;
      const muted = true;
      const full_question = full_feed && users[full_feed.display.id] ? users[full_feed.display.id].question : null;

      let program = this.props.mids.map((mid,i) => {
          if(mid && this.props.qam[i] === col) {
              if(!mid.active) {
                  return (<div className={fullscr ? "hidden" : ""} key={"prf" + i}>
                      <div className="video_box" key={"prov" + i}>
                          <div className="video_title" />
                      </div></div>)
              } else {
                  let qst = mid.user && users[mid.user.id] ? users[mid.user.id].question : false;
                  let talk = mid.talk;
                  //let id = feed.feed_id;
                  return (<div className={fullscr ? "hidden" : ""} key={"prf" + i}>
                      <div className="video_box"
                           key={"prov" + i}
                           ref={"provideo" + i}
                           id={"provideo" + i}>
                          <div className="video_title">{mid.user.display}</div>
                          {qst ? <div className='qst_title'>?</div> : ""}
                          <video className={talk ? "talk" : ""}
                                 onClick={() => this.toFullGroup(i,mid)}
                                 key={i}
                                 ref={"programVideo" + i}
                                 id={"programVideo" + i}
                                 width={width}
                                 height={height}
                                 autoPlay={autoPlay}
                                 controls={controls}
                                 muted={muted}
                                 playsInline={true}/>
                      </div></div>);
              }
          }
          return true;
      });

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
                  {program}
                  {fullscreen}
              </div>
          </Segment>
      );
  }
}

export default SDIOutGroups;

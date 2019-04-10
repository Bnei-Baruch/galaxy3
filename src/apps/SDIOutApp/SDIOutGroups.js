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

    switchProgram = (i, pre_feed) => {
        Janus.log(" :: Selected program Switch: ",i);
        this.props.setProps({program: i});
        if(pre_feed)
            this.props.setProps({pre_feed});
        let {mids} = this.props;

        // Unsubscribe from previous mid
        let streams = [{ sub_mid: mids[i].mid }];
        this.props.unsubscribeFrom(streams, mids[i].feed_id);
    };

    switchFour = () => {
        let {feeds_queue,feeds,index,round} = this.props;
        let {quad} = this.state;
        let streams = [];

        for(let i=index; i<index+4; i++) {

            // Don't switch if nobody in queue
            if(i === feeds.length) {
                console.log("Queue is END");
                break;
            }

            if(feeds_queue >= feeds.length) {
                // End round here!
                Janus.log(" -- ROUND END --");
                feeds_queue = 0;
                round++;
                this.props.setProps({feeds_queue,round});
            }

            // If program is not full avoid using feeds_queue
            if(feeds.length < 13) {
                let sub_mid = quad[i];
                let feed = feeds[i].id;
                streams.push({feed, mid: "1", sub_mid});
            } else {
                let sub_mid = quad[i];
                let feed = feeds[feeds_queue].id;
                streams.push({feed, mid: "1", sub_mid});
                feeds_queue++;
            }

        }

        this.props.setProps({feeds_queue});
        Janus.log(" :: Going to switch four: ", streams);
        let switch_four = {request: "switch", streams};
        this.props.remoteFeed.send ({"message": switch_four,
            success: () => {
                Janus.debug(" -- Switch success: ");
            }
        });
    };

    fullScreenGroup = (i,full_feed) => {
        Janus.log(":: Make Full Screen Group: ",full_feed);
        full_feed.display = JSON.parse(full_feed.feed_display);
        this.setState({fullscr: !this.state.fullscr,full_feed});
        let fourvideo = this.refs["programVideo" + i];
        let fullvideo = this.refs.fullscreenVideo;
        fullvideo.srcObject = fourvideo.captureStream();
    };

    toFourGroup = () => {
        Janus.log(":: Back to four: ");
        this.setState({fullscr: !this.state.fullscr, full_feed: null});
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
                                 onClick={() => this.fullScreenGroup(i,mid)}
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

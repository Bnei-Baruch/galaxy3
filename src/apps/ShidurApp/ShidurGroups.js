import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Segment, Icon, Button} from "semantic-ui-react";
import {putData} from "../../shared/tools";
import './ShidurGroups.css'
import {sendProtocolMessage} from "../../shared/protocol";

class ShidurGroups extends Component {

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

    switchProgram = (i) => {
        Janus.log(" :: Selected program Switch: ",i);
        this.props.setProps({program: i});
        let {mids} = this.props;

        // Unsubscribe from previous mid
        let streams = [{ sub_mid: mids[i].mid }];
        this.props.unsubscribeFrom(streams, mids[i].feed_id);

        setTimeout(() => {
            this.questionStatus();
        }, 1000);

        // Send sdi action
        let feed = this.props.pre_feed || null;
        this.sdiAction("switch_program" , false, i, feed);
    };

    questionStatus = () => {
        let {mids,qfeeds,quistions_queue} = this.props;
        for(let i = 0; i < quistions_queue.length; i++) {
            let qp_count = mids.filter(qp => qp.active && qp.feed_id === quistions_queue[i].rfid).length;
            let qf_chk = qfeeds.find(qf => qf.id === quistions_queue[i].rfid);
            if(qp_count > 0 && qf_chk) {
                for (let q = 0; q < qfeeds.length; q++) {
                    if (qfeeds[q] && qfeeds[q].id === quistions_queue[i].rfid) {
                        console.log(" - Remove QFEED: ", qfeeds[q]);
                        qfeeds.splice(q, 1);
                        this.props.setProps({qfeeds});
                        break
                    }
                }
            } else if(qp_count === 0 && !qf_chk) {
                qfeeds.push({id: quistions_queue[i].rfid, display: quistions_queue[i].user});
                this.props.setProps({qfeeds});
            }
        }
        this.saveState();
    };

    saveState = () => {
        let {feeds,users,quistions_queue,disabled_groups,feeds_queue,feedStreams,mids} = this.props;
        let state = {feeds,users,quistions_queue,disabled_groups,feeds_queue,feedStreams,mids};
        putData(`state/galaxy/shidur`, state, (cb) => {
            Janus.log(":: Save to state: ",cb);
        });
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
                // Add to qfeeds if removed from program with question status
                setTimeout(() => {
                    this.questionStatus();
                }, 1000);
            }
        });

        // Send sdi action
        this.sdiAction("switch_four" , false, null, streams);
    };

    sdiAction = (action, status, i, feed) => {
        const { protocol, user, index } = this.props;
        let col = index === 0 ? 1 : index === 4 ? 2 : index === 8 ? 3 : null;
        let msg = { type: "sdi-"+action, status, room: 1234, col, i, feed};
        sendProtocolMessage(protocol, user, msg );
    };

    fullScreenGroup = (i,full_feed) => {
        Janus.log(":: Make Full Screen Group: ",full_feed);
        full_feed.display = JSON.parse(full_feed.feed_display);
        this.setState({fullscr: !this.state.fullscr,full_feed});
        let fourvideo = this.refs["programVideo" + i];
        let fullvideo = this.refs.fullscreenVideo;
        fullvideo.srcObject = fourvideo.captureStream();
        this.sdiAction("fullscr_group" , true, i, full_feed);
    };

    toFourGroup = () => {
        Janus.log(":: Back to four: ");
        this.sdiAction("fullscr_group" , false, null, this.state.full_feed);
        this.setState({fullscr: !this.state.fullscr, full_feed: null});
    };


  render() {
      const { full_feed,fullscr,col } = this.state;
      const {feeds,pre_feed,users} = this.props;
      const width = "201px";
      const height = "113px";
      const autoPlay = true;
      const controls = false;
      const muted = true;
      const full_question = full_feed && users[full_feed.display.id] ? users[full_feed.display.id].question : null;
      //const q = (<Icon color='red' name='question circle' />);

      let program = this.props.mids.map((feed,i) => {
          if(feed && this.props.qam[i] === col) {
              if(!feed.active) {
                  return (<div className={fullscr ? "hidden" : ""} key={"prf" + i}>
                      <div className="video_box" key={"prov" + i}>
                          <div className="video_title" />
                      </div></div>)
              }
              let user = JSON.parse(feed.feed_display);
              let qst = users[user.id] ? users[user.id].question : false;
              let talk = feed.talk;
              //let id = feed.feed_id;
              return (<div className={fullscr ? "hidden" : ""} key={"prf" + i}>
                        <div className="video_box"
                           key={"prov" + i}
                           ref={"provideo" + i}
                           id={"provideo" + i}>
                  <div className="video_title">{user.display}</div>
                            {qst ? <div className='qst_title'>?</div> : ""}
                  <video className={talk ? "talk" : ""}
                         onClick={() => this.fullScreenGroup(i,feed)}
                         key={i}
                         ref={"programVideo" + i}
                         id={"programVideo" + i}
                         width={width}
                         height={height}
                         autoPlay={autoPlay}
                         controls={controls}
                         muted={muted}
                         playsInline={true}/>
                  <Button className='next_button'
                          disabled={feeds.length < 2}
                          size='mini'
                          color='green'
                          icon={pre_feed ? 'arrow up' : 'share'}
                          onClick={() => this.switchProgram(i)} />
              </div></div>);
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
                     width = "400"
                     height = "220"
                     autoPlay = {autoPlay}
                     controls = {controls}
                     muted = {muted}
                     playsInline = {true} />
          </div>
      );

      return (
          <Segment className="group_conteiner">
              <Segment attached className="program_segment" color='red'>
                  <div className="video_grid">
                      {program}
                      {fullscreen}
                  </div>
              </Segment>
              <Button className='fours_button'
                      disabled={feeds.length < 16}
                      attached='bottom'
                      color='blue'
                      size='mini'
                      onClick={this.switchFour}>
                  <Icon name='share' />
                  <Icon name='th large' />
                  <Icon name='share' />
              </Button>
          </Segment>
    );
  }
}

export default ShidurGroups;

import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Segment, Icon, Button} from "semantic-ui-react";
import './UsersQuad.scss'
import {sendProtocolMessage} from "../../shared/protocol";
import {GROUPS_ROOM} from "../../shared/consts";
import UsersHandle from "./UsersHandle";

class UsersQuad extends Component {

    state = {
        col: null,
        mids: [0,1,2,3],
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
        if(this.quadCheckDup())
            return;
        Janus.log(" :: Selected program Switch: ",i);
        //this.setDelay();
        const {mids} = this.props;
        this.props.setProps({program: i});

        // Unsubscribe from previous mid
        let streams = [{ sub_mid: mids[i].mid }];
        this.props.unsubscribeFrom(streams, mids[i].feed_id);

        setTimeout(() => {
            this.questionStatus();
        }, 1000);
    };

    quadCheckDup = () => {
        let {feeds,feeds_queue,pre_feed,index,mids} = this.props;
        let {quad} = this.state;
        let dup = false;
        let feed = pre_feed || feeds[feeds_queue];
        if(feed) {
            for (let i = index; i < index + 4; i++) {
                let sub_mid = quad[i];
                let mid = mids[sub_mid];
                if (mid && mid.active && feed.id && mid.feed_id === feed.id) {
                    dup = true;
                    break;
                }
            }
        }
        return dup;
    };

    questionStatus = () => {
        let {mids,qfeeds,questions_queue} = this.props;
        for(let i = 0; i < questions_queue.length; i++) {
            let qp_count = mids.filter(qp => qp.active && qp.feed_id === questions_queue[i].rfid).length;
            let qf_chk = qfeeds.find(qf => qf.id === questions_queue[i].rfid);
            if(qp_count > 0 && qf_chk) {
                for (let q = 0; q < qfeeds.length; q++) {
                    if (qfeeds[q] && qfeeds[q].id === questions_queue[i].rfid) {
                        Janus.log(" - Remove QFEED: ", qfeeds[q]);
                        qfeeds.splice(q, 1);
                        this.props.setProps({qfeeds});
                        break
                    }
                }
            } else if(qp_count === 0 && !qf_chk) {
                qfeeds.push({id: questions_queue[i].rfid, display: questions_queue[i].user});
                this.props.setProps({qfeeds});
            }
        }
    };

    switchFour = () => {
        let {feeds_queue,feeds,index,round} = this.props;
        let {quad} = this.state;
        let streams = [];

        for(let i=index; i<index+4; i++) {

            // Don't switch if nobody in queue
            if(i === feeds.length) {
                Janus.log("Queue is END");
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
        this.sdiAction("switch_req" , true, null, streams);
    };

    sdiAction = (action, status, i, feed) => {
        const { protocol, user, index } = this.props;
        let col = index === 0 ? 1 : index === 4 ? 2 : index === 8 ? 3 : null;
        let msg = { type: "sdi-"+action, status, room: GROUPS_ROOM, col, i, feed};
        sendProtocolMessage(protocol, user, msg );
    };

    checkFullScreen = () => {
        let {full_feed} = this.state;
        if(full_feed) {
            Janus.log(":: Group: " + full_feed + " , sending sdi-action...");
            this.sdiAction("fullscr_group" , true, full_feed.mindex, full_feed);
        }
    };

    switchFullScreen = (i,feed) => {
        console.log(" :: FULLSCREEN", i)
        let {fullscr} = this.state;
        this.setState({fullscr: !fullscr, full_feed: i});
        console.log(" :: FULLSCREEN", i, !fullscr)
        return
        feed.display = JSON.parse(feed.feed_display);
        let {full_feed} = this.state;
        if(full_feed && feed.feed_id === full_feed.feed_id) {
            this.toFourGroup(() => {});
        } else if(full_feed) {
            this.toFourGroup(() => {
                this.toFullGroup(i,feed);
            });
        } else {
            this.toFullGroup(i,feed);
        }
    };

    toFullGroup = (i,feed) => {
        Janus.log(":: Make Full Screen Group: ",feed);
        this.setState({fullscr: true,full_feed: feed});
        //this.sdiAction("fullscr_group" , true, i, feed);
    };

    toFourGroup = (cb) => {
        Janus.log(":: Back to four: ");
        //this.sdiAction("fullscr_group" , false, null, this.state.full_feed);
        this.setState({fullscr: false, full_feed: null}, () => {
            cb();
        });
    };

    setDelay = () => {
        this.props.setProps({disable_button: true, next_button: true});
        setTimeout(() => {
            this.props.setProps({disable_button: false, next_button: false});
        }, 2000);
    };

    setPreset = () => {
        Janus.log(" :: Set preset ::");
        let {users,mids,index,presets} = this.props;
        let streams = [];

        for(let i=index; i<index+4; i++) {
            if(!presets[i]) continue;
            let sub_mid = presets[i].sub_mid;
            let user_id = presets[i].user_id;
            let mid = mids[sub_mid];

            // Check if mid exist and user is online
            if(mid && mid.active && users[user_id]) {
                let feed = users[user_id].rfid;
                streams.push({feed, mid: "1", sub_mid});
            }
        }

        // Avoid request with empty streams
        if(streams.length === 0)
            return;

        Janus.log(" :: Going to switch to preset: ", streams);
        let switch_preset = {request: "switch", streams};
        this.props.remoteFeed.send ({"message": switch_preset,
            success: () => {
                Janus.debug(" -- Switch success: ");
                // Add to qfeeds if removed from program with question status
                setTimeout(() => {
                    this.questionStatus();
                }, 1000);
            }
        });

        // Send sdi action
        this.sdiAction("switch_req" , true, null, streams);
    };


  render() {
      const {full_feed,fullscr,col} = this.state;
      const {rooms,pre_feed,users,next_button} = this.props;
      const q = (<div className="question">
          <svg viewBox="0 0 50 50">
              <text x="25" y="25" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">&#xF128;</text>
          </svg>
      </div>);

      let program = this.state.mids.map((mid,i) => {
              if(mid === null) {
                  return (<div key={"prf" + i}>
                      <div className="video_box" key={"prov" + i}>
                          <div className="video_title" />
                      </div></div>)
              } else {
                  let qst = mid.user && users[mid.user.id] ? users[mid.user.id].question : false;
                  return (
                      <div className={fullscr && full_feed === i ? "video_full" : fullscr && full_feed !== i ? "hidden" : "video_box"}
                           onClick={() => this.switchFullScreen(i,mid)}
                           key={"prov" + i}
                           ref={"provideo" + i}
                           id={"provideo" + i}>
                          <div className={fullscr ? "fullscrvideo_title" : "video_title"} >Test Room</div>
                          {qst ? q : ""}
                                <UsersHandle ref={users => {this.users = users;}} {...this.props} />
                          {fullscr ? "" :
                              <Button className='next_button'
                                      disabled={rooms.length < 2 || next_button}
                                      size='mini'
                                      color='green'
                                      icon={pre_feed ? 'arrow up' : 'share'}
                                      onClick={() => this.switchProgram(i)} />}
                      </div>);
              }
      });

      return (
          <Segment className="group_conteiner">
              <Segment attached className="program_segment" color='red'>
                  <div className="video_grid">
                      {program}
                  </div>
              </Segment>
              <Button.Group attached='bottom' size='mini'>
                  <Button className='preset_button'
                          disabled={fullscr}
                          color='teal'
                          onClick={this.setPreset} >
                      {col}
                  </Button>
                  <Button className='fours_button'
                          disabled={fullscr}
                          color='blue'
                          onClick={this.switchFour}>
                      <Icon name='share' />
                      <Icon name='th large' />
                      <Icon name='share' />
                  </Button>
              </Button.Group>
          </Segment>
    );
  }
}

export default UsersQuad;
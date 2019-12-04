import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Segment, Icon, Button} from "semantic-ui-react";
import './UsersQuad.scss'
import {sendProtocolMessage} from "../../shared/protocol";
import {GROUPS_ROOM} from "../../shared/consts";
import UsersHandle from "./UsersHandle";

class UsersQuad extends Component {

    state = {
        col: 4,
        quad: [null,null,null,null],
    };

    componentDidMount() {
    };

    switchProgram = (i,g) => {
        let {group,groups,groups_queue,round} = this.props;
        let {quad} = this.state;

        if(group) {
            // From preview
            quad[i] = group.index;
            this.props.setProps({group: null});
        } else {
            // Next in queue
            if(groups_queue >= groups.length) {
                // End round here!
                Janus.log(" -- ROUND END --");
                groups_queue = 0;
                round++;
            }
            quad[i] = groups_queue;
            groups_queue++;
            this.props.setProps({groups_queue,round});
        }

        this.setState({quad});
    };

    switchFour = () => {
        let {groups_queue,groups,round} = this.props;
        let quad = [];

        for(let i=0; i<4; i++) {

            // Don't switch if nobody in queue
            if(i === groups.length) {
                Janus.log("Queue is END");
                break;
            }

            if(groups_queue >= groups.length) {
                // End round here!
                Janus.log(" -- ROUND END --");
                groups_queue = 0;
                round++;
                this.props.setProps({groups_queue,round});
            }

            quad.push(groups_queue);
            this.setState({quad});
            groups_queue++;
            this.props.setProps({groups_queue});
        }
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
        let {fullscr} = this.state;
        this.setState({fullscr: !fullscr, full_feed: i});
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
      const {full_feed,fullscr,col,quad} = this.state;
      const {groups,group,next_button} = this.props;
      const q = (<div className="question">
          <svg viewBox="0 0 50 50">
              <text x="25" y="25" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">&#xF128;</text>
          </svg>
      </div>);

      let program = quad.map((g,i) => {
          if (groups.length === 0) return;
          let qst = !!groups[g] && groups[g].questions;
          let name = groups[g] ? groups[g].description : "";
          //let room = groups[g] ? groups[g].room : "";
          return (
              <div className={fullscr && full_feed === i ? "video_full" : fullscr && full_feed !== i ? "hidden" : "video_box"}
                   key={"pr" + i} >
                  <div className='click-panel' onClick={() => this.switchFullScreen(i)} >
                  <div className={fullscr ? "fullscrvideo_title" : "video_title"} >{name}</div>
                  {qst ? q : ""}
                  <UsersHandle key={"q"+i} g={g} {...this.props} />
                  </div>
                  {fullscr ? "" :
                      <Button className='next_button'
                              disabled={groups.length < 2 || next_button}
                              size='mini'
                              color='green'
                              icon={group ? 'arrow up' : 'share'}
                              onClick={() => this.switchProgram(i,g)} />}
              </div>);
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
                          disabled={true}
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

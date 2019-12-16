import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Segment, Icon, Button} from "semantic-ui-react";
import './UsersQuad.scss'
import {sendProtocolMessage} from "../../shared/protocol";
import UsersHandle from "./UsersHandle";
import {putData} from "../../shared/tools";

class UsersQuad extends Component {

    state = {
        col: 4,
        quad: [null,null,null,null],
    };

    componentDidUpdate(prevProps) {
        let {groups} = this.props;
        let {quad} = this.state;
        if(groups.length > prevProps.groups.length) {
            let res = groups.filter(o => !prevProps.groups.some(v => v.room === o.room))[0];
            console.log(" :: Group enter in queue: ", res);
            if(groups.length < 5 || quad[0] === null) {
                this.switchFour();
            }
        } else if(groups.length < prevProps.groups.length) {
            let res = prevProps.groups.filter(o => !groups.some(v => v.room === o.room))[0];
            console.log(" :: Group exit from queue: ", res);
            for(let i=0; i<4; i++) {
                if(quad[i] && quad[i].room === res.room) {
                    // FIXME: Does we need send leave room request?
                    this.switchProgram(i, true);
                    break;
                }
            }
        }
    };

    setQuestion = (room, status) => {
        let {quad} = this.state;
        for(let i=0; i<4; i++) {
            if(quad[i] && quad[i].room === room) {
                quad[i].questions = status;
                this.setState({quad});
                // Save state
                putData(`galaxy/program`, {quad}, (cb) => {
                    Janus.log(":: Save to state: ",cb);
                });
                break;
            }
        }
    };

    quadGroup = (queue) => {
        let {groups} = this.props;
        let group = groups[queue];
        delete group.users;
        group.queue = queue;
        return group;
    };

    switchProgram = (i, leave) => {
        let {group,groups,groups_queue,round} = this.props;
        let {quad} = this.state;

        if(leave)
            groups_queue--;

        if(group) {
            // From preview
            quad[i] = group;
            this.props.setProps({group: null});
        } else {
            // Next in queue
            if(groups_queue >= groups.length) {
                // End round here!
                Janus.log(" -- ROUND END --");
                groups_queue = 0;
                round++;
            }
            quad[i] = groups.length < 4 ? null : this.quadGroup(groups_queue);
            groups_queue++;
            this.props.setProps({groups_queue,round});
        }

        this.setState({quad});

        // Save state
        putData(`galaxy/program`, {quad}, (cb) => {
            Janus.log(":: Save to state: ",cb);
        });
    };

    switchFour = () => {
        let {groups_queue,groups,round} = this.props;
        let {quad} = this.state;

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

            quad[i] = this.quadGroup(groups_queue);
            groups_queue++;
            this.props.setProps({groups_queue});
        }
        this.setState({quad});

        // Disable queue until program full
        if(groups.length < 4) {
            this.props.setProps({groups_queue: 0});
        }

        // Save state
        putData(`galaxy/program`, {quad}, (cb) => {
            Janus.log(":: Save to state: ",cb);
        });
    };

    sdiAction = (action, status, i, group) => {
        const {protocol, user} = this.props;
        let msg = {type: "sdi-"+action, status, room: null, col: 4, i, group};
        sendProtocolMessage(protocol, user, msg );
    };

    checkFullScreen = () => {
        let {fullscr,full_feed,quad} = this.state;
        if(fullscr) {
            Janus.log(":: Group: " + full_feed + " , sending sdi-action...");
            this.sdiAction("fullscr_group" , true, full_feed, quad[full_feed]);
        }
    };

    switchFullScreen = (i,g) => {
        if(!g) return;
        let {fullscr,full_feed} = this.state;

        if(fullscr && full_feed === i) {
            this.toFourGroup(i,g,() => {});
        } else if(fullscr) {
            this.toFourGroup(i,g, () => {
                this.toFullGroup(i,g);
            });
        } else {
            this.toFullGroup(i,g);
        }
    };

    toFullGroup = (i,g) => {
        Janus.log(":: Make Full Screen Group: ",g);
        this.setState({fullscr: true, full_feed: i});
        this.sdiAction("fullscr_group" , true, i, g);
    };

    toFourGroup = (i,g,cb) => {
        Janus.log(":: Back to four: ");
        this.sdiAction("fullscr_group" , false, i, g);
        this.setState({fullscr: false, full_feed: null}, () => {
            cb();
        });
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
          let qst = g && g.questions;
          let name = g ? g.description : "";
          return (
              <div key={"pr" + i} className={fullscr && full_feed === i ? "video_full" : "video_box"} >
                  <div className='click-panel' onClick={() => this.switchFullScreen(i,g)} >
                  <div className='video_title' >{name}</div>
                  {qst ? q : ""}
                  <UsersHandle key={"q"+i} g={g} index={i} {...this.props} />
                  </div>
                  {fullscr ? "" :
                      <Button className='next_button'
                              disabled={groups.length < 5 || next_button}
                              size='mini'
                              color='green'
                              icon={group ? 'arrow up' : 'share'}
                              onClick={() => this.switchProgram(i, false)} />}
              </div>
          );
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
                          disabled={groups.length < 10 || fullscr}
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

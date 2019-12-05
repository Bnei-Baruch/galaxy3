import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Segment, Icon, Button} from "semantic-ui-react";
import './UsersQuad.scss'
import {sendProtocolMessage} from "../../shared/protocol";
import {GROUPS_ROOM} from "../../shared/consts";
import UsersHandle from "./UsersHandle";
import {putData} from "../../shared/tools";

class UsersQuad extends Component {

    state = {
        col: 4,
        quad: [null,null,null,null],
    };

    componentDidMount() {
        setTimeout(() => {
            this.switchFour();
        }, 5000);
    };

    componentDidUpdate(prevProps) {
        let {groups} = this.props;
        if(groups.length > prevProps.groups.length) {
            console.log(" :: Group enter in queue");

            // Autofill quad 4 groups
            if(groups.length < 5) {
                this.switchFour();
            }
        } else if(groups.length < prevProps.groups.length) {
            console.log(" :: Group exit from queue")
        }
    };

    fillProgram = (i) => {
        this.switchProgram(i);
    };

    switchProgram = (i) => {
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

            quad[i] = groups_queue;
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
                  <UsersHandle key={"q"+i} g={g} index={i} fillProgram={this.fillProgram} {...this.props} />
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

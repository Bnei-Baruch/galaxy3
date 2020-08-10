import React, {Component} from 'react';
import {Button, Icon, Label, Segment} from "semantic-ui-react";
import './UsersQuadSndman.scss'
import UsersHandleSndman from "./UsersHandleSndman";
import api from '../../shared/Api';

class UsersQuadSndman extends Component {

    state = {
        col: null,
        feeds: [],
        full_group: null,
        forward_request: false,
        vquad: [null,null,null,null],
    };

    componentDidMount() {
        let { index } = this.props;
        let col = index === 0 ? 1 : index === 4 ? 2 : index === 8 ? 3 : index === 12 ? 4 : null;
        this.setState({col});
        document.addEventListener("keydown", this.onKeyPressed);
        setInterval(() => {
            api.fetchQuad(col)
                .then(data => this.setState({vquad: data.vquad}))
                .catch(err => {
                    console.error("[Sndman] error fetching quad state", col, err);
                });
        }, 1000);
    };

    componentWillUnmount() {
        document.removeEventListener("keydown", this.onKeyPressed);
    };

    onKeyPressed = (e) => {
        const {fullscr, forward_request,full_group,col} = this.state;
        if(e.code === "Numpad"+col && fullscr && full_group && !forward_request) {
            this.forwardStream(full_group);
        }
    };

    setDelay = () => {
        this.setState({forward_request: true});
        setTimeout(() => {
            this.setState({forward_request: false});
        }, 2000);
    };

    forwardStream = (full_group) => {
        const {fullscr,forward} = this.state;
        let {room,janus} = full_group;
        // Here we call start forward from one place and stop from two placed and we depend on fullscreen state.
        if(forward) {
            console.info("[Sndman] Stop forward", room);
            this.setDelay();
            this.micMute(false, room, janus);
            this.setState({forward: false});
        } else if(fullscr) {
            console.info("[Sndman] Start forward", room);
            this.setDelay();
            this.setState({forward: true});
            this.micMute(true, room, janus);
        }
    };

    fullScreenGroup = (i,full_group) => {
        console.info("[Sndman] make full screen", full_group);
        this.setState({fullscr: true, full_feed: i, full_group});
    };

    toFourGroup = (i,full_group) => {
        console.info("[Sndman] back to four", full_group);
        const {forward,forward_request} = this.state;
        this.setState({fullscr: false});
        if(forward_request) {
            setTimeout(() => {
                this.forwardStream(full_group);
            }, 1000);
        } else if(forward) {
            this.forwardStream(full_group);
        }
    };

    sendDataMessage = (status) => {
        const {col,full_feed} = this.state;
        const cmd = {type: "audio-out", rcmd: true, status}
        const message = JSON.stringify(cmd);
        console.log(':: Sending message: ', message);
        this["cmd"+col+full_feed].state.videoroom.data({ text: message });
    };

    micMute = (status, room, inst) => {
        const msg = {type: "audio-out", status, room, col: null, i: null, feed: null};

        const {gateways} = this.props;
        //TODO: Send data in room channel
        //this.sendDataMessage(status);
        gateways[inst].sendProtocolMessage(msg);
        gateways["gxy3"].sendServiceMessage(msg);
    };

  render() {
      const {full_group,full_feed,fullscr,vquad,forward,forward_request,col} = this.state;
      const q = (<div className="question">
          <svg viewBox="0 0 50 50">
              <text x="25" y="25" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">&#xF128;</text>
          </svg>
      </div>);

      let program = vquad.map((g,i) => {
          let qst = g && g.questions;
          let name = g ? g.description : "";
          //let room = groups[g] ? groups[g].room : "";
          return (
              <div className={fullscr && full_feed === i ? "video_full" : fullscr && full_feed !== i ? "hidden" : "usersvideo_box"}
                   key={"pr" + i} >
                  <div className={fullscr ? "fullscrvideo_title" : "video_title"} >{name}</div>
                  {qst ? q : ""}
                  <UsersHandleSndman key={"q"+i} g={g} index={i} ref={cmd => {this["cmd"+col+i] = cmd;}} {...this.props} />
              </div>);

      });

      return (
          <Segment className="usersquad_segment">
          <Segment attached className="usersquad_program" color='red'>
              <div className="usersvideo_grid">
                  {program}
              </div>
          </Segment>
              <Button className='fours_button'
                      disabled
                      // disabled={!fullscr || forward_request}
                      attached='bottom'
                      positive={!forward}
                      negative={forward}
                      onKeyDown={(e) => this.onKeyPressed(e)}
                      onClick={() => this.forwardStream(full_group)}>
                  <Icon size='large' name={forward ? 'microphone' : 'microphone slash' } />
                  <Label attached='top left' color='grey'>{this.state.col}</Label>
              </Button>
          </Segment>
    );
  }
}

export default UsersQuadSndman;

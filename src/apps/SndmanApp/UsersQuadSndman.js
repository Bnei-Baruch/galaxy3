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

    sendMessage = (user, talk) => {
        const gateway = this.props.gateways["gxy3"];
        gateway.forwardMessage({
            talk,
            name: user.display,
            ip: user.ip,
            col: 4,
            room: user.room,
        });
    };

    forwardStream = (full_group) => {
        const {fullscr,forward,feeds} = this.state;
        let {room,janus} = full_group;
        //FIXME: This is really problem place we call start forward from one place and stop from two placed
        // and we depend on callback from request and fullscreen state and feed info.
        // fix1: we take now feed info from state only in render and pass as param to needed functions
        // fix2: don't limit stop forward with fullscreen state it's will be limit only for start forward
        // fix3: set forward state after success request callback (send message to client must be here as well)
        // fix4: add start forward request progress state
        // fix5: put delay between start/stop request switch (It's still hacky we actually need callback from sendMessage)
        // fix6: put delay on stop request from shidur if start forward request still in progress
        if(forward) {
            console.info("[Sndman] Stop forward", room);
            this.setDelay();
            feeds.forEach((feed,i) => {
                if (feed) {
                    // FIXME: if we change sources on client based on room id (not ip) we send message only once?
                    this.sendMessage(feed, false);
                }
            });
            this.micMute(false, room, janus);
            this.setState({feeds: [], forward: false});
        } else if(fullscr) {
            console.info("[Sndman] Start forward", room);
            this.setDelay();
            api.fetchRoom(room)
                .then(data => {
                    const {users} = data;
                    users.forEach((user) => {
                        // TODO (edo): why not simply send to all users ?!
                        if (user && user.rfid) {
                            this.sendMessage(user, true);
                        } else {
                            console.error("Forward failed for user: " + user + " in room: " + room, data)
                        }
                    });
                    this.setState({feeds: users, forward: true});
                    this.micMute(true, room, janus);
                })
                .catch(err => {
                    console.error("[Sndman] error fetching room state", room, err);
                });
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

    sendDataMessage = (room) => {
        const cmd = {type: "audio-out", rcmd: true, status: true}
        const message = JSON.stringify(cmd);
        console.log(':: Sending message: ', message);
        this["cmd"+room].state.videoroom.data({ text: message });
    };

    micMute = (status, room, inst) => {
        const msg = {type: "audio-out", status, room, col: null, i: null, feed: null};

        const {gateways} = this.props;
        //TODO: We need send data in room channel
        //gateways[inst].sendProtocolMessage(msg);
        this.sendDataMessage(room, status);
        gateways["gxy3"].sendServiceMessage(msg);
    };

  render() {
      const {full_group,full_feed,fullscr,vquad,forward,forward_request} = this.state;
      const q = (<div className="question">
          <svg viewBox="0 0 50 50">
              <text x="25" y="25" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">&#xF128;</text>
          </svg>
      </div>);

      let program = vquad.map((g,i) => {
          let qst = g && g.questions;
          let name = g ? g.description : "";
          //let room = groups[g] ? groups[g].room : "";
          if(g && g.room) {
              return (
                  <div className={fullscr && full_feed === i ? "video_full" : fullscr && full_feed !== i ? "hidden" : "usersvideo_box"}
                       key={"pr" + i} >
                      <div className={fullscr ? "fullscrvideo_title" : "video_title"} >{name}</div>
                      {qst ? q : ""}
                      <UsersHandleSndman key={"q"+i} g={g} index={i} ref={cmd => {this["cmd"+g.room] = cmd;}} {...this.props} />
                  </div>);
          }

      });

      return (
          <Segment className="usersquad_segment">
          <Segment attached className="usersquad_program" color='red'>
              <div className="usersvideo_grid">
                  {program}
              </div>
          </Segment>
              <Button className='fours_button'
                      disabled={!fullscr || forward_request}
                      attached='bottom'
                      positive={!forward}
                      negative={forward}
                      onKeyDown={(e) => this.onKeyPressed(e)}
                      onClick={() => this.forwardStream(full_group)}>
                  <Icon size='large' name={forward ? 'microphone' : 'microphone slash' } />
                  <Label attached='top left' color='grey'>{this.state.col}</Label>
              </Button>
              <Button className='fours_button'
                  //disabled={!fullscr || forward_request}
                      attached='bottom'
                      onClick={() => this.sendDataMessage(2136)}>
                  <Icon size='large' name={forward ? 'microphone' : 'microphone slash' } />
                  <Label attached='top left' color='grey'>{this.state.col}</Label>
              </Button>
          </Segment>
    );
  }
}

export default UsersQuadSndman;

import React, { Component } from 'react';
import {Button, Icon, Label, Segment} from "semantic-ui-react";
import './UsersQuadSndman.scss'
import UsersHandleSndman from "./UsersHandleSndman";
import {getState,getPluginInfo} from "../../shared/tools";
import {Janus} from "../../lib/janus";
import {DANTE_IN_IP, SECRET} from "../../shared/consts";

class UsersQuadSndman extends Component {

    state = {
        col: 4,
        feeds: [],
        full_group: null,
        quad: [null,null,null,null],
    };

    componentDidMount() {
        setInterval(() => {
            getState('galaxy/program', ({quad}) => {
                this.setState({quad});
            });
        }, 3000);
    };

    onKeyPressed = (e) => {
        if(e.code === "Numpad4" && !this.state.onoff_but)
            this.forwardStream();
    };

    setDelay = () => {
        this.setState({onoff_but: true});
        setTimeout(() => {
            this.setState({onoff_but: false});
        }, 2000);
    };

    sendMessage = (user, talk) => {
        let {room} = this.state;
        let message = `{"talk":${talk},"name":"${user.display}","ip":"${user.ip}","col":4,"room":${room}}`;
        Janus.log(":: Sending message: ",message);
        this.props.fwdhandle.data({ text: message });
    };

    forwardStream = (feed) => {
        const {fullscr,forward,full_group,feeds} = this.state;
        let {room, users} = full_group;
        let port = 5630;
        //FIXME: This is really problem place we call start forward from one place and stop from two placed
        // and we depend on callback from request and fullscreen state and feed info.
        // fix1: we take now feed info from state only in render and pass as param to needed functions
        // fix2: don't limit stop forward with fullscreen state it's will be limit only for start forward
        // fix3: set forward state after success request callback (send message to client must be here as well)
        // fix4: add start forward request progress state
        // fix5: put delay between start/stop request switch (It's still hacky we actually need callback from sendMessage)
        // fix6: put delay on stop request from shidur if start forward request still in progress
        if(forward) {
            Janus.log(" :: Stop forward from room: ", room);
            this.setDelay();
            feeds.forEach((feed,i) => {
                if (feed) {
                    // FIXME: if we change sources on client based on room id (not ip) we send message only once
                    this.sendMessage(feed.display, false);
                    let stopfw = { "request":"stop_rtp_forward","stream_id":feed.streamid,"publisher_id":feed.rfid,"room":feed.room,"secret":`${SECRET}` };
                    getPluginInfo(stopfw, data => {
                        Janus.log(":: Forward callback: ", data);
                    });
                }
            });
            this.setState({feeds: [], forward: false});
        } else if(fullscr) {
            Janus.log(" :: Start forward from room: ", room);
            this.setDelay();
            users.forEach((user,i) => {
                if (user) {
                    this.sendMessage(user.display, true);
                    let forward = { "request": "rtp_forward","publisher_id":feed.feed_id,"room":room,"secret":`${SECRET}`,"host":`${DANTE_IN_IP}`,"audio_port":port};
                    getPluginInfo(forward, data => {
                        Janus.log(":: Forward callback: ", data);
                        users[i].streamid = data["rtp_stream"]["audio_stream_id"];
                        this.sendMessage(user.display, true);
                    });
                    port++;
                }
            });
            this.setState({feeds: users, forward: true});
        }
    };

    switchFullScreen = (i,full_group) => {
        let {fullscr} = this.state;
        this.setState({fullscr: !fullscr, full_feed: i, full_group});
    };

  render() {
      const {full_group,full_feed,fullscr,col,quad,forward,forward_request} = this.state;
      const q = (<div className="question">
          <svg viewBox="0 0 50 50">
              <text x="25" y="25" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">&#xF128;</text>
          </svg>
      </div>);

      let program = quad.map((g,i) => {
          let qst = g && g.questions;
          let name = g ? g.description : "";
          //let room = groups[g] ? groups[g].room : "";
          return (
              <div className={fullscr && full_feed === i ? "video_full" : fullscr && full_feed !== i ? "hidden" : "usersvideo_box"}
                   key={"pr" + i} >
                  <div className={fullscr ? "fullscrvideo_title" : "video_title"} >{name}</div>
                  {qst ? q : ""}
                  <UsersHandleSndman key={"q"+i} g={g} index={i} {...this.props} />
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
                      disabled={!fullscr || forward_request}
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

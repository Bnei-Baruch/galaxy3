import React, { Component } from 'react';
import {Button, Icon, Label, Segment} from "semantic-ui-react";
import './UsersQuadSndman.scss'
import UsersHandleSndman from "./UsersHandleSndman";
import {getState} from "../../shared/tools";
import {Janus} from "../../lib/janus";
import {DANTE_IN_IP, SECRET} from "../../shared/consts";

class UsersQuadSndman extends Component {

    state = {
        col: 4,
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
        let {videoroom,room} = this.state;
        var message = `{"talk":${talk},"name":"${user.display}","ip":"${user.ip}","col":4,"room":${room}}`;
        Janus.log(":: Sending message: ",message);
        videoroom.data({ text: message })
    };

    forwardStream = () => {
        const {feeds, room, videoroom, forward} = this.state;
        // TODO: WE need solution for joining users to already forwarded room
        if(forward) {
            Janus.log(" :: Stop forward from room: ", room);
            this.setDelay();
            feeds.forEach((feed,i) => {
                if (feed !== null && feed !== undefined) {
                    // FIXME: if we change sources on client based on room id (not ip) we send message only once
                    this.sendMessage(feed.display, false);
                    let stopfw = { "request":"stop_rtp_forward","stream_id":feed.streamid,"publisher_id":feed.id,"room":room,"secret":`${SECRET}` };
                    videoroom.send({"message": stopfw,
                        success: (data) => {
                            Janus.log(":: Forward callback: ", data);
                            feeds[i].streamid = null;
                        },
                    });
                }
            });
            this.setState({feeds, forward: false});
        } else {
            Janus.log(" :: Start forward from room: ", room);
            // FIXME: We have to be sure that forward stopped
            this.setDelay();
            let port = 5630;
            feeds.forEach((feed,i) => {
                if (feed !== null && feed !== undefined) {
                    this.sendMessage(feed.display, true);
                    let forward = { "request": "rtp_forward","publisher_id":feed.id,"room":room,"secret":`${SECRET}`,"host":`${DANTE_IN_IP}`,"audio_port":port};
                    videoroom.send({"message": forward,
                        success: (data) => {
                            Janus.log(":: Forward callback: ", data);
                            let streamid = data["rtp_stream"]["audio_stream_id"];
                            feeds[i].streamid = streamid;
                        },
                    });
                    port++;
                }
            });
            this.setState({feeds, forward: true});
        }
    };

    switchFullScreen = (i,full_group) => {
        let {fullscr} = this.state;
        this.setState({fullscr: !fullscr, full_feed: i, full_group});
    };

  render() {
      const {full_feed,fullscr,col,quad,forward,onoff_but} = this.state;
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
                      disabled={onoff_but}
                      attached='bottom'
                      positive={!forward}
                      negative={forward}
                      onKeyDown={(e) => this.onKeyPressed(e)}
                      onClick={this.forwardStream}>
                  <Icon size='large' name={forward ? 'microphone' : 'microphone slash' } />
                  <Label attached='top left' color='grey'>{this.state.col}</Label>
              </Button>
          </Segment>
    );
  }
}

export default UsersQuadSndman;

import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Segment, Icon, Button, Label} from "semantic-ui-react";
import './SndmanGroups.css'
import {GROUPS_ROOM, DANTE_IN_IP, SECRET} from "../../shared/consts";

class SndmanGroups extends Component {

    state = {
        col: null,
        quad: [
            "0","3","6","9",
            "1","4","7","10",
            "2","5","8","11"
        ],
        forward: false,
        forward_feed: {},
        forward_request: false,
        full_feed: null,
        fullscr: false,
        room: GROUPS_ROOM,
        port: null,
    };

    componentDidMount() {
        document.addEventListener("keydown", this.onKeyPressed);
        const { index } = this.props;
        let col = index === 0 ? 1 : index === 4 ? 2 : index === 8 ? 3 : null;
        let port = index === 0 ? 5102 : index === 4 ? 5103 : index === 8 ? 5104 : null;
        this.setState({col,port});
    };

    componentWillUnmount() {
        document.removeEventListener("keydown", this.onKeyPressed);
    };

    fullScreenGroup = (i,full_feed) => {
        Janus.log(":: Make Full Screen Group: ",full_feed);
        this.setState({fullscr: true,full_feed});
    };

    toFourGroup = (i,full_feed) => {
        Janus.log(":: Back to four: ");
        const {forward,forward_request} = this.state;
        this.setState({fullscr: false});
        if(forward_request) {
            setTimeout(() => {
                this.forwardStream(full_feed);
            }, 1000);
        } else if(forward) {
            this.forwardStream(full_feed);
        }
    };

    forwardStream = (feed) => {
        const {fullscr,forward_feed,room,forward,port} = this.state;
        const {gxyhandle} = this.props;
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
            let stopfw = { "request":"stop_rtp_forward","stream_id":forward_feed.streamid,"publisher_id":forward_feed.id,"room":room,"secret":`${SECRET}` };
            gxyhandle.send({"message": stopfw,
                success: (data) => {
                    Janus.log(":: Forward callback: ", data);
                    this.sendMessage(forward_feed.display, false);
                    this.setState({forward_feed: {}, forward: false});
                },
            });
        } else if(fullscr) {
            Janus.log(" :: Start forward from room: ", room);
            this.setDelay();
            let forward = { "request": "rtp_forward","publisher_id":feed.feed_id,"room":room,"secret":`${SECRET}`,"host":`${DANTE_IN_IP}`,"audio_port":port};
            gxyhandle.send({"message": forward,
                success: (data) => {
                    Janus.log(":: Forward callback: ", data);
                    forward_feed.streamid = data["rtp_stream"]["audio_stream_id"];
                    forward_feed.id = feed.feed_id;
                    forward_feed.display = feed.display;
                    this.sendMessage(feed.display, true);
                    this.setState({forward_feed, forward: true});
                },
            });
        }
    };

    setDelay = () => {
        this.setState({forward_request: true});
        setTimeout(() => {
            this.setState({forward_request: false});
        }, 1000);
    };

    sendMessage = (user, talk) => {
        let {room,col} = this.state;
        let message = `{"talk":${talk},"name":"${user.display}","ip":"${user.ip}","col":${col},"room":${room}}`;
        Janus.log(":: Sending message: ",message);
        this.props.fwdhandle.data({ text: message });
    };

    onKeyPressed = (e) => {
        const {fullscr, forward_request,full_feed} = this.state;
        if(e.code === "Numpad"+this.state.col && fullscr && full_feed && !forward_request) {
            this.forwardStream(full_feed);
        }
    };


  render() {
      const {users} = this.props;
      const { full_feed,fullscr,col,forward,forward_request } = this.state;
      const width = "100%";
      const height = "100%";
      const autoPlay = true;
      const controls = false;
      const muted = true;
      const q = (<div className="question">
          <svg viewBox="0 0 50 50">
              <text x="25" y="25" textAnchor="middle" alignmentBaseline="central" dominantBaseline="central">&#xF128;</text>
          </svg>
      </div>);

      let program = this.props.mids.map((mid,i) => {
          if(mid && this.props.qam[i] === col) {
              if(!mid.active) {
                  return (<div className="group_box" key={"prov" + i} />)
              } else {
                  let qst = mid.user && users[mid.user.id] ? users[mid.user.id].question : false;
                  let talk = mid.talk;
                  //let id = feed.feed_id;
                  return (
                      <div className={fullscr && full_feed.mid === mid.mid ? "group_full" : fullscr && full_feed.mid !== mid.mid ? "hidden" : "group_box"}
                           key={"prov" + i} ref={"provideo" + i} id={"provideo" + i}>
                          <div className={fullscr ? "fullscrvideo_title" : "video_title"} >{mid.user.display}</div>
                          {qst ? q : ""}
                          <video className={talk ? "talk" : ""}
                                 key={i}
                                 ref={"programVideo" + i}
                                 id={"programVideo" + i}
                                 width={width}
                                 height={height}
                                 autoPlay={autoPlay}
                                 controls={controls}
                                 muted={muted}
                                 playsInline={true}/>
                      </div>);
              }
          }
          return true;
      });

      return (
          <Segment className="sndman_segment">
          <Segment attached className="preview_sdi" color='red'>
              <div className="video_grid">
                  {program}
              </div>
          </Segment>
              <Button className='fours_button'
                      disabled={!fullscr || forward_request}
                      attached='bottom'
                      positive={!forward}
                      negative={forward}
                      onKeyDown={(e) => this.onKeyPressed(e)}
                      onClick={() => this.forwardStream(full_feed)}>
                  <Icon size='large' name={forward ? 'microphone' : 'microphone slash' } />
                  <Label attached='top left' color='grey'>{col}</Label>
              </Button>
          </Segment>
      );
  }
}

export default SndmanGroups;

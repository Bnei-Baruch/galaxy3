import React, { Component } from 'react';
import {Segment, Icon, Button} from "semantic-ui-react";
import './UsersQuad.scss'
import UsersHandle from "./UsersHandle";
import api from '../../shared/Api';
//import {AUDIOOUT_ID, SDIOUT_ID, SNDMAN_ID} from "../../shared/consts"
import {captureException, captureMessage} from "../../shared/sentry";

class UsersQuad extends Component {

    state = {
        question: false,
        col: null,
        vquad: [null,null,null,null],
        ask_feed: null,
    };

    componentDidMount() {
        let { index } = this.props;
        let col = index === 0 ? 1 : index === 4 ? 2 : index === 8 ? 3 : index === 12 ? 4 : null;
        this.setState({col});
    };

    componentDidUpdate(prevProps) {
        let {groups,index} = this.props;
        let {vquad,col} = this.state;
        if(groups.length > prevProps.groups.length) {
            let res = groups.filter(o => !prevProps.groups.some(v => v.room === o.room))[0];
            console.debug("[Shidur] :: Group enter in queue: ", res);
            if(vquad[0] === null && groups.length > index+4) {
                setTimeout(() => {
                    this.switchFour();
                }, col*1000);
            }
        } else if(groups.length < prevProps.groups.length) {
            let res = prevProps.groups.filter(o => !groups.some(v => v.room === o.room))[0];
            console.debug("[Shidur] :: Group exit from queue: ", res);
            for(let i=0; i<4; i++) {
                if(vquad[i] && vquad[i].room === res.room) {
                    // Check question state
                    const {full_qst, full_col, full_group} = this.props;
                    if(full_qst && full_group.room === res.room) {
                        this.toFourGroup(i,full_group,() => {},true);
                        this.props.setProps({full_qst: false, full_col, full_group});
                    }
                    // FIXME: Does we need send leave room request?
                    this.switchProgram(i, true);
                    break;
                }
            }
        }
    };

    // quadCheckDup = () => {
    //     let {group,groups,groups_queue,quads} = this.props;
    //     let {vquad} = this.state;
    //     let dup = false;
    //     let g = group || groups[groups_queue];
    //     for (let i=0; i<4; i++) {
    //         if(vquad[i] && g && vquad[i].room === g.room) {
    //             dup = true;
    //             break;
    //         }
    //     }
    //     return dup;
    // };

    checkDup = () => {
        let {group,groups,groups_queue,quads} = this.props;
        let i = groups_queue >= groups.length ? 0 : groups_queue;
        let g = group || groups[i];
        let r = quads.filter(q => q && g && q.room === g.room);
        return r.length > 0;
    };

    quadGroup = (queue) => {
        let {groups} = this.props;
        let group = groups[queue];
        if(group && group.users) {
            delete group.users;
            group.queue = queue;
            return group;
        } else {
            return null;
        }
    };

    switchProgram = (i, leave) => {
        let {group,groups,groups_queue,round} = this.props;
        let {vquad,col} = this.state;

        if(leave)
            groups_queue--;

        if(this.checkDup())
            return;

        if(group) {
            // From preview
            delete group.users;
            vquad[i] = group;
            this.props.setProps({group: null});
        } else {
            // Next in queue
            if(groups_queue >= groups.length) {
                // End round here!
                console.log("[Shidur] -- ROUND END --");
                groups_queue = 0;
                round++;
            }
            vquad[i] = groups.length < 4 ? null : this.quadGroup(groups_queue);
            groups_queue++;
            this.props.setProps({groups_queue,round});
        }

        this.setState({vquad});
        api.updateQuad(col, {vquad})
            .catch(err => {
							console.error("[Shidur] error updating quad state", col, err);
							captureException(err, {source: "Shidur"});
						});
    };

    switchFour = () => {
        let {groups_queue,groups,round} = this.props;
        let {vquad,col} = this.state;

        this.setDelay();

        for(let i=0; i<4; i++) {

            // Don't switch if nobody in queue
            if(i === groups.length) {
                console.log("[Shidur] Queue is END");
                break;
            }

            if(groups_queue >= groups.length) {
                // End round here!
                console.log("[Shidur] -- ROUND END --");
                groups_queue = 0;
                round++;
                this.props.setProps({groups_queue,round});
            }

            vquad[i] = this.quadGroup(groups_queue);
            groups_queue++;
            this.props.setProps({groups_queue});
        }
        this.setState({vquad});

        // Disable queue until program full
        if(groups.length < 4) {
            this.props.setProps({groups_queue: 0});
        }

        api.updateQuad(col, {vquad})
            .catch(err => {
							console.error("[Shidur] error updating quad state", col, err);
							captureException(err, {source: "Shidur"});
						});
    };

    setPreset = () => {
        let {presets} = this.props;
        let {vquad,col} = this.state;

        if(presets[col].length === 0) return;

        for(let i=0; i<presets[col].length; i++) {
            vquad[i] = presets[col][i];
        }
        this.setState({vquad});

        api.updateQuad(col, {vquad})
            .catch(err => {
							console.error("[Shidur] error updating quad state", col, err);
							captureException(err, {source: "Shidur"});
						});
    };

    sdiActionMessage_ = (action, status, i, group, qst) => {
      const {col} = this.state;
      return {type: "sdi-"+action, status, room: null, col, i, group, qst};
    }

    sdiAction = (action, status, i, group, qst) => {
        const {gateways} = this.props;
        gateways["gxy3"].sendServiceMessage(this.sdiActionMessage_(action, status, i, group, qst));
    };

    sdiGuaranteeAction = (action, status, i, group, qst, toAck) => {
      const { gateways, gdm } = this.props;
      gdm.send(this.sdiActionMessage_(action, status, i, group, qst), toAck, (msg) => gateways["gxy3"].sendServiceMessage(msg))
				.then(() => {
					console.log(`${action} delivered to ${toAck}.`);
				})
				.catch((error) => {
					console.error(`${action} not delivered to ${toAck} due to ${error}`);
				});
    }

    checkFullScreen = () => {
        let {fullscr,index,vquad,question} = this.state;
        if(fullscr) {
            console.log("[Shidur] :: Group: " + index + " , sending sdi-action...");
            //this.sdiGuaranteeAction("fullscr_group" , true, index, vquad[index], question, [AUDIOOUT_ID, SDIOUT_ID, SNDMAN_ID]);
            this.sdiAction("fullscr_group" , true, index, vquad[index], question);
        }
    };

    switchFullScreen = (i, group, is_qst) => {
        if(!group) return;
        let {fullscr,index,question} = this.state;

        if(question) return;

        if(fullscr && index === i) {
            this.toFourGroup(i, group,() => {}, is_qst);
        } else if(fullscr) {
            this.toFourGroup(i, group, () => {
                this.toFullGroup(i, group, is_qst);
            });
        } else {
            this.toFullGroup(i, group, is_qst);
        }
    };

    switchQuestion = (i, group, is_qst) => {
        if(!group) return;
        let {fullscr,index,question,col} = this.state;

        if(fullscr && !question) return;

        const {full_qst, full_col} = this.props;
        if(full_qst && full_col !== col) return;

        if(!this["cmd"+col+i].state.videoroom) return;

        if(fullscr && index === i) {
            this.toFourGroup(i, group,() => {}, is_qst);
            this.props.setProps({full_qst: false, full_col: col, full_group: group});
        } else if(fullscr) {
            return
            // this.toFourGroup(i,g, () => {
            //     this.toFullGroup(i,g,q);
            //     setStore({qst: true,col,group: g});
            // });
        } else {
            this.toFullGroup(i, group, is_qst);
            this.props.setProps({full_qst: true, full_col: col, full_group: group});
        }
    };

    toFullGroup = (i, group, is_qst) => {
        let {room,janus} = group;
        console.log("[Shidur]:: Make Full Screen Group: ", group);
        this.setState({fullscr: true, index: i, question: is_qst});
        //this.sdiGuaranteeAction("fullscr_group" , true, i, group, is_qst, [AUDIOOUT_ID, SDIOUT_ID, SNDMAN_ID]);
        this.sdiAction("fullscr_group" , true, i, group, is_qst);
        if(is_qst) this.micMute(true, room, janus, i);
    };

    toFourGroup = (i, group, cb , is_qst) => {
        let {room,janus} = group;
        console.log("[Shidur]:: Back to four: ");
        //this.sdiGuaranteeAction("fullscr_group" , false, i, group, is_qst, [AUDIOOUT_ID, SDIOUT_ID, SNDMAN_ID]);
        this.sdiAction("fullscr_group" , false, i, group, is_qst);
        if(is_qst) this.micMute(false, room, janus, i);
        this.setState({fullscr: false, index: null, question: false}, () => {
            cb();
        });
    };

    micMute = (status, room, inst, i) => {
        const msg = {type: "audio-out", status, room, col: null, i, feed: null};
        const cmd = {type: "audio-out", rcmd: true, status, room, i}
        const group = this.props.rooms.filter(g => g.room === room)[0];
        //const ask_feed = group.users.filter(u => u.question)[0];
        let toAck = [];

        if(group && group.users) {
            toAck = group.users.map(u => u.role.match(/^(user|ghost|guest)$/) ? u.id : null).filter(id => !!id);
            if(toAck.length === 0) return;
        } else {
            return;
        }

        const {gateways, gdm} = this.props;

        // TODO: should be using gdm as well.
        // Maybe revive https://github.com/Bnei-Baruch/galaxy3/pull/158
        gateways["gxy3"].sendServiceMessage(msg)
            .catch(err => {
                captureException(err, {source: "Shidur"});
            });

        if(status) {
            gateways[inst].chatRoomJoin(room, this.props.user)
                .then(() => {
                    gdm.send(cmd, toAck, (cmd) => {
                        // TODO: retry this on errors
                        gateways[inst].sendCmdMessage(cmd)
                            .catch(err => {
                                captureException(err, {source: "Shidur"});
                            });
                    })
                        .then(() => {
                            console.log('[Shidur] MIC ON delivered');
                            captureMessage("Delivery ON success", {source: "Shidur"});
                        })
                        .catch((err) => {
                            console.error('[Shidur] MIC ON not delivered' , err);
                            captureMessage("Delivery ON failed", {source: "Shidur", err}, 'error');
                        });
                })
                .catch(err => {
                    captureException(err, {source: "Shidur"});
                });
        } else {
            gdm.send(cmd, toAck, (cmd) => {
                // TODO: retry this on errors
                gateways[inst].sendCmdMessage(cmd)
                    .catch(err => {
                        captureException(err, {source: "Shidur"});
                    });
            })
                .then(() => {
                    console.log('[Shidur] MIC OFF delivered');
                    captureMessage("Delivery OFF success",{source: "Shidur"});
                })
                .catch((err) => {
                    console.error('[Shidur] MIC OFF not delivered', err);
                    captureMessage("Delivery OFF failed", {source: "Shidur", err}, 'error');
                }).finally(() => {
                    gateways[inst].chatRoomLeave(room)
                        .catch(err => {
                            captureException(err, {source: "Shidur"});
                        });
                });
        }
    };

    setDelay = () => {
        this.props.setProps({delay: true});
        setTimeout(() => {
            this.props.setProps({delay: false});
        }, 3000);
    };

  render() {
      const {index,fullscr,col,vquad,question} = this.state;
      const {groups,group,rooms,next_button,presets,delay, roomsStatistics} = this.props;

      let program = vquad.map((g,i) => {
          if (groups.length === 0) return false;
          let qst = "";
          if (rooms && rooms.filter(q => q && g && q.room === g.room && q.questions).length > 0) {
              let className = "qst_title";
              if (!roomsStatistics[g.room] || roomsStatistics[g.room]["on_air"] === 0) {
                  className += " qst_title__first_time";
              }
              qst = <div className={className}>?</div>;
          }
          let qf = fullscr && index === i && question;
          let ff = fullscr && index === i && !question;
          let name = g ? g.description : "";
          return (
              <div key={"pr" + i} className={qf ? "video_full" : ff ? "video_qst" : "video_box"} >
                  <div className='click-panel' onClick={() => this.switchQuestion(i, g, true)} >
                  <div className='video_title' >{name}</div>
                  {qst}
                  <UsersHandle key={"q"+i} g={g} index={i} ref={cmd => {this["cmd"+col+i] = cmd;}} {...this.props} />
                  </div>
                  {!question ?
                  <Button className='fullscr_button'
                          size='mini'
                          icon='expand arrows alternate'
                          onClick={() => this.switchFullScreen(i, g, false)} /> : ""}
                  {fullscr && index === i ? "" :
                      <Button className='next_button'
                              disabled={groups.length < 5 || next_button}
                              size='mini'
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
                          disabled={presets.length === 0}
                          color='teal'
                          onClick={this.setPreset} >
                      {col}
                  </Button>
                  <Button className='fours_button'
                          disabled={delay || groups.length < 10 || fullscr}
                          color='brown'
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

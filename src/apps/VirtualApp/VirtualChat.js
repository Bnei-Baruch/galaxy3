import React, {Component} from 'react';
import {Janus} from '../../lib/janus';
import {Button, Input, Message} from 'semantic-ui-react';
import {getDateString, notifyMe,} from '../../shared/tools';
import {SHIDUR_ID} from '../../shared/consts';
import {captureMessage} from '../../shared/sentry';

const isUseNewDesign = new URL(window.location.href).searchParams.has('new_design');
class VirtualChat extends Component {

  state = {
    chatroom: null,
    room: null,
    input_value: '',
    messages: [],
    support_msgs: [],
    room_chat: true,
    from: null,
  };

  componentDidMount() {
    document.addEventListener('keydown', this.onKeyPressed);
  };

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKeyPressed);
  };

  componentDidUpdate(prevProps) {
    if (this.props.visible && !prevProps.visible) {
      this.refs.input.focus();
    }
  }

  joinChatRoom = (textroom, roomid, user) => {
    let transaction = Janus.randomString(12);
    let register = {
      textroom: "join",
      transaction: transaction,
      room: roomid,
      username: user.id,
      display: user.display
    };
    textroom.data({
      text: JSON.stringify(register),
      success: () => {
        console.log("[VirtualChat] join success", roomid);
        this.setState({room: roomid});
      },
      error: (err) => {
        console.error("[VirtualChat] join error", roomid, err);
        captureMessage(`Chatroom error: join - ${err}`, {source: "Textroom", err, room: roomid}, 'error');
      }
    });
  };

  iceRestart = () => {
    this.state.chatroom.send({
      message: {request: "restart"},
      error: (err) => {
        console.error("[VirtualChat] ICE restart error", err);
        captureMessage(`Chatroom error: ice restart - ${err}`, {source: "Textroom", err}, 'error');
      }
    });
  }

  initChatRoom = (janus, room, user, cb) => {
    let chatroom = null;
    janus.attach(
        {
          plugin: "janus.plugin.textroom",
          opaqueId: "chatroom_user",
          success: (pluginHandle) => {
            chatroom = pluginHandle;
            console.log("[VirtualChat] Plugin attached! (" + chatroom.getPlugin() + ", id=" + chatroom.getId() + ")");
            this.setState({ chatroom });
            // Setup the DataChannel
            chatroom.send({
              message: {request: "setup"},
              success: () => {
                console.log("[VirtualChat] setup success");
              },
              error: (err) => {
                console.error("[VirtualChat] setup error", err);
                captureMessage(`Chatroom error: setup - ${err}`, {source: "Textroom", err}, 'error');
              }
            });
          },
          error: (err) => {
            console.error("[VirtualChat] Error attaching plugin...", err);
						captureMessage(`Chatroom error: attach - ${err}`, {source: "Textroom", err}, 'error');
          },
          iceState: (state) => {
            console.log("[VirtualChat] ICE state", state);
						captureMessage(`Chatroom: ICE state changed to ${state}`, {source: "Textroom"});
          },
          mediaState: (medium, on) => {
						const message = `Janus ${on ? "started" : "stopped"} receiving our ${medium}`;
            console.log(`[VirtualChat] ${message}`);
						captureMessage(`Chatroom: ${message}`, {source: "Textroom"});
          },
          webrtcState: (on) => {
						const message = `Janus says our WebRTC PeerConnection is ${on ? "up" : "down"} now`;
            console.log(`[VirtualChat] ${message}`);
            captureMessage(`Chatroom: ${message}`, {source: "Textroom"});
          },
          onmessage: (msg, jsep) => {
            console.debug("[VirtualChat] ::: Got a message :::", msg);
            if (msg["error"] !== undefined && msg["error"] !== null) {
              console.error("[VirtualChat] textroom error message", msg);
							captureMessage(`Chatroom error: message - ${msg["error"]}`, {source: "Textroom", err: msg}, 'error');
            }
            if (jsep !== undefined && jsep !== null) {
              // Answer
              chatroom.createAnswer(
                {
                  jsep: jsep,
                  media: {audio: false, video: false, data: true},	// We only use datachannels
                  success: (jsep) => {
                    console.debug("[VirtualChat] Got SDP!", jsep);
                    chatroom.send({
                      jsep,
                      message: {request: "ack"},
                      error: (err) => {
                        console.debug("[VirtualChat] ack error", err);
                        captureMessage(`Chatroom error: ack - ${err}`, {source: "Textroom", err}, 'error');
                      }
                    });
                  },
                  error: (err) => {
                    console.error("[VirtualChat] createAnswer error", err);
                    captureMessage(`Chatroom error: createAnswer - ${err}`, {source: "Textroom", err}, 'error');
                  }
                });
            }
          },
          ondataopen: () => {
            console.log("[VirtualChat] The DataChannel is available! ");
            if(!this.state.room)
              this.joinChatRoom(chatroom, room, user);
          },
          ondata: (data) => {
            console.debug('[VirtualChat] We got message from Data Channel', data);
            let json = JSON.parse(data);
            let what = json['textroom'];
            if (what.match(/^(success|error)$/)) {
              cb(json);
            } else {
              this.onData(json);
            }
          },
          oncleanup: () => {
            console.log("[VirtualChat] ::: Got a cleanup notification :::");
            if(this.state.room)
              this.setState({ messages: [], chatroom: null, room: null });
          }
        });
  };

  onKeyPressed = (e) => {
    if (e.code === 'Enter') {
      this.sendChatMessage();
    }
  };

  exitChatRoom = (room) => {
    const {chatroom} = this.state;
    if(chatroom) {
      chatroom.data({
        text: JSON.stringify({textroom: 'leave', transaction: Janus.randomString(12), room}),
        success: () => {
          console.log('[VirtualChat] :: Text room leave callback: ');
          this.setState({ messages: [], chatroom: null, room: null });
        },
        error: (err) => {
          console.error("[VirtualChat] leave error", err);
          captureMessage(`Chatroom error: leave - ${err}`, {source: "Textroom", err}, 'error');
        }
      });
    }
  };

  onData = (json) => {
    // var transaction = json["transaction"];
    // if (transactions[transaction]) {
    //     // Someone was waiting for this
    //     transactions[transaction](json);
    //     delete transactions[transaction];
    //     return;
    // }
    let what = json['textroom'];
    if (what === 'message') {
      // Incoming message: public or private?
      let msg = json['text'];
      msg = msg.replace(new RegExp('<', 'g'), '&lt');
      msg = msg.replace(new RegExp('>', 'g'), '&gt');
      let from = json['from'];
      let dateString = getDateString(json['date']);
      let whisper = json['whisper'];

      let message = JSON.parse(msg);
      const { gdm } = this.props;
      if (gdm.checkAck(message)) {
        // Ack received, do nothing.
        return;
      }

      if (whisper === true) {
        // Private message
        console.log('[VirtualChat]:: It\'s private message: ' + dateString + ' : ' + from + ' : ' + msg);
        let { support_msgs } = this.state;
        if(message.type && message.type !== "chat") {
          console.log('[VirtualChat] :: It\'s remote command :: ', message);
          this.props.onCmdMsg(message);
        } else {
          message.time = dateString;
          support_msgs.push(message);
          this.setState({ support_msgs, from });
          if (this.props.visible) {
            this.scrollToBottom();
          } else {
            notifyMe('Shidur', message.text, true);
            isUseNewDesign ? this.props.setIsRoomChat(false) : this.setState({ room_chat: false });
            this.props.onNewMsg(true);
          }
        }
      } else {
        // Public message
        let { messages } = this.state;
        console.log('[VirtualChat]-:: It\'s public message: ' + msg);
        if(message.type && message.type !== "chat") {
          console.log('[VirtualChat]:: It\'s remote command :: ', message);
          this.props.onCmdMsg(message);
        } else {
          message.time = dateString;
          messages.push(message);
          this.setState({ messages });
          if (this.props.visible) {
            this.scrollToBottom();
          } else {
            if(message.user.role.match(/^(admin|root)$/)) {
              notifyMe('Shidur', message.text, true);
            }
            this.props.onNewMsg();
          }
        }
      }
    } else if (what === 'join') {
      // Somebody joined
      let username = json['username'];
      let display = json['display'];
      console.log('[VirtualChat]-:: Somebody joined - username: ' + username + ' : display: ' + display);
    } else if (what === 'leave') {
      // Somebody left
      let username = json['username'];
      //var when = new Date();
      console.log('[VirtualChat]-:: Somebody left - username: ' + username + ' : Time: ' + getDateString());
    } else if (what === 'kicked') {
      // Somebody was kicked
      // var username = json["username"];
    } else if (what === 'destroyed') {
      let room = json['room'];
      console.log('[VirtualChat] room destroyed', room);
    }
  };

  showSupportMessage = (message) => {
    let { support_msgs } = this.state;
    message.time = getDateString();
    support_msgs.push(message);
    this.setState({ support_msgs, from: 'Admin' });
    if (this.props.visible) {
      this.scrollToBottom();
    } else {
      notifyMe('Shidur', message.text, true);
      isUseNewDesign ? this.props.setIsRoomChat(false) : this.setState({ room_chat: false });
      this.props.onNewMsg(true);
    }
  };

  sendCmdMessage = (msg) => {
    let message = {
      ack: false,
      textroom: 'message',
      transaction: Janus.randomString(12),
      room: this.state.room,
      text: JSON.stringify(msg),
    };
    this.state.chatroom.data({
      text: JSON.stringify(message),
      success: () => {
        console.log('[VirtualChat] :: Cmd Message sent ::');
      },
      error: (err) => {
        console.error('[VirtualChat] message error [cmd]', err);
        captureMessage(`Chatroom error: message - ${err}`, {source: "Textroom", err}, 'error');
      }
    });
  };

  sendChatMessage = () => {
    const {  room_chat } = isUseNewDesign ? this.props : this.state;
    let { id, role, display } = this.props.user;
    let { input_value, from,  support_msgs } = this.state;
    if (!role.match(/^(user|guest)$/) || input_value === '') {
      return;
    }
    let msg = { user: {id, role, display}, type: "chat", text: input_value };
    let pvt = room_chat ? '' : from ? { 'to': from } : { 'to': `${SHIDUR_ID}` };
    let message = {
      ack: false,
      textroom: 'message',
      transaction: Janus.randomString(12),
      room: this.state.room,
      ...pvt,
      text: JSON.stringify(msg),
    };
    // Note: messages are always acknowledged by default. This means that you'll
    // always receive a confirmation back that the message has been received by the
    // server and forwarded to the recipients. If you do not want this to happen,
    // just add an ack:false property to the message above, and server won't send
    // you a response (meaning you just have to hope it succeeded).
    this.state.chatroom.data({
      text: JSON.stringify(message),
      success: () => {
        console.log('[VirtualChat]:: Message sent ::');
        this.setState({ input_value: '' });
        if (!room_chat) {
          support_msgs.push(msg);
          this.setState({ support_msgs });
        }
      },
      error: (err) => {
        console.error('[VirtualChat] message error [chat]', err);
        captureMessage(`Chatroom error: message - ${err}`, {source: "Textroom", err}, 'error');
      }
    });
  };

  scrollToBottom = () => {
    this.refs.end.scrollIntoView({ behavior: 'smooth' });
  };

  tooggleChat = (room_chat) => {
    isUseNewDesign ? this.props.setIsRoomChat(room_chat) : this.setState({ room_chat });
  };

  render() {
    const { t } = this.props;
    const { room_chat } = isUseNewDesign ? this.props : this.state;
    const { messages, support_msgs } = this.state;

    const urlRegex =/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;()]*[-A-Z0-9+&@#/%=~_|()])/ig;
    const textWithLinks = (text) => {
      const parts = [];
      let start = 0;
      // Polyfil for Safari <13
      let matchAll = null;
      if (text.matchAll) {
        matchAll = (re) => text.matchAll(re);
      } else {
        matchAll = (re) => ([text.match(re)].filter(m => m));
      }
      for (const match of matchAll(urlRegex)) {
        const url = match[0];
        const index = match.index;
        if (index > start) {
          parts.push(<span key={start}>{text.slice(start, index)}</span>);
        }
        parts.push(<a key={index} target='blank_' href={url}>{url}</a>);
        start = index + url.length;
      }
      if (start < text.length) {
        parts.push(<span key={start}>{text.slice(start, text.length)}</span>);
      }
      return parts;
    };

    const isRTLChar = /[\u0590-\u07FF\u200F\u202B\u202E\uFB1D-\uFDFD\uFE70-\uFEFC]/;
    const isAscii = /[\x20-\x7F]/;
    const isAsciiChar = /[a-zA-Z]/;
    const isRTLString = (text) => {
      let rtl = 0;
      let ltr = 0;
      for (let i = 0; i < text.length; i++){
        if (!isAscii.test(text[i]) || isAsciiChar.test(text[i])) {
          if (isRTLChar.test(text[i])) {
            rtl++;
          } else {
            ltr++;
          }
        }
      }
      return rtl > ltr;
    };

    let room_msgs = messages.map((msg, i) => {
      let { user, time, text } = msg;
      if(text) {
        return (
            <p key={i} style={{direction: isRTLString(text) ? 'rtl' : 'ltr', textAlign: isRTLString(text) ? 'right' : 'left'}}><span style={{display: 'block'}}>
          <i style={{ color: 'grey' }}>{time}</i> -
          <b style={{ color: user.role.match(/^(admin|root)$/) ? 'red' : 'blue' }}>{user.display}</b>:
        </span>{textWithLinks(text)}</p>
        );
      }
			return null;
    });

    let admin_msgs = support_msgs.map((msg, i) => {
      let { user, time, text } = msg;
      if(text) {
        return (
            <p key={i} style={{direction: isRTLString(text) ? 'rtl' : 'ltr', textAlign: isRTLString(text) ? 'right' : 'left'}}><span style={{display: 'block'}}>
          <i style={{ color: 'grey' }}>{time}</i> -
          <b style={{ color: user.role.match(/^(admin|root)$/) ? 'red' : 'blue' }}>{user.role === 'admin' ? user.username : user.display}</b>:
        </span>{textWithLinks(text)}</p>
        );
      }
			return null;
    });

    return (
        <div className="chat-panel">
          {
            isUseNewDesign
              ? null
              : (
                <Button.Group attached='top'>
                  <Button disabled={room_chat} color='blue' onClick={() => this.tooggleChat(true)}>{t('virtualChat.roomChat')}</Button>
                  <Button disabled={!room_chat} color='blue' onClick={() => this.tooggleChat(false)}>{t('virtualChat.supportChat')}</Button>
                </Button.Group>
              )
          }
          <Message attached className='messages_list'>
            <div className="messages-wrapper">
              <Message size='mini' color="grey">{t(room_chat ? 'virtualChat.msgRoomInfo' : 'virtualChat.msgAdminInfo')}</Message>
              {room_chat ? room_msgs : admin_msgs}
              <div ref='end' />
            </div>
          </Message>

          <Input ref='input'
                 fluid type='text'
                 placeholder={t('virtualChat.enterMessage')}
                 action
                 value={this.state.input_value}
                 onChange={(v, { value }) => this.setState({ input_value: value })}>
            <input dir={isRTLString(this.state.input_value) ? 'rtl' : 'ltr'}
                   style={{textAlign: isRTLString(this.state.input_value) ? 'right' : 'left'}}/>
            <Button size='mini' positive onClick={this.sendChatMessage}>{t('virtualChat.send')}</Button>
          </Input>
        </div>
    );

  }
}

export default VirtualChat;

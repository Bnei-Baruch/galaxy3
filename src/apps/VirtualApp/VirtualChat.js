import React, { Component } from 'react';
import { Janus } from '../../lib/janus';
import { Button, Input, Message } from 'semantic-ui-react';
import { getDateString, initChatRoom, joinChatRoom, notifyMe } from '../../shared/tools';
import { SHIDUR_ID } from '../../shared/consts';
import classNames from 'classnames';

class VirtualChat extends Component {

  state = {
    chatroom: null,
    input_value: '',
    messages: [],
    support_msgs: [],
    room_chat: true,
    from: null,
  };

  static getDerivedStateFromProps(props, state) {
    return {
      ...state,
      ...props
    }
  }

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

  initChat = (janus) => {
    initChatRoom(janus, this.props.user, chatroom => {
      Janus.log(':: Got Chat Handle: ', chatroom);
      this.setState({ chatroom });
    }, data => {
      this.onData(data);
    });
  };

  initChatRoom = (user, room) => {
    joinChatRoom(this.state.chatroom, room, user);
    this.setState({ room });
  };

  onKeyPressed = (e) => {
    if (e.code === 'Enter') {
      this.sendChatMessage();
    }
  };

  exitChatRoom = (room) => {
    let {chatroom} = this.state;
    let chatreq = { textroom: 'leave', transaction: Janus.randomString(12), 'room': room };
    if(chatroom) {
      chatroom.data({
        text: JSON.stringify(chatreq),
        success: () => {
          Janus.log(':: Text room leave callback: ');
          this.setState({ messages: [], chatroom: null });
        }
      });
    }
  };

  onData = (data) => {
    Janus.log(':: We got message from Data Channel: ', data);
    let json = JSON.parse(data);
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
        Janus.log(':: It\'s private message: ' + dateString + ' : ' + from + ' : ' + msg);
        let { support_msgs } = this.state;
        if(message.type && message.type !== "chat") {
          Janus.log(':: It\'s remote command :: ', message);
          this.props.onCmdMsg(message);
        } else {
          message.time = dateString;
          support_msgs.push(message);
          this.setState({ support_msgs, from });
          if (this.props.visible) {
            this.scrollToBottom();
          } else {
            notifyMe('Shidur', message.text, true);
            this.setState({ room_chat: false });
            this.props.onNewMsg(true);
          }
        }
      } else {
        // Public message
        let { messages } = this.state;
        Janus.log('-:: It\'s public message: ' + msg);
        if(message.type && message.type !== "chat") {
          Janus.log(':: It\'s remote command :: ', message);
          this.props.onCmdMsg(message);
        } else {
          message.time = dateString;
          messages.push(message);
          this.setState({ messages });
          if (this.props.visible) {
            this.scrollToBottom();
          } else {
            this.props.onNewMsg();
          }
        }
      }
    } else if (what === 'join') {
      // Somebody joined
      let username = json['username'];
      let display = json['display'];
      Janus.log('-:: Somebody joined - username: ' + username + ' : display: ' + display);
    } else if (what === 'leave') {
      // Somebody left
      let username = json['username'];
      //var when = new Date();
      Janus.log('-:: Somebody left - username: ' + username + ' : Time: ' + getDateString());
    } else if (what === 'kicked') {
      // Somebody was kicked
      // var username = json["username"];
    } else if (what === 'destroyed') {
      let room = json['room'];
      Janus.log('The room: ' + room + ' has been destroyed');
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
      this.setState({ room_chat: false });
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
      error: (reason) => {
        console.error(reason);
      },
      success: () => {
        Janus.log(':: Cmd Message sent ::');
      }
    });
  };

  sendChatMessage = () => {
    let { input_value, user:{id, role, display}, from, room_chat, support_msgs } = this.state;
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
      error: (reason) => {
        console.error(reason);
      },
      success: () => {
        Janus.log(':: Message sent ::');
        this.setState({ input_value: '' });
        if (!room_chat) {
          support_msgs.push(msg);
          this.setState({ support_msgs });
        }
      }
    });
  };

  scrollToBottom = () => {
    this.refs.end.scrollIntoView({ behavior: 'smooth' });
  };

  tooggleChat = (room_chat) => {
    this.setState({ room_chat });
  };

  render() {
    const { t, visible } = this.props;
    const { messages, support_msgs, room_chat } = this.state;

    const urlRegex =/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;()]*[-A-Z0-9+&@#/%=~_|()])/ig;
    const textWithLinks = (text) => {
      const parts = [];
      let start = 0;
      // Polyfil for Safari <13
      let matchAll = null;
      if (text.matchAll) {
        matchAll = (re) => text.matchAll(re);
      } else {
        matchAll = (re) => text.match(re);
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
    const isAscii = /[\x00-\x7F]/;
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
          <b style={{ color: user.role === 'admin' ? 'red' : 'blue' }}>{user.display}</b>:
        </span>{textWithLinks(text)}</p>
        );
      }
    });

    let admin_msgs = support_msgs.map((msg, i) => {
      let { user, time, text } = msg;
      if(text) {
        return (
            <p key={i} style={{direction: isRTLString(text) ? 'rtl' : 'ltr', textAlign: isRTLString(text) ? 'right' : 'left'}}><span style={{display: 'block'}}>
          <i style={{ color: 'grey' }}>{time}</i> -
          <b style={{ color: user.role === 'admin' ? 'red' : 'blue' }}>{user.role === 'admin' ? user.username : user.display}</b>:
        </span>{textWithLinks(text)}</p>
        );
      }
    });

    return (
      <div className={classNames('chat-panel', {hidden: !visible})}>
        {/* <div className="chat" > */}
        <Button.Group attached='top'>
          <Button disabled={room_chat} color='blue' onClick={() => this.tooggleChat(true)}>{t('virtualChat.roomChat')}</Button>
          <Button disabled={!room_chat} color='blue' onClick={() => this.tooggleChat(false)}>{t('virtualChat.supportChat')}</Button>
        </Button.Group>
        <Message attached className='messages_list'>
          <div className="messages-wrapper">
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

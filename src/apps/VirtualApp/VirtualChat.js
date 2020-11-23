import React, { Component } from 'react';
import { Janus } from '../../lib/janus';
import { Button, Input, Message, TextArea, Form} from 'semantic-ui-react';
import { getDateString, initChatRoom, joinChatRoom, notifyMe } from '../../shared/tools';
import { SHIDUR_ID, TABS} from '../../shared/consts';
import api from '../../shared/Api';

class VirtualChat extends Component {
  constructor(props){
    super(props);
    this.onKeyPressed = this.onKeyPressed.bind(this);
  }

  state = {
    chatroom: null,
    input_value: '',
    messages: [],
    support_msgs: [],
    questions:[],
    room_chat: TABS.CHAT,
    from: null,
    quest_input_username:'',
    quest_input_usergroup:'',
    quest_input_message:''
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
    initChatRoom(janus, null, chatroom => {
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
      if(this.state.room_chat !== TABS.QUESTIONS){
        this.sendChatMessage();
      }
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
    var json = JSON.parse(data);
    // var transaction = json["transaction"];
    // if (transactions[transaction]) {
    //     // Someone was waiting for this
    //     transactions[transaction](json);
    //     delete transactions[transaction];
    //     return;
    // }
    var what = json['textroom'];
    if (what === 'message') {
      // Incoming message: public or private?
      var msg        = json['text'];
      msg            = msg.replace(new RegExp('<', 'g'), '&lt');
      msg            = msg.replace(new RegExp('>', 'g'), '&gt');
      var from       = json['from'];
      var dateString = getDateString(json['date']);
      var whisper    = json['whisper'];
      if (whisper === true) {
        // Private message
        Janus.log('-:: It\'s private message: ' + dateString + ' : ' + from + ' : ' + msg);
        let { support_msgs } = this.state;
        let message          = JSON.parse(msg);
        message.time         = dateString;
        support_msgs.push(message);
        this.setState({ support_msgs, from });
        if (this.props.visible) {
          this.scrollToBottom();
        } else {
          notifyMe('Shidur', message.text, true);
          this.setState({ room_chat: TABS.SUPPORT });
          this.props.onNewMsg(true);
        }
      } else {
        // Public message
        let { messages } = this.state;
        let message      = JSON.parse(msg);
        message.time     = dateString;
        Janus.log('-:: It\'s public message: ' + JSON.stringify(message));
        messages.push(message);
        console.log('Messages: ', messages);
        this.setState({ messages });
        if (this.props.visible) {
          this.scrollToBottom();
        } else {
          this.props.onNewMsg();
        }
      }
    } else if (what === 'join') {
      // Somebody joined
      let username = json['username'];
      let display  = json['display'];
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
    message.time         = getDateString();
    support_msgs.push(message);
    this.setState({ support_msgs, from: 'Admin' });
    if (this.props.visible) {
      this.scrollToBottom();
    } else {
      notifyMe('Shidur', message.text, true);
      this.setState({ room_chat: TABS.SUPPORT });
      this.props.onNewMsg(true);
    }
  };

  sendChatMessage = () => {
    let { input_value, user, from, room_chat, support_msgs, messages } = this.state;
    if (!user.role.match(/^(user|guest)$/) || input_value === '') {
      return;
    }
    let msg     = { user, text: input_value, time: getDateString() };
    let pvt     = room_chat ? '' : from ? { 'to': from } : { 'to': `${SHIDUR_ID}` };
    let message = {
      ack: false,
      textroom: 'localmessage',
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
        alert(reason);
      },
      success: () => {
        Janus.log(':: Message sent ::');
        this.setState({ input_value: '' });
        if (room_chat === TABS.SUPPORT){
          support_msgs.push(msg);
          this.setState({ support_msgs });
        }else{
          messages.push(msg);
          this.setState({ messages });          
        }
      }
    });
  };

  sendQuestionMessage = () => {
    let { quest_input_message,quest_input_usergroup,quest_input_username, user } = this.state;
    if (!user.role.match(/^(user|guest)$/) || quest_input_message === '') {
      return;
    }

    let msg = {
      serialUserId: user.id,
      question: {
        content: quest_input_message
      },
      user: {
          name: quest_input_username === ""?user.name:quest_input_username,
          gender: !user.group.match(/^W\s/) ? 'male':'female',
          galaxyRoom: quest_input_usergroup === ""?user.group:quest_input_usergroup
        }
      }
    api.sendQuestion(msg)
    .then(data => {
        this.setState({ quest_input_message: '' },
        () => this.getQuestions());
      })
    .catch(err => console.error(" error saving questions", user.name, err))
  };

  getQuestions = () => {
    let {user} = this.state;
    api.getQuestions({serialUserId: user.id})
    .then(data => this.setState({ questions: data.feed }))
    .catch(err => console.error(" error gatting questions", err));
  }

  scrollToBottom = () => {
    this.refs.end.scrollIntoView({ behavior: 'smooth' });
  };

  tooggleChat = (room_chat) => {
    this.setState({ room_chat });
    if(room_chat === TABS.QUESTIONS){
      this.getQuestions();
    }
  };

  render() {
    const { t } = this.props;
    const { messages, support_msgs, room_chat,user,questions } = this.state;
		const urlRegex =/(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;()]*[-A-Z0-9+&@#/%=~_|()])/ig;
    const textWithLinks = (text) => {
      const parts = [];
      if(typeof text === 'undefined'){
    		return parts;
    	}			
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
      if (typeof text === 'undefined') {
        return 0;
      }
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
     // console.log('messages.map', 'user', user, 'time', time, 'text!!!!!', text, 'msg', msg);
      return (
        <p key={i} style={{direction: isRTLString(text) ? 'rtl' : 'ltr', textAlign: isRTLString(text) ? 'right' : 'left'}}><span style={{display: 'block'}}>
          <i style={{ color: 'grey' }}>{time}</i> -
          <b style={{ color: user.role === 'admin' ? 'red' : 'blue' }}>{user.display}</b>:
        </span>{textWithLinks(text)}</p>
      );
    });

    let admin_msgs = support_msgs.map((msg, i) => {
      let { user, time, text } = msg;
    //  console.log('messages.map', 'user', user, 'time', time, 'text5555!!!!!', text, 'msg', msg);
      return (
        <p key={i} style={{direction: isRTLString(text) ? 'rtl' : 'ltr', textAlign: isRTLString(text) ? 'right' : 'left'}}><span style={{display: 'block'}}>
          <i style={{ color: 'grey' }}>{time}</i> -
          <b style={{ color: user.role === 'admin' ? 'red' : 'blue' }}>{user.role === 'admin' ? user.username : user.display}</b>:
        </span>{textWithLinks(text)}</p>
      );
    });

    let questions_msgs = questions.map((msg, i) => {
      let { user, askForMe,timestamp, question} = msg;
      var _time = new Date(timestamp);
      _time = getDateString(_time);
      return (
        <p key={i} style={{direction: isRTLString(question.content) ? 'rtl' : 'ltr', textAlign: isRTLString(question.content) ? 'right' : 'left'}}>
          <span style={{display: 'block'}}>
          <i style={{ color: 'grey' }}>{_time}</i> -
          <i style={{ color: 'grey' }}>{user.galaxyRoom}</i> -
          <b style={{ color: !askForMe ? 'green' : 'blue' }}>{user.name}</b>:
        </span>{textWithLinks(question.content)}</p>
      );
    });

    return (
      <div className="chat-panel">
        {/* <div className="chat" > */}
        <Button.Group attached='top'>
          <Button className={room_chat!==TABS.CHAT /*chat*/? 'inactive':''} color='blue' onClick={() => this.tooggleChat(TABS.CHAT)}>{t('virtualChat.roomChat')}</Button>
          <Button className={room_chat!==TABS.QUESTIONS /*questions*/ ?'inactive':''} color='blue' onClick={() => this.tooggleChat(TABS.QUESTIONS)}>{t('virtualChat.questions')}</Button>
          <Button className={room_chat!==TABS.SUPPORT /*support*/?'inactive':''} color='blue' onClick={() => this.tooggleChat(TABS.SUPPORT)}>{t('virtualChat.supportChat')}</Button>
        </Button.Group>
        <Message attached className='messages_list'>
          <div className='messages-wrapper'>
            <div className={room_chat===TABS.QUESTIONS?'moderator-messages':'hidden'}>{t('virtualChat.moderator')}</div>
            {room_chat === TABS.CHAT ? room_msgs : room_chat === TABS.SUPPORT ? admin_msgs : questions_msgs}
            <div ref='end' />
          </div>
        </Message>
        <div className = {room_chat === TABS.QUESTIONS ? 'hidden' : ''}>
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
        <div className={room_chat===TABS.QUESTIONS?'questions_form':'hidden'}>
          <Input ref='input'
            fluid type='text'
            action
            value={this.quest_input_username}
            placeholder={user.name}
            onChange={(v, { value }) => this.setState({ quest_input_username: value })}
            dir={isRTLString(this.state.quest_input_username) ? 'rtl' : 'ltr'}
            style={{textAlign: isRTLString(this.state.quest_input_username) ? 'right' : 'left'}}/ >
          <Input ref='input'
            fluid type='text'
            action 
            value={this.quest_input_usergroup}
            placeholder={user.group}
            onChange={(v, {value }) => this.setState({ quest_input_usergroup: value })}
            dir={isRTLString(this.state.quest_input_group) ? 'rtl' : 'ltr'}
            style={{textAlign: isRTLString(this.state.quest_input_usergroup) ? 'right' : 'left'}}/ >
              <Form>
          <TextArea
            rows='4'
            value={this.state.quest_input_message}
            placeholder={t('virtualChat.enterQuestion')}
            onChange={(v,{ value }) => this.setState({ quest_input_message: value })}
            dir={isRTLString(this.state.quest_input_message) ? 'rtl' : 'ltr'}
            style={{textAlign: isRTLString(this.state.quest_input_message) ? 'right' : 'left'}}>   
          </TextArea>
          </Form>
          <Button positive onClick={this.sendQuestionMessage}>{t('virtualChat.sendQuestion')}</Button>
        </div>        
        {/* </div> */}
      </div>
    );

  }
}

export default VirtualChat;

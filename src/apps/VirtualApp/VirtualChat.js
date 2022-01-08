import React, {Component} from "react";
import {Button, Input, Message} from "semantic-ui-react";
import {getDateString, notifyMe} from "../../shared/tools";
import {Typography} from "@material-ui/core";
import mqtt from "../../shared/mqtt";

//const isUseNewDesign = new URL(window.location.href).searchParams.has('new_design');
const isUseNewDesign = window.location.hostname === "arvut.kli.one" && window.location.pathname.search(/userm/) === -1;

class VirtualChat extends Component {
  state = {
    room: null,
    input_value: "",
    messages: [],
    privates: [],
    support_msgs: [],
    room_chat: true,
    from: null,
  };

  componentDidMount() {
    document.addEventListener("keydown", this.onKeyPressed);
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.onKeyPressed);
  }

  componentDidUpdate(prevProps) {
    if (this.props.visible && !prevProps.visible) {
      this.refs.input.focus();
    }
  }

  onKeyPressed = (e) => {
    if (e.code === "Enter") {
      this.newChatMessage();
    }
  };

  onChatMessage = (message) => {
    let {messages} = this.state;
    message.time = getDateString();
    messages.push(message);
    this.setState({messages});
    if (this.props.visible) {
      this.scrollToBottom();
    } else {
      if (message.user.role.match(/^(admin|root)$/)) {
        notifyMe("Shidur", message.text, true);
      }
      this.props.onNewMsg();
    }
  };

  showSupportMessage = (message) => {
    let {support_msgs} = this.state;
    message.time = getDateString();
    support_msgs.push(message);
    this.setState({support_msgs, from: "Admin"});
    if (this.props.visible) {
      this.scrollToBottom();
    } else {
      notifyMe("Shidur", message.text, true);
      isUseNewDesign ? this.props.setIsRoomChat(false) : this.setState({room_chat: false});
      this.props.onNewMsg(true);
    }
  };

  newChatMessage = (user) => {
    const {room_chat} = isUseNewDesign ? this.props : this.state;
    let {id, role, display} = this.props.user;
    let {input_value, privates} = this.state;

    if (!role.match(/^(user|guest)$/) || input_value === "") {
      return;
    }

    const msg = {user: {id, role, display}, type: "client-chat", text: input_value};
    const topic = user?.id ? `galaxy/users/${user.id}` : `galaxy/room/${this.props.room}/chat`;

    mqtt.send(JSON.stringify(msg), false, topic);

    this.setState({input_value: ""});
    if (!room_chat) {
      privates.push(msg);
      this.setState({privates});
    }
  };

  scrollToBottom = () => {
    this.refs.end.scrollIntoView({behavior: "smooth"});
  };

  tooggleChat = (room_chat) => {
    isUseNewDesign ? this.props.setIsRoomChat(room_chat) : this.setState({room_chat});
  };

  render() {
    const {t} = this.props;
    const {room_chat} = isUseNewDesign ? this.props : this.state;
    const {messages, support_msgs} = this.state;

    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;()]*[-A-Z0-9+&@#/%=~_|()])/gi;
    const textWithLinks = (text) => {
      const parts = [];
      let start = 0;
      // Polyfil for Safari <13
      let matchAll = null;
      if (text.matchAll) {
        matchAll = (re) => text.matchAll(re);
      } else {
        matchAll = (re) => [text.match(re)].filter((m) => m);
      }
      for (const match of matchAll(urlRegex)) {
        const url = match[0];
        const index = match.index;
        if (index > start) {
          parts.push(<span key={start}>{text.slice(start, index)}</span>);
        }
        parts.push(
          <a key={index} target="blank_" href={url}>
            {url}
          </a>
        );
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
      for (let i = 0; i < text.length; i++) {
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
      let {user, time, text} = msg;
      if (text) {
        return (
          <Typography
            color={isUseNewDesign ? "textPrimary" : "inherit"}
            paragraph
            key={i}
            style={{
              direction: isRTLString(text) ? "rtl" : "ltr",
              textAlign: isRTLString(text) ? "right" : "left",
            }}
          >
            <Typography display="block">
              <i style={{color: "grey"}}>{time}</i> -
              <Typography
                display="inline"
                color={user.role.match(/^(admin|root)$/) ? "secondary" : "textSecondary"}
                style={isUseNewDesign ? {} : {color: user.role.match(/^(admin|root)$/) ? "red" : "blue"}}
              >
                {user.display}
              </Typography>
              :
            </Typography>
            {textWithLinks(text)}
          </Typography>
        );
      }
      return null;
    });

    let admin_msgs = support_msgs.map((msg, i) => {
      let {user, time, text} = msg;
      if (text) {
        return (
          <Typography
            paragraph
            color={isUseNewDesign ? "textPrimary" : "inherit"}
            key={i}
            style={{
              direction: isRTLString(text) ? "rtl" : "ltr",
              textAlign: isRTLString(text) ? "right" : "left",
            }}
          >
            <Typography display="block">
              <i style={{color: "grey"}}>{time}</i> -
              <Typography
                display="inline"
                color={user.role.match(/^(admin|root)$/) ? "secondary" : "textSecondary"}
                style={isUseNewDesign ? {} : {color: user.role.match(/^(admin|root)$/) ? "red" : "blue"}}
              >
                {user.role === "admin" ? user.username : user.display}
              </Typography>
              :
            </Typography>
            {textWithLinks(text)}
          </Typography>
        );
      }
      return null;
    });

    return (
      <div className="chat-panel">
        {isUseNewDesign ? null : (
          <Button.Group attached="top">
            <Button disabled={room_chat} color="blue" onClick={() => this.tooggleChat(true)}>
              {t("virtualChat.roomChat")}
            </Button>
            <Button disabled={!room_chat} color="blue" onClick={() => this.tooggleChat(false)}>
              {t("virtualChat.supportChat")}
            </Button>
          </Button.Group>
        )}
        <Message attached className="messages_list">
          <div className="messages-wrapper">
            <Message size="mini" color="grey">
              {t(room_chat ? "virtualChat.msgRoomInfo" : "virtualChat.msgAdminInfo")}
            </Message>
            {room_chat ? room_msgs : admin_msgs}
            <div ref="end" />
          </div>
        </Message>

        <Input
          ref="input"
          fluid
          type="text"
          placeholder={t("virtualChat.enterMessage")}
          action
          value={this.state.input_value}
          onChange={(v, {value}) => this.setState({input_value: value})}
        >
          <input
            dir={isRTLString(this.state.input_value) ? "rtl" : "ltr"}
            style={{textAlign: isRTLString(this.state.input_value) ? "right" : "left"}}
          />
          <Button size="mini" positive onClick={this.newChatMessage}>
            {t("virtualChat.send")}
          </Button>
        </Input>
      </div>
    );
  }
}

export default VirtualChat;

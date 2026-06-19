import React, {Component} from "react";
import {Button, Input, Message} from "semantic-ui-react";
import {Box, Tab, Tabs, TextField, Typography} from "@mui/material";
import {getDateString, notifyMe} from "../../shared/tools";
import mqtt from "../../shared/mqtt";

const COMMON_CHAT_TOPIC = "galaxy/users/chat";

const isOperator = (role) => !!role && /^(admin|root)$/.test(role);
const nameColor = (role) => (isOperator(role) ? "red" : "blue");

const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;()]*[-A-Z0-9+&@#/%=~_|()])/gi;
const isRTLChar = /[֐-߿‏‫‮יִ-﷽ﹰ-ﻼ]/;
const isAscii = /[\x20-\x7F]/;
const isAsciiChar = /[a-zA-Z]/;
const isRTLString = (text) => {
  if (!text) return false;
  let rtl = 0;
  let ltr = 0;
  for (let i = 0; i < text.length; i++) {
    if (!isAscii.test(text[i]) || isAsciiChar.test(text[i])) {
      if (isRTLChar.test(text[i])) rtl++;
      else ltr++;
    }
  }
  return rtl > ltr;
};
const textWithLinks = (text) => {
  const parts = [];
  let start = 0;
  const matchAll = text.matchAll ? (re) => text.matchAll(re) : (re) => [text.match(re)].filter((m) => m);
  for (const match of matchAll(urlRegex)) {
    const url = match[0];
    const index = match.index;
    if (index > start) parts.push(<span key={start}>{text.slice(start, index)}</span>);
    parts.push(
      <a key={index} target="blank_" href={url}>
        {url}
      </a>
    );
    start = index + url.length;
  }
  if (start < text.length) parts.push(<span key={start}>{text.slice(start, text.length)}</span>);
  return parts;
};

// Client-side chat with three tabs:
//  - Chat:     common chat for everyone (galaxy/users/chat).
//  - Operator: private dialog with operators. Operator messages arrive on this
//              user's personal topic (galaxy/users/<id>); replies go back to the
//              operator that last wrote (galaxy/users/<operatorId>).
//  - Question: posts a retained question to galaxy/users/questions/<id>.
class WebinarChat extends Component {
  state = {
    active_tab: "chat",
    chat_msgs: [],
    chat_input: "",
    operator_msgs: [],
    operator_input: "",
    operator_from: null, // id of the operator we reply to
    q_name: "",
    q_content: "",
    my_questions: [],
  };

  componentDidMount() {
    document.addEventListener("keydown", this.onKeyPressed);
    const {user} = this.props;
    if (user && !this.state.q_name) this.setState({q_name: user.name || user.display || ""});
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.onKeyPressed);
  }

  componentDidUpdate(prevProps) {
    if (this.props.visible && !prevProps.visible) this.scrollToBottom();
    if (this.props.openTab && this.props.openTab !== prevProps.openTab) {
      this.setState({active_tab: this.props.openTab});
    }
  }

  onKeyPressed = (e) => {
    if (e.code !== "Enter") return;
    if (this.state.active_tab === "chat") this.sendChat();
    else if (this.state.active_tab === "operator") this.sendOperator();
  };

  // --- Common chat (called from WebinarClient via ref) -----------------------
  onChatMessage = (message) => {
    message.time = getDateString();
    this.setState((s) => ({chat_msgs: [...s.chat_msgs, message]}));
    this.afterIncoming(message, "chat");
  };

  // --- Private message from an operator (called via ref) ---------------------
  onOperatorMessage = (message) => {
    message.time = getDateString();
    this.setState((s) => ({
      operator_msgs: [...s.operator_msgs, message],
      operator_from: message.user?.id || s.operator_from,
    }));
    this.afterIncoming(message, "operator");
  };

  afterIncoming = (message, tab) => {
    if (this.props.visible && this.state.active_tab === tab) {
      this.scrollToBottom();
    } else {
      if (isOperator(message.user?.role)) notifyMe("Shidur", message.text, true);
      if (this.props.onNewMsg) this.props.onNewMsg();
    }
  };

  sendChat = () => {
    const {chat_input} = this.state;
    if (chat_input === "") return;
    const {id, role, display, username} = this.props.user;
    const msg = {user: {id, role, display, username}, type: "client-chat", text: chat_input};
    mqtt.send(JSON.stringify(msg), false, COMMON_CHAT_TOPIC);
    this.setState((s) => ({chat_msgs: [...s.chat_msgs, {...msg, time: getDateString()}], chat_input: ""}));
  };

  sendOperator = () => {
    const {operator_input, operator_from} = this.state;
    if (operator_input === "" || !operator_from) return;
    const {id, role, display, username} = this.props.user;
    const msg = {user: {id, role, display, username}, type: "client-chat", text: operator_input};
    mqtt.send(JSON.stringify(msg), false, "galaxy/users/" + operator_from);
    this.setState((s) => ({operator_msgs: [...s.operator_msgs, {...msg, time: getDateString()}], operator_input: ""}));
  };

  sendQuestion = () => {
    const {q_name, q_content} = this.state;
    const {id, role, display, group} = this.props.user;
    if (!q_content) return;
    const msg = {
      user: {id, role, display, name: q_name, group},
      type: "client-question",
      text: q_content,
      time: getDateString(),
    };
    mqtt.send(JSON.stringify(msg), true, "galaxy/users/questions/" + id);
    this.setState((s) => ({my_questions: [...s.my_questions, msg], q_content: ""}));
  };

  scrollToBottom = () => {
    if (this.refs.end) this.refs.end.scrollIntoView({behavior: "smooth"});
  };

  renderMessages = (messages) =>
    messages.map((msg, i) => {
      const {user, time, text} = msg;
      if (!text) return null;
      return (
        <Typography
          color="textPrimary"
          paragraph
          key={i}
          style={{direction: isRTLString(text) ? "rtl" : "ltr", textAlign: isRTLString(text) ? "right" : "left"}}
        >
          <Typography display="block">
            <i style={{color: "grey"}}>{time}</i> -{" "}
            <Typography display="inline" style={{color: nameColor(user?.role)}}>
              {user?.display || user?.username}
            </Typography>
            :
          </Typography>
          {textWithLinks(text)}
        </Typography>
      );
    });

  renderChat = () => {
    const {t} = this.props;
    const {chat_msgs, chat_input} = this.state;
    return (
      <div className="chat-panel">
        <Message attached className="messages_list">
          <div className="messages-wrapper">
            {this.renderMessages(chat_msgs)}
            <div ref="end" />
          </div>
        </Message>
        <Input
          ref="input"
          fluid
          type="text"
          placeholder={t ? t("virtualChat.enterMessage") : "Enter message"}
          action
          value={chat_input}
          onChange={(e, {value}) => this.setState({chat_input: value})}
        >
          <input dir={isRTLString(chat_input) ? "rtl" : "ltr"} />
          <Button size="mini" positive onClick={this.sendChat}>
            {t ? t("virtualChat.send") : "Send"}
          </Button>
        </Input>
      </div>
    );
  };

  renderOperator = () => {
    const {t} = this.props;
    const {operator_msgs, operator_input, operator_from} = this.state;
    return (
      <div className="chat-panel">
        <Message attached className="messages_list">
          <div className="messages-wrapper">
            {this.renderMessages(operator_msgs)}
            <div ref="end" />
          </div>
        </Message>
        <Input
          fluid
          type="text"
          placeholder={operator_from ? (t ? t("virtualChat.enterMessage") : "Enter message") : "Waiting for operator…"}
          action
          disabled={!operator_from}
          value={operator_input}
          onChange={(e, {value}) => this.setState({operator_input: value})}
        >
          <input dir={isRTLString(operator_input) ? "rtl" : "ltr"} />
          <Button size="mini" positive disabled={!operator_from} onClick={this.sendOperator}>
            {t ? t("virtualChat.send") : "Send"}
          </Button>
        </Input>
      </div>
    );
  };

  renderQuestion = () => {
    const {t} = this.props;
    const {user} = this.props;
    const {q_name, q_content, my_questions} = this.state;
    return (
      <Box className="chat-panel">
        <Message attached className="messages_list">
          <span className="messages-wrapper">
            {my_questions.map((q, i) => (
              <Typography
                key={i}
                style={{direction: isRTLString(q.text) ? "rtl" : "ltr", textAlign: isRTLString(q.text) ? "right" : "left"}}
              >
                <Typography style={{color: "grey"}}>
                  {q.time} {q.user?.group ? "- " + q.user.group : ""} -{" "}
                  <Typography display="inline" style={{color: nameColor(q.user?.role)}}>
                    {q.user?.name || q.user?.display}
                  </Typography>
                  :
                </Typography>
                <Typography color="textPrimary">{q.text}</Typography>
              </Typography>
            ))}
          </span>
        </Message>
        <TextField
          fullWidth
          label={t ? t("questions.userName") : "Name"}
          value={q_name}
          variant="outlined"
          onChange={({target: {value}}) => this.setState({q_name: value})}
          margin="dense"
          dir={isRTLString(q_name) ? "rtl" : "ltr"}
        />
        <TextField
          fullWidth
          label={t ? t("questions.galaxyRoom") : "Room"}
          value={user?.group || ""}
          variant="outlined"
          margin="dense"
          disabled
        />
        <TextField
          fullWidth
          multiline
          label={t ? t("questions.enterQuestion") : "Your question"}
          value={q_content}
          variant="outlined"
          onChange={({target: {value}}) => this.setState({q_content: value})}
          margin="dense"
          dir={isRTLString(q_content) ? "rtl" : "ltr"}
        />
        <Button positive disabled={!q_name || !q_content} onClick={this.sendQuestion}>
          {t ? t("questions.sendQuestion") : "Send question"}
        </Button>
      </Box>
    );
  };

  render() {
    const {t} = this.props;
    const {active_tab} = this.state;
    return (
      <div className="chat-panel" style={{height: "100%", display: "flex", flexDirection: "column"}}>
        <Tabs
          value={active_tab}
          variant="fullWidth"
          onChange={(e, value) => this.setState({active_tab: value})}
        >
          <Tab label={t ? t("oldClient.chat") : "Chat"} value="chat" />
          <Tab label="Operator" value="operator" />
          <Tab label={t ? t("oldClient.sendQuestion") : "Question"} value="question" />
        </Tabs>
        <Box style={{flex: 1, minHeight: 0}}>
          {active_tab === "chat" && this.renderChat()}
          {active_tab === "operator" && this.renderOperator()}
          {active_tab === "question" && this.renderQuestion()}
        </Box>
      </div>
    );
  }
}

export default WebinarChat;

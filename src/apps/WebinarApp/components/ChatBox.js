import React, {Component} from "react";
import {Button, Icon, Input, Label, Menu, Message, Segment, Tab} from "semantic-ui-react";
import {getDateString} from "../../../shared/tools";
import mqtt from "../../../shared/mqtt";

const COMMON_CHAT_TOPIC = "galaxy/users/chat";
const QUESTIONS_TOPIC = "galaxy/users/questions/+";

const isOperator = (role) => !!role && /^(admin|root)$/.test(role);
const nameColor = (role) => (isOperator(role) ? "red" : "blue");

// Operator-side chat. Three vertical sections:
//  - Chat:     the common chat for everyone (galaxy/users/chat).
//  - Operator: private dialogs with users. Incoming private messages land on
//              the operator's own personal topic (galaxy/users/<operatorId>,
//              already subscribed by the AdminClient shell) and are grouped per
//              user into horizontal, closeable conversation tabs so the operator
//              can run several dialogs in parallel.
//  - Question: retained questions from users (galaxy/users/questions/<userId>).
//              Clicking a question opens the matching private dialog to answer.
class ChatBox extends Component {
  state = {
    active_section: "chat",
    chat_msgs: [],
    chat_input: "",
    // {[userId]: {id, display, messages: []}}
    conversations: {},
    active_user_id: null,
    operator_input: "",
    // {[userId]: {user, text, time}}
    questions: {},
  };

  componentDidMount() {
    if (this.props.onRef) this.props.onRef(this);

    mqtt.join(COMMON_CHAT_TOPIC);
    mqtt.join(QUESTIONS_TOPIC);

    this._onCommonChat = (data) => {
      const json = JSON.parse(data);
      if (json?.type === "client-chat") this.onChatMessage(json);
    };
    this._onPrivate = (data) => {
      const json = JSON.parse(data);
      // Only collect chat messages coming from users, not our own echoes/commands.
      if (json?.type === "client-chat" && json?.user && json.user.id !== this.props.user.id) {
        this.onOperatorMessage(json);
      }
    };
    this._onQuestion = (data, target) => {
      const json = JSON.parse(data);
      if (json?.type === "client-question") this.onQuestion(json, target);
    };

    mqtt.mq.on("MqttUsersChatEvent", this._onCommonChat);
    mqtt.mq.on("MqttPrivateMessage", this._onPrivate);
    mqtt.mq.on("MqttQuestionEvent", this._onQuestion);

    document.addEventListener("keydown", this.onKeyPressed);
  }

  componentDidUpdate(prevProps) {
    // Operator picked a user in the list -> open/focus their private dialog.
    const prevId = prevProps.selected_user?.id;
    const curUser = this.props.selected_user;
    if (curUser?.id && curUser.id !== prevId) {
      this.openConversation(curUser);
    }
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.onKeyPressed);
    if (this.props.onRef) this.props.onRef(undefined);

    mqtt.mq.removeListener("MqttUsersChatEvent", this._onCommonChat);
    mqtt.mq.removeListener("MqttPrivateMessage", this._onPrivate);
    mqtt.mq.removeListener("MqttQuestionEvent", this._onQuestion);

    mqtt.exit(COMMON_CHAT_TOPIC);
    mqtt.exit(QUESTIONS_TOPIC);
  }

  onKeyPressed = (e) => {
    if (e.code !== "Enter") return;
    if (this.state.active_section === "chat") this.sendChat();
    else if (this.state.active_section === "operator") this.sendOperator();
  };

  // --- Common chat -----------------------------------------------------------

  onChatMessage = (message) => {
    message.time = getDateString();
    this.setState((s) => ({chat_msgs: [...s.chat_msgs, message]}));
  };

  sendChat = () => {
    const {user} = this.props;
    const {chat_input} = this.state;
    if (chat_input === "") return;

    const {id, role, display, username} = user;
    const msg = {user: {id, role, display, username}, type: "client-chat", text: chat_input};
    mqtt.send(JSON.stringify(msg), false, COMMON_CHAT_TOPIC);

    // Echo our own message (broker won't send it back to us).
    this.onChatMessage({...msg});
    this.setState({chat_input: ""});
  };

  // --- Private operator dialogs ----------------------------------------------

  openConversation = (u) => {
    if (!u?.id) return;
    this.setState((s) => {
      const conversations = {...s.conversations};
      if (!conversations[u.id]) {
        conversations[u.id] = {id: u.id, display: u.display || u.username || String(u.id), messages: []};
      }
      return {conversations, active_user_id: u.id, active_section: "operator"};
    });
  };

  onOperatorMessage = (message) => {
    message.time = getDateString();
    const {id, display, username} = message.user;
    this.setState((s) => {
      const conversations = {...s.conversations};
      const conv = conversations[id]
        ? {...conversations[id], messages: [...conversations[id].messages, message]}
        : {id, display: display || username || String(id), messages: [message]};
      conversations[id] = conv;
      return {conversations, active_user_id: s.active_user_id || id};
    });
  };

  sendOperator = () => {
    const {user} = this.props;
    const {operator_input, active_user_id} = this.state;
    if (operator_input === "" || !active_user_id) return;

    const {id, role, display, username} = user;
    const msg = {user: {id, role, display, username}, type: "client-chat", text: operator_input};
    mqtt.send(JSON.stringify(msg), false, "galaxy/users/" + active_user_id);

    // Echo into the dialog as an outgoing message.
    const sent = {...msg, time: getDateString()};
    this.setState((s) => {
      const conversations = {...s.conversations};
      const conv = conversations[active_user_id];
      if (conv) conversations[active_user_id] = {...conv, messages: [...conv.messages, sent]};
      return {conversations, operator_input: ""};
    });
  };

  closeConversation = (id) => {
    this.setState((s) => {
      const conversations = {...s.conversations};
      delete conversations[id];
      let active_user_id = s.active_user_id;
      if (active_user_id === id) {
        const ids = Object.keys(conversations);
        active_user_id = ids.length ? ids[ids.length - 1] : null;
      }
      return {conversations, active_user_id};
    });
  };

  // --- Questions -------------------------------------------------------------

  onQuestion = (message, target) => {
    const key = target || message.user?.id;
    if (!key) return;
    message.time = message.time || getDateString();
    this.setState((s) => ({questions: {...s.questions, [key]: message}}));
  };

  answerQuestion = (key, q) => {
    this.openConversation({id: key, display: q.user?.display || q.user?.name || String(key)});
  };

  // --- Renderers -------------------------------------------------------------

  renderMessages = (messages) =>
    messages.map((msg, i) => {
      const {user, time, text} = msg;
      return (
        <div key={i}>
          <p>
            <i style={{color: "grey"}}>{time}</i> -{" "}
            <b style={{color: nameColor(user?.role)}}>{user?.display || user?.username}</b>:
          </p>
          {text}
        </div>
      );
    });

  renderChat = () => {
    const {chat_msgs, chat_input} = this.state;
    return (
      <div>
        <Message className="messages_list">
          {this.renderMessages(chat_msgs)}
          <div ref="chat_end" />
        </Message>
        <Input
          fluid
          type="text"
          placeholder="Message to everyone"
          action
          value={chat_input}
          onChange={(e, {value}) => this.setState({chat_input: value})}
        >
          <input />
          <Button positive onClick={this.sendChat}>
            Send
          </Button>
        </Input>
      </div>
    );
  };

  renderOperator = () => {
    const {conversations, active_user_id, operator_input} = this.state;
    const ids = Object.keys(conversations);
    const active = active_user_id ? conversations[active_user_id] : null;

    return (
      <div>
        <Menu pointing secondary size="small" style={{overflowX: "auto", flexWrap: "nowrap"}}>
          {ids.length === 0 ? <Menu.Item disabled>No dialogs</Menu.Item> : null}
          {ids.map((id) => {
            const conv = conversations[id];
            return (
              <Menu.Item key={id} active={id === active_user_id} onClick={() => this.setState({active_user_id: id})}>
                {conv.display}
                <Icon
                  name="close"
                  size="small"
                  style={{marginLeft: "0.5em"}}
                  onClick={(e) => {
                    e.stopPropagation();
                    this.closeConversation(id);
                  }}
                />
              </Menu.Item>
            );
          })}
        </Menu>
        <Message className="messages_list">
          {active ? this.renderMessages(active.messages) : null}
          <div ref="op_end" />
        </Message>
        <Input
          fluid
          type="text"
          placeholder={active ? "Message to " + active.display : "Select a dialog"}
          action
          disabled={!active}
          value={operator_input}
          onChange={(e, {value}) => this.setState({operator_input: value})}
        >
          <input />
          <Button positive disabled={!active} onClick={this.sendOperator}>
            Send
          </Button>
        </Input>
      </div>
    );
  };

  renderQuestion = () => {
    const {questions} = this.state;
    const keys = Object.keys(questions);
    return (
      <Message className="messages_list">
        {keys.length === 0 ? <p style={{color: "grey"}}>No questions</p> : null}
        {keys.map((key) => {
          const q = questions[key];
          const u = q.user || {};
          return (
            <div key={key} style={{cursor: "pointer"}} onClick={() => this.answerQuestion(key, q)}>
              <p>
                <i style={{color: "grey"}}>{q.time}</i> -{" "}
                <b style={{color: nameColor(u.role)}}>{u.display || u.name}</b>
                {u.group ? <Label size="mini">{u.group}</Label> : null}:
              </p>
              {q.text}
            </div>
          );
        })}
      </Message>
    );
  };

  render() {
    const panes = [
      {
        menuItem: {key: "chat", icon: "comments", content: "Chat"},
        render: () => <Tab.Pane>{this.renderChat()}</Tab.Pane>,
      },
      {
        menuItem: {key: "operator", icon: "user", content: "Operator"},
        render: () => <Tab.Pane>{this.renderOperator()}</Tab.Pane>,
      },
      {
        menuItem: {key: "question", icon: "question", content: "Question"},
        render: () => <Tab.Pane>{this.renderQuestion()}</Tab.Pane>,
      },
    ];

    const activeIndex = ["chat", "operator", "question"].indexOf(this.state.active_section);

    return (
      <Segment className="chat_segment">
        <Tab
          menu={{fluid: true, vertical: true, tabular: true}}
          panes={panes}
          activeIndex={activeIndex}
          onTabChange={(e, {activeIndex}) =>
            this.setState({active_section: ["chat", "operator", "question"][activeIndex]})
          }
        />
      </Segment>
    );
  }
}

export default ChatBox;

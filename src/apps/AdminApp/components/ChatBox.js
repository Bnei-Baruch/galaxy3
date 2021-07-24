import React, {Component} from "react";
import {Button, Confirm, Header, Icon, Input, Message, Segment, Select} from "semantic-ui-react";
import {Janus} from "../../../lib/janus";
import {getDateString, notifyMe} from "../../../shared/tools";
import mqtt from "../../../shared/mqtt";

class ChatBox extends Component {
  /*
        props:
            gateways: {},
            user: null,
            selected_user: null,
            selected_room: null,
            rooms:[],
            onChatRoomsInitialized: noop
    */

  state = {
    msg_type: "public",
    messages: [],
    visible: false,
    input_value: "",
    showConfirmBroadcast: false,
  };

  componentDidMount() {
    this.props.onRef(this);
    this.initChatEvents();
    document.addEventListener("keydown", this.onKeyPressed);
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.onKeyPressed);
    this.props.onRef(undefined);
  }

  initChatEvents = () => {
    // Public chat
    mqtt.mq.on("MqttChatEvent", (data) => {
      let json = JSON.parse(data);
      if(json?.type === "client-chat") {
        this.onChatMessage(json);
      } else {
        this.onChatData(json);
      }
    });

    // Private chat
    mqtt.mq.on("MqttPrivateMessage", (data) => {
      let json = JSON.parse(data);
      json["whisper"] = true;
      if(json?.type === "client-chat") {
        this.onChatMessage(json);
      } else {
        this.onChatData(json);
      }
    });

    // Broadcast message
    mqtt.mq.on("MqttBroadcastMessage", (data) => {
      let json = JSON.parse(data);
      let message = JSON.parse(json.text);
      message.time = getDateString(json["date"]);
      notifyMe("Arvut System", message.text, true);
    });
  };

  onConfirmBroadcast = (sure) => {
    this.setState({showConfirmBroadcast: false});
    if (sure) this.sendBroadcastMessage();
  };

  onKeyPressed = (e) => {
    if (e.code === "Enter") this.sendMessage();
  };

  onChatMessage = (message) => {
    const dateString = getDateString();
    message.time = dateString;

    if (message.whisper) {

      // Private message
      console.log("[VirtualChat]:: It's private message: ", message);
      let {privates} = this.state;
      privates.push(message);
      this.setState({privates});
      this.scrollToBottom();
    } else {

      // Public message
      let {messages} = this.state;
      message.to = this.props.selected_group;
      console.log("[VirtualChat]-:: It's public message: ", message);
      messages.push(message);
      this.setState({messages});
      this.scrollToBottom();
    }
  };

  onChatData = (json) => {
    const what = json["textroom"];
    if (what === "message") {
      // Incoming message: public or private?
      let msg = json["text"];
      msg = msg.replace(new RegExp("<", "g"), "&lt");
      msg = msg.replace(new RegExp(">", "g"), "&gt");
      let from = json["from"];
      let dateString = getDateString(json["date"]);
      let whisper = json["whisper"];
      let message = JSON.parse(msg);

      // const {gdm} = this.props;
      // if (gdm.checkAck(message)) {
      //   // Ack received, do nothing.
      //   return;
      // }

      if (message.type && message.type !== "chat") {
        console.log(":: It's remote command :: ");
        return;
      }

      message.user.username = message.user.display;
      message.time = dateString;
      if (whisper === true) {
        // Private message
        console.log("[Admin] [ChatBox] private message", from, message);
        let {messages} = this.state;
        messages.push(message);
        this.setState({messages});
        this.scrollToBottom();
      } else {
        // Public message
        console.log("[Admin] [ChatBox] public message", from, message);
        let {messages} = this.state;
        message.to = this.props.selected_group;
        messages.push(message);
        this.setState({messages});
        this.scrollToBottom();
      }
    }
  };

  sendPrivateMessage = () => {
    const {
      user: {role, display, username},
      selected_room,
      selected_user,
    } = this.props;
    const {input_value} = this.state;
    if (!selected_user) {
      alert("Choose user");
      return;
    }

    const msg = {user: {role, display, username}, text: input_value};
    const message = {
      ack: false,
      textroom: "message",
      transaction: Janus.randomString(12),
      room: selected_room,
      to: selected_user.id,
      text: JSON.stringify(msg),
    };

    mqtt.send(JSON.stringify(message), false, `galaxy/users/${selected_user.id}`);
    this.setState({input_value: ""});
    const {messages} = this.state;
    msg.time = getDateString();
    msg.to = selected_user.display;
    messages.push(msg);
    this.setState({input_value: ""}, this.scrollToBottom);
  };

  sendPublicMessage = () => {
    const {
      user: {role, display, username},
      selected_room,
    } = this.props;
    const {input_value} = this.state;
    if (!selected_room) {
      alert("Enter room");
      return;
    }

    const msg = {user: {role, display, username}, text: input_value};
    const message = {
      ack: false,
      textroom: "message",
      transaction: Janus.randomString(12),
      room: selected_room,
      text: JSON.stringify(msg),
    };

    mqtt.send(JSON.stringify(message), false, `galaxy/room/${selected_room}/chat`);
    this.setState({input_value: ""});
    const {messages} = this.state;
    msg.time = getDateString();
    //messages.push(msg);
    this.setState({input_value: ""}, this.scrollToBottom);
  };

  sendBroadcastMessage = () => {
    const {user: {role, display, username}, selected_room,} = this.props;
    const {input_value} = this.state;

    const msg = {user: {role, display, username}, text: input_value};
    const message = {
      ack: false,
      textroom: "message",
      transaction: Janus.randomString(12),
      room: selected_room,
      text: JSON.stringify(msg),
    };

    mqtt.send(JSON.stringify(message), false, `galaxy/users/broadcast`);
    this.setState({input_value: ""});
    const {messages} = this.state;
    msg.time = getDateString();
    messages.push(msg);
    this.setState({input_value: ""}, this.scrollToBottom);
  };

  sendMessage = () => {
    const {msg_type} = this.state;
    if (msg_type === "all") {
      this.setState({showConfirmBroadcast: true});
      return;
    }
    msg_type === "private" ? this.sendPrivateMessage() : this.sendPublicMessage();
  };

  newChatMessage = () => {
    const {user: {role, display, id}, selected_room, selected_user} = this.props;
    let {input_value, msg_type} = this.state;

    if (msg_type === "all") {
      // TODO: Broadcast messages
      this.setState({showConfirmBroadcast: true});
      return;
    }

    if (!role.match(/^(user|guest)$/) || input_value === "") {
      return;
    }

    if (!selected_room) {
      alert("Enter room");
      return;
    }

    const msg = {user: {id, role, display}, type: "client-chat", text: input_value};
    const topic = msg_type === "private" ? `galaxy/users/${selected_user.id}` : `galaxy/room/${selected_room}/chat`;

    mqtt.send(JSON.stringify(msg), false, topic);

    this.setState({input_value: ""});

    // TODO: Where we show private messages?
    // if (user?.id) {
    //   privates.push(msg);
    //   this.setState({privates});
    // }
  };

  scrollToBottom = () => {
    this.refs.end.scrollIntoView({behavior: "smooth"});
  };

  handleInputChange = (e, data) => {
    this.setState({input_value: data.value});
  };

  render() {
    const {selected_user, selected_group} = this.props;
    const {messages, msg_type, input_value, showConfirmBroadcast} = this.state;
    const to = selected_user && selected_user.display ? selected_user.display : "Select User:";
    const group = selected_group ? selected_group : "Select Group:";

    const send_options = [
      {key: "all", text: "Everyone", value: "all", disabled: true},
      {key: "public", text: group, value: "public"},
      {key: "private", text: to, value: "private", disabled: true},
    ];

    const list_msgs = messages.map((msg, i) => {
      const {user, time, text, to} = msg;
      return (
        <div key={i}>
          <p>
            <i style={{color: "grey"}}>{time}</i> -
            <b style={{color: user.role === "admin" ? "red" : "blue"}}>{user.display}</b>
            {to ? <b style={{color: "blue"}}>-> {to} :</b> : ""}
          </p>
          {text}
        </div>
      );
    });

    return (
      <Segment className="chat_segment">
        <Message className="messages_list">
          {list_msgs}
          <div ref="end" />
        </Message>
        <Input
          fluid
          type="text"
          placeholder="Type your message"
          action
          value={input_value}
          onChange={this.handleInputChange}
        >
          <input />
          <Select
            options={send_options}
            value={msg_type}
            error={msg_type === "all"}
            onChange={(e, {value}) => this.setState({msg_type: value})}
          />
          <Button positive negative={msg_type === "all"} onClick={this.sendMessage}>
            Send
          </Button>
        </Input>
        <Confirm
          open={showConfirmBroadcast}
          header={
            <Header>
              <Icon name="warning circle" color="red" />
              Caution
            </Header>
          }
          content="Are you sure you want to send message to EVERYONE?!"
          onCancel={() => this.onConfirmBroadcast(false)}
          onConfirm={() => this.onConfirmBroadcast(true)}
        />
      </Segment>
    );
  }
}

export default ChatBox;

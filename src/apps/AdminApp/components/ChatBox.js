import React, {Component} from "react";
import {Button, Confirm, Header, Icon, Input, Message, Segment, Select} from "semantic-ui-react";
import {getDateString, notifyMe} from "../../../shared/tools";
import mqtt from "../../../shared/mqtt";

class ChatBox extends Component {
  state = {
    msg_type: "public",
    messages: [],
    visible: false,
    input_value: "",
    show_confirm: false,
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
      if (json?.type === "client-chat") {
        this.onChatMessage(json);
      }
    });

    // Private chat
    mqtt.mq.on("MqttPrivateMessage", (data) => {
      let json = JSON.parse(data);
      json["whisper"] = true;
      if (json?.type === "client-chat") {
        this.onChatMessage(json);
      }
    });

    // Broadcast message
    mqtt.mq.on("MqttBroadcastMessage", (data) => {
      let message = JSON.parse(data);
      if (message?.type === "client-chat") {
        message.time = getDateString(message["date"]);
        notifyMe("Arvut System", message.text, true);
      }
    });
  };

  newBroadcastMessage = () => {
    const {
      user: {role, display, username},
    } = this.props;
    const {input_value} = this.state;

    const msg = {user: {role, display, username}, type: "client-chat", text: input_value};

    this.setState({show_confirm: false, input_value: ""});
    mqtt.send(JSON.stringify(msg), false, `galaxy/users/broadcast`);
  };

  onKeyPressed = (e) => {
    let {msg_type} = this.state;
    if (e.code === "Enter" && msg_type !== "all") this.newChatMessage();
  };

  onChatMessage = (message) => {
    message.time = getDateString();

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
      this.setState({messages}, () => {
        //this.scrollToBottom()
      });
    }
  };

  newChatMessage = () => {
    const {
      user: {role, display, id},
      selected_room,
      selected_user,
    } = this.props;
    let {input_value, msg_type} = this.state;

    if (msg_type === "all") {
      this.setState({show_confirm: true});
      return;
    }

    if (input_value === "") {
      return;
    }

    if (!selected_room) {
      alert("Enter room");
      return;
    }

    if (msg_type === "private" && !selected_user) {
      alert("Choose user");
      return;
    }

    const msg = {user: {id, role, display}, type: "client-chat", text: input_value};
    const topic = msg_type === "private" ? `galaxy/users/${selected_user.id}` : `galaxy/room/${selected_room}/chat`;

    mqtt.send(JSON.stringify(msg), false, topic);
    console.log(msg);
    this.setState({input_value: ""});

    // TODO: Make private dialog exchange
  };

  scrollToBottom = () => {
    if (this.refs?.end) this.refs.end.scrollIntoView({behavior: "smooth"});
  };

  handleInputChange = (e, data) => {
    this.setState({input_value: data.value});
  };

  render() {
    const {selected_user, selected_group, user} = this.props;
    const {messages, msg_type, input_value, show_confirm} = this.state;
    const to = selected_user && selected_user.display ? selected_user.display : "Select User:";
    const group = selected_group ? selected_group : "Select Group:";

    const send_options = [
      {key: "public", text: group, value: "public"},
      {key: "private", text: to, value: "private"},
    ];

    if (user.role === "root") {
      send_options.push({key: "all", text: "Everyone", value: "all"});
    }

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
          <Button positive negative={msg_type === "all"} onClick={this.newChatMessage}>
            Send
          </Button>
        </Input>
        <Confirm
          open={show_confirm}
          header={
            <Header>
              <Icon name="warning circle" color="red" />
              Caution
            </Header>
          }
          content="Are you sure you want to send message to EVERYONE?!"
          onCancel={() => this.setState({show_confirm: false})}
          onConfirm={this.newBroadcastMessage}
        />
      </Segment>
    );
  }
}

export default ChatBox;

import React, {Component} from "react";
import {Button, Confirm, Header, Icon, Input, Message, Segment, Select} from "semantic-ui-react";
import {Janus} from "../../../lib/janus";
import {getDateString} from "../../../shared/tools";
import {captureException} from "../../../shared/sentry";
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
    msg_type: "private",
    messages: [],
    visible: false,
    input_value: "",
    showConfirmBroadcast: false,
  };

  componentDidMount() {
    document.addEventListener("keydown", this.onKeyPressed);
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.onKeyPressed);
  }

  onConfirmBroadcast = (sure) => {
    this.setState({showConfirmBroadcast: false});
    if (sure) this.sendBroadcastMessage();
  };

  initGateways = () => {
    const {gateways} = this.props;
    console.log("[Admin] [ChatBox] initGateways", gateways);

    Promise.all(
      Object.values(gateways).map((gateway) => {
        if (gateway.chatroom) {
          return Promise.resolve();
        }
        return gateway
          .initChatRoom((data) => this.onChatData(gateway, data))
          .catch((error) => {
            console.error("[Admin] [ChatBox] gateway.initChatRoom error", gateway.name, error);
            captureException(error, {source: "AdminRoot ChatBox", gateway: gateway.name});
            throw error;
          });
      })
    )
      .then(() => {
        if (!!this.props.onChatRoomsInitialized) {
          this.props.onChatRoomsInitialized();
        }
      })
      .catch((error) => {
        console.error("[Admin] [ChatBox] error initializing gateways", error);
        captureException(error, {source: "AdminRoot ChatBox"});
        if (!!this.props.onChatRoomsInitialized) {
          this.props.onChatRoomsInitialized(error);
        }
      });
  };

  onKeyPressed = (e) => {
    if (e.code === "Enter") this.sendMessage();
  };

  onChatData = (gateway, data) => {
    const json = JSON.parse(data);
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
        console.log("[Admin] [ChatBox] private message", gateway.name, from, message);
        let {messages} = this.state;
        messages.push(message);
        this.setState({messages});
        this.scrollToBottom();
      } else {
        // Public message
        console.log("[Admin] [ChatBox] public message", gateway.name, from, message);
        let {messages} = this.state;
        message.to = this.props.selected_group;
        messages.push(message);
        this.setState({messages});
        this.scrollToBottom();
      }
    } else if (what === "join") {
      gateway.log("[chatroom] Somebody joined", json["username"], json["display"]);
    } else if (what === "leave") {
      gateway.log("[chatroom] Somebody left", json["username"], getDateString());
    } else if (what === "kicked") {
      gateway.log("[chatroom] Somebody was kicked", json["username"], getDateString());
    } else if (what === "destroyed") {
      gateway.log("[chatroom] room destroyed", json["room"]);
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
    messages.push(msg);
    this.setState({input_value: ""}, this.scrollToBottom);
  };

  sendBroadcastMessage = () => {
    const {
      user: {role, display, username},
      selected_room,
    } = this.props;
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

  scrollToBottom = () => {
    this.refs.end.scrollIntoView({behavior: "smooth"});
  };

  handleInputChange = (e, data) => {
    this.setState({input_value: data.value});
  };

  render() {
    const {selected_user, selected_group, chatRoomsInitializedError} = this.props;
    const {messages, msg_type, input_value, showConfirmBroadcast} = this.state;
    const to = selected_user && selected_user.display ? selected_user.display : "Select User:";
    const group = selected_group ? selected_group : "Select Group:";

    const send_options = [
      {key: "all", text: "Everyone", value: "all"},
      {key: "public", text: group, value: "public"},
      {key: "private", text: to, value: "private"},
    ];

    const list_msgs = messages.map((msg, i) => {
      const {user, time, text, to} = msg;
      return (
        <div key={i}>
          <p>
            <i style={{color: "grey"}}>{time}</i> -
            <b style={{color: user.role === "admin" ? "red" : "blue"}}>{user.username}</b>
            {to ? <b style={{color: "blue"}}>-> {to} :</b> : ""}
          </p>
          {text}
        </div>
      );
    });

    return (
      <Segment className="chat_segment" disabled={chatRoomsInitializedError} error>
        <Message className="messages_list" error={chatRoomsInitializedError}>
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
          disabled={chatRoomsInitializedError}
          error={chatRoomsInitializedError}
        >
          <input />
          <Select
            options={send_options}
            value={msg_type}
            error={msg_type === "all"}
            disabled={chatRoomsInitializedError}
            onChange={(e, {value}) => this.setState({msg_type: value})}
          />
          <Button
            positive
            negative={msg_type === "all"}
            onClick={this.sendMessage}
            disabled={chatRoomsInitializedError}
          >
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

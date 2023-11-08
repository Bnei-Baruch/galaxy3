import React, {Component, Fragment} from "react";
import {Button, Confirm, Header, Icon, Label, Divider, Segment, Select, TextArea} from "semantic-ui-react";
import {randomString} from "../../shared/tools";
import mqtt from "../../shared/mqtt";
import log from "loglevel";

class NotificationManager extends Component {

  state = {
    msg_type: "test",
    message: {en: "", ru: "", he: "", es: ""},
    visible: false,
    release: {},
    show_confirm: false,
  };

  componentDidMount() {
    //this.props.onRef(this);
    this.initMQTT(this.props.user);
    document.addEventListener("keydown", this.onKeyPressed);
  }

  componentWillUnmount() {
    document.removeEventListener("keydown", this.onKeyPressed);
    //this.props.onRef(undefined);
  }

  initMQTT = (user) => {
    mqtt.init(user, (data) => {
      console.log("[Admin] mqtt init: ", data);
      mqtt.join("galaxy/users/notification");
      mqtt.join("galaxy/users/notification_test");
      mqtt.watch(() => {});
      this.initChatEvents()
    });
  };

  initChatEvents = () => {
    // Broadcast message
    mqtt.mq.on("MqttTestMessage", (data) => {
      let message = JSON.parse(data);
      log.info(message)
      this.setState({message: message.text})
    });

    // Notification message
    mqtt.mq.on("MqttNotificationMessage", (data) => {
      let message = JSON.parse(data);
      log.info(message)
      this.setState({release: message})
    });
  };

  onKeyPressed = (e) => {
    let {msg_type} = this.state;
    if (e.code === "Enter" && msg_type !== "prod") this.newChatMessage();
  };

  newTestMessage = () => {
    const {user: {role, display, id}, selected_room, selected_user} = this.props;
    let {message, msg_type} = this.state;

    if (msg_type === "prod") {
      this.setState({show_confirm: true});
      return;
    }

    const msg = {user: {id, role, display}, id: randomString(7), type: "broadcast-message", text: message};
    const topic = "galaxy/users/notification_test";

    mqtt.send(JSON.stringify(msg), true, topic);
    console.log(msg)
    this.setState({input_value: ""});
  };

  newReleaseMessage = () => {
    const {user: {role, display, username}} = this.props;
    const {message} = this.state;

    const msg = {user: {role, display, username}, id: randomString(7), type: "broadcast-message", text: message};

    this.setState({show_confirm: false});
    mqtt.send(JSON.stringify(msg), true, `galaxy/users/notification`);
  };

  scrollToBottom = () => {
    if(this.refs?.end)
      this.refs.end.scrollIntoView({behavior: "smooth"});
  };

  handleInputChange = (e, data) => {
    this.setState({input_value: data.value});
  };

  changeContent = (lang, text) => {
    const {message} = this.state;
    message[lang] = text;
    this.setState({message});
  }

  render() {
    const {message, msg_type, input_value, show_confirm} = this.state;

    const send_options = [
      {key: "test", text: "Test", value: "test"},
      {key: "prod", text: "Release", value: "prod"},
    ];

    const content_list = Object.keys(message).map(k => {
      return (
        <Segment>
          <Label attached horizontal color='blue' >{k}</Label><Divider />
          <TextArea style={{ minWidth: "100%" }} rows={3} value={message[k]} onChange={(e) => this.changeContent(k, e.target.value)} />
        </Segment>
      )
    })

    return (
      <Fragment>
        {content_list}
      <Segment>
        <Select
          options={send_options}
          value={msg_type}
          error={msg_type === "prod"}
          onChange={(e, {value}) => this.setState({msg_type: value})}
        />
        <Button positive negative={msg_type === "prod"} onClick={this.newTestMessage} content="Send" />
        <Confirm
          open={show_confirm}
          header={
            <Header>
              <Icon name="warning circle" color="red" />
              Caution
            </Header>
          }
          content="Are you sure you want to release ntification?"
          onCancel={() => this.setState({show_confirm: false})}
          onConfirm={this.newReleaseMessage}
        />
      </Segment>
      </Fragment>
    );
  }
}

export default NotificationManager;

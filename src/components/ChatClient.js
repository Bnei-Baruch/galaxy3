import React, { Component } from 'react';
import { Janus } from "../lib/janus";
import {Segment, Message, Button, Input} from "semantic-ui-react";
import {initChatRoom,getDateString,joinChatRoom} from "../shared/tools";


class ChatClient extends Component {

    state = {
        ...this.props,
        chatroom: null,
        input_value: "",
        messages: [],
    };

    componentDidMount() {
        document.addEventListener("keydown", this.onKeyPressed);
    };

    componentWillUnmount() {
        document.removeEventListener("keydown", this.onKeyPressed);
    };

    componentDidUpdate(prevProps) {
        //Janus.log(" -- componentDidUpdate -- ",prevProps)
        if (prevProps.janus !== this.state.janus) {
            this.setState({janus: prevProps.janus})
            Janus.log(" -- Janus was updated");
            initChatRoom(prevProps.janus, null, chatroom => {
                Janus.log(":: Got Chat Handle: ", chatroom);
                this.setState({chatroom});
            }, data => {
                this.onData(data);
            });
        }
        if (prevProps.room !== this.state.room) {
            Janus.log(" -- Room was updated");
            let {user,chatroom,room} = this.state;
            if(prevProps.room === "") {
                this.exitRoom(room);
            } else {
                joinChatRoom(chatroom,prevProps.room,user)
            }
            this.setState({room: prevProps.room});
        }
    };

    onKeyPressed = (e) => {
        if(e.code === "Enter")
            this.sendDataMessage();
    };

    exitRoom = (room) => {
        let {chatroom} = this.state;
        let chatreq = {textroom : "leave", transaction: Janus.randomString(12),"room": room};
        chatroom.data({text: JSON.stringify(chatreq),
            success: () => {
                Janus.log(":: Text room leave callback: ");
                this.setState({messages:[]});
            }
        });
    };

    onData = (data) => {
        Janus.log(":: We got message from Data Channel: ",data);
        var json = JSON.parse(data);
        // var transaction = json["transaction"];
        // if (transactions[transaction]) {
        //     // Someone was waiting for this
        //     transactions[transaction](json);
        //     delete transactions[transaction];
        //     return;
        // }
        var what = json["textroom"];
        if (what === "message") {
            // Incoming message: public or private?
            var msg = json["text"];
            msg = msg.replace(new RegExp('<', 'g'), '&lt');
            msg = msg.replace(new RegExp('>', 'g'), '&gt');
            var from = json["from"];
            var dateString = getDateString(json["date"]);
            var whisper = json["whisper"];
            if (whisper === true) {
                // Private message
                Janus.log("-:: It's private message: "+dateString+" : "+from+" : "+msg)
            } else {
                // Public message
                let {messages} = this.state;
                //let message = dateString+" : "+from+" : "+msg;
                let message = JSON.parse(msg);
                message.time = dateString;
                Janus.log("-:: It's public message: "+message);
                messages.push(message);
                this.setState({messages});
                if(this.props.visible) {
                    this.scrollToBottom();
                } else {
                    this.props.onNewMsg();
                }
            }
        } else if (what === "join") {
            // Somebody joined
            let username = json["username"];
            let display = json["display"];
            Janus.log("-:: Somebody joined - username: "+username+" : display: "+display)
        } else if (what === "leave") {
            // Somebody left
            let username = json["username"];
            //var when = new Date();
            Janus.log("-:: Somebody left - username: "+username+" : Time: "+getDateString())
        } else if (what === "kicked") {
            // Somebody was kicked
            // var username = json["username"];
        } else if (what === "destroyed") {
            let room = json["room"];
            Janus.log("The room: "+room+" has been destroyed")
        }
    };

    sendDataMessage = () => {
        let {input_value, user} = this.state;
        let msg = {user, text: input_value};
        let message = {
            textroom: "message",
            transaction: Janus.randomString(12),
            room: this.state.room,
            text: JSON.stringify(msg),
        };
        // Note: messages are always acknowledged by default. This means that you'll
        // always receive a confirmation back that the message has been received by the
        // server and forwarded to the recipients. If you do not want this to happen,
        // just add an ack:false property to the message above, and server won't send
        // you a response (meaning you just have to hope it succeeded).
        this.state.chatroom.data({
            text: JSON.stringify(message),
            error: (reason) => { alert(reason); },
            success: () => {
                Janus.log(":: Message sent ::");
                this.setState({input_value: ""});
            }
        });
    };

    scrollToBottom = () => {
        this.refs.end.scrollIntoView({ behavior: 'smooth' })
    };

    render() {

        const {messages} = this.state;

        let list_msgs = messages.map((msg,i) => {
            let {user,time,text} = msg;
            return (
                <div key={i}><p>
                    <i style={{color: 'grey'}}>{time}</i> -
                    <b style={{color: user.role === "admin" ? 'red' : 'blue'}}>{user.name}</b>:
                </p>{text}</div>
            );
        });

        return (
            <Segment fluid className="virtual_segment" >

                <Message className='messages_list' size='mini'>
                    {list_msgs}
                    <div ref='end' />
                </Message>

                <Input size='mini' fluid type='text' placeholder='Type your message' action value={this.state.input_value}
                       onChange={(v,{value}) => this.setState({input_value: value})}>
                    <input />
                    <Button size='mini' positive onClick={this.sendDataMessage}>Send</Button>
                </Input>

            </Segment>
        );

    }
}

export default ChatClient;
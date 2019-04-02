import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Message, Button, Input} from "semantic-ui-react";
import {initChatRoom,getDateString,joinChatRoom,notifyMe} from "../../shared/tools";
//import {SHIDUR_ID} from "../../shared/consts";


class GroupChat extends Component {

    state = {
        room: 1234,
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

    initChat = (janus) => {
        initChatRoom(janus, null, chatroom => {
            Janus.log(":: Got Chat Handle: ", chatroom);
            this.setState({chatroom});
        }, data => {
            this.onData(data);
        });
    };

    initChatRoom = (user) => {
        joinChatRoom(this.state.chatroom,1234,user);
    };

    onKeyPressed = (e) => {
        if(e.code === "Enter")
            this.sendChatMessage();
    };

    exitChatRoom = (room) => {
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
                    notifyMe("Shidur",message.text,true);
                    this.props.onNewMsg();
                }
            } else {
                // Public message
                // let {messages} = this.state;
                // //let message = dateString+" : "+from+" : "+msg;
                // let message = JSON.parse(msg);
                // message.time = dateString;
                // Janus.log("-:: It's public message: "+message);
                // messages.push(message);
                // this.setState({messages});
                // if(this.props.visible) {
                //     this.scrollToBottom();
                // } else {
                //     this.props.onNewMsg();
                // }
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

    sendChatMessage = () => {
        let {input_value} = this.state;
        let {user} = this.props;
        let msg = {user, text: input_value};
        let message = {
            textroom: "message",
            transaction: Janus.randomString(12),
            room: this.state.room,
            //to: `${SHIDUR_ID}`,
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
                //FIXME: it's directly put to message box
                let {messages} = this.state;
                msg.time = getDateString();
                Janus.log("-:: It's public message: "+msg);
                messages.push(msg);
                this.setState({messages, input_value: ""});
                this.scrollToBottom();
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
            let name = user.display || user.username;
            return (
                <div key={i}><p>
                    <i style={{color: 'grey'}}>{time}</i> -
                    <b style={{color: user.role === "admin" ? 'red' : 'blue'}}>{name}</b>:
                </p>{text}</div>
            );
        });

        return (
            <div className="chat-panel" >
                {/* <div className="chat" > */}
                <Message className='messages_list'>
                    <div className="messages-wrapper">
                        {list_msgs}
                        <div ref='end' />
                    </div>

                </Message>

                <Input fluid type='text' placeholder='Type your message' action value={this.state.input_value}
                       onChange={(v,{value}) => this.setState({input_value: value})}>
                    <input />
                    <Button positive onClick={this.sendChatMessage}>Send</Button>
                </Input>
                {/* </div> */}
            </div>
        );

    }
}

export default GroupChat;
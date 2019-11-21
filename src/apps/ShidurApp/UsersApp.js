import React, { Component } from 'react';
import { Janus } from "../../lib/janus";
import {Segment} from "semantic-ui-react";
import {getState, putData, initJanus} from "../../shared/tools";
import './ShidurUsers.css'
import './VideoConteiner.scss'
import {initGxyProtocol} from "../../shared/protocol";
import UsersQuad from "./UsersQuad";

class UsersApp extends Component {

    state = {
        janus: null,
        protocol: null,
        feeds: [],
        user: {
            session: 0,
            handle: 0,
            role: "shidur",
            display: "shidur",
            id: Janus.randomString(10),
            name: "shidur"
        },
        users: {},
    };

    componentDidMount() {
        initJanus(janus => {
            let {user} = this.state;
            user.session = janus.getSessionId();
            this.setState({janus,user});
            //this.initVideoRoom(null, "preview");

            initGxyProtocol(janus, user, protocol => {
                this.setState({protocol});
            }, ondata => {
                Janus.log("-- :: It's protocol public message: ", ondata);
                this.onProtocolData(ondata);
            });
        },er => {}, true);
    };

    componentWillUnmount() {
        this.state.janus.destroy();
    };

    subscribeTo = (h, subscription) => {
        // New feeds are available, do we need create a new plugin handle first?
        if (this.state[h].remoteFeed) {
            this.state[h].remoteFeed.send({message:
                    {request: "subscribe", streams: subscription}
            });
            return;
        }
        // We don't have a handle yet, but we may be creating one already
        if (this.state[h].creatingFeed) {
            // Still working on the handle
            setTimeout(() => {
                this.subscribeTo(h, subscription);
            }, 500);
        } else {
            // We don't creating, so let's do it
            this.setState({[h]: {...this.state[h], creatingFeed: true}});
            this.newRemoteFeed(h, subscription);
        }
    };

    unsubscribeFrom = (h, id) => {
        // Unsubscribe from this publisher
        let {feeds,users,feedStreams} = this.state[h];
        let {remoteFeed} = this.state[h];
        for (let i=0; i<feeds.length; i++) {
            if (feeds[i].id === id) {
                Janus.log("Feed " + feeds[i] + " (" + id + ") has left the room, detaching");
                delete users[feeds[i].display.id];
                delete feedStreams[id];

                feeds.splice(i, 1);
                // Send an unsubscribe request
                let unsubscribe = {
                    request: "unsubscribe",
                    streams: [{ feed: id }]
                };
                if(remoteFeed !== null)
                    remoteFeed.send({ message: unsubscribe });
                this.setState({[h]:{...this.state[h], feeds,users,feedStreams}});
                break
            }
        }
    };

    onProtocolData = (data) => {
        let {users} = this.state;

        // Set status in users list
        if(data.type.match(/^(camera|question|sound-test)$/)) {
            if(users[data.user.id]) {
                users[data.user.id][data.type] = data.status;
                this.setState({users});
            } else {
                users[data.user.id] = {[data.type]: data.status};
                this.setState({users});
            }
        }

        if(data.type === "leave" && users[data.id]) {
            delete users[data.id];
            this.setState({users});
        }
    };


    render() {
        const {users} = this.state;


        return (

            <Segment className="users_container">
                <UsersQuad {...this.state} />
            </Segment>
        );
    }
}

export default UsersApp;

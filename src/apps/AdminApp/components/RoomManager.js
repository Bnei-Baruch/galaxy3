import React, {Component} from 'react';
import {Button, Input, Menu, Message, Select} from "semantic-ui-react";
import {Janus} from "../../../lib/janus";
import {JANUS_GATEWAYS, SECRET} from "../../../shared/consts";

const bitrate_options = [
    {key: 0, text: '64Kb/s', value: 64000},
    {key: 1, text: '128Kb/s', value: 128000},
    {key: 2, text: '300Kb/s', value: 300000},
    {key: 3, text: '600Kb/s', value: 600000},
];

class RoomManager extends Component {

    /*
        props:
            gateways: {},
    */

    state = {
        bitrate: 128000,
        current_gateway: "",
        rooms_list: {},
        current_room: "",
        room_id: "",
        description: "",
    };

    componentDidMount() {
        this.initGateways();
    };

    componentDidUpdate(prevProps) {
        if (prevProps.gateways !== this.props.gateways) {
            this.initGateways();
        }
    }

    initGateways = () => {
        const {gateways} = this.props;
        console.log("[Admin] [RoomManager] initGateways", gateways);

        Object.values(gateways).forEach(gateway => {
            if (!gateway.videoroom) {
                gateway.initVideoRoom()
                    .catch(err => {
                        console.error("[Admin] [RoomManager] gateway.initVideoRoom error", gateway.name, err);
                    });
            }
        });
    };

    getRoomList = (gateway) => {
        console.log("[Admin] [RoomManager] getRoomList", gateway.name);

        if (!gateway.videoroom) {
            console.error("[Admin] [RoomManager] getRoomList gateway videoroom not initialized", gateway);
            return;
        }

        gateway.send("videoroom", "list", gateway.videoroom, {request: "list"})
            .then(data => {
                let rooms_list = data.list;
                rooms_list.sort((a, b) => {
                    if (a.description > b.description) return 1;
                    if (a.description < b.description) return -1;
                    return 0;
                });

                this.setState({
                        rooms_list: {
                            ...this.state.rooms_list,
                            [gateway.name]: rooms_list,
                        }
                    }
                );
            });
    };

    selectRoom = (e, data) => {
        const {rooms_list, current_gateway} = this.state;
        this.setState({room_id: rooms_list[current_gateway][data.value].room});
    };

    selectJanusInstance = (e, data) => {
        this.setState({current_gateway: data.value});
        this.getRoomList(this.props.gateways[data.value]);
    };

    handleBitrateChange = (e, data) => {
        this.setState({bitrate: data.value});
    };

    handleDescriptionChange = (e, data) => {
        this.setState({description: data.value});
    };

    getRoomID = () => {
        const {rooms_list, current_gateway} = this.state;
        const roomIDs = new Set((rooms_list[current_gateway] || []).map(x => x.room));
        let id = 2100;
        for (let i = id; i < 9999; i++) {
            if (!roomIDs.has(i)) {
                return i;
            }
        }
    };

    createChatRoom = (gateway, room, description) => {
        return gateway.data("chatroom", gateway.chatroom, {
            textroom: "create",
            room,
            transaction: Janus.randomString(12),
            secret: `${SECRET}`,
            description,
            is_private: false,
            permanent: true
        });
    };

    removeChatRoom = (gateway, room) => {
        return gateway.data("chatroom", gateway.chatroom, {
            textroom: "destroy",
            room,
            transaction: Janus.randomString(12),
            secret: `${SECRET}`,
            permanent: true,
        });
    };

    createRoom = () => {
        const {gateways} = this.props;
        const {current_gateway, bitrate, description} = this.state;
        const gateway = gateways[current_gateway];

        const room = this.getRoomID();
        console.log("[Admin] [RoomManager] createRoom", current_gateway, room, bitrate, description);

        gateway.send("videoroom", "create", gateway.videoroom, {
            request: "create",
            room,
            description,
            secret: `${SECRET}`,
            publishers: 20,
            bitrate,
            fir_freq: 10,
            audiocodec: "opus",
            videocodec: "h264",
            audiolevel_event: true,
            audio_level_average: 100,
            audio_active_packets: 25,
            record: false,
            is_private: false,
            permanent: true,
        })
            .then(() => {
                this.getRoomList(gateway);
                return this.createChatRoom(gateway, room, description);
            })
            .then(() => {
                this.setState({description: ""});
                console.log("[Admin] [RoomManager] createRoom success");
                alert(`Room ${room} created on ${gateway.name}`);
            })
            .catch(err => {
                console.error("[Admin] [RoomManager] createRoom error", err);
                alert(`Error creating room ${room} on ${gateway.name}: ${err}`);
            });
    };

    removeRoom = () => {
        const {gateways} = this.props;
        const {room_id, current_gateway} = this.state;
        const gateway = gateways[current_gateway];

        console.log("[Admin] [RoomManager] removeRoom", current_gateway, room_id);

        gateway.send("videoroom", "destory", gateway.videoroom, {
            request: "destroy",
            room: room_id,
            secret: `${SECRET}`,
            permanent: true,
        })
            .then(() => {
                this.getRoomList(gateway);
                return this.removeChatRoom(gateway, room_id);
            })
            .then(() => {
                console.log("[Admin] [RoomManager] removeRoom success");
                alert(`Room ${room_id} removed from ${gateway.name}`);
            })
            .catch(err => {
                console.error("[Admin] [RoomManager] removeRoom error", err);
                alert(`Error removing room ${room_id} from ${gateway.name}: ${err}`);
            });
    };

    render() {
        const {bitrate, rooms_list, current_gateway, i, description, room_id} = this.state;

        const videorooms = (rooms_list[current_gateway] || []).map((data, i) => {
            const {room, num_participants, description} = data;
            return ({key: room, text: description, value: i, description: num_participants.toString()});
        });

        return (
            <Menu secondary>
                <Menu.Item>
                    <Message info content="Room management is pending new implementation"/>
                </Menu.Item>

                {/*<Menu.Item>*/}
                {/*    <Select placeholder="Janus instance"*/}
                {/*            value={current_gateway}*/}
                {/*            onChange={this.selectJanusInstance}*/}
                {/*            options={*/}
                {/*                JANUS_GATEWAYS.map((gateway) => ({*/}
                {/*                    key: gateway,*/}
                {/*                    text: gateway,*/}
                {/*                    value: gateway,*/}
                {/*                }))*/}
                {/*            }/>*/}
                {/*</Menu.Item>*/}
                {/*<Menu.Item>*/}
                {/*    <Button negative onClick={this.removeRoom}>Remove</Button>*/}
                {/*    :::*/}
                {/*    <Select*/}
                {/*        error={!!room_id}*/}
                {/*        scrolling*/}
                {/*        placeholder="Select Room:"*/}
                {/*        value={i}*/}
                {/*        options={videorooms}*/}
                {/*        onChange={this.selectRoom}/>*/}
                {/*</Menu.Item>*/}
                {/*<Menu.Item>*/}
                {/*    <Input type='text' placeholder='Room description...' action value={description}*/}
                {/*           onChange={this.handleDescriptionChange}>*/}
                {/*        <input/>*/}
                {/*        <Select*/}
                {/*            compact={true}*/}
                {/*            scrolling={false}*/}
                {/*            placeholder="Room Bitrate:"*/}
                {/*            value={bitrate}*/}
                {/*            options={bitrate_options}*/}
                {/*            onChange={this.handleBitrateChange}/>*/}
                {/*        <Button positive onClick={this.createRoom}>Create</Button>*/}
                {/*    </Input>*/}
                {/*</Menu.Item>*/}
            </Menu>
        );
    }
}

export default RoomManager;

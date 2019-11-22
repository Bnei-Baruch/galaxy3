import React, {Component, Fragment} from 'react';
import { Janus } from "../../lib/janus";
import {Segment, Table, Icon} from "semantic-ui-react";
import './ShidurToran.scss';
import UsersHandle from "./UsersHandle";
import {getPluginInfo} from "../../shared/tools";

class UsersToran extends Component {

    state = {
        janus: null,
        rooms: [],
        index: 0,
        disabled_rooms: [],
        group: null,
        preview: {
            feeds: [],
            feedStreams: {},
            mids: [],
            name: "",
            room: "",
            users: {}
            },
        protocol: null,
        myid: null,
        mypvtid: null,
        mystream: null,
        audio: null,
        muted: true,
        users: {},
    };

    componentDidMount() {
        setInterval(() => this.getRoomList(), 10000 );
        setInterval(() => this.chkDisabledRooms(), 10000 );
    };

    componentWillUnmount() {
        this.state.janus.destroy();
    };

    getRoomList = () => {
        const {disabled_rooms} = this.state;
        let req = {request: "list"};
        getPluginInfo(req, data => {
            let usable_rooms = data.response.list.filter(room => room.num_participants > 0);
            var newarray = usable_rooms.filter((room) => !disabled_rooms.find(droom => room.room === droom.room));
            newarray.sort((a, b) => {
                // if (a.num_participants > b.num_participants) return -1;
                // if (a.num_participants < b.num_participants) return 1;
                if (a.description > b.description) return 1;
                if (a.description < b.description) return -1;
                return 0;
            });
            this.getFeedsList(newarray)
        })
    };

    //FIXME: tmp solution to show count without service users in room list
    getFeedsList = (rooms) => {
        let {users} = this.state;
        rooms.forEach((room,i) => {
            if(room.num_participants > 0) {
                let req = {request: "listparticipants", "room": room.room};
                getPluginInfo(req, data => {
                    Janus.debug("Feeds: ", data);
                    let count = data.response.participants.filter(p => JSON.parse(p.display).role === "user");
                    let questions = data.response.participants.find(p => users[JSON.parse(p.display).id] ? users[JSON.parse(p.display).id].question : null);
                    rooms[i].num_participants = count.length;
                    rooms[i].questions = questions;
                    this.setState({rooms});
                })
            }
        });
    };

    chkDisabledRooms = () => {
        let {users,disabled_rooms} = this.state;
        for (let i=0; i<disabled_rooms.length; i++) {
            if(disabled_rooms[i].num_participants === 0) {
                disabled_rooms.splice(i, 1);
                this.setState({disabled_rooms});
                continue;
            }
            let req = {request: "listparticipants", "room": disabled_rooms[i].room};
            getPluginInfo(req, data => {
                Janus.debug("Feeds: ", data.response.participants);
                let count = data.response.participants.filter(p => JSON.parse(p.display).role === "user");
                let questions = data.response.participants.find(p => users[JSON.parse(p.display).id] ? users[JSON.parse(p.display).id].question : null);
                disabled_rooms[i].num_participants = count.length;
                disabled_rooms[i].questions = questions;
                this.setState({disabled_rooms});
            });
        }
    };

    attachToPreview = (group, index) => {
        let room = group.room;
        let name = group.description;
        let h = "preview";
        if(this.state.preview.room === room)
            return;
        if(this.state.preview.videoroom) {
            let leave_room = {request : "leave", "room": this.state.preview.room};
            this.state.preview.videoroom.send({"message": leave_room});
        }
        Janus.log(" :: Attaching to Preview: ",group);
        this.setState({[h]:{...this.state[h], feeds: [], room, name, index}});
        //this.initVideoRoom(room, "preview");
    };

    selectGroup = (group, i) => {
        group.index = i;
        this.setState({group});
        Janus.log(group);
        let room = group.room;
        let name = group.description;
        this.users.initVideoRoom(room, "program");
        //this.attachToPreview(group, i);
    };

    disableRoom = (e, data, i) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            let {disabled_rooms} = this.state;
            disabled_rooms.push(data);
            this.setState({disabled_rooms});
            this.getRoomList();
        }
    };

    restoreRoom = (e, data, i) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            let {disabled_rooms} = this.state;
            for(let i = 0; i < disabled_rooms.length; i++){
                if(disabled_rooms[i].room === data.room) {
                    disabled_rooms.splice(i, 1);
                    this.setState({disabled_rooms});
                    this.getRoomList();
                }
            }
        }
    };


  render() {
      const {preview,disabled_rooms,rooms,users} = this.state;
      const q = (<b style={{color: 'red', fontSize: '20px', fontFamily: 'Verdana', fontWeight: 'bold'}}>?</b>);

      let rooms_list = rooms.map((data,i) => {
          const {room, num_participants, description, questions} = data;
          return (
              <Table.Row
                         positive={preview.name === description}
                         disabled={num_participants === 0}
                         className={preview.room === room ? 'active' : 'no'}
                         key={room} onClick={() => this.selectGroup(data, i)}
                         onContextMenu={(e) => this.disableRoom(e, data, i)} >
                  <Table.Cell width={5}>{description}</Table.Cell>
                  <Table.Cell width={1}>{num_participants}</Table.Cell>
                  <Table.Cell width={1}>{questions ? q : ""}</Table.Cell>
              </Table.Row>
          )
      });

      let disabled_list = disabled_rooms.map((data,i) => {
          const {room, num_participants, description, questions} = data;
          return (
              <Table.Row key={room} warning
                         onClick={() => this.selectGroup(data, i)}
                         onContextMenu={(e) => this.restoreRoom(e, data, i)} >
                  <Table.Cell width={5}>{description}</Table.Cell>
                  <Table.Cell width={1}>{num_participants}</Table.Cell>
                  <Table.Cell width={1}>{questions ? q : ""}</Table.Cell>
              </Table.Row>
          )
      });

      return (
          <Fragment>
              <Segment className="preview_conteiner" color='green' >
                  <div className="shidur_overlay"><span>{preview.name}</span></div>
                  <UsersHandle ref={users => {this.users = users;}} {...this.props} />
              </Segment>
              <Segment textAlign='center' className="users_list" raised>
                  <Table selectable compact='very' basic structured className="admin_table" unstackable>
                      <Table.Body>
                          {rooms_list}
                      </Table.Body>
                  </Table>
              </Segment>
              <Segment textAlign='center' className="disabled_users">
                  <Table selectable compact='very' basic structured className="admin_table" unstackable>
                      <Table.Body>
                          {disabled_list}
                      </Table.Body>
                  </Table>
              </Segment>
          </Fragment>
      );
  }
}

export default UsersToran;

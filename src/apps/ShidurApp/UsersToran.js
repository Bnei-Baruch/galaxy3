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
        protocol: null,
    };

    componentDidMount() {
    };

    componentDidUpdate(prevProps) {
        if(this.props.group === null && prevProps.group) {
            this.users.exitVideoRoom(prevProps.group.room, "program");
        }
    }

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
        this.props.setProps({group});
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
      const {group,disabled_rooms,groups,users} = this.props;
      const q = (<b style={{color: 'red', fontSize: '20px', fontFamily: 'Verdana', fontWeight: 'bold'}}>?</b>);

      let rooms_list = groups.map((data,i) => {
          const {room, num_participants, description, questions} = data;
          return (
              <Table.Row
                         positive={group && group.description === description}
                         // disabled={num_participants === 0}
                         className={group && group.room === room ? 'active' : 'no'}
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
                  <div className="shidur_overlay"><span>{group ? group.description : ""}</span></div>
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

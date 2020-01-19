import React, {Component, Fragment} from 'react';
import { Janus } from "../../lib/janus";
import {Dropdown, Label, Popup, Segment, Table} from "semantic-ui-react";
import './ShidurToran.scss';
import UsersPreview from "./UsersPreview";

class UsersToran extends Component {

    state = {
        index: 0,
        group: null,
        sorted_feeds: [],
    };

    selectGroup = (group, i) => {
        Janus.log(group, i);
        this.setState({pg: group});
        group.queue = i;
        this.props.setProps({group});
    };

    closePopup = () => {
        this.props.setProps({group: null});
    };

    disableRoom = (e, data, i) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            let {disabled_rooms} = this.props;
            let group = disabled_rooms.find(r => r.room === data.room);
            if(group) return;
            disabled_rooms.push(data);
            this.props.setProps({disabled_rooms});
            this.props.gerGroups();
        }
    };

    restoreRoom = (e, data, i) => {
        e.preventDefault();
        if (e.type === 'contextmenu') {
            let {disabled_rooms} = this.props;
            for(let i = 0; i < disabled_rooms.length; i++){
                if(disabled_rooms[i].room === data.room) {
                    disabled_rooms.splice(i, 1);
                    this.props.setProps({disabled_rooms});
                    this.props.gerGroups();
                }
            }
        }
    };

    sortGroups = () => {
        let sorted_feeds = this.props.groups.slice();
        sorted_feeds.sort((a, b) => {
            if (a.description > b.description) return 1;
            if (a.description < b.description) return -1;
            return 0;
        });
        this.setState({sorted_feeds});
    };

  render() {
      const {group,disabled_rooms,groups,groups_queue} = this.props;
      const q = (<b style={{color: 'red', fontSize: '20px', fontFamily: 'Verdana', fontWeight: 'bold'}}>?</b>);
      const next_group = groups[groups_queue] ? groups[groups_queue].description : groups[0] ? groups[0].description : "";

      let rooms_list = groups.map((data,i) => {
          const {room, num_users, description, questions} = data;
          const next = data.description === next_group;
          const active = group && group.room === room;
          return (
              <Popup className='popup_preview' on='click'
                     position='right center'
                     onClose={this.closePopup}
                     trigger={
              <Table.Row positive={group && group.description === description}
                         className={active ? 'active' : next ? 'warning' : 'no'}
                         key={room}
                         onClick={() => this.selectGroup(data, i)}
                         onContextMenu={(e) => this.disableRoom(e, data, i)} >
                  <Table.Cell width={5}>{description}</Table.Cell>
                  <Table.Cell width={1}>{num_users}</Table.Cell>
                  <Table.Cell width={1}>{questions ? q : ""}</Table.Cell>
              </Table.Row>}><Segment className="preview_conteiner" color='green' >
                  <div className="shidur_overlay"><span>{group ? group.description : ""}</span></div>
                  <UsersPreview pg={this.state.pg} {...this.props} />
              </Segment></Popup>
          )
      });

      let disabled_list = disabled_rooms.map((data,i) => {
          const {room, num_users, description, questions} = data;
          return (
              <Popup className='popup_preview' on='click'
                     position='right center'
                     onClose={this.closePopup}
                     trigger={
                  <Table.Row key={room} error
                             onClick={() => this.selectGroup(data, i)}
                             onContextMenu={(e) => this.restoreRoom(e, data, i)} >
                      <Table.Cell width={5}>{description}</Table.Cell>
                      <Table.Cell width={1}>{num_users}</Table.Cell>
                      <Table.Cell width={1}>{questions ? q : ""}</Table.Cell>
                  </Table.Row>}><Segment className="preview_conteiner" color='green' >
                  <div className="shidur_overlay"><span>{group ? group.description : ""}</span></div>
                  <UsersPreview pg={this.state.pg} {...this.props} />
              </Segment></Popup>
          )
      });

      let group_options = this.state.sorted_feeds.map((feed,i) => {
          const display = feed.description;
          return ({ key: i, value: feed, text: display })
      });

      return (
          <Fragment>
              <Segment attached textAlign='center' >
                  <Label attached='top right' color={groups.length > 4 ? 'green' : 'grey'}>
                      Online: {groups.length}
                  </Label>
                  <Dropdown className='select_group'
                            placeholder='Search..'
                            fluid
                            search
                            selection
                            options={group_options}
                            onClick={this.sortGroups}
                            onChange={(e,{value}) => this.selectGroup(value)} />
                  <Label attached='top left' color={groups.length > 4 ? 'blue' : 'grey'} >
                      Next: {next_group}
                  </Label>
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

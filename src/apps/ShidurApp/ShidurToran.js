import React, {Component} from 'react';
import {Janus} from "../../lib/janus";
import {Grid, Label, Message, Segment, Table, Icon, Button, Dropdown, Popup} from "semantic-ui-react";
import './ShidurToran.scss';
import UsersPreview from "./UsersPreview";


class ShidurToran extends Component {

    state = {
        index: 0,
        group: null,
        open: false,
        sorted_feeds: [],
        pg: null,
    };

    componentDidUpdate(prevProps) {
        let {group} = this.props;
        if(prevProps.group !== group && group === null) {
            this.setState({open: false});
        }
    }

    selectGroup = (group, i) => {
        Janus.log(group, i);
        this.setState({pg: group, open: true});
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

    savePreset = () => {
        let {presets,group} = this.props;

        // First group to preset
        if(presets.length === 0) {
            delete group.users;
            presets[0] = group;
            this.props.setProps({presets});
            return
        }

        //Don't allow group be twice in presets
        for(let i=0; i<presets.length; i++) {
            //remove from presets
            if(presets[i].room === group.room) {
                presets.splice(i, 1);
                this.props.setProps({presets});
                return
            }
        }

        // Presets is full
        if(presets.length === 4)
            return;

        //Add to presets
        delete group.users;
        presets.push(group);
        this.props.setProps({presets});

        Janus.log(presets)
    };

    previewQuestion = () => {
        let {questions} = this.props;
        if(questions.length > 0)
            this.selectGroup(questions[0], null);
    };

    render() {

        const {group,disabled_rooms,groups,groups_queue,questions,presets,users} = this.props;
        const {open} = this.state;
        const q = (<b style={{color: 'red', fontSize: '20px', fontFamily: 'Verdana', fontWeight: 'bold'}}>?</b>);
        const next_group = groups[groups_queue] ? groups[groups_queue].description : groups[0] ? groups[0].description : "";

        let rooms_list = groups.map((data,i) => {
            const {room, num_users, description, questions} = data;
            const next = data.description === next_group;
            const active = group && group.room === room;
            const pr = presets.find(pst => pst.room === room);
            const p = pr ? (<Label size='mini' color='teal' >4</Label>) : "";
            return (
                <Table.Row positive={group && group.description === description}
                           className={active ? 'active' : next ? 'warning' : 'no'}
                           key={room}
                           onClick={() => this.selectGroup(data, i)}
                           onContextMenu={(e) => this.disableRoom(e, data, i)} >
                    <Table.Cell width={5}>{description}</Table.Cell>
                    <Table.Cell width={1}>{p}</Table.Cell>
                    <Table.Cell width={1}>{num_users}</Table.Cell>
                    <Table.Cell width={1}>{questions ? q : ""}</Table.Cell>
                </Table.Row>
            )
        });

        let disabled_list = disabled_rooms.map((data,i) => {
            const {room, num_users, description, questions} = data;
            return (
                <Table.Row key={room} error
                           onClick={() => this.selectGroup(data, i)}
                           onContextMenu={(e) => this.restoreRoom(e, data, i)} >
                    <Table.Cell width={5}>{description}</Table.Cell>
                    <Table.Cell width={1}>{num_users}</Table.Cell>
                    <Table.Cell width={1}>{questions ? q : ""}</Table.Cell>
                </Table.Row>
            )
        });

        let group_options = this.state.sorted_feeds.map((feed,i) => {
            const display = feed.description;
            return ({ key: i, value: feed, text: display })
        });

        let preset4 = presets.map((data,i) => {
            const {room,description} = data;
            return (<p key={room}>{description}</p>)
        });


        return (
            <Grid.Row>
                <Grid.Column>
                    <Segment className="preview_conteiner">
                        <Segment className="group_segment" color='blue'>
                            {/*{nextfeed}*/}
                        </Segment>
                    </Segment>
                    <Message attached className='info-panel' color='grey'>
                        {/*{action_log}*/}
                        <div ref='end' />
                    </Message>
                    <Button.Group attached='bottom' >
                        <Button
                            // color={sndman ? "green" : "red"}
                            // disabled={!sndman || feeds.length < 13}
                            onClick={() => this.sdiAction("restart_sndman", false, 1, this.props.mids)}>
                            SndMan</Button>
                        <Button
                            // color={sdiout ? "green" : "red"}
                            // disabled={!sdiout || feeds.length < 13}
                            onClick={() => this.sdiAction("restart_sdiout", false, 1, this.props.mids)}>
                            SdiOut</Button>
                    </Button.Group>
                </Grid.Column>
                <Grid.Column>
                    <Segment attached textAlign='center' >
                        <Label attached='top right' color='green' >
                            Users: {Object.keys(users).length}
                        </Label>
                        <Dropdown className='select_group'
                                  placeholder='Search..'
                                  fluid
                                  search
                                  selection
                                  options={group_options}
                                  onClick={this.sortGroups}
                                  onChange={(e,{value}) => this.selectGroup(value)} />
                        <Label attached='top left' color='blue'>
                            Groups: {groups.length}
                        </Label>
                    </Segment>
                    <Button.Group attached='bottom' size='mini' >
                        <Popup trigger={<Button disabled color='teal' content='1' onClick={() => this.savePreset(0)} />} content={preset4} />
                        <Popup trigger={<Button disabled color='teal' content='2' onClick={() => this.savePreset(4)} />} content={preset4} />
                        <Popup trigger={<Button disabled color='teal' content='3' onClick={() => this.savePreset(8)} />} content={preset4} />
                    </Button.Group>
                    <Segment textAlign='center' className="group_list" raised >
                        <Table selectable compact='very' basic structured className="admin_table" unstackable>
                            <Table.Body>
                                {rooms_list}
                            </Table.Body>
                        </Table>
                    </Segment>
                    <Segment textAlign='center' >
                        <Button.Group attached='bottom' size='mini' >
                            <Button color={questions.length > 0 ? 'red' : 'grey'} onClick={this.previewQuestion} >Questions: {questions.length}</Button>
                        </Button.Group>
                    </Segment>
                </Grid.Column>
                <Grid.Column>
                    <Segment className="preview_conteiner">
                        {open ? <Segment className="group_segment" color='green'>
                                <div className="shidur_overlay"><span>{group ? group.description : ""}</span></div>
                                <UsersPreview pg={this.state.pg} {...this.props} closePopup={this.closePopup} />
                                </Segment> : ""}
                    </Segment>
                    <Segment textAlign='center' className="disabled_groups">
                        <Table selectable compact='very' basic structured className="admin_table" unstackable>
                            <Table.Body>
                                {disabled_list}
                            </Table.Body>
                        </Table>
                    </Segment>
                </Grid.Column>
            </Grid.Row>
        );
    }
}

export default ShidurToran;
import React, {Component, Fragment} from 'react';
import {
  Button,
  Confirm,
  Dropdown,
  Form,
  Header,
  Icon,
  Input,
  Menu,
  Message,
  Modal,
  Pagination,
  Table
} from 'semantic-ui-react'
import {debounce} from 'debounce';
import api from "../../../shared/Api";

const pageSize = 10;

// key should be up to 32 characters (DB column size)
const regions = {
  'petach-tikva': 'Petach Tikva',
  'israel': 'Israel',
  'russia': 'Russia',
  'ukraine': 'Ukraine',
  'europe': 'Europe',
  'asia': 'Asia',
  'north-america': 'North America',
  'latin-america': 'Latin America',
  'africa': 'Africa',
};

const regionOptions = Object.entries(regions).map(([value, text]) => ({value, text, key: value}));

class RoomManager extends Component {

    state = {
        data: [],
        total: 0,
        wip: false,
        err: null,
        pageNo: 1,
        currentRoom: null,
        gateways: [],
        filters: {},
        modals: {
            confirmRemoveRoom: false,
            createEditRoom: false,
        }
    };

    componentDidMount() {
        this.fetchGateways();
        this.fetchData();
    };

    fetchGateways = () => {
        api.adminFetchGateways({order_by: 'name'})
            .then(data => {
                const gateways = data.data.filter(x => x.type === 'rooms');
                this.setState({gateways});
            })
            .catch(err => {
                console.error("[Admin-Rooms] fetch gateways", err);
                this.setState({err});
            })
    }

    fetchData = () => {
        const {pageNo, filters} = this.state;
        console.debug("[Admin-Rooms] fetch rooms", pageNo, filters);
        const params = {
            page_no: pageNo,
            page_size: pageSize,
            order_by: 'name',
            ...filters,
        };

        this.setState({wip: true, err: null});
        api.adminFetchRooms(params)
            .then(data => this.setState(data))
            .catch(err => {
                console.error("[Admin-Rooms] fetch rooms", err);
                this.setState({err});
            }).finally(() => this.setState({wip: false}));
    };

    onPageChange = (e, data) => {
        this.setState({pageNo: data.activePage}, this.fetchData);
    }

    onFilterChangeGateway = (e, data) => {
        this.setState({pageNo: 1, filters: {...this.state.filters, gateway_id: data.value}}, this.fetchData);
    }

    onFilterChangeDisabled = (e, data) => {
        this.setState({pageNo: 1, filters: {...this.state.filters, disabled: data.value}}, this.fetchData);
    }

    onFilterChangeRemoved = (e, data) => {
        this.setState({pageNo: 1, filters: {...this.state.filters, removed: data.value}}, this.fetchData);
    }

    debouncedFetchData = () => {
        if (!this.debouncedFetchDataFn) {
            this.debouncedFetchDataFn = debounce(this.fetchData, 200);
        }
        this.debouncedFetchDataFn();
    }

    onFilterChangeSearch = (e, data) => {
        this.setState({pageNo: 1, filters: {...this.state.filters, term: data.value}}, this.debouncedFetchData);
    }

    onCreateRoom = (e, data) => {
        const {gateways} = this.state;
        this.setState({
            currentRoom: {default_gateway_id: gateways[0].id},
            modals: {createEditRoom: true},
            wip: false,
            err: null
        });
    }

    onEnableRoom = (e, data, room) => {
        this.doUpdateRoom({...room, disabled: false});
    }

    onDisableRoom = (e, data, room) => {
        this.doUpdateRoom({...room, disabled: true});
    }

    doUpdateRoom = (room) => {
        api.adminUpdateRoom(room.id, room)
            .then(this.fetchData)
            .catch(err => {
                console.error("[Admin-Rooms] update room", err);
                this.setState({err});
            });
    };

    onRemoveRoom = (e, data, room) => {
        this.setState({currentRoom: room, modals: {confirmRemoveRoom: true}});
    }

    doRemoveRoom = () => {
        const {currentRoom} = this.state;
        api.adminDeleteRoom(currentRoom.id)
            .then(() => {
                this.closeModal('confirmRemoveRoom');
                this.fetchData();
            })
            .catch(err => {
                console.error("[Admin-Rooms] delete room", err);
                this.setState({err});
            });
    }

    onEditRoom = (e, data, room) => {
        this.setState({
            currentRoom: room,
            modals: {
                createEditRoom: true,
            },
            wip: false,
            err: null,
        });
    }

    onCurrentRoomNameChange = (e, data) => {
        this.setState({
            currentRoom: {
                ...this.state.currentRoom,
                name: data.value,
            }
        });
    }

    onCurrentRoomGatewayChange = (e, data) => {
        this.setState({
            currentRoom: {
                ...this.state.currentRoom,
                default_gateway_id: data.value,
            }
        });
    }

    onCurrentRoomRegionChange = (e, data) => {
        this.setState({
          currentRoom: {
            ...this.state.currentRoom,
            region: data.value,
          }
        });
    }

    doSaveRoom = () => {
        const {currentRoom} = this.state;
        console.info("[Admin-Rooms] save room", currentRoom);

        let p;
        if (!!currentRoom.id) {
            p = api.adminUpdateRoom(currentRoom.id, currentRoom);
        } else {
            p = api.adminCreateRoom(currentRoom);
        }

        p.then(() => {
            this.closeModal('createEditRoom');
            this.fetchData();
        })
            .catch(err => {
                console.error(`[Admin-Rooms] save room [${!!currentRoom.id ? 'edit' : 'create'}]`, err);
                this.setState({err});
            });
    }

    closeModal = (modal) => {
        this.setState({
            modals: {
                ...this.state.modals,
                [modal]: false,
            }
        });
    }

    render() {
        const {pageNo, data, total, err, wip, currentRoom, modals, gateways} = this.state;

        const gatewayOptions = gateways.map(x => ({key: x.id, text: x.name, value: x.id}));
        const gatewaysByID = gateways.reduce((acc, x) => {
            acc[x.id] = x;
            return acc;
        }, {});

        return (
            <Fragment>
                <Menu secondary>
                    <Menu.Item icon='filter'/>

                    <Dropdown
                        item
                        multiple
                        selection
                        text='Gateway'
                        options={gatewayOptions}
                        onChange={this.onFilterChangeGateway}
                    />

                    <Dropdown
                        item
                        selection
                        placeholder='Disabled'
                        options={[
                            {key: 1, text: 'All', value: null},
                            {key: 2, text: 'Disabled', value: 'true'},
                            {key: 3, text: 'Enabled Only', value: 'false'},
                        ]}
                        onChange={this.onFilterChangeDisabled}
                    />

                    <Dropdown
                        item
                        selection
                        placeholder='Removed'
                        options={[
                            {key: 1, text: 'All', value: null},
                            {key: 2, text: 'Removed', value: 'true'},
                            {key: 3, text: 'Active Only', value: 'false'},
                        ]}
                        onChange={this.onFilterChangeRemoved}
                    />

                    <Menu.Item style={{flexGrow: 1}}>
                        <Input className='icon' icon='search' placeholder='Search...'
                               onChange={this.onFilterChangeSearch}/>
                    </Menu.Item>

                    <Menu.Menu position='right'>
                        <Menu.Item>
                            <Button
                                primary
                                content='Create New'
                                icon='add'
                                labelPosition='left'
                                onClick={this.onCreateRoom}
                            />
                        </Menu.Item>
                    </Menu.Menu>
                </Menu>

                {err ?
                    <Message negative>
                        <Message.Header>Unexpected error fetching data from server</Message.Header>
                        <p>{JSON.stringify(err)}</p>
                    </Message> :
                    null}

                <div style={{float: 'right', paddingRight: '1em'}}>
                    {wip ? <Icon loading name='spinner'/> : null}
                    <strong>{(pageNo - 1) * pageSize + 1}-{Math.min(total, pageNo * pageSize)}</strong>&nbsp;
                    of &nbsp;
                    <strong>{total}</strong>
                </div>
                <br/>

                <Table celled padded compact>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell>ID</Table.HeaderCell>
                            <Table.HeaderCell singleLine>Gateway</Table.HeaderCell>
                            <Table.HeaderCell singleLine>Gateway UID</Table.HeaderCell>
                            <Table.HeaderCell>Name</Table.HeaderCell>
                            <Table.HeaderCell>Region</Table.HeaderCell>
                            <Table.HeaderCell>Actions</Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>

                    <Table.Body>
                        {
                            data.map(x => {
                                const error = !!x.removed_at;
                                const warning = !error && !!x.disabled;
                                return (
                                    <Table.Row key={x.id} error={error} warning={warning}>
                                        <Table.Cell collapsing textAlign='center'>{x.id}</Table.Cell>
                                        <Table.Cell collapsing
                                                    textAlign='center'>{gatewaysByID[x.default_gateway_id]?.name}</Table.Cell>
                                        <Table.Cell collapsing textAlign='center'>{x.gateway_uid}</Table.Cell>
                                        <Table.Cell>
                                            {x.name}
                                            {!!x.removed_at ?
                                                <Header sub
                                                        size='tiny'
                                                        color='grey'
                                                        floated='right'>Removed At: {x.removed_at}</Header> :
                                                x.disabled ?
                                                    <Header sub
                                                            size='tiny'
                                                            color='grey'
                                                            floated='right'>Updated At: {x.updated_at}</Header> :
                                                    null
                                            }
                                        </Table.Cell>
                                      <Table.Cell collapsing textAlign='center'>{regions[x.region]}</Table.Cell>
                                        <Table.Cell collapsing textAlign='center'>
                                            <Button.Group basic>
                                                <Button
                                                    icon='edit'
                                                    title='edit'
                                                    onClick={(e, data) => this.onEditRoom(e, data, x)}
                                                />
                                                {x.disabled ?
                                                    <Button disabled={!!x.removed_at}
                                                            icon='play'
                                                            title='enable'
                                                            onClick={(e, data) => this.onEnableRoom(e, data, x)}/> :
                                                    <Button disabled={!!x.removed_at}
                                                            icon='pause'
                                                            title='disable'
                                                            onClick={(e, data) => this.onDisableRoom(e, data, x)}/>
                                                }
                                                <Button disabled={!!x.removed_at}
                                                        icon='trash alternate'
                                                        title='remove'
                                                        onClick={(e, data) => this.onRemoveRoom(e, data, x)}
                                                />
                                            </Button.Group>
                                        </Table.Cell>
                                    </Table.Row>
                                );
                            })
                        }
                    </Table.Body>

                    <Table.Footer>
                        <Table.Row>
                            <Table.HeaderCell colSpan='5'>
                                <Menu floated='right'>
                                    <Pagination
                                        activePage={pageNo}
                                        siblingRange={2}
                                        totalPages={Math.ceil(total / pageSize)}
                                        onPageChange={this.onPageChange}/>
                                </Menu>
                            </Table.HeaderCell>
                        </Table.Row>
                    </Table.Footer>
                </Table>

                <Confirm
                    open={modals.confirmRemoveRoom}
                    onCancel={() => this.closeModal('confirmRemoveRoom')}
                    onConfirm={this.doRemoveRoom}
                />

                {currentRoom ?
                    <Modal
                        open={modals.createEditRoom}
                        onClose={() => this.closeModal('createEditRoom')}
                        size='small'
                        closeIcon
                    >
                        <Header content='Room Details'/>
                        <Modal.Content>
                            <Form>
                                <Form.Field required>
                                    <label>Name</label>
                                    <Input
                                        value={currentRoom.name}
                                        onChange={this.onCurrentRoomNameChange}
                                        placeholder='Room name goes here'
                                    />
                                    <small> Up to 64 characters. </small>
                                </Form.Field>
                                <Form.Select
                                    label='Gateway'
                                    options={gatewayOptions}
                                    value={currentRoom.default_gateway_id}
                                    onChange={this.onCurrentRoomGatewayChange}
                                    required
                                />
                              <Form.Select
                                label='Region'
                                options={regionOptions}
                                value={currentRoom.region}
                                onChange={this.onCurrentRoomRegionChange}
                              />
                            </Form>
                            {err ?
                                <Message negative>
                                    <Message.Header>Unexpected error saving data to the server</Message.Header>
                                    <p>{JSON.stringify(err)}</p>
                                </Message> :
                                null}
                        </Modal.Content>
                        <Modal.Actions>
                            <Button onClick={() => this.closeModal('createEditRoom')}>
                                <Icon name='cancel'/> Cancel
                            </Button>
                            <Button primary onClick={this.doSaveRoom}>
                                <Icon name='save outline'/> Save
                            </Button>
                        </Modal.Actions>
                    </Modal>
                    : null}

            </Fragment>
        );
    }
}

export default RoomManager;

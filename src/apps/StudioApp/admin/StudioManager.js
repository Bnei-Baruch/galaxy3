// Studio tab of the admin: events (create / edit / activate), questions from the
// event rooms, guest on air, layout. All state lives in retained MQTT (studio.js).
import React, {Component} from "react";
import {Button, Divider, Dropdown, Form, Grid, Header, Icon, Label, List, Message, Segment, Table} from "semantic-ui-react";
import log from "loglevel";
import api from "../../../shared/Api";
import mqtt from "../../../shared/mqtt";
import {
  busyRooms,
  deleteEvent,
  LAYOUTS,
  newEventId,
  publishEvent,
  publishGuest,
  publishLayout,
  StudioStore,
  STUDIO_DEFAULTS,
} from "../studio";

const LAYOUT_LABELS = {hosts: "Ведущие", screen_hosts: "Экран + ведущие", screen: "Только экран"};
const MOUNTPOINTS = ["host1", "host2", "screen", "guest", "quad"];
const POLL_MS = 5000;

const emptyEvent = () => ({
  id: newEventId(),
  name: "",
  date: new Date().toISOString().slice(0, 10),
  rooms: [],
  active: false,
  studio: {...STUDIO_DEFAULTS.studio},
  mountpoints: {...STUDIO_DEFAULTS.mountpoints},
});

class StudioManager extends Component {
  state = {
    events: {},
    selectedId: null,
    draft: null, // event being edited (not yet published)
    rooms: [], // all rooms: {room, description, janus}
    activeRooms: [], // rooms with users: {room, description, janus, users: [...]}
  };

  componentDidMount() {
    this.store = new StudioStore((events) => this.setState({events}));
    this.store.start();
    this.fetchRooms();
    this.fetchActiveRooms();
    this.timer = setInterval(this.fetchActiveRooms, POLL_MS);
  }

  componentWillUnmount() {
    clearInterval(this.timer);
    if (this.store) this.store.stop();
  }

  fetchRooms = () => {
    api
      .fetchAvailableRooms({with_num_users: true})
      .then((data) => {
        const rooms = (data && data.rooms) || [];
        rooms.sort((a, b) => String(a.description).localeCompare(String(b.description)));
        this.setState({rooms});
      })
      .catch((err) => log.error("[studio-admin] fetch rooms failed:", err));
  };

  fetchActiveRooms = () => {
    api
      .fetchActiveRooms()
      .then((activeRooms) => this.setState({activeRooms: activeRooms || []}))
      .catch((err) => log.error("[studio-admin] fetch active rooms failed:", err));
  };

  selected = () => this.state.events[this.state.selectedId] || null;

  // ---- Events -----------------------------------------------------------------

  newEvent = () => this.setState({selectedId: null, draft: emptyEvent()});

  selectEvent = (id) => {
    const event = this.state.events[id];
    this.setState({selectedId: id, draft: event ? this.toDraft(event) : null});
  };

  toDraft = (event) => {
    const {layout, guest, ts, ...def} = event;
    return JSON.parse(JSON.stringify(def));
  };

  setDraft = (path, value) => {
    const draft = JSON.parse(JSON.stringify(this.state.draft));
    const keys = path.split(".");
    let o = draft;
    keys.slice(0, -1).forEach((k) => (o = o[k] = o[k] || {}));
    o[keys[keys.length - 1]] = value;
    this.setState({draft});
  };

  saveDraft = () => {
    const {draft} = this.state;
    if (!draft.name.trim()) return alert("Введите название события");
    const busy = busyRooms(this.state.events, draft.id);
    const conflict = draft.rooms.filter((r) => busy[Number(r)]);
    if (conflict.length > 0) {
      return alert("Комнаты уже в другом событии: " + conflict.map((r) => this.roomName(r)).join(", "));
    }
    // `active` is changed only by Activate/Stop, never by a (possibly stale) draft.
    const saved = this.state.events[draft.id];
    publishEvent({...draft, active: saved ? !!saved.active : false});
    this.setState({selectedId: draft.id});
  };

  removeEvent = () => {
    const event = this.selected();
    if (!event) return;
    if (event.active) return alert("Сначала деактивируйте событие");
    if (!window.confirm(`Удалить событие "${event.name}"?`)) return;
    deleteEvent(event.id);
    this.setState({selectedId: null, draft: null});
  };

  setActive = (active) => {
    const event = this.selected();
    if (!event) return;
    const name = event.name;
    if (!window.confirm(active ? `Активировать "${name}"? Комнаты переключатся на студию.` : `Остановить "${name}"? Комнаты вернутся на обычную трансляцию.`)) return;
    if (!active) {
      this.takeOffAir(event);
      publishLayout(event.id, "hosts");
    }
    publishEvent({...this.toDraft(event), active});
  };

  // ---- Guest / questions ------------------------------------------------------

  eventRooms = (event) => {
    const ids = new Set((event?.rooms || []).map(Number));
    return this.state.activeRooms.filter((r) => ids.has(Number(r.room)));
  };

  findUser = (id) => {
    for (const r of this.state.activeRooms) {
      const u = (r.users || []).find((x) => x.id === id);
      if (u) return {user: u, room: r};
    }
    return null;
  };

  putOnAir = (event, user, room) => {
    if (event.guest && event.guest.id !== user.id) this.takeOffAir(event);
    publishGuest(event.id, {
      id: user.id,
      display: userName(user),
      room: room.room,
      janus: room.janus,
      rfid: user.rfid,
    });
  };

  // Clears the guest and the question flag of the user that was on air.
  takeOffAir = (event) => {
    const guest = event.guest;
    if (!guest) return;
    publishGuest(event.id, null);
    const found = this.findUser(guest.id);
    if (found && found.user.question) {
      const {user, room} = found;
      const cmd = {type: "client-question", room: room.room, id: user.id, user: {camera: user.camera, question: user.question, rfid: user.rfid}};
      mqtt.send(JSON.stringify(cmd), false, "galaxy/room/" + room.room);
    }
  };

  // ---- Render -----------------------------------------------------------------

  roomName = (id) => {
    const r = this.state.rooms.find((x) => Number(x.room) === Number(id));
    return r ? r.description : String(id);
  };

  renderEvents() {
    const {events, selectedId} = this.state;
    const list = Object.values(events).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return (
      <Segment>
        <Header as="h4">
          События
          <Button size="mini" floated="right" primary icon="plus" content="Новое" onClick={this.newEvent} />
        </Header>
        <List divided selection>
          {list.map((e) => (
            <List.Item key={e.id} active={e.id === selectedId} onClick={() => this.selectEvent(e.id)}>
              <List.Content floated="right">
                {e.active ? <Label color="red" size="mini">ACTIVE</Label> : null}
              </List.Content>
              <List.Content>
                <List.Header>{e.name || e.id}</List.Header>
                <List.Description>
                  {e.date} · комнат: {(e.rooms || []).length}
                </List.Description>
              </List.Content>
            </List.Item>
          ))}
          {list.length === 0 && <List.Item disabled>Нет событий</List.Item>}
        </List>
      </Segment>
    );
  }

  renderEditor() {
    const {draft, rooms, events} = this.state;
    if (!draft) return <Message info content="Выберите событие или создайте новое" />;
    const saved = events[draft.id];
    const locked = !!saved?.active; // rooms and streams can't change while active
    const busy = busyRooms(events, draft.id);
    const roomOptions = rooms.map((r) => ({
      key: r.room,
      value: r.room,
      text: r.description,
      disabled: !!busy[Number(r.room)],
      description: busy[Number(r.room)] ? busy[Number(r.room)].name : undefined,
    }));

    return (
      <Segment>
        <Header as="h4">{saved ? "Событие" : "Новое событие"}</Header>
        <Form>
          <Form.Group widths="equal">
            <Form.Input label="Название" value={draft.name} onChange={(e, {value}) => this.setDraft("name", value)} />
            <Form.Input label="Дата" type="date" value={draft.date} onChange={(e, {value}) => this.setDraft("date", value)} />
          </Form.Group>
          <Form.Field>
            <label>Комнаты ({draft.rooms.length})</label>
            <Dropdown
              placeholder="Комнаты"
              fluid
              multiple
              search
              selection
              disabled={locked}
              options={roomOptions}
              value={draft.rooms}
              onChange={(e, {value}) => this.setDraft("rooms", value)}
            />
          </Form.Field>
          <Form.Group widths="equal">
            <Form.Input label="Студия: gxy" disabled={locked} value={draft.studio.janus} onChange={(e, {value}) => this.setDraft("studio.janus", value)} />
            <Form.Input label="Студия: комната" type="number" disabled={locked} value={draft.studio.room} onChange={(e, {value}) => this.setDraft("studio.room", Number(value))} />
            <Form.Input label="Студия: str" disabled={locked} value={draft.studio.str} onChange={(e, {value}) => this.setDraft("studio.str", value)} />
          </Form.Group>
          <Form.Group widths="equal">
            {MOUNTPOINTS.map((m) => (
              <Form.Input
                key={m}
                label={`Mountpoint ${m}`}
                type="number"
                disabled={locked}
                value={draft.mountpoints[m]}
                onChange={(e, {value}) => this.setDraft("mountpoints." + m, Number(value))}
              />
            ))}
          </Form.Group>
          <Button primary onClick={this.saveDraft}>
            Сохранить
          </Button>
          {saved && !saved.active && (
            <Button color="green" onClick={() => this.setActive(true)}>
              Активировать
            </Button>
          )}
          {saved && saved.active && (
            <Button color="orange" onClick={() => this.setActive(false)}>
              Остановить
            </Button>
          )}
          {saved && (
            <Button basic negative floated="right" onClick={this.removeEvent}>
              Удалить
            </Button>
          )}
        </Form>
        {saved && (
          <Message size="tiny">
            URL ведущих: <code>?event={saved.id}&amp;slot=host1|host2|screen</code> · Quad: <code>?event={saved.id}</code>
          </Message>
        )}
      </Segment>
    );
  }

  renderLive() {
    const event = this.selected();
    if (!event) return null;
    const rooms = this.eventRooms(event);
    const questions = [];
    rooms.forEach((r) => (r.users || []).filter((u) => u.question).forEach((u) => questions.push({user: u, room: r})));

    return (
      <Segment>
        <Header as="h4">
          Эфир {event.active ? <Label color="red">ACTIVE</Label> : <Label>не активно</Label>}
        </Header>

        <Button.Group fluid size="small">
          {LAYOUTS.map((l) => (
            <Button key={l} color={event.layout === l ? "blue" : undefined} onClick={() => publishLayout(event.id, l)}>
              {LAYOUT_LABELS[l]}
            </Button>
          ))}
        </Button.Group>

        <Divider />
        <Header as="h5">Гость</Header>
        {event.guest ? (
          <Segment color="red">
            <Icon name="microphone" color="red" /> <b>{event.guest.display}</b> · {this.roomName(event.guest.room)}
            <Button size="mini" negative floated="right" onClick={() => this.takeOffAir(event)}>
              Снять
            </Button>
          </Segment>
        ) : (
          <Message size="tiny" content="Никого в эфире" />
        )}

        <Header as="h5">Вопросы ({questions.length})</Header>
        <Table compact size="small" selectable>
          <Table.Body>
            {questions.map(({user, room}) => {
              const onAir = event.guest && event.guest.id === user.id;
              return (
                <Table.Row key={user.id} positive={onAir}>
                  <Table.Cell>{userName(user)}</Table.Cell>
                  <Table.Cell>{room.description}</Table.Cell>
                  <Table.Cell>{user.camera ? <Icon name="video camera" /> : <Icon name="eye slash" color="grey" title="камера выключена" />}</Table.Cell>
                  <Table.Cell collapsing>
                    <Button size="mini" color="green" disabled={onAir || !event.active} onClick={() => this.putOnAir(event, user, room)}>
                      В эфир
                    </Button>
                  </Table.Cell>
                </Table.Row>
              );
            })}
            {questions.length === 0 && (
              <Table.Row>
                <Table.Cell disabled>Нет вопросов</Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table>
        <Message size="tiny" content="Превью человека — во вкладке Rooms." />
      </Segment>
    );
  }

  render() {
    return (
      <Grid columns={3} stackable>
        <Grid.Column width={4}>{this.renderEvents()}</Grid.Column>
        <Grid.Column width={7}>{this.renderEditor()}</Grid.Column>
        <Grid.Column width={5}>{this.renderLive()}</Grid.Column>
      </Grid>
    );
  }
}

const userName = (u) => u.display || u.name || u.username || u.id;

export default StudioManager;

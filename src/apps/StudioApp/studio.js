// Shared protocol of the Studio mode (see README.md in this folder).
//
// Retained MQTT topics, one set per event:
//   galaxy/studio/<eventId>          event definition (written by the admin only)
//   galaxy/studio/<eventId>/layout   {layout, ts}     (admin + StudioClient slot=screen)
//   galaxy/studio/<eventId>/guest    {id, display, room, janus, rfid, ts} | empty (admin)
// Layout and guest live in their own topics so two writers never overwrite each
// other's fields of one big document.
// An empty retained payload clears a topic (= event deleted / no guest).

import log from "loglevel";
import mqtt from "../../shared/mqtt";

export const STUDIO_NS = "galaxy/studio";
export const STUDIO_SUB = `${STUDIO_NS}/#`;
export const eventTopic = (id) => `${STUDIO_NS}/${id}`;
export const layoutTopic = (id) => `${STUDIO_NS}/${id}/layout`;
export const guestTopic = (id) => `${STUDIO_NS}/${id}/guest`;

export const SLOTS = ["host1", "host2", "screen", "guest"];
export const LAYOUTS = ["hosts", "screen_hosts", "screen"];
export const DEFAULT_LAYOUT = "hosts";

// Defaults for a new event in the admin form. Every value can be changed per event.
// TODO: replace with the real studio gxy/str names and mountpoint ids.
export const STUDIO_DEFAULTS = {
  studio: {janus: "gxy1", room: 9999, str: "str1"},
  mountpoints: {host1: 9001, host2: 9002, screen: 9003, guest: 9004, quad: 9005},
};

export const newEventId = () => Date.now().toString(36);

export const publishEvent = (event) => publishRetained(eventTopic(event.id), {...event, ts: Date.now()});
export const deleteEvent = (id) => {
  clearRetained(layoutTopic(id));
  clearRetained(guestTopic(id));
  clearRetained(eventTopic(id));
};
export const publishLayout = (id, layout) => publishRetained(layoutTopic(id), {layout, ts: Date.now()});
export const publishGuest = (id, guest) =>
  guest ? publishRetained(guestTopic(id), {...guest, ts: Date.now()}) : clearRetained(guestTopic(id));

function publishRetained(topic, payload) {
  mqtt.send(JSON.stringify(payload), true, topic);
}

// mqtt.send() parses the message as JSON, so an empty payload goes directly.
function clearRetained(topic) {
  if (!mqtt.mq) return;
  mqtt.mq.publish(topic, "", {qos: 1, retain: true}, (err) => err && log.error("[studio] clear failed:", err));
}

// Collects all studio events from MQTT. `onChange(events)` gets the full map
// {id: {...definition, layout, guest}} on every change.
// Requires the "studio" route in shared/mqtt.js watch() (MqttStudioEvent).
export class StudioStore {
  constructor(onChange) {
    this.onChange = onChange;
    this.defs = {};
    this.layouts = {};
    this.guests = {};
  }

  start() {
    mqtt.mq.on("MqttStudioEvent", this.onMessage);
    mqtt.join(STUDIO_SUB);
  }

  stop() {
    if (mqtt.mq) mqtt.mq.removeListener("MqttStudioEvent", this.onMessage);
    mqtt.exit(STUDIO_SUB);
  }

  onMessage = ({id, target, data}) => {
    if (!id) return;
    let msg = null;
    if (data && data.length > 0) {
      try {
        msg = JSON.parse(data.toString());
      } catch (e) {
        log.error("[studio] bad payload:", id, target, e);
        return;
      }
    }
    if (!target) {
      if (msg) this.defs[id] = msg;
      else delete this.defs[id];
    } else if (target === "layout") {
      if (msg) this.layouts[id] = msg.layout;
      else delete this.layouts[id];
    } else if (target === "guest") {
      if (msg) this.guests[id] = msg;
      else delete this.guests[id];
    } else {
      return;
    }
    if (typeof this.onChange === "function") this.onChange(this.events());
  };

  events() {
    const out = {};
    Object.keys(this.defs).forEach((id) => {
      out[id] = {
        ...this.defs[id],
        layout: LAYOUTS.includes(this.layouts[id]) ? this.layouts[id] : DEFAULT_LAYOUT,
        guest: this.guests[id] || null,
      };
    });
    return out;
  }
}

// Active event that includes |room|. If a misconfiguration puts a room into two
// active events, the most recently changed one wins.
export const findEventForRoom = (events, room) => {
  if (room === "" || room === null || room === undefined) return null;
  const list = Object.values(events || {}).filter(
    (e) => e.active && Array.isArray(e.rooms) && e.rooms.map(Number).includes(Number(room))
  );
  if (list.length === 0) return null;
  return list.sort((a, b) => (b.ts || 0) - (a.ts || 0))[0];
};

// Rooms already used by other active-or-not events (one room — one event).
export const busyRooms = (events, exceptId) => {
  const busy = {};
  Object.values(events || {}).forEach((e) => {
    if (e.id === exceptId) return;
    (e.rooms || []).forEach((r) => (busy[Number(r)] = e));
  });
  return busy;
};

export const queryParam = (name) => new URLSearchParams(window.location.search).get(name);

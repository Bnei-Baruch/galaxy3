// Watches the Studio mountpoints (host1, host2, screen, guest, quad) on the
// studio str server, over its own Janus session so the main broadcast
// (shared/streaming-utils.js) is not touched.
//
// Usage:
//   const s = new StudioStream(user, (slot, mediaStream) => ...);
//   s.start(event);   // event.studio.str + event.mountpoints
//   s.stop();

import log from "loglevel";
import mqtt from "../../shared/mqtt";
import {JanusMqtt} from "../../lib/janus-mqtt";
import {StreamingPlugin} from "../../lib/streaming-plugin";

const RETRY_MS = 5000;

// StreamingPlugin resolves watch() with the first track only. Studio mountpoints
// carry audio + video, so collect every track into one MediaStream.
class StudioStreamingPlugin extends StreamingPlugin {
  initPcEvents(resolve) {
    super.initPcEvents(resolve);
    let resolved = false;
    this.pc.ontrack = (e) => {
      log.info("[studio] got track:", e.track && e.track.kind);
      const tracks = (this.mediaStream ? this.mediaStream.getTracks() : []).filter((t) => t.kind !== e.track.kind);
      this.mediaStream = new MediaStream([...tracks, e.track]);
      if (typeof this.onTracks === "function") this.onTracks(this.mediaStream);
      if (!resolved) {
        resolved = true;
        resolve(this.mediaStream);
      }
    };
  }
}

export default class StudioStream {
  constructor(user, onStream, slots = ["host1", "host2", "screen", "guest", "quad"]) {
    this.user = user;
    this.onStream = onStream;
    this.slots = slots;
    this.janus = null;
    this.plugins = {};
    this.srv = null;
    this.mountpoints = {};
    this.stopped = true;
    this.timers = {};
  }

  start(event) {
    const srv = event?.studio?.str;
    const mountpoints = event?.mountpoints || {};
    if (!srv) {
      log.error("[studio] event has no studio.str server:", event);
      return;
    }
    const same = srv === this.srv && this.slots.every((s) => mountpoints[s] === this.mountpoints[s]);
    if (!this.stopped && same) return;
    this.stop();
    this.stopped = false;
    this.srv = srv;
    this.mountpoints = {...mountpoints};
    this.initJanus();
  }

  stop() {
    this.stopped = true;
    Object.values(this.timers).forEach((t) => clearTimeout(t));
    this.timers = {};
    Object.keys(this.plugins).forEach((slot) => this.detachSlot(slot));
    if (this.janus) {
      try {
        this.janus.destroy();
      } catch (e) {
        log.debug("[studio] janus destroy failed:", e && e.message);
      }
    }
    this.janus = null;
    this.slots.forEach((slot) => this.onStream(slot, null));
  }

  initJanus() {
    // `mit` keeps this session's messages apart from the main broadcast session,
    // which may be on the same str server.
    const user = {...this.user, mit: "studio-" + this.srv};
    const janus = new JanusMqtt(user, this.srv, mqtt.clientId);
    janus.onStatus = (srv, status) => {
      if (status === "online" || this.stopped) return;
      log.warn("[studio] str status:", status);
      this.restart();
    };
    this.janus = janus;
    janus
      .init()
      .then(() => {
        if (this.janus !== janus) return;
        this.slots.forEach((slot) => this.watchSlot(slot));
      })
      .catch((err) => {
        log.error("[studio] janus init failed:", err);
        this.restart();
      });
  }

  restart() {
    if (this.stopped || this.timers.janus) return;
    const event = {studio: {str: this.srv}, mountpoints: this.mountpoints};
    this.timers.janus = setTimeout(() => {
      delete this.timers.janus;
      if (this.stopped) return;
      this.stop();
      this.start(event);
    }, RETRY_MS);
  }

  watchSlot(slot) {
    const id = Number(this.mountpoints[slot]);
    if (!id || !this.janus) return;
    const plugin = new StudioStreamingPlugin();
    plugin.onTracks = (stream) => this.onStream(slot, stream);
    plugin.onStatus = () => this.retrySlot(slot);
    this.plugins[slot] = plugin;
    this.janus
      .attach(plugin)
      .then(() => plugin.watch(id))
      .then(() => log.info("[studio] watching", slot, id))
      .catch((err) => {
        log.warn("[studio] watch failed:", slot, id, err && err.message);
        this.retrySlot(slot);
      });
  }

  retrySlot(slot) {
    if (this.stopped || this.timers[slot]) return;
    this.timers[slot] = setTimeout(() => {
      delete this.timers[slot];
      if (this.stopped) return;
      this.detachSlot(slot);
      this.onStream(slot, null);
      this.watchSlot(slot);
    }, RETRY_MS);
  }

  detachSlot(slot) {
    const plugin = this.plugins[slot];
    delete this.plugins[slot];
    if (!plugin) return;
    if (this.janus) {
      const p = this.janus.detach(plugin);
      if (p && typeof p.catch === "function") p.catch((err) => log.debug("[studio] detach failed:", err && err.message));
    } else {
      plugin.detach();
    }
  }
}

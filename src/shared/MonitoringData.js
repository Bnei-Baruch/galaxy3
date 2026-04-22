// Monitoring library to track connection stats.
import pako from "pako";
import {MONITORING_BACKEND} from "./env";
import log from "loglevel";
import {dataValues} from "./MonitoringUtils";
import Version from "../apps/VirtualApp/Version";

const ONE_SECOND_IN_MS = 1000;
const ONE_MINUTE_IN_MS = 60 * 1000;
const FIVE_SECONDS_IN_MS = 5 * ONE_SECOND_IN_MS;

const FIRST_BUCKET = 5 * ONE_SECOND_IN_MS;
const MEDIUM_BUCKET = 15 * ONE_SECOND_IN_MS;
const FULL_BUCKET = 45 * ONE_SECOND_IN_MS;

const INITIAL_STORE_INTERVAL = 5 * ONE_MINUTE_IN_MS;
const INITIAL_SAMPLE_INTERVAL = FIVE_SECONDS_IN_MS;
const MAX_EXPONENTIAL_BACKOFF_MS = 10 * ONE_MINUTE_IN_MS;

export const LINK_STATE_INIT = "init";
export const LINK_STATE_GOOD = "good";
export const LINK_STATE_MEDIUM = "medium";
export const LINK_STATE_WEAK = "weak";

// --- Local connection-quality scorer (publisher-side) ---
// Absolute thresholds (what the current value looks like).
const ABS_RTT_MEDIUM_MS = 150;
const ABS_RTT_WEAK_MS = 300;
const ABS_JITTER_MEDIUM_MS = 30;
const ABS_JITTER_WEAK_MS = 50;
const ABS_LOSS_MEDIUM = 0.01; // 1% packet loss.
const ABS_LOSS_WEAK = 0.03;   // 3% packet loss.

// Delta thresholds (short window vs long window).
const DELTA_RTT_MEDIUM_MS = 100;
const DELTA_RTT_WEAK_MS = 250;
const DELTA_JITTER_MEDIUM_MS = 15;
const DELTA_JITTER_WEAK_MS = 40;
const DELTA_LOSS_MEDIUM = 0.02;
const DELTA_LOSS_WEAK = 0.05;

// Rolling-window sizes for the local scorer (in ms).
const QUALITY_SHORT_WINDOW_MS = 10 * ONE_SECOND_IN_MS;
const QUALITY_LONG_WINDOW_MS = 45 * ONE_SECOND_IN_MS;
// How long to stay in LINK_STATE_INIT before we start reporting real quality.
const QUALITY_WARMUP_MS = 15 * ONE_SECOND_IN_MS;
// Severity tiers used internally.
const TIER_GOOD = 0;
const TIER_MEDIUM = 1;
const TIER_WEAK = 2;

export const Stats = class {
  constructor() {
    this.mean = 0;
    this.dSquared = 0;
    this.length = 0;
    this.maxAddedTimestamp = 0;
    this.maxRemovedTimestamp = 0;
    this.numAdds = 0;
    this.numRemoves = 0;
    this.numEmptyRemoves = 0;
  }

  add(value, timestamp) {
    if (isNaN(value) || !isFinite(value)) {
      // May be string value. Ignore.
      return;
    }

    this.numAdds++;
    if (timestamp > this.maxAddedTimestamp) {
      this.maxAddedTimestamp = timestamp;
    } else {
      log.error(
        `[monitoring] Expecting to add only new values, old timestamp: ${timestamp} found, max ${this.maxAddedTimestamp}.`
      );
    }
    this.length++;

    const meanIncrement = (value - this.mean) / this.length;
    const newMean = this.mean + meanIncrement;

    const dSquaredIncrement = (value - newMean) * (value - this.mean);
    let newDSquared = (this.dSquared * (this.length - 1) + dSquaredIncrement) / this.length;
    if (isNaN(newDSquared)) {
      log.debug("[monitoring] add newDSquared", newDSquared, this.dSquared, this.length, dSquaredIncrement);
    }
    if (newDSquared < 0) {
      // Correcting float inaccuracy.
      if (newDSquared < -0.00001) {
        log.warn(`[monitoring] Add: newDSquared negative: ${newDSquared}. Setting to 0. ${value}, ${timestamp} ${this}`);
      }
      newDSquared = 0;
    }

    this.mean = newMean;
    this.dSquared = newDSquared;
  }

  remove(value, timestamp) {
    if (isNaN(value) || !isFinite(value)) {
      // May be string value. Ingore.
      return;
    }
    if (timestamp > this.maxRemovedTimestamp) {
      this.maxRemovedTimestamp = timestamp;
    } else {
      log.warn(
        `[monitoring] Expecting to remove only new values, old timestamp: ${timestamp} found, max ${this.maxRemovedTimestamp}.`
      );
    }
    if (this.length <= 1) {
      if (this.length === 1) {
        this.numRemoves++;
      } else {
        this.numEmptyRemoves++;
      }
      log.warn(`[monitoring] Empty stats (${value}, ${timestamp}, ${this}).`);
      this.mean = 0;
      this.dSquared = 0;
      this.length = 0;
      return;
    }
    this.numRemoves++;
    this.length--;

    const meanIncrement = (this.mean - value) / this.length;
    const newMean = this.mean + meanIncrement;

    const dSquaredIncrement = (newMean - value) * (value - this.mean);
    let newDSquared = (this.dSquared * (this.length + 1) + dSquaredIncrement) / this.length;
    if (isNaN(newDSquared)) {
      log.debug("[monitoring] remove newDSquared", newDSquared, this.dSquared, this.length, dSquaredIncrement);
    }
    if (newDSquared < 0) {
      // Correcting float inaccuracy.
      if (newDSquared < -0.00001) {
        log.warn(`[monitoring] Remove: newDSquared negative: ${newDSquared}. Setting to 0. ${value}, ${timestamp} ${this}`);
      }
      newDSquared = 0;
    }

    this.mean = newMean;
    this.dSquared = newDSquared;
  }
};

export const MonitoringData = class {
  constructor() {
    // Connection and user info.
    this.pluginHandle = null;
    this.localAudioTrack = null;
    this.localVideoTrack = null;
    this.user = null;
    this.monitorIntervalId = 0;
    this.storedData = []; // Data saved using spec to indentify how much.
    this.scoreData = []; // Same data, buf filtered and saved for 10 minutes for calculating score.
    this.onDataCallback = null;
    this.onStatus = null;
    this.fetchErrors = 0;
    this.lastFetchTimestamp = 0;
    this.lastUpdateTimestamp = 0;
    this.sentDataCount = 0;
    this.miscData = {};
    this.scoreFormula = "";
    this.virtualStreamingJanus = null;

    // Local quality scorer state.
    this.qualitySamples = []; // [{timestamp, rtt, jitter, packetsLost, packetsSent, qualityLimit}]
    this.qualityFirstTimestamp = 0;
    this.lastQualityStatus = "";

    this.spec = {
      sample_interval: INITIAL_SAMPLE_INTERVAL,
      store_interval: INITIAL_STORE_INTERVAL,
      metrics_whitelist: [],
    };

    this.restartMonitoring();
  }

  setOnStatus(callback) {
    this.onStatus = callback;
  }

  updateSpec(spec) {
    if (!isNaN(spec.store_interval) && spec.store_interval >= ONE_MINUTE_IN_MS) {
      this.spec.store_interval = spec.store_interval;
    }
    if (
      Array.isArray(spec.metrics_whitelist) &&
      spec.metrics_whitelist.length > 0 &&
      spec.metrics_whitelist.every((metric) => typeof metric === "string")
    ) {
      this.spec.metrics_whitelist = spec.metrics_whitelist;
    }
    if (
      !isNaN(spec.sample_interval) &&
      this.spec.sample_interval !== spec.sample_interval &&
      spec.sample_interval >= ONE_SECOND_IN_MS
    ) {
      this.spec.sample_interval = spec.sample_interval;
      this.restartMonitoring();
    }
  }

  register(callback) {
    this.onDataCallback = callback;
  }

  unregister(callback) {
    this.onDataCallback = null;
  }

  setConnection(pluginHandle, localAudioTrack, localVideoTrack, user, virtualStreamingJanus) {
    if (this.pluginHandle !== pluginHandle) {
      // New peer-connection: drop any quality samples collected from the old one.
      this.qualitySamples = [];
      this.qualityFirstTimestamp = 0;
      this.lastQualityStatus = "";
      if (this.miscData) {
        delete this.miscData.iceState;
      }
    }
    this.pluginHandle = pluginHandle;
    this.localAudioTrack = localAudioTrack;
    this.localVideoTrack = localVideoTrack;
    this.virtualStreamingJanus = virtualStreamingJanus;
    this.user = Object.assign(
      {
        cpu: (navigator && navigator.hardwareConcurrency) || 0,
        ram: (navigator && navigator.deviceMemory) || 0,
        network: (navigator && navigator.connection && navigator.connection.type) || "",
        galaxyVersion: Version,
      },
      user
    );
    this.installDebugHooks_();
  }

  // Exposes two helpers on `window` for diagnosing the local link scorer
  // without going to chrome://webrtc-internals:
  //   window.__linkQualityDebug()         -> snapshot of current scorer state
  //   window.__forceLinkState("weak"|...) -> override the reported status
  //     valid: "init" | "good" | "medium" | "weak" | null (null = release)
  installDebugHooks_() {
    if (typeof window === "undefined") return;
    if (window.__linkQualityDebug && window.__linkQualityDebugOwner === this) return;
    window.__linkQualityDebugOwner = this;
    window.__linkQualityDebug = () => {
      const last = this.qualitySamples[this.qualitySamples.length - 1] || null;
      return {
        samples: this.qualitySamples.length,
        firstTs: this.qualityFirstTimestamp,
        lastStatus: this.lastQualityStatus,
        forced: this._forcedStatus || null,
        iceState: (this.miscData && this.miscData.iceState) || null,
        last,
        all: this.qualitySamples,
      };
    };
    window.__forceLinkState = (state) => {
      const valid = [null, LINK_STATE_INIT, LINK_STATE_GOOD, LINK_STATE_MEDIUM, LINK_STATE_WEAK];
      if (!valid.includes(state)) {
        log.warn(`[monitoring] __forceLinkState: invalid value ${state}. Use one of ${JSON.stringify(valid)}`);
        return;
      }
      this._forcedStatus = state;
      if (state) {
        this.dispatchQualityStatus_(state, "forced");
      }
      log.warn(`[monitoring] __forceLinkState = ${state}`);
    };
  }

  restartMonitoring() {
    this.stopMonitoring();
    this.monitorIntervalId = setInterval(() => this.monitor_(), this.spec.sample_interval);
  }

  stopMonitoring() {
    if (this.monitorIntervalId) {
      clearInterval(this.monitorIntervalId);
      this.monitorIntervalId = 0;
    }
  }

  getLastData() {
    return (this.storedData.length && this.storedData[this.storedData.length - 1]) || null;
  }

  navigatorConnectionData(timestamp) {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) {
      return null;
    }
    return {
      timestamp,
      downlink: c.downlink,
      downlinkMax: c.downlinkMax,
      effectiveType: c.effectiveType,
      rtt: c.rtt,
      saveData: c.saveData,
      type: c.type,
    };
  }

  onSlowLink(slowLinkType, lost) {
    const countName = `slow-link-${slowLinkType}`;
    const lostName = `slow-link-${slowLinkType}-lost`;
    if (!(countName in this.miscData)) {
      this.miscData[countName] = 0;
    }
    this.miscData[countName]++;
    if (!(lostName in this.miscData)) {
      this.miscData[lostName] = 0;
    }
    this.miscData[lostName] += lost;
  }

  onIceState(state) {
    this.miscData.iceState = state;
  }

  getMiscData(timestamp) {
    return Object.assign({timestamp, type: "misc"}, this.miscData);
  }

  monitor_() {
    if (!this.pluginHandle || !this.localAudioTrack || !this.user) {
      return; // User not connected.
    }
    const pc = (this.pluginHandle && this.pluginHandle.webrtcStuff && this.pluginHandle.webrtcStuff.pc) || (this.pluginHandle && this.pluginHandle.pc) || null;
    // Publisher plugin keeps its own iceState on the handle itself. Pick it up so
    // the local scorer sees ICE transitions even when nobody calls onIceState().
    if (this.pluginHandle && typeof this.pluginHandle.iceState === "string" && this.pluginHandle.iceState) {
      this.miscData.iceState = this.pluginHandle.iceState;
    }
    const defaultTimestamp = new Date().getTime();
    // A track is usable for pc.getStats(track) only if it is alive AND still
    // attached to a sender on this peer connection. If the camera was turned
    // off the app may keep holding a dead MediaStreamTrack reference — asking
    // getStats() for it throws InvalidAccessError.
    const trackAttached = (track) => {
      if (!track || track.constructor.name !== "MediaStreamTrack") return false;
      if (track.readyState !== "live") return false;
      if (pc && typeof pc.getSenders === "function") {
        try {
          return pc.getSenders().some((s) => s && s.track === track);
        } catch (_e) {
          return false;
        }
      }
      return true;
    };
    const audioUsable = trackAttached(this.localAudioTrack);
    const videoUsable = trackAttached(this.localVideoTrack);
    if (pc && audioUsable) {
      const datas = [];
      const SKIP_REPORTS = ["certificate", "codec", "track", "local-candidate", "remote-candidate"];
      const getStatsPromises = [];
      getStatsPromises.push(
        pc.getStats(this.localAudioTrack).then((stats) => {
          const audioReports = {name: "audio", reports: [], timestamp: defaultTimestamp};
          stats.forEach((report) => {
            // Remove not necessary reports.
            if (!SKIP_REPORTS.includes(report.type)) {
              if (report.timestamp) {
                audioReports.timestamp = report.timestamp;
              }
              audioReports.reports.push(report);
            }
          });
          datas.push(audioReports);
        }).catch((e) => {
          log.debug("[monitoring] getStats(audio) failed:", e && e.message);
        })
      );
      if (videoUsable) {
        getStatsPromises.push(
          pc.getStats(this.localVideoTrack).then((stats) => {
            const videoReports = {name: "video", reports: [], timestamp: defaultTimestamp};
            stats.forEach((report) => {
              // Remove not necessary reports.
              if (!SKIP_REPORTS.includes(report.type)) {
                if (report.timestamp) {
                  videoReports.timestamp = report.timestamp;
                }
                videoReports.reports.push(report);
              }
            });
            datas.push(videoReports);
          }).catch((e) => {
            log.debug("[monitoring] getStats(video) failed:", e && e.message);
          })
        );
      }

      // Missing some important reports. Add them manually.
      const ids = [this.localAudioTrack.id];
      if (videoUsable) {
        ids.push(this.localVideoTrack.id);
      }
      let mediaSourceIds = [];
      let ssrcs = [];
      getStatsPromises.push(
        pc.getStats(null).then((stats) => {
          stats.forEach((report) => {
            if (ids.includes(report.trackIdentifier)) {
              if (report.mediaSourceId && !mediaSourceIds.includes(report.mediaSourceId)) {
                mediaSourceIds.push(report.mediaSourceId);
              }
            }
          });
          if (mediaSourceIds.length) {
            stats.forEach((report) => {
              if (mediaSourceIds.includes(report.mediaSourceId)) {
                if (report.ssrc && !ssrcs.includes(report.ssrc)) {
                  ssrcs.push(report.ssrc);
                }
              }
            });
          }
          if (ssrcs.length) {
            stats.forEach((report) => {
              if (
                ssrcs.includes(report.ssrc) ||
                mediaSourceIds.includes(report.mediaSourceId) ||
                ids.includes(report.trackIdentifier)
              ) {
                const kind = report.kind;
                const type = report.type;
                const data = datas.find((data) => data.name === kind);
                if (data && data.reports) {
                  const r = data.reports.find((r) => r.type === type);
                  if (!r) {
                    data.reports.push(report);
                  }
                }
              }
            });
          }
        }).catch((e) => {
          log.debug("[monitoring] getStats(null) failed:", e && e.message);
        })
      );

      Promise.all(getStatsPromises).then(() => {
        this.forEachMonitor_(datas, defaultTimestamp);
      });
    } else {
      this.forEachMonitor_([], defaultTimestamp);
    }
  }

  forEachMonitor_(datas, defaultTimestamp) {
    const dataTimestamp = (datas && datas.length && datas[0].timestamp) || defaultTimestamp;
    const navigatorConnection = this.navigatorConnectionData(dataTimestamp);
    if (navigatorConnection) {
      datas.push({name: "NetworkInformation", reports: [navigatorConnection], timestamp: dataTimestamp});
    }
    const misc = this.getMiscData(dataTimestamp);
    if (misc) {
      datas.push({name: "Misc", reports: [misc], timestamp: dataTimestamp});
    }
    if (datas.length) {
      this.storedData.push(datas);
    }

    // This is Async callback. Sort stored data.
    this.storedData.sort((a, b) => a[0].timestamp - b[0].timestamp);
    // Throw old stats, STORE_INTERVAL from last timestamp stored.
    const lastTimestamp = this.lastTimestamp();
    if (lastTimestamp) {
      this.storedData = this.storedData.filter((data) => data[0].timestamp >= lastTimestamp - this.spec.store_interval);
    }
    if (datas.length && this.onDataCallback && this.storedData.length) {
      this.onDataCallback(this.storedData[this.storedData.length - 1]);
    }
    this.updateLocalQuality_(datas, dataTimestamp);
    this.updateScore();

    const backoff = Math.min(MAX_EXPONENTIAL_BACKOFF_MS, FIVE_SECONDS_IN_MS * Math.pow(2, this.fetchErrors));
    if (
      (!this.lastUpdateTimestamp && !this.fetchErrors) /* Fetch for the first time */ ||
      (lastTimestamp - this.lastUpdateTimestamp > this.spec.store_interval /* Fetch after STORE_INTERVAL */ &&
        lastTimestamp - this.lastFetchTimestamp > backoff) /* Fetch after errors backoff */
    ) {
      this.update();
    }
  }

  lastTimestamp() {
    return this.storedData.length &&
      this.storedData[this.storedData.length - 1] &&
      this.storedData[this.storedData.length - 1].length
      ? this.storedData[this.storedData.length - 1][0].timestamp
      : 0;
  }

  filterData(data, metrics, prefix) {
    if (Array.isArray(data)) {
      return data
        .filter((e) =>
          metrics.some((m) =>
            m.startsWith([prefix, e.name ? `[name:${e.name}]` : `[type:${e.type}]`].filter((part) => part).join("."))
          )
        )
        .map((e) =>
          this.filterData(
            e,
            metrics,
            [prefix, e.name ? `[name:${e.name}]` : `[type:${e.type}]`].filter((part) => part).join(".")
          )
        );
    } else if (typeof data === "object") {
      const filterField = ["type", "name"].find((f) => prefix.split(".").slice(-1)[0].startsWith(`[${f}`));
      const copy = {};
      Object.entries(data)
        .filter(([key, value]) =>
          metrics.some((m) => m.startsWith(`${prefix}.${key}`) || [filterField, "timestamp"].includes(key))
        )
        .forEach(
          ([key, value]) =>
            (copy[key] = [filterField, "timestamp"].includes(key)
              ? value
              : this.filterData(value, metrics, `${prefix}.${key}`))
        );
      return copy;
    }
    if (!metrics.some((m) => m === prefix)) {
      log.debug(`[monitoring] Expected leaf ${data} to fully match prefix ${prefix} to one of the metrics ${metrics}`);
    }
    return data;
  }

  getMetricValue(data, metric, prefix) {
    if (Array.isArray(data)) {
      const e = data.find((e) =>
        metric.startsWith([prefix, e.name ? `[name:${e.name}]` : `[type:${e.type}]`].filter((part) => part).join("."))
      );
      if (e === undefined) {
        return undefined;
      }
      return this.getMetricValue(
        e,
        metric,
        [prefix, e.name ? `[name:${e.name}]` : `[type:${e.type}]`].filter((part) => part).join(".")
      );
    } else if (data && typeof data === "object") {
      for (const [key, value] of Object.entries(data)) {
        if (metric.startsWith(`${prefix}.${key}`)) {
          const ret = this.getMetricValue(value, metric, `${prefix}.${key}`);
          if (ret !== undefined) {
            return ret;
          }
        }
      }
      // Did not find metric.
      return undefined;
    }
    if (metric !== prefix) {
      // log.debug(`[monitoring] Expected leaf ${data} to fully match prefix ${prefix} to ${metric}`);
      return undefined;
    }
    return data;
  }

  updateScore() {
    const data = this.storedData.map((d) => this.filterData(d, this.spec.metrics_whitelist, ""));
    data.forEach((d) => {
      if (d.length && d[0].timestamp) {
        const timestamp = d[0].timestamp;
        const lastScoreTimestamp = this.scoreData.length && this.scoreData[this.scoreData.length - 1][0].timestamp;
        if (timestamp && (!lastScoreTimestamp || lastScoreTimestamp < timestamp)) {
          this.scoreData.push(d);
        }
      }
    });
    // Remove older then 10 minutes.
    const last = this.scoreData[this.scoreData.length - 1];
    if (last && last.length && /* [0] - audio */ last[0].timestamp) {
      const lastTimestamp = last[0].timestamp;
      this.scoreData = this.scoreData.filter((d) => {
        const timestamp = d[0].timestamp;
        return timestamp && timestamp >= lastTimestamp - FULL_BUCKET;
      });
      const input = {
        // Last timestamp.
        timestamp: [lastTimestamp],
        // Last timestamp values.
        data: this.spec.metrics_whitelist.map((metric) => [this.getMetricValue(last, metric, "")]),
        // Mapping form metric to it's index.
        index: this.spec.metrics_whitelist.reduce((acc, metric, idx) => {
          acc[metric] = idx;
          return acc;
        }, {}),
        stats: this.spec.metrics_whitelist.map((metric) => {
          const stats = [new Stats(), new Stats(), new Stats()];
          stats.forEach((stat, statIndex) =>
            this.scoreData
              .map((d) => {
                return [d[0].timestamp, this.getMetricValue(d, metric, "")];
              })
              .forEach(([timestamp, v]) => {
                switch (statIndex) {
                  case 0: // Smallest time bucket.
                    if (lastTimestamp - timestamp > FIRST_BUCKET) {
                      return; // Skipp add.
                    }
                    break;
                  case 1: // Medium time bucket.
                    if (lastTimestamp - timestamp > MEDIUM_BUCKET) {
                      return; // Skipp add.
                    }
                    break;
                  case 2: // Full time bucket
                    if (lastTimestamp - timestamp > FULL_BUCKET) {
                      return; // Skipp add.
                    }
                    break;
                  default:
                    break;
                }
                stat.add(v, timestamp);
              })
          );
          return stats;
        }),
      };
      const values = dataValues(input, lastTimestamp);
      // Keep commented out logs for debugging.
      // log.debug(input, values);
      // log.debug('last', this.scoreData.length, input.data.map(arr => arr[0] === undefined ? 'undefined' : arr[0]).join(' | '));
      // log.debug('score', values.score.value, values.score.formula);
      // log.debug('audio score 1min', values.audio.jitter.oneMin && values.audio.jitter.oneMin.mean.value, values.audio.packetsLost.oneMin && values.audio.packetsLost.oneMin.mean.value, values.audio.roundTripTime.oneMin && values.audio.roundTripTime.oneMin.mean.value);
      // log.debug('audio score 3min', values.audio.jitter.threeMin && values.audio.jitter.threeMin.mean.value, values.audio.packetsLost.threeMin && values.audio.packetsLost.threeMin.mean.value, values.audio.roundTripTime.threeMin && values.audio.roundTripTime.threeMin.mean.value);
      // log.debug('video score 1min', values.video.jitter.oneMin && values.video.jitter.oneMin.mean.value, values.video.packetsLost.oneMin && values.video.packetsLost.oneMin.mean.value, values.video.roundTripTime.oneMin && values.video.roundTripTime.oneMin.mean.value);
      // log.debug('video score 3min', values.video.jitter.threeMin && values.video.jitter.threeMin.mean.value, values.video.packetsLost.threeMin && values.video.packetsLost.threeMin.mean.value, values.video.roundTripTime.threeMin && values.video.roundTripTime.threeMin.mean.value);
      // NOTE: link-state dispatch moved to updateLocalQuality_() which is
      // computed directly from pc.getStats() and does not depend on the
      // backend-provided metrics_whitelist.
    }
  }

  // Extracts a single quality sample from a raw getStats() snapshot.
  // Returns null if no usable data is present.
  extractQualitySample_(datas, timestamp) {
    const findReport = (reports, type) => (reports || []).find((r) => r && r.type === type) || null;
    const sample = {
      timestamp,
      rtt: null,            // ms, averaged across audio+video remote-inbound
      jitter: null,         // ms, averaged across audio+video remote-inbound
      packetsLost: 0,       // cumulative, audio+video
      packetsSent: 0,       // cumulative, audio+video
      qualityLimit: null,   // "none" | "cpu" | "bandwidth" | "other"
      hasData: false,
    };
    const rttValues = [];
    const jitterValues = [];
    for (const sectionName of ["audio", "video"]) {
      const section = (datas || []).find((d) => d.name === sectionName);
      if (!section) continue;
      const remoteInbound = findReport(section.reports, "remote-inbound-rtp");
      if (remoteInbound) {
        sample.hasData = true;
        if (typeof remoteInbound.roundTripTime === "number" && isFinite(remoteInbound.roundTripTime)) {
          rttValues.push(remoteInbound.roundTripTime);
        }
        if (typeof remoteInbound.jitter === "number" && isFinite(remoteInbound.jitter)) {
          jitterValues.push(remoteInbound.jitter);
        }
        if (typeof remoteInbound.packetsLost === "number" && isFinite(remoteInbound.packetsLost)) {
          sample.packetsLost += Math.max(0, remoteInbound.packetsLost);
        }
      }
      const outbound = findReport(section.reports, "outbound-rtp");
      if (outbound && typeof outbound.packetsSent === "number" && isFinite(outbound.packetsSent)) {
        sample.packetsSent += outbound.packetsSent;
        sample.hasData = true;
      }
      if (sectionName === "video" && outbound && typeof outbound.qualityLimitationReason === "string") {
        sample.qualityLimit = outbound.qualityLimitationReason;
      }
    }
    if (rttValues.length) {
      sample.rtt = (rttValues.reduce((a, b) => a + b, 0) / rttValues.length) * 1000;
    }
    if (jitterValues.length) {
      sample.jitter = (jitterValues.reduce((a, b) => a + b, 0) / jitterValues.length) * 1000;
    }
    return sample.hasData ? sample : null;
  }

  // Computes the current link quality and dispatches onStatus. Fully self-
  // contained: works without any backend / metrics_whitelist.
  updateLocalQuality_(datas, timestamp) {
    if (!this.onStatus) return;

    // Dev override via window.__forceLinkState(...). Still collect samples so
    // that __linkQualityDebug() stays useful while the override is active.
    if (this._forcedStatus) {
      const sample = this.extractQualitySample_(datas, timestamp);
      if (sample) {
        this.qualitySamples.push(sample);
        this.qualitySamples = this.qualitySamples.filter(
          (s) => timestamp - s.timestamp <= QUALITY_LONG_WINDOW_MS
        );
      }
      this.dispatchQualityStatus_(this._forcedStatus, "forced");
      return;
    }

    const sample = this.extractQualitySample_(datas, timestamp);
    if (sample) {
      this.qualitySamples.push(sample);
      // Drop samples older than the long window.
      this.qualitySamples = this.qualitySamples.filter(
        (s) => timestamp - s.timestamp <= QUALITY_LONG_WINDOW_MS
      );
      if (!this.qualityFirstTimestamp) {
        this.qualityFirstTimestamp = timestamp;
      }
    }

    // Warmup: until we've accumulated enough data, stay in INIT.
    if (!this.qualityFirstTimestamp || timestamp - this.qualityFirstTimestamp < QUALITY_WARMUP_MS) {
      this.dispatchQualityStatus_(LINK_STATE_INIT, "warming up");
      return;
    }
    if (this.qualitySamples.length < 2) {
      this.dispatchQualityStatus_(LINK_STATE_INIT, "not enough samples");
      return;
    }

    const samples = this.qualitySamples;
    const shortSamples = samples.filter((s) => timestamp - s.timestamp <= QUALITY_SHORT_WINDOW_MS);
    const longSamples = samples;

    const meanOf = (arr, key) => {
      const vals = arr.map((s) => s[key]).filter((v) => v != null && isFinite(v));
      if (!vals.length) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    };
    const lossRateOf = (arr) => {
      if (arr.length < 2) return null;
      const first = arr[0];
      const last = arr[arr.length - 1];
      const sent = Math.max(0, last.packetsSent - first.packetsSent);
      const lost = Math.max(0, last.packetsLost - first.packetsLost);
      const total = sent + lost;
      if (total === 0) return null;
      return lost / total;
    };

    const longRtt = meanOf(longSamples, "rtt");
    const longJitter = meanOf(longSamples, "jitter");
    const longLoss = lossRateOf(longSamples);
    const shortRtt = meanOf(shortSamples, "rtt");
    const shortJitter = meanOf(shortSamples, "jitter");
    const shortLoss = lossRateOf(shortSamples);

    const tierFor = (v, mediumTh, weakTh) => {
      if (v == null || !isFinite(v)) return TIER_GOOD;
      if (v >= weakTh) return TIER_WEAK;
      if (v >= mediumTh) return TIER_MEDIUM;
      return TIER_GOOD;
    };

    const reasons = [];
    const bumpTier = (current, next, reason) => {
      if (next > current) {
        reasons.length = 0;
        reasons.push(reason);
        return next;
      }
      if (next === current && next !== TIER_GOOD) {
        reasons.push(reason);
      }
      return current;
    };

    let tier = TIER_GOOD;

    // Absolute penalties — "my connection is currently bad".
    let t = tierFor(longRtt, ABS_RTT_MEDIUM_MS, ABS_RTT_WEAK_MS);
    if (t > TIER_GOOD) tier = bumpTier(tier, t, `rtt ${Math.round(longRtt)}ms`);
    t = tierFor(longJitter, ABS_JITTER_MEDIUM_MS, ABS_JITTER_WEAK_MS);
    if (t > TIER_GOOD) tier = bumpTier(tier, t, `jitter ${Math.round(longJitter)}ms`);
    t = tierFor(longLoss, ABS_LOSS_MEDIUM, ABS_LOSS_WEAK);
    if (t > TIER_GOOD) tier = bumpTier(tier, t, `loss ${(longLoss * 100).toFixed(1)}%`);

    // Delta penalties — "my connection just got worse".
    const dRtt = shortRtt != null && longRtt != null ? shortRtt - longRtt : null;
    const dJitter = shortJitter != null && longJitter != null ? shortJitter - longJitter : null;
    const dLoss = shortLoss != null && longLoss != null ? shortLoss - longLoss : null;
    t = tierFor(dRtt, DELTA_RTT_MEDIUM_MS, DELTA_RTT_WEAK_MS);
    if (t > TIER_GOOD) tier = bumpTier(tier, t, `Δrtt +${Math.round(dRtt)}ms`);
    t = tierFor(dJitter, DELTA_JITTER_MEDIUM_MS, DELTA_JITTER_WEAK_MS);
    if (t > TIER_GOOD) tier = bumpTier(tier, t, `Δjitter +${Math.round(dJitter)}ms`);
    t = tierFor(dLoss, DELTA_LOSS_MEDIUM, DELTA_LOSS_WEAK);
    if (t > TIER_GOOD) tier = bumpTier(tier, t, `Δloss +${(dLoss * 100).toFixed(1)}%`);

    // Encoder quality limitation on video. "bandwidth" does NOT necessarily
    // mean bad network — it also fires when the application caps the bitrate
    // (RTCRtpSender.setParameters) or when BWE is probing back up slowly after
    // a congestion event. So we use it only as an amplifier: if we already see
    // real network deterioration (loss / RTT), and the encoder is persistently
    // bandwidth-limited, bump the tier one step. Standalone "bandwidth" is
    // just logged.
    const bandwidthLimited = shortSamples.filter((s) => s.qualityLimit === "bandwidth").length;
    const bwRatio = shortSamples.length ? bandwidthLimited / shortSamples.length : 0;
    const hasNetworkDegradation =
      (longLoss != null && longLoss >= ABS_LOSS_MEDIUM) ||
      (longRtt != null && longRtt >= ABS_RTT_MEDIUM_MS) ||
      (dLoss != null && dLoss >= DELTA_LOSS_MEDIUM) ||
      (dRtt != null && dRtt >= DELTA_RTT_MEDIUM_MS);
    if (bwRatio >= 0.5 && hasNetworkDegradation && tier < TIER_WEAK) {
      tier = bumpTier(tier, tier + 1, `encoder bw-limited ${Math.round(bwRatio * 100)}%`);
    } else if (bwRatio >= 0.5) {
      log.info(`[monitoring] encoder bandwidth-limited ${Math.round(bwRatio * 100)}% (no other degradation)`);
    }
    // CPU-limited — not the network, just log it.
    const lastSample = samples[samples.length - 1];
    if (lastSample && lastSample.qualityLimit === "cpu") {
      log.warn("[monitoring] encoder CPU-limited");
    }

    // ICE trouble dominates everything else.
    const iceState = this.miscData && this.miscData.iceState;
    if (iceState && !["checking", "completed", "connected", "new"].includes(iceState)) {
      tier = bumpTier(tier, TIER_WEAK, `ice ${iceState}`);
    }

    const status =
      tier === TIER_WEAK ? LINK_STATE_WEAK : tier === TIER_MEDIUM ? LINK_STATE_MEDIUM : LINK_STATE_GOOD;
    const reason = reasons.length ? reasons.join(", ") : "ok";
    this.dispatchQualityStatus_(status, reason);
  }

  dispatchQualityStatus_(status, reason) {
    if (!this.onStatus) return;
    if (this.lastQualityStatus !== status) {
      log.debug(`[monitoring] link quality: ${this.lastQualityStatus || "(none)"} -> ${status} (${reason})`);
      this.lastQualityStatus = status;
    }
    this.onStatus(status, reason);
  }

  update() {
    const lastTimestamp = this.lastTimestamp();
    this.lastFetchTimestamp = lastTimestamp;

    const sentData = this.storedData.map((d, index) =>
      this.sentDataCount++ % 100 === 0 ? d : this.filterData(d, this.spec.metrics_whitelist, "")
    );
    this.sentDataCount = this.sentDataCount % 100; // Keep count small.
    // Update user network. We just need the latest and don't want to monitor this.
    this.user.network = (navigator && navigator.connection && navigator.connection.type) || "";
    // Update last streaming server from virtualStreamingJanus.
    this.user.streamingGateway = this.virtualStreamingJanus.config && this.virtualStreamingJanus.config.name || '';
    const data = {
      user: this.user,
      data: sentData,
    };
    // log.debug("[monitoring] Spec", this.spec);
    // log.debug("[monitoring] Update", data);
    // // Update backend.
    // fetch(`${MONITORING_BACKEND}/update`, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //     "Content-Encoding": "gzip",
    //   },
    //   body: pako.gzip(JSON.stringify(data)),
    // })
    //   .then((response) => {
    //     if (response.ok) {
    //       this.fetchErrors = 0;
    //       return response.json();
    //     } else {
    //       throw new Error(`[monitoring] Fetch error: ${response.status}`);
    //     }
    //   })
    //   .then((data) => {
    //     if (data && data.spec) {
    //       this.updateSpec(data.spec);
    //     }
    //     this.lastUpdateTimestamp = lastTimestamp;
    //     log.debug("[monitoring] Update success.");
    //   })
    //   .catch((error) => {
    //     log.error("[monitoring] Update monitoring error:", error);
    //     this.fetchErrors++;
    //   });
  }
};

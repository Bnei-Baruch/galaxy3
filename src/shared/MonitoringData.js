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
    const defaultTimestamp = new Date().getTime();
    if (
      pc &&
      this.localAudioTrack.constructor.name === "MediaStreamTrack" &&
      (!this.localVideoTrack || this.localVideoTrack.constructor.name === "MediaStreamTrack")
    ) {
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
        })
      );
      if (this.localVideoTrack) {
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
          })
        );
      }

      // Missing some important reports. Add them manually.
      const ids = [this.localAudioTrack.id];
      if (this.localVideoTrack) {
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
      if (this.onStatus) {
        const firstTimestamp = this.scoreData[0][0].timestamp;
        const formula = `Score ${values.score.view} = ${values.score.formula}`;
        // log.debug('[monitoring] Connection', formula, values.score.value);
        if (lastTimestamp - firstTimestamp >= MEDIUM_BUCKET) {
          if (values.score.value < 10) {
            this.onStatus(LINK_STATE_GOOD, formula);
          } else if (values.score.value < 100) {
            this.onStatus(LINK_STATE_MEDIUM, formula);
          } else {
            this.onStatus(LINK_STATE_WEAK, formula);
          }
        } else {
          this.onStatus(LINK_STATE_INIT, formula);
        }
      }
    }
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
    log.debug("[monitoring] Spec", this.spec);
    log.debug("[monitoring] Update", data);
    // Update backend.
    fetch(`${MONITORING_BACKEND}/update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Encoding": "gzip",
      },
      body: pako.gzip(JSON.stringify(data)),
    })
      .then((response) => {
        if (response.ok) {
          this.fetchErrors = 0;
          return response.json();
        } else {
          throw new Error(`[monitoring] Fetch error: ${response.status}`);
        }
      })
      .then((data) => {
        if (data && data.spec) {
          this.updateSpec(data.spec);
        }
        this.lastUpdateTimestamp = lastTimestamp;
        log.debug("[monitoring] Update success.");
      })
      .catch((error) => {
        log.error("[monitoring] Update monitoring error:", error);
        this.fetchErrors++;
      });
  }
};

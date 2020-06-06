// Monitoring library to track connection stats.
import pako from 'pako';
import {
  MONITORING_BACKEND,
} from "./env";

const ONE_SECOND_IN_MS = 1000;
const ONE_MINUTE_IN_MS = 60 * 1000;
const FIVE_SECONDS_IN_MS = 5 * ONE_SECOND_IN_MS;

const INITIAL_STORE_INTERVAL = 5 * ONE_MINUTE_IN_MS;
const INITIAL_SAMPLE_INTERVAL = FIVE_SECONDS_IN_MS;
const MAX_EXPONENTIAL_BACKOFF_MS = 10 * ONE_MINUTE_IN_MS;

export const MonitoringData = class {
  constructor() {
    // Connection and user info.
    this.pluginHandle = null;
    this.localAudioTrack = null;
    this.localVideoTrack = null;
    this.user = null;
    this.monitorIntervalId = 0;
    this.storedData = [];
    this.onDataCallback = null;
    this.fetchErrors = 0;
    this.lastFetchTimestamp = 0;
    this.lastUpdateTimestamp = 0;
    this.sentDataCount = 0;
    this.miscData = {};

    this.spec = {
      sample_interval: INITIAL_SAMPLE_INTERVAL,
      store_interval: INITIAL_STORE_INTERVAL,
      metrics_whitelist: [],
    };

    this.restartMonitoring();
  }

  updateSpec(spec) {
    if (!isNaN(spec.store_interval) && spec.store_interval >= ONE_MINUTE_IN_MS) {
      this.spec.store_interval = spec.store_interval;
    }
    if (Array.isArray(spec.metrics_whitelist) &&
        spec.metrics_whitelist.length > 0 &&
        spec.metrics_whitelist.every((metric) => typeof metric === 'string')) {
      this.spec.metrics_whitelist = spec.metrics_whitelist;
    }
    if (!isNaN(spec.sample_interval) &&
        this.spec.sample_interval !== spec.sample_interval &&
        spec.sample_interval >= ONE_SECOND_IN_MS) {
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

  setConnection(pluginHandle, localAudioTrack, localVideoTrack, user) {
    this.pluginHandle = pluginHandle;
    this.localAudioTrack = localAudioTrack;
    this.localVideoTrack = localVideoTrack;
    this.user = Object.assign({
      cpu: (navigator && navigator.hardwareConcurrency) || 0,
      ram: (navigator && navigator.deviceMemory) || 0,
      network: (navigator && navigator.connection && navigator.connection.type) || '',
    }, user);
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
    }
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
    return Object.assign({timestamp, type: 'misc'}, this.miscData);
  }

  monitor_() {
    if (!this.pluginHandle || !this.localAudioTrack || !this.user) {
      return;  // User not connected.
    }
    const pc = (this.pluginHandle && this.pluginHandle.webrtcStuff && this.pluginHandle.webrtcStuff.pc) || null;
    const defaultTimestamp = new Date().getTime();
    if (pc && this.localAudioTrack.constructor.name === 'MediaStreamTrack' &&
        (!this.localVideoTrack || this.localVideoTrack.constructor.name === 'MediaStreamTrack')) {
      const datas = [];
      const SKIP_REPORTS = ['certificate', 'codec', 'track', 'local-candidate', 'remote-candidate'];
      const getStatsPromises = [];
      getStatsPromises.push(pc.getStats(this.localAudioTrack).then(stats => {
        const audioReports = {name: 'audio', reports: [], timestamp: defaultTimestamp};
        stats.forEach(report => {
          // Remove not necessary reports.
          if (!SKIP_REPORTS.includes(report.type)) {
            if (report.timestamp) {
              audioReports.timestamp = report.timestamp;
            }
            audioReports.reports.push(report);
          }
        });
        datas.push(audioReports);
      }))
      if (this.localVideoTrack) {
        getStatsPromises.push(pc.getStats(this.localVideoTrack).then((stats) => {
          const videoReports = {name: 'video', reports: [], timestamp: defaultTimestamp};
          stats.forEach(report => {
            // Remove not necessary reports.
            if (!SKIP_REPORTS.includes(report.type)) {
            if (report.timestamp) {
              videoReports.timestamp = report.timestamp;
            }
              videoReports.reports.push(report);
            }
          });
          datas.push(videoReports);
        }));
      }

      // Missing some important reports. Add them manually.
      const ids = [this.localAudioTrack.id];
      if (this.localVideoTrack) {
        ids.push(this.localVideoTrack.id);
      }
      let mediaSourceIds = [];
      let ssrcs = [];
      getStatsPromises.push(pc.getStats(null).then((stats) => {
        stats.forEach(report => {
          if (ids.includes(report.trackIdentifier)) {
            if (report.mediaSourceId && !mediaSourceIds.includes(report.mediaSourceId)) {
              mediaSourceIds.push(report.mediaSourceId);
            }
          }
        });
        if (mediaSourceIds.length) {
          stats.forEach(report => {
            if (mediaSourceIds.includes(report.mediaSourceId)) {
              if (report.ssrc && !ssrcs.includes(report.ssrc)) {
                ssrcs.push(report.ssrc);
              }
            }
          });
        }
        if (ssrcs.length) {
          stats.forEach(report => {
            if (ssrcs.includes(report.ssrc) || mediaSourceIds.includes(report.mediaSourceId) || ids.includes(report.trackIdentifier)) {
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
      }));

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
      datas.push({name: 'NetworkInformation', reports: [navigatorConnection], timestamp: dataTimestamp});
    }
    const misc = this.getMiscData(dataTimestamp);
    if (misc) {
      datas.push({name: 'Misc', reports: [misc], timestamp: dataTimestamp});
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

    const backoff = Math.min(MAX_EXPONENTIAL_BACKOFF_MS, FIVE_SECONDS_IN_MS * Math.pow(2, this.fetchErrors));
    if ((!this.lastUpdateTimestamp && !this.fetchErrors) /* Fetch for the first time */ ||
        ((lastTimestamp - this.lastUpdateTimestamp > this.spec.store_interval) /* Fetch after STORE_INTERVAL */ &&
         (lastTimestamp - this.lastFetchTimestamp > backoff) /* Fetch after errors backoff */)) {
      this.update(/*logToConsole=*/false);
    }
  }

  lastTimestamp() {
    return (this.storedData.length &&
            this.storedData[this.storedData.length - 1] &&
            this.storedData[this.storedData.length - 1].length) ?
              this.storedData[this.storedData.length - 1][0].timestamp : 0;
  }

  filterData(data, metrics, prefix) {
    if (Array.isArray(data)) {
      return data.filter(e =>
        metrics.some(m => m.startsWith([prefix, e.name ? `[name:${e.name}]` : `[type:${e.type}]`].filter(part => part).join('.'))))
          .map(e => this.filterData(e, metrics, [prefix, e.name ? `[name:${e.name}]` : `[type:${e.type}]`].filter(part => part).join('.')));
    } else if (typeof data === 'object') {
      const filterField = ['type', 'name'].find(f => prefix.split('.').slice(-1)[0].startsWith(`[${f}`))
      const copy = {};
      Object.entries(data).filter(([key, value]) => metrics.some(m => m.startsWith(`${prefix}.${key}`) || [filterField, 'timestamp'].includes(key)))
        .forEach(([key, value]) => copy[key] = [filterField, 'timestamp'].includes(key) ? value : this.filterData(value, metrics, `${prefix}.${key}`));
      return copy;
    }
    if (!metrics.some(m => m === prefix)) {
      console.log(`Expected leaf ${data} to fully match prefix ${prefix} to one of the metrics ${metrics}`);
    }
    return data;
  }

  update(logToConsole) {
    const lastTimestamp = this.lastTimestamp();
    this.lastFetchTimestamp = lastTimestamp;

    const sentData = this.storedData.map((d, index) => this.sentDataCount++ % 100 === 0 ? d : this.filterData(d, this.spec.metrics_whitelist, ''));
    this.sentDataCount = this.sentDataCount % 100;  // Keep count small.
    // Update user network. We just need the latest and don't want to monitor this.
    this.user.network = (navigator && navigator.connection && navigator.connection.type) || '';
    const data = {
      user: this.user,
      data: sentData,
    };
    if (logToConsole) {
      console.log('Spec', this.spec);
      console.log('Update', data);
    }
    // Update backend.
    fetch(`${MONITORING_BACKEND}/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Encoding': 'gzip',
      },
      body: pako.gzip(JSON.stringify(data)),
    }).then((response) => {
      if (response.ok) {
        this.fetchErrors = 0;
        return response.json();
      } else {
        throw new Error(`Fetch error: ${response.status}`);
      }
    }).then((data) => {
      if (data && data.spec) {
        this.updateSpec(data.spec);
      }
      this.lastUpdateTimestamp = lastTimestamp;
      if (logToConsole) {
        console.log('Update success.');
      }
    })
    .catch((error) => {
      console.error('Update monitoring error:', error);
      this.fetchErrors++;
    });
  }
};

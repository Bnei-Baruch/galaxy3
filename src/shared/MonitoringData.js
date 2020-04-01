// Monitoring library to track connection stats.
import {
  MONITORING_BACKEND,
} from "./consts";

const ONE_SECOND_IN_MS = 1000;
const STORE_INTERVAL = 60 * ONE_SECOND_IN_MS; // Store for one minute in ms.
const MAX_EXPONENTIAL_BACKOFF_MS = 10 * 60 * ONE_SECOND_IN_MS; // 10 Minutes in ms.
const FIVE_SECONDS_IN_MS = 5 * ONE_SECOND_IN_MS;

export const MonitoringData = class {
  constructor() {
    // Connection and user info.
    this.pluginHandle = null;
    this.localAudioTrack = null;
    this.localVideoTrack = null;
    this.user = null;
    this.monitorIntervalId = 0;
    this.storedData = [];
    this.lastUpdateTimestamp = 0;
    this.onDataCallback = null;
    this.fetchErrors = 0;
    this.lastFetchTimestamp = 0;

    this.startMonitoring();
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
    this.user = user;
  }

  startMonitoring() {
    this.monitorIntervalId = setInterval(() => this.monitor_(), ONE_SECOND_IN_MS)
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

  monitor_() {
    if (!this.pluginHandle || !this.localAudioTrack || !this.user) {
      return;  // User not connected.
    }
    const pc = (this.pluginHandle && this.pluginHandle.webrtcStuff && this.pluginHandle.webrtcStuff.pc) || null;
    const defaultTimestamp = new Date().getTime();
    if (pc && this.localAudioTrack.constructor.name === 'MediaStreamTrack' &&
        (!this.localVideoTrack || this.localVideoTrack.constructor.name === 'MediaStreamTrack')) {
      const datas = [];
      const SKIP_REPORTS = ['certificate', 'codec', 'track', 'remote-candidate'];
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
    if (datas.length) {
      this.storedData.push(datas);
    }

    // This is Async callback. Sort stored data.
    this.storedData.sort((a, b) => a[0].timestamp - b[0].timestamp);
    // Throw old stats, STORE_INTERVAL from last timestamp stored.
    const lastTimestamp = (this.storedData.length &&
                           this.storedData[this.storedData.length - 1] &&
                           this.storedData[this.storedData.length - 1].length) ? this.storedData[this.storedData.length - 1][0].timestamp : 0;
    if (lastTimestamp) {
      this.storedData = this.storedData.filter((data) => data[0].timestamp >= lastTimestamp - STORE_INTERVAL);
    }
    if (datas.length && this.onDataCallback && this.storedData.length) {
      this.onDataCallback(this.storedData[this.storedData.length - 1]);
    }

    const backoff = Math.min(MAX_EXPONENTIAL_BACKOFF_MS, FIVE_SECONDS_IN_MS * Math.pow(2, this.fetchErrors));
    if ((!this.lastUpdateTimestamp && !this.fetchErrors) /* Fetch for the first time */ ||
        ((lastTimestamp - this.lastUpdateTimestamp > STORE_INTERVAL) /* Fetch after STORE_INTERVAL */ &&
         (lastTimestamp - this.lastFetchTimestamp > backoff) /* Fetch after errors backoff */)) {
      this.lastFetchTimestamp = lastTimestamp;
      const data = {
        user: this.user,
        data: this.storedData,
      };
      // Update backend.
      fetch(`${MONITORING_BACKEND}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', },
        body: JSON.stringify(data),
      }).then((response) => {
        if (response.ok) {
          this.fetchErrors = 0;
          return response.json()
        } else {
          throw new Error(`Fetch error: ${response.status}`);
        }
      }).then((data) => {
        this.lastUpdateTimestamp = lastTimestamp;
      })
      .catch((error) => {
        console.error('Error:', error);
        this.fetchErrors++;
      });
    }
  }
};

// Monitoring library to track connection stats.
import {
  MONITORING_BACKEND,
} from "../../../shared/consts";

const ONE_SECOND_IN_MS = 1000;
const STORE_INTERVAL = 60 * ONE_SECOND_IN_MS; // Store for one minute.

export const MonitoringData = class {
  constructor() {
    // Connection and user info.
    this.pluginHandle = null;
    this.localAudioTrackId = '';
    this.localVideoTrackId = '';
    this.user = null;
    this.monitorIntervalId = 0;
    this.storedData = [];
    this.lastUpdateTimestamp = 0;
    this.onDataCallback = null;

    this.startMonitoring();
  }

  register(callback) {
    this.onDataCallback = callback;
  }

  unregister(callback) {
    this.onDataCallback = null;
  }

  setConnection(pluginHandle, localAudioTrackId, localVideoTrackId, user) {
    this.pluginHandle = pluginHandle;
    this.localAudioTrackId = localAudioTrackId;
    this.localVideoTrackId = localVideoTrackId;
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

  monitor_() {
    if (!this.pluginHandle || !this.localAudioTrackId || !this.user) {
      return;  // User not connected.
    }
    const pc = (this.pluginHandle && this.pluginHandle.webrtcStuff && this.pluginHandle.webrtcStuff.pc) || null;
    if (!pc) {
      return;  // No rtp teer connection yet.
    }

    pc.getStats(stats => {
      const data = stats.result().filter(report =>
        report.type !== 'googTrack' &&
        (report.stat('googTrackId') === this.localAudioTrackId ||
         report.stat('googTrackId') === this.localVideoTrackId)).map(report => {
        const info = {type: report.type, id: report.id, timestamp: report.timestamp.getTime()};
        report.names().forEach(statName => {
          if (!["id", "timestamp", "type"].includes(statName)) {
            info[statName] = report.stat(statName);
          }
        });
        return info;
      });
      if (!data.length) {
        // No statistics yet.
        return;
      }
      this.storedData.push(data);
      // This is Async callback. Sort stored data.
      this.storedData.sort((a, b) => a[0].timestamp - b[0].timestamp);
      // Throw old stats, STORE_INTERVAL from last timestamp stored.
      const lastTimestamp = this.storedData.length && this.storedData[this.storedData.length - 1].length ? this.storedData[this.storedData.length - 1][0].timestamp : 0;
      if (lastTimestamp) {
        this.storedData = this.storedData.filter((data) => data[0].timestamp >= lastTimestamp - STORE_INTERVAL);
      }
      if (this.onDataCallback && this.storedData.length) {
        this.onDataCallback(this.storedData[this.storedData.length - 1]);
      }
      if (!this.lastUpdateTimestamp || (this.lastUpdateTimestamp <= (lastTimestamp - STORE_INTERVAL))) {
        const data = {
          user: this.user,
          data: this.storedData,
        };
        // Update backend.
        fetch(`${MONITORING_BACKEND}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', },
          body: JSON.stringify(data),
        }).then((response) => response.json())
        .then((data) => {
          this.lastUpdateTimestamp = lastTimestamp;
        })
        .catch((error) => {
          console.error('Error:', error);
        });
      }
    });
  }
};

import workerUrl from 'worker-plugin/loader!./volmeter-processor';
import log from "loglevel";

class LocalDevices {
  constructor() {
    this.audio = {
        context: null,
        device: null,
        devices: [],
        error: null,
        stream: null,
    }
    this.video = {
        setting: {width: 320, height: 180, ideal: 15},
        device: null,
        devices: [],
        error: null,
        stream: null,
    }

    this.audio_stream = null
    this.micLevel = null
    // Tracks intentional suspension (user muted / cam off) so onstatechange
    // can distinguish it from unexpected browser-triggered suspension.
    this.micMuted = false
  }

  init = async (onChange) => {
    let devices = [], ts = 0;

    //TODO: Translate exceptions - https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#Exceptions

    // Check saved devices in local storage
    let storage_video = localStorage.getItem("video_device");
    let storage_audio = localStorage.getItem("audio_device");
    let storage_setting = JSON.parse(localStorage.getItem("video_setting"));
    this.video.device = !!storage_video ? storage_video : null;
    this.audio.device = !!storage_audio ? storage_audio : null;
    this.video.setting = !!storage_setting ? storage_setting : this.video.setting;
    [this.video.stream, this.video.error] = await this.getMediaStream(
      true,
      true,
      this.video.setting,
      this.audio.device,
      this.video.device
    );

    // Saved devices failed try with default
    if (this.video.error === "OverconstrainedError") {
      [this.video.stream, this.video.error] = await this.getMediaStream(
        true,
        true
      );
    }

    if (this.video.error) {
      // Get only audio
      [this.audio.stream, this.audio.error] = await this.getMediaStream(
        true,
        false,
        this.video.setting,
        this.audio.device,
        null
      );
      devices = await navigator.mediaDevices.enumerateDevices();
      this.audio.devices = devices.filter((a) => !!a.deviceId && a.kind === "audioinput");

      // Get only video
      [this.video.stream, this.video.error] = await this.getMediaStream(
        false,
        true,
        this.video.setting,
        null,
        this.video.device
      );
      devices = await navigator.mediaDevices.enumerateDevices();
      this.video.devices = devices.filter((v) => !!v.deviceId && v.kind === "videoinput");
    } else {
      devices = await navigator.mediaDevices.enumerateDevices();
      this.audio.devices = devices.filter((a) => !!a.deviceId && a.kind === "audioinput");
      this.video.devices = devices.filter((v) => !!v.deviceId && v.kind === "videoinput");
      this.audio.stream = this.video.stream;
    }

    if (this.audio.stream) {
      this.audio_stream = this.audio.stream.clone()
      await this.initMicLevel()
      this.audio.device = this.audio.stream.getAudioTracks()[0].getSettings().deviceId;
    } else {
      this.audio.device = "";
    }

    if (this.video.stream) {
      this.video.device = this.video.stream.getVideoTracks()[0].getSettings().deviceId;
    } else {
      this.video.device = "";
    }

    navigator.mediaDevices.ondevicechange = async (e) => {

      //Ignore first event
      if (e.timeStamp - ts < 1000) return;
      ts = e.timeStamp;

      // Devices list not ready on first event
      setTimeout(async() => {
        devices = await navigator.mediaDevices.enumerateDevices();
        log.debug("[devices] devices list refreshed: ", devices);
        this.audio.devices = devices.filter((a) => !!a.deviceId && a.kind === "audioinput");
        this.video.devices = devices.filter((v) => !!v.deviceId && v.kind === "videoinput");

        // Snapshot device IDs before any mutation so the callback can compare old vs new
        const prevAudioDevice = this.audio.device;
        const prevVideoDevice = this.video.device;

        // If the active audio device was unplugged, pick the best available replacement
        const activeAudioExists = this.audio.devices.find(d => d.deviceId === this.audio.device);
        if (!activeAudioExists) {
          const saved_audio = localStorage.getItem("audio_device");
          const isSavedAudio = this.audio.devices.find(d => d.deviceId === saved_audio);
          this.audio.device = isSavedAudio ? saved_audio : (this.audio.devices[0]?.deviceId || null);
        }

        // If the active video device was unplugged, pick the best available replacement
        const activeVideoExists = this.video.devices.find(d => d.deviceId === this.video.device);
        if (!activeVideoExists) {
          const saved_video = localStorage.getItem("video_device");
          const isSavedVideo = this.video.devices.find(d => d.deviceId === saved_video);
          this.video.device = isSavedVideo ? saved_video : (this.video.devices[0]?.deviceId || null);
        }

        log.debug("[devices] ondevicechange: audio", prevAudioDevice, "->", this.audio.device, "| video", prevVideoDevice, "->", this.video.device);
        if (typeof onChange === "function") onChange({video: {...this.video}, audio: {...this.audio}}, prevAudioDevice, prevVideoDevice);
      }, 500)
    };

    log.debug("[devices] init: ", this)
    return {video: this.video, audio: this.audio};
  };

  getMediaStream = (audio, video, setting = {width: 320, height: 180, ideal: 15}, audioid, videoid) => {
    const {width, height, ideal} = setting;
    if (video && videoid) {
      video = {width, height, frameRate: {ideal, min: 1}, deviceId: {exact: videoid}};
    } else if (video && !videoid) {
      video = {width, height, frameRate: {ideal, min: 1}};
    }
    audio = audioid ? {noiseSuppression: true, deviceId: {exact: audioid}} : audio;
    return navigator.mediaDevices
      .getUserMedia({audio, video})
      .then((data) => [data, null])
      .catch((error) => Promise.resolve([null, error.name]));
  };

  initMicLevel = async() => {
    if(!this.audio_stream) return

    this.audio.context = new AudioContext()
    log.debug("[devices] AudioContext: ", this.audio.context)

    this.audio.context.onstatechange = () => {
      log.debug("[devices] AudioContext state:", this.audio.context.state, "micMuted:", this.micMuted)
      if (this.audio.context.state === 'suspended' && !this.micMuted) {
        // Browser auto-suspended the context (e.g. during device change on macOS).
        // Resume it since the user has not intentionally muted.
        log.debug("[devices] AudioContext unexpectedly suspended — resuming")
        this.audio.context.resume()
      }
    }

    await this.audio.context.audioWorklet.addModule(workerUrl)
    this.micNode = new AudioWorkletNode(this.audio.context, 'volume_meter')

    this.micNode.port.onmessage = event => {
      if (event.data.volume) {
        log.trace('[devices] mic level: ', event.data.volume)
        if(typeof this.micLevel === "function")
          this.micLevel(event.data.volume)
      }
    }

    this.micSource = this.audio.context.createMediaStreamSource(this.audio_stream)
    this.micSource.connect(this.micNode)
  };

  setVideoSize = (setting) => {
    if (JSON.stringify(setting) === JSON.stringify(this.video.setting)) return;

    return this.getMediaStream(false, true, setting, null, this.video.device)
      .then((data) => {
        log.debug("[devices] setVideoSize: ", data);
        const [stream, error] = data;
        if (error) {
          this.video.error = error
          log.error("[devices] setVideoSize: ", error);
        } else {
          localStorage.setItem("video_setting", JSON.stringify(setting));
          this.video.stream = stream;
          this.video.setting = setting;
        }
        return {video: this.video, audio: this.audio};
      });
  };

  setVideoDevice = (device) => {
    return this.getMediaStream(false, true, this.video.setting, null, device)
      .then((data) => {
        log.debug("[devices] setVideoDevice: ", data);
        const [stream, error] = data;
        if (error) {
          this.video.error = error
          log.error("[devices] setVideoDevice: ", error);
        } else {
          localStorage.setItem("video_device", device);
          this.video.stream = stream;
          this.video.device = device;
        }
        return {video: this.video, audio: this.audio};
      });
  };

  setAudioDevice = (device, cam_mute) => {
    return this.getMediaStream(true, false, this.video.setting, device, null)
      .then((data) => {
        log.debug("[devices] setAudioDevice: ", data);
        const [stream, error] = data;
        if (error) {
          this.audio.error = error
          log.error("[devices] setAudioDevice: ", error);
        } else {
          localStorage.setItem("audio_device", device);
          this.audio.stream = stream;
          this.audio.device = device;
          this.audio_stream = stream.clone()
          if (this.audio.context && this.micNode) {
            // Reuse the existing AudioContext — just reconnect the source to the new stream.
            // Closing and recreating the context would cause it to start suspended
            // when triggered without a user gesture (e.g. ondevicechange).
            if (this.micSource) this.micSource.disconnect()
            this.micSource = this.audio.context.createMediaStreamSource(this.audio_stream)
            this.micSource.connect(this.micNode)
            this.micMuted = !!cam_mute
            if (cam_mute) {
              this.audio.context.suspend()
            } else {
              this.audio.context.resume()
            }
          }
        }
        return {video: this.video, audio: this.audio};
      });
  };


}

const defaultDevices = new LocalDevices();

export default defaultDevices;

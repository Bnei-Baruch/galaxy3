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

    navigator.mediaDevices.ondevicechange = async(e) => {
      if(e.timeStamp - ts < 1000) return
      ts = e.timeStamp
      devices = await navigator.mediaDevices.enumerateDevices();
      log.debug("[devices] devices list refreshed: ", devices);
      this.audio.devices = devices.filter((a) => !!a.deviceId && a.kind === "audioinput");
      this.video.devices = devices.filter((v) => !!v.deviceId && v.kind === "videoinput");
      // Refresh audio devices list
      let storage_audio = localStorage.getItem("audio_device");
      let isSavedAudio = this.audio.devices.find(d => d.deviceId === storage_audio)
      let default_audio = this.audio.devices.length > 0 ? this.audio.devices[0].deviceId : null;
      this.audio.device = isSavedAudio ? storage_audio : default_audio;
      // Refresh video devices list
      let storage_video = localStorage.getItem("video_device");
      let isSavedVideo = this.video.devices.find(d => d.deviceId === storage_video)
      let default_video = this.video.devices.length > 0 ? this.video.devices[0].deviceId : null;
      this.video.device = isSavedVideo ? storage_video : default_video;

      if(typeof onChange === "function") onChange({video: this.video, audio: this.audio})
    }

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
    await this.audio.context.audioWorklet.addModule(workerUrl)
    let microphone = this.audio.context.createMediaStreamSource(this.audio_stream)
    const node = new AudioWorkletNode(this.audio.context, 'volume_meter')

    node.port.onmessage = event => {
      let _volume = 0
      let _rms = 0
      let _dB = 0

      log.trace('[devices] mic level: ', event.data)

      if (event.data.volume) {
        _volume = event.data.volume
        _rms = event.data.rms
        _dB = event.data.dB

        if(typeof this.micLevel === "function")
          this.micLevel(_volume)
      }
    }

    microphone.connect(node)
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
          if (this.audio.context) {
            this.audio.context.close();
            this.initMicLevel()
            if(cam_mute) {
              this.audio.context.suspend()
            }
          }
        }
        return {video: this.video, audio: this.audio};
      });
  };


}

const defaultDevices = new LocalDevices();

export default defaultDevices;

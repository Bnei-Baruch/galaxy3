import workerUrl from 'worker-plugin/loader!./volmeter-processor';
import {getMediaStream} from "../shared/tools";

class LocalDevices {
  constructor() {
    this.media = null
    this.audio = null;
    this.audio_device = null
    this.audio_devices = []
    this.audio_error = null
    this.audio_stream = null
    this.audio_context = null

    this.video = null
    this.video_device = null
    this.video_devices = []
    this.video_error = null
    this.video_stream = null
    this.video_setting = {width: 320, height: 180, ideal: 15}

    this.micLevel = null
  }

  init = async (media) => {
    const {audio, video} = media;
    let error = null;
    let devices = [];

    //TODO: Translate exceptions - https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#Exceptions

    // Check saved devices in local storage
    let storage_video = localStorage.getItem("video_device");
    let storage_audio = localStorage.getItem("audio_device");
    let storage_setting = JSON.parse(localStorage.getItem("video_setting"));
    video.video_device = !!storage_video ? storage_video : null;
    audio.audio_device = !!storage_audio ? storage_audio : null;
    video.setting = !!storage_setting ? storage_setting : video.setting;
    [video.stream, error] = await this.getMediaStream(true, true, video.setting, audio.audio_device, video.video_device);

    // Saved devices failed try with default
    if (error === "OverconstrainedError") {
      [video.stream, error] = await getMediaStream(true, true);
    }

    if (error) {
      // Get only audio
      [audio.stream, audio.error] = await this.getMediaStream(true, false, video.setting, audio.audio_device, null);
      devices = await navigator.mediaDevices.enumerateDevices();
      audio.devices = devices.filter((a) => !!a.deviceId && a.kind === "audioinput");

      // Get only video
      [video.stream, video.error] = await this.getMediaStream(false, true, video.setting, null, video.video_device);
      devices = await navigator.mediaDevices.enumerateDevices();
      video.devices = devices.filter((v) => !!v.deviceId && v.kind === "videoinput");
    } else {
      devices = await navigator.mediaDevices.enumerateDevices();
      audio.devices = devices.filter((a) => !!a.deviceId && a.kind === "audioinput");
      video.devices = devices.filter((v) => !!v.deviceId && v.kind === "videoinput");
      audio.stream = video.stream;
    }

    if (audio.stream) {
      console.log(audio.stream);
      this.audio_stream = audio.stream.clone();
      this.initMicLevel()
      audio.audio_device = audio.stream.getAudioTracks()[0].getSettings().deviceId;
    } else {
      audio.audio_device = "";
    }

    if (video.stream) {
      video.video_device = video.stream.getVideoTracks()[0].getSettings().deviceId;
    } else {
      video.video_device = "";
    }

    this.media = media
    return media;
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
    if(!this.audio_stream) return null

    this.audio_context = new AudioContext()
    //console.log("[devices] mic level: ", this.audio_context)
    await this.audio_context.audioWorklet.addModule(workerUrl)
    let microphone = this.audio_context.createMediaStreamSource(this.audio_stream)
    const node = new AudioWorkletNode(this.audio_context, 'volume_meter')

    node.port.onmessage = event => {
      let _volume = 0
      let _rms = 0
      let _dB = 0

      //console.log('[devices] latest readings:', event.data)

      if (event.data.volume) {
        _volume = event.data.volume
        _rms = event.data.rms
        _dB = event.data.dB

        if(typeof this.micLevel === "function")
          this.micLevel(_volume)
      }
    }

    microphone.connect(node)
    return this.audio_context
  }


}

const defaultDevices = new LocalDevices();

export default defaultDevices;

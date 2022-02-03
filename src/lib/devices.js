import workerUrl from 'worker-plugin/loader!./volmeter-processor';

class LocalDevices {
  constructor() {
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

  init = async () => {
    let devices = [];

    //TODO: Translate exceptions - https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#Exceptions

    // Check saved devices in local storage
    let storage_video = localStorage.getItem("video_device");
    let storage_audio = localStorage.getItem("audio_device");
    let storage_setting = JSON.parse(localStorage.getItem("video_setting"));
    this.video_device = !!storage_video ? storage_video : null;
    this.audio_device = !!storage_audio ? storage_audio : null;
    this.video_setting = !!storage_setting ? storage_setting : video.setting;
    [this.video_stream, this.video_error] = await this.getMediaStream(true, true, this.video_setting, this.audio_device, this.video_device);

    // Saved devices failed try with default
    if (this.video_error === "OverconstrainedError") {
      [this.video_stream, this.video_error] = await this.getMediaStream(true, true);
    }

    if (this.video_error) {
      // Get only audio
      [this.audio_stream, this.audio_error] = await this.getMediaStream(true, false, this.video_setting, this.audio_device, null);
      devices = await navigator.mediaDevices.enumerateDevices();
      this.audio_devices = devices.filter((a) => !!a.deviceId && a.kind === "audioinput");

      // Get only video
      [this.video_stream, this.video_error] = await this.getMediaStream(false, true, this.video_setting, null, this.video_device);
      devices = await navigator.mediaDevices.enumerateDevices();
      this.video_devices = devices.filter((v) => !!v.deviceId && v.kind === "videoinput");
    } else {
      devices = await navigator.mediaDevices.enumerateDevices();
      this.audio_devices = devices.filter((a) => !!a.deviceId && a.kind === "audioinput");
      this.video_devices = devices.filter((v) => !!v.deviceId && v.kind === "videoinput");
      this.audio_stream = this.video_stream;
    }

    if (this.audio_stream) {
      this.audio_device = this.audio_stream.getAudioTracks()[0].getSettings().deviceId;
    } else {
      this.audio_device = "";
    }

    if (this.video_stream) {
      this.video_device = this.video_stream.getVideoTracks()[0].getSettings().deviceId;
    } else {
      this.video_device = "";
    }

    console.debug("[devices] init: ", this)
    return this;
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
    console.log("[devices] mic level: ", this.audio_context)
    await this.audio_context.audioWorklet.addModule(workerUrl)
    let microphone = this.audio_context.createMediaStreamSource(this.audio_stream)
    const node = new AudioWorkletNode(this.audio_context, 'volume_meter')

    node.port.onmessage = event => {
      let _volume = 0
      let _rms = 0
      let _dB = 0

      console.log('[devices] latest readings:', event.data)

      if (event.data.volume) {
        _volume = event.data.volume
        _rms = event.data.rms
        _dB = event.data.dB
        this.micLevel(_volume)
      }
    }

    microphone.connect(node)
    return this.audio_context
  }


}

const defaultDevices = new LocalDevices();

export default defaultDevices;

import workerUrl from 'worker-plugin/loader!../lib/volmeter-processor';

export class AudioStreamVolume {
  constructor(stream, onVolume) {
    this.volume = 0;
    this.context = new AudioContext();
    this.media = null;
    this.node = null;

    // Init context.
    this.promise = this.context.audioWorklet.addModule(workerUrl).then(() => {
      this.media = this.context.createMediaStreamSource(stream);
      this.node = new AudioWorkletNode(this.context, 'volume_meter');
      this.node.port.onmessage = event => {
        if (event && event.data && event.data.volume !== undefined) {
          if (this.volume !== event.data.volume) {
            this.volume = event.data.volume;
            if (onVolume) {
              onVolume(event.data.volume);
            }
          }
        }
      }
    }).catch((e) => {
      console.error('Failed initializeind audio stream volume!', e);
    });
  }

  suspend() {
    if (this.media && this.node) {
      this.media.disconnect(this.node);
    }
  }

  resume() {
    if (this.media && this.node) {
      this.media.connect(this.node);
    }
  }

  close() {
    this.promise = this.promise.then(() => this.context.close());
    return this.promise;
  }
}

export const gainStream = (stream, gain) => {
  const ctx = new AudioContext();
  const src = ctx.createMediaStreamSource(stream);
  const dst = ctx.createMediaStreamDestination();
  const gainNode = ctx.createGain();
  gainNode.gain.value = 3;
  [src, gainNode, dst].reduce((a, b) => a && a.connect(b));
  return [ctx, dst.stream];
}

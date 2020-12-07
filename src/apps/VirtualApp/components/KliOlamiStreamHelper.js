import { Janus } from '../../../lib/janus';
import GxyJanus from '../../../shared/janus-utils';

const ALL_KLI_OLAMI_STREAM_ID = 102;
let janus;
let streamHandle;

const initJanus = () => {
  return new Promise((resolve) => {
    if (janus)
      return resolve();

    Janus.init({
      debug: process.env.NODE_ENV !== 'production' ? ['log', 'error'] : ['log', 'error'],

      callback: () => {
        const gateways = GxyJanus.gatewayNames('streaming');
        const gateway  = gateways[Math.floor(Math.random() * gateways.length)];
        const config   = GxyJanus.instanceConfig(gateway);

        janus = new Janus({
          server: config.url,
          iceServers: config.iceServers,
          success: () => {
            Janus.log(' :: Connected to JANUS');
            resolve(true);
          },
          error: (err) => {
            Janus.log(JSON.stringify(err));
            console.error('RELOAD ON ERROR', err);
          },
          destroyed: () => {
            Janus.log('Janus handle successfully destroyed.');
          }
        });
      }
    });
  });
};

export const initStream = async (updateStream) => {
  await initJanus();

  return janus.attach({
    plugin: 'janus.plugin.streaming',
    success: (videostream) => {
      Janus.debug(`connected to videostream:${videostream}`);

      streamHandle = videostream;
      videostream.send({ 'message': { 'request': 'watch', id: ALL_KLI_OLAMI_STREAM_ID } });
    },
    error: (error) => {
      Janus.warn('Error attaching plugin: ' + error);
    },
    iceState: (state) => {
      Janus.warn('ICE state changed to ' + state);
    },
    webrtcState: (on) => {
      Janus.warn('Janus says our WebRTC PeerConnection is ' + (on ? 'up' : 'down') + ' now');
    },
    slowLink: (uplink, lost, mid) => {
      Janus.warn('Janus reports problems ' + (uplink ? 'sending' : 'receiving') +
        ' packets on mid ' + mid + ' (' + lost + ' lost packets)');
    },
    onmessage: (msg, jsep) => {
      Janus.log(`Got a message ${JSON.stringify(msg)}`);
      if (streamHandle !== null && jsep !== undefined && jsep !== null) {
        Janus.log('Handling SDP as well...', jsep);
        // Answer
        streamHandle.createAnswer({
          jsep: jsep,
          media: { audioSend: false, videoSend: false },
          success: (jsep) => {

            Janus.log('Got SDP!', jsep);
            streamHandle.send({ message: { request: 'start' }, jsep: jsep });
          },
          customizeSdp: (jsep) => {
            Janus.log(':: Modify original SDP: ', jsep);
            jsep.sdp = jsep.sdp.replace(/a=fmtp:111 minptime=10;useinbandfec=1\r\n/g, 'a=fmtp:111 minptime=10;useinbandfec=1;stereo=1;sprop-stereo=1\r\n');
          },
          error: (error) => {
            Janus.log('WebRTC error: ' + error);
          }
        });
      }
    },
    onremotetrack: (track, mid, on) => {
      Janus.warn(' ::: Got a remote video track event :::');
      Janus.warn('Remote video track (mid=' + mid + ') ' + (on ? 'added' : 'removed') + ':', track);
      if (!on) {
        return;
      }

      let stream = new MediaStream();
      stream.addTrack(track.clone());
      updateStream(stream);
    },
    oncleanup: () => {
      Janus.warn('Got a cleanup notification - videostream.');
    }
  });
};

export const detach = () => {
  if (!streamHandle)
    return;
  streamHandle.detach({
    success: () => streamHandle = null,
    error: () => streamHandle = null
  });
};


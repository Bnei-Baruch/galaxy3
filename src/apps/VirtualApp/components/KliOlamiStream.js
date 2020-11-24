import React, { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@material-ui/core/Box';
import { Janus } from '../../../lib/janus';
import { captureMessage } from '../../../shared/sentry';
import FullScreenHelper from '../FullScreenHelper';

const ALL_KLI_OLAMI_STREAM_ID = 102;
let streamHandle;

const initStream = (janus, updateStream) => {
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

const detach = () => {
  streamHandle && streamHandle.detach({
    success: () => streamHandle = null,
    error: () => streamHandle = null
  });
};

const KliOlamiStream = ({ janus }) => {
  const ref = useRef();

  useEffect(() => {
    initStream(janus, attachStream);
    return detach;
  }, []);

  const attachStream = (stream) => Janus.attachMediaStream(ref.current, stream);

  return (
    <Box className="video">
      <video
        ref={ref}
        autoPlay={true}
        controls={true}
        muted={true}
        playsInline={true}
      />
    </Box>
  );
};

export default KliOlamiStream;

import React, { useEffect, useRef } from 'react';
import classNames from 'classnames';
import { Icon } from 'semantic-ui-react';
import { renderUserName, renderNoCam, renderQuestion } from './helper';
import Box from '@material-ui/core/Box';

const MyMedia = (props) => {
  const { cammuted, user, question, muted, connectionIcon, video = {} } = props;
  const { setting: { height, width } = {}, stream }                     = video;
  const videoRef                                                        = useRef();

  useEffect(() => {
    stream && videoRef && (videoRef.current.srcObject = stream);
  }, [stream, videoRef]);

  const renderVideo = () => (
    <video
      ref={videoRef}
      id="localVideo"
      width={width}
      height={height}
      autoPlay={true}
      controls={false}
      muted={true}
      playsInline={true} />
  );

  if (!video)
    return null;

  return (
    <Box className="video">
      <div className={classNames('video__overlay')}>
        {question ? renderQuestion() : null}
        <div className="video__title">
          {muted ? <Icon name="microphone slash" size="small" color="red" /> : ''}
          {renderUserName(user)}
          <Icon style={{ marginLeft: '0.3rem' }} name="signal" size="small" color={connectionIcon} />
        </div>
      </div>
      {cammuted ? renderNoCam() : renderVideo()}
    </Box>
  );

};

export default MyMedia;

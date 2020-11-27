import React, {useCallback} from 'react';
import classNames from 'classnames';
import {Icon} from 'semantic-ui-react';
import {renderUserName, renderNoCam, renderQuestion} from './helper';
import Box from '@material-ui/core/Box';

const MyMedia = (props) => {
  const {cammuted, user, question, muted, connectionIcon, video = {}} = props;
  const {setting: {height, width} = {}, stream} = video;

  const renderVideo = useCallback(() => {
    return (
      <video
        src={stream ? URL.createObjectURL(stream) : null}
        id="localVideo"
        width={width}
        height={height}
        autoPlay={true}
        controls={false}
        muted={true}
        playsInline={true}/>
    );
  }, [stream, height, width]);

  if (!video)
    return null;

  return (
    <Box className="video">
      <div className={classNames('video__overlay')}>
        {question ? renderQuestion() : null}
        <div className="video__title">
          {muted ? <Icon name="microphone slash" size="small" color="red"/> : ''}
          {renderUserName(user)}
          <Icon style={{marginLeft: '0.3rem'}} name="signal" size="small" color={connectionIcon}/>
        </div>
      </div>
      {cammuted ? renderNoCam() : renderVideo()}
    </Box>
  );

};

export default MyMedia;

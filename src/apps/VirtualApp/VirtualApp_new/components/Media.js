import React, { useEffect, useRef, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { CardActionArea, CardContent, Card } from '@material-ui/core';
import classNames from 'classnames';
import { Icon, Popup } from 'semantic-ui-react';

import { getMedia } from '../../../../shared/tools';
import { renderUserName, renderNoCam, renderQuestion } from '../helper';

const renderVideo = (video) => (
  <video
    src={URL.createObjectURL(video)}
    autoPlay={true}
    controls={false}
    muted={true}
    playsInline={true} />
);

const renderAudio = (audio) => (
  <audio
    src={URL.createObjectURL(audio)}
    autoPlay={true}
    controls={false}
    playsInline={true} />
);

const Media = (props) => {
  const { cammute, user, question, muted, connectionIcon, feed, talking, muteOtherCams, mid } = props;

  const { audio, video, audio_stream, video_stream, display: { display } } = feed;

  const mute = cammute || muteOtherCams;

  const renderMedia = () => {
    return (
      <>
        {audio && video_stream && renderVideo(video_stream)}
        {video && audio_stream && renderAudio(audio_stream)}
      </>
    );
  };

  return (
    <Card>
      <CardActionArea>
        <CardContent>
          <div className={'video'}>
            <div className={classNames('video__overlay', { 'talk-frame': talking })}>
              {question ? renderQuestion() : null}
              <div className="video__title">
                {!talking ? <Icon name="microphone slash" size="small" color="red" /> : null}
                {renderUserName(display)}
                <Icon style={{ marginLeft: '0.3rem' }} name="signal" size="small" color={connectionIcon} />
              </div>
            </div>
            {cammute ? renderNoCam(mute) : renderMedia()}
          </div>
        </CardContent>
      </CardActionArea>
    </Card>
  );

};

export default Media;
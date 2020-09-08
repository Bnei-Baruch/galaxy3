import React, { useEffect, useRef, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import { Icon, Popup } from 'semantic-ui-react';
import { getMedia } from '../../../../shared/tools';
import CardActionArea from '@material-ui/core/CardActionArea';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';

const useStyles = makeStyles({
  video: {
    height: ({ height = 'auto' }) => height,
    width: ({ width = 'auto' }) => width
  },
});

const renderNoCam = () => (
  <svg className={classNames('nowebcam')} viewBox="0 0 32 18"
       preserveAspectRatio="xMidYMid meet">
    <text x="16" y="9" textAnchor="middle" alignmentBaseline="central"
          dominantBaseline="central">&#xf2bd;</text>
  </svg>
);

const renderUserName = (user) => (
  <Popup
    content={user ? user.username : ''}
    mouseEnterDelay={200}
    mouseLeaveDelay={500}
    on='hover'
    trigger={<div className='title-name'>{user ? user.username : ''}</div>}
  />
);

const renderQuestion = () => (
  <div className="question">
    <svg viewBox="0 0 50 50">
      <text x="25" y="25" textAnchor="middle"
            alignmentBaseline="central"
            dominantBaseline="central">&#xF128;</text>
    </svg>
  </div>
);

const Media = (props) => {
  const { cammuted, user, question, muted, connectionIcon, video = {} } = props;
  const { setting: { height, width } = {}, stream }                     = video;

  const classes = useStyles({ height, width });

  const renderVideo = () => {
    return (
      <video
        src={stream ? URL.createObjectURL(stream) : null}
        id="localVideo"
        width={width}
        height={height}
        autoPlay={true}
        controls={false}
        muted={true}
        playsInline={true} />
    );
  };

  if (!video)
    return null;

  return (
    <Card>
      <CardActionArea>
        <CardContent>
          <div className={'video ' + classes.video}>
            <div className={classNames('video__overlay')}>
              {question ? renderQuestion() : null}
              <div className="video__title">
                {muted ? <Icon name="microphone slash" size="small" color="red" /> : ''}
                {renderUserName(user)}
                <Icon style={{ marginLeft: '0.3rem' }} name="signal" size="small" color={connectionIcon} />
              </div>
            </div>
            {cammuted ? renderNoCam() : renderVideo()}
          </div>
        </CardContent>
      </CardActionArea>
    </Card>
  );

};

export default Media;
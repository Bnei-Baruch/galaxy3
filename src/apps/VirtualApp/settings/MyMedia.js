import React, { useCallback } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import { Icon } from 'semantic-ui-react';
import CardActionArea from '@material-ui/core/CardActionArea';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import { renderUserName, renderNoCam, renderQuestion } from './helper';

const useStyles = makeStyles({
  video: {
    height: ({ height = 'auto' }) => height,
    width: ({ width = 'auto' }) => width
  },
});

const MyMedia = (props) => {
  const { cammuted, user, question, muted, connectionIcon, video = {} } = props;
  const { setting: { height, width } = {}, stream }                     = video;

  const classes = useStyles({ height, width });

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
        playsInline={true} />
    );
  }, [stream]);

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

export default MyMedia;
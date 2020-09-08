import React, { useEffect } from 'react';
import classNames from 'classnames';
import { Icon, Popup } from 'semantic-ui-react';

const Media = (props) => {
  const { width, height, index, media: { video, audio }, cammuted, user, question, muted } = props;

  useEffect(() => {

  }, []);

  return (<div className="video" key={index}>
    <div className={classNames('video__overlay')}>
      {question ?
        <div className="question">
          <svg viewBox="0 0 50 50">
            <text x="25" y="25" textAnchor="middle"
                  alignmentBaseline="central"
                  dominantBaseline="central">&#xF128;</text>
          </svg>
        </div>
        :
        ''
      }
      <div className="video__title">
        {muted ? <Icon name="microphone slash" size="small" color="red" /> : ''}
        <Popup
          content={user ? user.username : ''}
          mouseEnterDelay={200}
          mouseLeaveDelay={500}
          on='hover'
          trigger={<div className='title-name'>{user ? user.username : ''}</div>}
        />
        <Icon style={{ marginLeft: '0.3rem' }} name="signal" size="small" color={this.connectionIcon()} />
      </div>
    </div>
    <svg className={classNames('nowebcam', { 'hidden': !cammuted })} viewBox="0 0 32 18"
         preserveAspectRatio="xMidYMid meet">
      <text x="16" y="9" textAnchor="middle" alignmentBaseline="central"
            dominantBaseline="central">&#xf2bd;</text>
    </svg>
    <video
      className={classNames('mirror', { 'hidden': cammuted })}
      ref="localVideo"
      id="localVideo"
      width={width}
      height={height}
      autoPlay={true}
      controls={false}
      muted={true}
      playsInline={true} />
  </div>);

};

export default Media;
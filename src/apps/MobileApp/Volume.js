import React, { useEffect, useState } from 'react';
import { Icon } from 'semantic-ui-react';

import './Volume.css';

const Volume = ({ media }) => {
  const [volumeState, setVolumeState] = useState(0);
  const [mutedState, setMutedState] = useState(0);

	useEffect(() => {
		setVolumeState((media && media.volume) || 0);
		setMutedState(!media || media.muted);
	}, [media]);

  const handleMuteUnmute = () => {
    media.muted = !media.muted;
		setMutedState(media.muted);
		if (media.muted) {
			setVolumeState(0);
		} else {
			if (media.volume === 0) {
				media.volume = 0.6;  // Default volume.
			}
			setVolumeState(media.volume);
		}
  };

  return (
    <div className="mediaplayer__volume">
      <button type="button" onClick={handleMuteUnmute}>
        {
          (mutedState || volumeState === 0) && (
            <Icon key="mute" name="volume off" color="white" />
          )
        }
        {
          !mutedState && volumeState > 0 && volumeState < 0.5 && (
            <Icon key="volume-down" name="volume down" color="white" />
          )
        }
        {
          !mutedState && volumeState >= 0.5 && (
            <Icon key="volume-up" name="volume up" color="white" />
          )
        }
      </button>
    </div>
  );
};

const arePropsEqual = (props, nextProps) => {
  const { media } = props;

	const ret = media === nextProps.media;
	return ret;
};

export default React.memo(Volume, arePropsEqual);

import React, { useEffect, useState } from 'react';
import { Icon } from 'semantic-ui-react';

import './Volume.css';

const Volume = ({ media, muted, setMuted }) => {
  const [volumeState, setVolumeState] = useState(0);

	useEffect(() => {
		setVolumeState((media && media.volume) || 0.6 /* default */);
	}, [media, muted]);

  const handleMuteUnmute = () => {
    media.muted = !muted;
    setMuted(media.muted);
		if (muted) {
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
        {(muted || volumeState === 0) && (
            <Icon key="mute" name="volume off" color="red" />
        )}
        {!muted && volumeState > 0 && volumeState < 0.5 && (
            <Icon key="volume-down" name="volume down" color="white" />
        )}
        {!muted && volumeState >= 0.5 && (
            <Icon key="volume-up" name="volume up" color="white" />
        )}
      </button>
    </div>
  );
};

export default Volume

import React, { useEffect, useState } from 'react';
import { Icon } from 'semantic-ui-react';

import './Volume.css';

const Volume = ({ upward = true, media, onVolumeChange, onMuteUnmute }) => {
  const [element, setElement]           = useState(null);
  const [volumeHover, setVolumeHover]   = useState(false);
  const [wasMouseDown, setWasMouseDown] = useState(false);
  const [volumeState, setVolumeState] = useState(0);
  const [mutedState, setMutedState] = useState(0);
  const [documentElem, setDocument] = useState(null);

  // Handle volume change on bar
  useEffect(() => {
		if (documentElem) {
			documentElem.addEventListener('mousemove', handleMove, { passive: false });
			documentElem.addEventListener('touchmove', handleMove, { passive: false });
			documentElem.addEventListener('mouseup', handleEnd, { passive: false });
			documentElem.addEventListener('touchend', handleEnd, { passive: false });
			window.addEventListener('beforeunload', handleClose);
			return () => {
				documentElem.removeEventListener('mousemove', handleMove);
				documentElem.removeEventListener('touchmove', handleMove);
				documentElem.removeEventListener('mouseup', handleEnd);
				documentElem.removeEventListener('touchend', handleEnd);
				window.removeEventListener('beforeunload', handleClose)
			};
		}
  });

	useEffect(() => {
		setVolumeState((media && media.volume) || 0);
		setMutedState(!media || media.muted);
	}, [media]);

  const setVolume = (clientY) => {
    const { top, bottom } = element.getBoundingClientRect();
    const offset          = Math.min(Math.max(0, clientY - top), bottom - top);
    const newVolume       = 1 - (offset / (bottom - top));
		console.log('setVolume', newVolume);
    media.volume = newVolume;
		setVolumeState(newVolume);
		if (newVolume > 0 && media && media.muted) {
			media.muted = false;
			setMutedState(false);
		}
  };

	const handleClose = () => documentElem.defaultView.close();

  const handleMuteUnmute = () => {
    media.muted = !media.muted;
		setMutedState(media.muted);
		if (media.muted) {
			setVolumeState(0);
		} else {
			if (media.volume === 0) {
				media.volume = 0.5;
			}
			setVolumeState(media.volume);
		}
  };

  const handleMouseEnter = () => {
    setVolumeHover(true);
  };

  const handleMouseLeave = () => {
    setVolumeHover(false);
  };

  const handleStart = () => {
    setWasMouseDown(true);
  };

  const handleMove = (e) => {
    if (wasMouseDown) {
      // Resolve clientY from mouse or touch event.
      const clientY = e.touches ? e.touches[e.touches.length - 1].clientY : e.clientY;
      setVolume(clientY);
      e.preventDefault();
    }
  };

  const handleEnd = (e) => {
    if (wasMouseDown) {
      setWasMouseDown(false);
      setVolumeHover(false);
      // Seek on desktop on mouse up. On mobile Move is called so no need to setVolume here.
      if (e.clientY) {
        setVolume(e.clientY);
      }
      e.preventDefault();
    }
  };

  const normalize = (l) => {
    const ret = 100 * l;
    if (ret < 1) {
      return 0;
    }
    return ret;
  };

  const volumePopoverStyle = {
    bottom: upward ? '100%' : 'auto',
    top: upward ? 'auto' : '100%',
    visibility: volumeHover || wasMouseDown ? 'visible' : 'hidden',
  };

  const styleFull = {
    height: `${normalize(volumeState)}px`,
  };

  const styleEmpty = {
    height: `${normalize(1 - volumeState)}px`,
  };

  return (
    <div ref={(ref) => ref && ref.ownerDocument && setDocument(ref.ownerDocument)}
				 className="mediaplayer__volume">
      <button
        type="button"
        onClick={handleMuteUnmute}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {
          (mutedState || volumeState === 0) && (
            <Icon key="mute" name="volume off" />
          )
        }
        {
          !mutedState && volumeState > 0 && volumeState < 0.5 && (
            <Icon key="volume-down" name="volume down" />
          )
        }
        {
          !mutedState && volumeState >= 0.5 && (
            <Icon key="volume-up" name="volume up" />
          )
        }
      </button>
      <div
        className="volume-popover"
        style={volumePopoverStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          ref={c => setElement(c)}
          className="volume-popover__wrapper"
          role="button"
          tabIndex="0"
          onMouseDown={handleStart}
          onTouchStart={handleStart}
        >
          <div className="volume-popover__bar is-full" style={styleFull}>
            <div className="volume-popover__knob" />
          </div>
          <div className="volume-popover__bar is-empty" style={styleEmpty} />
        </div>
      </div>
    </div>
  );
};

const arePropsEqual = (props, nextProps) => {
  const { media } = props;

	return media === nextProps.media;
};

export default React.memo(Volume, arePropsEqual);

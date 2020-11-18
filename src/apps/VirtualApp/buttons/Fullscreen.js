import React from 'react';
import {Fullscreen as FullscreenIcon, FullscreenExit} from '@material-ui/icons';
import {Tooltip, IconButton} from '@material-ui/core';

const Fullscreen = (props) => {
  const { action, isOn, disabled, t } = props;
  const handleAction = () => action(isOn);

  return (
    <Tooltip title={t(isOn ? 'oldClient.fullMode' : 'oldClient.audioMode')} >
      <IconButton
        aria-label={t(isOn ? 'oldClient.fullMode' : 'oldClient.audioMode')}
        disabled={disabled}
        onClick={() => handleAction()}>
        {isOn ? <FullscreenExit/> : <FullscreenIcon  />}
      </IconButton>
    </Tooltip>
  );
};

export { Fullscreen };
export default Fullscreen;
import React from 'react';
import {Mic, MicOff} from '@material-ui/icons';
import {Tooltip, IconButton} from '@material-ui/core';

const Mute = (props) => {
  const { action, isOn, disabled, t } = props;
  const handleAction = () => action(isOn);

  return (
    <Tooltip title={t(isOn ? 'oldClient.unMute' : 'oldClient.mute')} >
      <IconButton
        aria-label={t(isOn ? 'oldClient.unMute' : 'oldClient.mute')}
        disabled={disabled}
        onClick={() => handleAction()}>
        {isOn ? <MicOff color="secondary"/> : <Mic  />}
      </IconButton>
    </Tooltip>
  );
};

export { Mute };
export default Mute;
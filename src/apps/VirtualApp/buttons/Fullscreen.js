import React from 'react';
import { Fullscreen as FullscreenIcon, FullscreenExit } from '@material-ui/icons';
import { Tooltip, IconButton } from '@material-ui/core';
import { useTranslation } from 'react-i18next';

const Fullscreen = (props) => {
  const { action, isOn, disabled } = props;
  const { t }                      = useTranslation();
  const handleAction               = () => action(isOn);

  return (
    <Tooltip title={t(isOn ? 'oldClient.openFullScreen' : 'oldClient.closeFullScreen')}>
      <IconButton
        aria-label={t(isOn ? 'oldClient.openFullScreen' : 'oldClient.closeFullScreen')}
        disabled={disabled}
        onClick={() => handleAction()}>
        {isOn ? <FullscreenExit /> : <FullscreenIcon />}
      </IconButton>
    </Tooltip>
  );
};

export { Fullscreen };
export default Fullscreen;

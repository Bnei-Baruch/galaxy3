import React from 'react';
import { DesktopAccessDisabled, DesktopWindows } from '@material-ui/icons';
import { Tooltip, IconButton } from '@material-ui/core';

const CloseBroadcast = (props) => {
  const { action, isOn, disabled, t } = props;
  const handleAction                  = () => action();

  return (
    <Tooltip title={isOn ? t('oldClient.closeBroadcast') : t('oldClient.openBroadcast')} disableTouchListener={true}>
      <span>
        <IconButton
          aria-label={isOn ? t('oldClient.closeBroadcast') : t('oldClient.openBroadcast')}
          disabled={disabled}
          onClick={() => handleAction()}>
          {isOn ? <DesktopWindows /> : <DesktopAccessDisabled color="secondary" />}
        </IconButton>
      </span>
    </Tooltip>
  );
};

export { CloseBroadcast };
export default CloseBroadcast;

import React from 'react';
import { Public } from '@material-ui/icons';
import { Tooltip, IconButton } from '@material-ui/core';
import { useTranslation } from 'react-i18next';

const KliOlamiToggle = (props) => {
  const { action, isOn, disabled } = props;
  const { t }                          = useTranslation();

  const handleAction = () => action();

  return (
    <Tooltip title={isOn ? t('oldClient.closeKliOlami') : t('oldClient.openKliOlami')}>
      <IconButton
        aria-label={isOn ? t('oldClient.closeKliOlami') : t('oldClient.openKliOlami')}
        disabled={disabled}
        onClick={() => handleAction()}>
        {isOn ? <Public /> : <Public color="secondary" />}
      </IconButton>
    </Tooltip>
  );
};

export { KliOlamiToggle };
export default KliOlamiToggle;

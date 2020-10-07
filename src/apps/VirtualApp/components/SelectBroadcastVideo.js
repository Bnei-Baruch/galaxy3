import React from 'react';
import { Divider, MenuItem, Typography } from '@material-ui/core';
import { videos_options2 } from '../../../shared/consts';
import { useTranslation } from 'react-i18next';
import TextField from '@material-ui/core/TextField';

export const SelectBroadcastVideo = ({ setVideo, videos }) => {
  const { t } = useTranslation();

  const renderDivider = () => <Divider key="divider" />;

  const renderOption = (op) => (
    <MenuItem key={op.key} inputMode="text" value={op.value}>
      <Typography>{`${t(op.text)} ${op.description}`}</Typography>
    </MenuItem>
  );

  const handleSelect = (e) => {
    setVideo(e.target.value);
  };

  return (
    <TextField
      label={t('settings.broadcastQuality')}
      fullWidth={true}
      variant="outlined"
      value={videos}
      onChange={handleSelect}
      select
    >
      {
        videos_options2.map(op => {
          if (op.divider === true) return renderDivider();
          return renderOption(op);
        })
      }
    </TextField>
  );
};

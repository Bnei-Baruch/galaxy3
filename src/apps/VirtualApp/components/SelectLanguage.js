import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListItemIcon, ListItemText, Divider, Typography, TextField, ListItem } from '@material-ui/core';
import { CenterFocusWeak, Group } from '@material-ui/icons';
import { blue } from '@material-ui/core/colors';

import { audiog_options2 } from '../../../shared/consts';

export const SelectLanguage = ({ setAudio }) => {
  const { t }                   = useTranslation();
  const vrt_lang                = Number(localStorage.getItem('vrt_lang')) || 2;
  const [selected, setSelected] = useState(audiog_options2.find(op => op.value === vrt_lang));

  const headerIconByName = (name) => {
    switch (name) {
    case 'group':
      return <Group />;
    case 'crosshairs':
      return <CenterFocusWeak />;
    default:
      return null;
    }
  };
  const renderHeader     = (op) => (
    <ListItem key={op.text}>
      <ListItemIcon>{headerIconByName(op.icon)}</ListItemIcon>
      <ListItemText
        primary={t(op.text)}
        secondary={t(op.description)}
      />
    </ListItem>
  );

  const renderDivider = key => <Divider key={`divider_${key}`} />;

  const renderOption = (op) => (
    <ListItem key={op.key} value={op} button>
      <Typography>{t(op.text)}</Typography>
    </ListItem>
  );

  const handleSelectLang = (value, eng_text) => {
    setSelected(audiog_options2.find(op => op.value === value));
    setAudio(value, eng_text);
  };

  return (
    <TextField
      select={true}
      variant="outlined"
      label={t('settings.broadcastLanguage')}
      fullWidth={true}
      value={selected}
      onChange={({ target: { value: { value, eng_text } } }) => handleSelectLang(value, eng_text)}
    >
      {
        audiog_options2.map((op, i) => {
          switch (true) {
          case op.header:
            return renderHeader(op);
          case op.divider:
            return renderDivider(i);
          default:
            return renderOption(op);
          }
        })
      }
    </TextField>
  );
};

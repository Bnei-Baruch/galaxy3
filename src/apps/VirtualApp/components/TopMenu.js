import React, { useRef, useState } from 'react';
import { ListItemIcon, List, ListItemText, ListItem, IconButton, SwipeableDrawer, Divider } from '@material-ui/core';
import { AccountBox, Close, ExitToApp, Feedback, Help, Menu as MenuIcon, Settings } from '@material-ui/icons';
import Menu from '@material-ui/core/Menu';
import { kc } from '../../../components/UserManager';
import { updateSentryUser } from '../../../shared/sentry';
import { getLanguage } from '../../../i18n/i18n';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';

const helpUrlsByLang = {
  'en': 'https://bit.ly/2JkBU08',
  'es': 'https://bit.ly/39miYbJ',
  'he': 'https://bit.ly/3amR5BV',
  'ru': 'https://bit.ly/2UE1l1Y'
};

export const TopMenu = ({ t, openSettings, open = false, setOpen }) => {
  const anchorRef = useRef();

  const handleClick = (event) => {
    setOpen(!open);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const toggleMenu = (o = !open) => setOpen(o);

  const helpByLang = () => {
    let url = helpUrlsByLang[getLanguage()];

    return (
      <ListItem button key={'help'} onClick={() => window.open(url, '_blank')}>
        <ListItemText primary={t('feedback.help')} />
        <ListItemSecondaryAction><Help /></ListItemSecondaryAction>
      </ListItem>
    );
  };

  const renderMenu = () => {
    return (
      <List>
        <ListItem style={{ fontWeight: 'bold' }}>{t('oldClient.user')}</ListItem>
        <ListItem button key={'account'} onClick={() => window.open('https://accounts.kbb1.com/auth/realms/main/account', '_blank')}>
          <ListItemText primary={t('oldClient.myAccount')} />
          <ListItemSecondaryAction><AccountBox /></ListItemSecondaryAction>
        </ListItem>
        <ListItem button key={'settings'} onClick={openSettings}>
          <ListItemText primary={t('oldClient.settings')} />
          <ListItemSecondaryAction><Settings /></ListItemSecondaryAction>
        </ListItem>
        <ListItem button key={'signOut'} onClick={() => {
          kc.logout();
          updateSentryUser(null);
        }}>
          <ListItemText primary={t('oldClient.signOut')} />
          <ListItemSecondaryAction><ExitToApp /></ListItemSecondaryAction>
        </ListItem>
        <Divider />
        <ListItem style={{ fontWeight: 'bold' }}>{t('oldClient.support')}</ListItem>
        <ListItem button onClick={() => window.open('https://forms.gle/F6Lm2KMLUkU4hrmK8', '_blank')}>
          <ListItemText>
            {t('feedback.feedback')}
          </ListItemText>
          <ListItemSecondaryAction><Feedback /></ListItemSecondaryAction>
        </ListItem>
        {helpByLang()}
        <Divider />

        <ListItem style={{ fontWeight: 'bold' }}>{t('oldClient.usefulLinks')}</ListItem>
        <ListItem button onClick={() => window.open('https://kabbalahgroup.info/internet/', '_blank')}>
          <ListItemText>{t('Sviva Tova')}</ListItemText>
        </ListItem>
      </List>
    );
  };

  return (
    <>
      <IconButton
        edge="start"
        color="inherit"
        onClick={() => toggleMenu(true)}
        style={{ margin: '0 1em' }}
        ref={anchorRef}
      >
        {open ? <Close /> : <MenuIcon />}
      </IconButton>
      <Menu
        id="help-menu"
        anchorEl={anchorRef.current}
        open={open}
        onClose={handleClose}
        getContentAnchorEl={null}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        {renderMenu()}
      </Menu>
    </>
  );
};

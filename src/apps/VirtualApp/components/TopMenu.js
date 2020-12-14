import React, { useRef, useState } from 'react';

import {
  List,
  ListItemText,
  ListItem,
  IconButton,
  Menu,
  Divider,
  ListItemSecondaryAction,
  Collapse
} from '@material-ui/core';
import {
  AccountBox,
  Close,
  ExitToApp,
  Feedback,
  Help,
  Menu as MenuIcon,
  Settings,
  Translate
} from '@material-ui/icons';
import { grey } from '@material-ui/core/colors';
import makeStyles from '@material-ui/core/styles/makeStyles';

import { kc } from '../../../components/UserManager';
import { updateSentryUser } from '../../../shared/sentry';
import { getLanguage, languagesOptions, setLanguage } from '../../../i18n/i18n';

const helpUrlsByLang = {
  'en': 'https://bit.ly/2JkBU08',
  'es': 'https://bit.ly/39miYbJ',
  'he': 'https://bit.ly/3amR5BV',
  'ru': 'https://bit.ly/2UE1l1Y'
};

const useStyles      = makeStyles(() => ({
  submenuItem: {
    paddingLeft: '2em',
    background: grey[300]
  }
}));
export const TopMenu = ({ t, openSettings, open = false, setOpen, notApproved }) => {
  const classes                           = useStyles();
  const menuRef                           = useRef();
  const [openLanguages, setOpenLanguages] = useState(false);

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

  const renderLanguage = ({ key, text, value }) => {
    return (
      <ListItem button key={key} className={classes.submenuItem} onClick={e => setLanguage(value)}>
        <ListItemText primary={text} />
        <Divider />
      </ListItem>
    );
  };

  const renderMenu = () => {
    return (
      <List>
        <ListItem style={{ fontWeight: 'bold' }}>{t('oldClient.user')}</ListItem>
        <ListItem button key={'account'} onClick={() => window.open('https://accounts.kab.info/auth/realms/main/account', '_blank')}>
          <ListItemText primary={t('oldClient.myAccount')} />
          <ListItemSecondaryAction><AccountBox /></ListItemSecondaryAction>
        </ListItem>
        {
          notApproved
            ? (
              <>
                <ListItem button key={'languages'} onClick={() => setOpenLanguages(!openLanguages)}>
                  <ListItemText primary={t('oldClient.language')} />
                  <ListItemSecondaryAction><Translate /></ListItemSecondaryAction>
                </ListItem>
                <Collapse in={openLanguages} timeout="auto" unmountOnExit>
                  <List component="div" disablePadding>
                    {languagesOptions.map(renderLanguage)}
                  </List>
                </Collapse>
              </>
            )
            : (
              <ListItem button key={'settings'} onClick={openSettings}>
                <ListItemText primary={t('oldClient.settings')} />
                <ListItemSecondaryAction><Settings /></ListItemSecondaryAction>
              </ListItem>
            )
        }
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
          <ListItemText>{t('oldClient.SvivaTova')}</ListItemText>
        </ListItem>
        <ListItem button onClick={() => window.open('https://bb.kli.one', '_blank')}>
          <ListItemText>{t('oldClient.LiveGroups')}</ListItemText>
        </ListItem>
        <ListItem button onClick={() => window.open('https://ktuviot.kbb1.com/three_languages', '_blank')}>
          <ListItemText>{t('oldClient.WorkshopQuestions')}</ListItemText>
        </ListItem>
        <ListItem button onClick={() => window.open('https://kabbalahmedia.info/', '_blank')}>
          <ListItemText>{t('oldClient.KabbalahMedia')}</ListItemText>
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
        ref={menuRef}
      >
        {open ? <Close /> : <MenuIcon />}
      </IconButton>
      <Menu
        id="help-menu"
        anchorEl={menuRef.current}
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

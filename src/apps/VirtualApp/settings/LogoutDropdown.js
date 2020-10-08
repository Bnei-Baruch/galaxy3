import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Popper,
  List,
  ClickAwayListener
} from '@material-ui/core';
import { AccountBox, ArrowDropDown, ArrowDropUp, ExitToApp } from '@material-ui/icons';
import { grey } from '@material-ui/core/colors';
import { makeStyles } from '@material-ui/core/styles';

import { kc } from '../../../components/UserManager';
import { updateSentryUser } from '../../../shared/sentry';

const useStyles      = makeStyles({
  root: {
    textTransform: 'none',
    whiteSpace: 'nowrap'
  },
  popper: {
    zIndex: 1,
    background: grey[50]
  }
});
const LogoutDropdown = ({ display }) => {
  const { t }           = useTranslation();
  const [open, setOpen] = useState(false);
  const anchorRef       = useRef();
  const classes         = useStyles();

  const handleClose = () => setOpen(false);

  const handleOpen = () => setOpen(true);

  return (
    <>
      <Button
        ref={anchorRef}
        variant="outlined"
        onClick={handleOpen}
        className={classes.root}
        endIcon={open ? <ArrowDropUp /> : <ArrowDropDown />}
      >
        {display}
      </Button>
      <Popper
        anchorEl={anchorRef.current}
        className={classes.popper}
        disablePortal
        open={open}
      >
        <ClickAwayListener onClickAway={handleClose}>
          <List>
            <ListItem button key={'signOut'} onClick={() => {
              kc.logout();
              updateSentryUser(null);
            }}>
              <ListItemText primary={t('oldClient.signOut')} />
              <ListItemSecondaryAction><ExitToApp /></ListItemSecondaryAction>
            </ListItem>
            <ListItem button key={'account'} onClick={() => {
              window.open('https://accounts.kbb1.com/auth/realms/main/account', '_blank');
              handleClose();
            }}>
              <ListItemText primary={t('oldClient.myAccount')} />
              <ListItemSecondaryAction><AccountBox /></ListItemSecondaryAction>
            </ListItem>
          </List>
        </ClickAwayListener>
      </Popper>
    </>
  );
};

export default LogoutDropdown;
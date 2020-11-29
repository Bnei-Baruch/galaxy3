import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  Dialog,
  Grid,
  Typography
} from '@material-ui/core';
import { green } from '@material-ui/core/colors';
import makeStyles from '@material-ui/core/styles/makeStyles';

import { RegistrationForm } from './RegistrationForm';
import { userRolesEnum } from '../../shared/enums';

const modalStateEnum = {
  close: 1,
  form: 3,
  completed: 4
};

const useStyles = makeStyles(() => ({
  button: {
    background: green[700],
    color: 'white',
    fontWeight: 'bold'
  }
}));

export const RegistrationModals = ({ user, language, updateUserRole }) => {
  const classes                     = useStyles();
  const [modalState, setModalState] = useState(modalStateEnum.close);
  const { t }                       = useTranslation();
  const { role, id }                = user;
  const direction                   = language === 'he' ? 'rtl' : '';

  useEffect(() => {
    if (!localStorage.getItem('notFirstEnter') && role === userRolesEnum.new_user) {
      setModalState(modalStateEnum.form);
      localStorage.setItem('notFirstEnter', 'true');
    }
    if (role === userRolesEnum.pending_approve) {
      setModalState(modalStateEnum.completed);
    }
  }, [role]);

  if (role !== userRolesEnum.pending_approve && role !== userRolesEnum.new_user)
    return null;

  const handleClose = () => {
    setModalState(modalStateEnum.close);
  };

  const renderCompleted = () => {
    return (
      <Dialog
        open={modalState === modalStateEnum.completed}
        onClose={handleClose}
        dir={direction}
      >
        <DialogContent>
          <DialogContentText style={{ textAlign: 'center', fontSize: '2.5rem' }}>
            {t('registration.completed')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Grid container justify="center">
            <Button
              onClick={handleClose}
              style={{ textAlign: 'center', fontSize: '2rem' }}
            >
              {t('galaxyApp.close')}
            </Button>
          </Grid>

        </DialogActions>
      </Dialog>
    );
  };

  const renderForm = () => (
    <RegistrationForm
      user={user}
      id={id}
      onSubmit={updateUserRole}
      onClose={handleClose}
      isOpen={modalState === modalStateEnum.form}
      language={language}
    />
  );

  const renderGoToComplete = () => (
    <>
      <Typography
        dir={direction}
        style={{ textAlign: 'center', fontSize: '2.5rem' }}
      >
        {t('registration.youRegisteredAsGuest')}
      </Typography>
      <Grid container justify="center">
        <Button
          className={classes.button}
          style={{ fontSize: '2rem' }}
          onClick={() => setModalState(modalStateEnum.form)}
        >
          {t('registration.youRegisteredAsGuestLink')}
        </Button>
      </Grid>
    </>
  );

  return (
    <>
      {(modalState === modalStateEnum.form) && renderForm()}
      {renderCompleted()}
      {role === userRolesEnum.new_user && renderGoToComplete()}
    </>
  );
};


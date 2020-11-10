import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';

import makeStyles from '@material-ui/core/styles/makeStyles';
import {
  Button,
  Typography,
  Drawer,
  DialogActions,
  DialogContent,
  DialogContentText,
  Dialog, Grid
} from '@material-ui/core';
import {RegistrationForm} from './RegistrationForm';
import {green} from '@material-ui/core/colors';
import Box from '@material-ui/core/Box';

const modalStateEnum = {
  close: 1,
  toComplete: 2,
  form: 3,
  completed: 4
};

const useStyles = makeStyles(() => ({
  toComplete: {
    padding: '2em 4em'
  },
  toCompleteBtn: {
    color: green[500]
  }
}));

export const RegistrationModals = ({user: {display, role, id}, language, onCloseCallback}) => {
  const classes = useStyles();
  const defState = role === 'guest' ? modalStateEnum.toComplete : modalStateEnum.completed;
  //const defState                    = modalStateEnum.form;
  const [modalState, setModalState] = useState(defState);
  const {t} = useTranslation();

  const handleClose = () => {
    setModalState(modalStateEnum.close);
    console.log('handleClose', onCloseCallback)
    onCloseCallback();
  }

  if (role !== 'pending_new_user' && role !== 'guest')
    return null;

  const renderCompleted = () => {
    return (
      <Dialog
        open={modalState === modalStateEnum.completed}
        onClose={handleClose}
      >
        <DialogContent>
          <DialogContentText>
            {t('registration.completed')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Grid container justify="center">
            <Button
              onClick={handleClose}
            >
              {t('galaxyApp.ok')}
            </Button>
          </Grid>

        </DialogActions>
      </Dialog>
    );
  };

  const renderToComplete = () => {
    return (
      <Drawer
        anchor="top"
        open={modalState === modalStateEnum.toComplete}
        onClose={handleClose}
      >
        <Box className={classes.toComplete}>
          <Typography variant="h4" paragraph>
            {t('registration.welcome', {name: display})}
          </Typography>

          <Typography paragraph>
            {t('registration.youRegisteredAsGuest')}
          </Typography>
          <Grid container justify="center">
            <Button
              size="large"
              variant="text"
              onClick={() => setModalState(modalStateEnum.form)}
              className={classes.toCompleteBtn}
            >
              {t('registration.toComplete')}
            </Button>
          </Grid>
        </Box>
      </Drawer>
    );
  };

  const renderForm = () => (
    <RegistrationForm
      display={display}
      id={id}
      onClose={handleClose}
      isOpen={modalState === modalStateEnum.form}
    />
  );

  return (
    <>
      {renderToComplete()}
      {renderForm()}
      {renderCompleted()}
    </>
  );
};


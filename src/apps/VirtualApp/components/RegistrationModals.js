import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  Dialog, Grid
} from '@material-ui/core';
import {RegistrationForm} from './RegistrationForm';
import {green} from '@material-ui/core/colors';
import Box from '@material-ui/core/Box';
import {userRolesEnum} from "../enums";
import Chip from "@material-ui/core/Chip";
import LogoutDropdown from "../settings/LogoutDropdown";
import {Done} from "@material-ui/icons";

const modalStateEnum = {
  close: 1,
  form: 3,
  completed: 4
};

export const RegistrationModals = ({user: {display, role, id}, language, updateUserRole}) => {
  const [modalState, setModalState] = useState(modalStateEnum.close);
  const {t} = useTranslation();

  useEffect(() => {
    if (!localStorage.getItem("notFirstEnter") && role === userRolesEnum.guest) {
      setModalState(modalStateEnum.form);
      localStorage.setItem("notFirstEnter", 'true')
    }
    if (role === userRolesEnum.pending_new_user) {
      setModalState(modalStateEnum.completed);
    }
  }, [role]);


  if (role !== userRolesEnum.pending_new_user && role !== userRolesEnum.guest)
    return null;

  const handleClose = () => {
    setModalState(modalStateEnum.close);
  }


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

  const renderForm = () => (
    <RegistrationForm
      display={display}
      id={id}
      onSubmit={updateUserRole}
      onClose={handleClose}
      isOpen={modalState === modalStateEnum.form}
      language={language}
    />
  );

  const renderGoToComplete = () => (
    <Grid container justify="center" style={{backgroundColor: "black"}}>
      <Chip
        label={t('registration.youRegisteredAsGuest')}
        onDelete={() => setModalState(modalStateEnum.form)}
        deleteIcon={<Done/>}
      />
    </Grid>
  )

  return (
    <>
      {role === userRolesEnum.guest && renderGoToComplete()}
      {(modalState === modalStateEnum.form) && renderForm()}
      {renderCompleted()}
    </>
  );
};


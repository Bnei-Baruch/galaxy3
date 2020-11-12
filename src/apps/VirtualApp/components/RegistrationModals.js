import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';

import {
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  Dialog,
  Grid,
  Chip
} from '@material-ui/core';
import {RegistrationForm} from './RegistrationForm';
import {userRolesEnum} from "../enums";
import {ListAlt} from "@material-ui/icons";

const modalStateEnum = {
  close: 1,
  form: 3,
  completed: 4
};

export const RegistrationModals = ({user, language, updateUserRole}) => {
  const [modalState, setModalState] = useState(modalStateEnum.close);
  const {t} = useTranslation();
  const {role, id} = user;

  useEffect(() => {
    if (!localStorage.getItem("notFirstEnter") && role === userRolesEnum.new_user) {
      setModalState(modalStateEnum.form);
      localStorage.setItem("notFirstEnter", 'true')
    }
    if (role === userRolesEnum.pending_approve) {
      setModalState(modalStateEnum.completed);
    }
  }, [role]);


  if (role !== userRolesEnum.pending_approve && role !== userRolesEnum.new_user)
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
    <Grid container justify="center" style={{backgroundColor: "black"}}>
      <Chip
        label={t('registration.youRegisteredAsGuest')}
        onDelete={() => setModalState(modalStateEnum.form)}
        deleteIcon={<ListAlt/>}
      />
    </Grid>
  )

  return (
    <>
      {role === userRolesEnum.new_user && renderGoToComplete()}
      {(modalState === modalStateEnum.form) && renderForm()}
      {renderCompleted()}
    </>
  );
};


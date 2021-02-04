import React, { useEffect } from 'react';
import { Button } from '@material-ui/core';
import { initCrisp, openCrisp } from './helper';
import { useTranslation } from 'react-i18next';

export const Support = ({ user }) => {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    initCrisp(null, i18n.language, user, null);
  }, [i18n.language, user]);

  const handleOpenCrisp = () => openCrisp();

  return (
    <Button
      color="default"
      variant="outlined"
      onClick={handleOpenCrisp}
    >
      {t('oldClient.support')}
    </Button>
  );
};

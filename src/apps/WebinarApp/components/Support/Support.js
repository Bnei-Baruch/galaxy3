import React, {useEffect} from "react";
import {Button} from "@mui/material";
import {configCrisp, openCrisp, resetCrisp} from "./helper";
import {useTranslation} from "react-i18next";

export const Support = () => {
  const {t, i18n} = useTranslation();

  useEffect(() => {
    return () => {
      resetCrisp();
    };
  }, []);

  useEffect(() => {
    configCrisp(i18n.language);
  }, [i18n.language]);

  const handleOpenCrisp = () => openCrisp();

  return (
    <Button variant="outlined" onClick={handleOpenCrisp} color="primary" size="small" disableElevation>
      {t("oldClient.support")}
    </Button>
  );
};

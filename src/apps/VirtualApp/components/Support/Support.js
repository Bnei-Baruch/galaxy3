import React, {useEffect} from "react";
import {Button} from "@material-ui/core";
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
    <Button color="default" variant="outlined" onClick={handleOpenCrisp}>
      {t("oldClient.support")}
    </Button>
  );
};

import React from "react";
import {getLanguage, languagesOptions, setLanguage} from "../../../i18n/i18n";
import {ListItem, TextField, Typography} from "@material-ui/core";
import {useTranslation} from "react-i18next";

export const SelectViewLanguage = ({size = "medium", hasLabel = true, fullWidth = true}) => {
  const {t} = useTranslation();
  const lang = getLanguage();

  const renderItem = ({key, text, value}) => (
    <ListItem key={key} value={value} button>
      <Typography>{text}</Typography>
    </ListItem>
  );

  return (
    <TextField
      variant="outlined"
      fullWidth={fullWidth}
      label={hasLabel ? t("settings.interfaceLanguage") : null}
      onChange={(e) => setLanguage(e.target.value)}
      value={lang}
      select
      size={size}
    >
      {languagesOptions.map(renderItem)}
    </TextField>
  );
};

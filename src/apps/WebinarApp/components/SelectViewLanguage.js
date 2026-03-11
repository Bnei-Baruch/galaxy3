import React from "react";
import {getLanguage, languagesOptions, setLanguage} from "../../../i18n/i18n";
import {ListItemButton, TextField, Typography} from "@mui/material";
import {useTranslation} from "react-i18next";

export const SelectViewLanguage = ({size = "medium", hasLabel = true, fullWidth = true}) => {
  const {t} = useTranslation();
  const lang = getLanguage();

  const renderItem = ({key, text, value}) => (
    <ListItemButton key={key} value={value}>
      <Typography>{text}</Typography>
    </ListItemButton>
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

import React from "react";
import {Public} from "@mui/icons-material";
import {Tooltip, IconButton} from "@mui/material";
import {useTranslation} from "react-i18next";

const KliOlamiToggle = (props) => {
  const {action, isOn, disabled} = props;
  const {t} = useTranslation();

  const handleAction = () => action();

  return (
    <Tooltip title={isOn ? t("oldClient.closeKliOlami") : t("oldClient.openKliOlami")} disableTouchListener={true}>
      <span>
        <IconButton
          aria-label={isOn ? t("oldClient.closeKliOlami") : t("oldClient.openKliOlami")}
          disabled={disabled}
          onClick={() => handleAction()}
          size="large"
        >
          {isOn ? <Public /> : <Public color="secondary" />}
        </IconButton>
      </span>
    </Tooltip>
  );
};

export {KliOlamiToggle};
export default KliOlamiToggle;

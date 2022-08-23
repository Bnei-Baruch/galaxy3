import React from "react";
import {DesktopAccessDisabled, DesktopWindows} from "@mui/icons-material";
import {Tooltip, IconButton} from "@mui/material";

const CloseBroadcast = (props) => {
  const {action, isOn, disabled, t} = props;
  const handleAction = () => action();

  return (
    <Tooltip title={isOn ? t("oldClient.closeBroadcast") : t("oldClient.openBroadcast")} disableTouchListener={true}>
      <span>
        <IconButton
          aria-label={isOn ? t("oldClient.closeBroadcast") : t("oldClient.openBroadcast")}
          disabled={disabled}
          onClick={() => handleAction()}
          size="large"
        >
          {isOn ? <DesktopWindows /> : <DesktopAccessDisabled color="secondary" />}
        </IconButton>
      </span>
    </Tooltip>
  );
};

export {CloseBroadcast};
export default CloseBroadcast;

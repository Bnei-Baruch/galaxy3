import React from "react";
import {ScreenShare as ScreenShareIcon, StopScreenShare} from "@mui/icons-material";
import {Tooltip, IconButton} from "@mui/material";
import {useTranslation} from "react-i18next";

// mode:
//  "start" - nobody is sharing, click starts sharing
//  "stop"  - we are sharing, click stops
//  "busy"  - somebody else is sharing and the screen is shown
//  "show"  - somebody else is sharing, but the broadcast is shown; click shows the screen
const ScreenShare = ({mode, name, action, disabled}) => {
  const {t} = useTranslation();

  const titles = {
    start: t("oldClient.shareScreen"),
    stop: t("oldClient.stopShareScreen"),
    busy: t("oldClient.screenShareBusy", {name: name || ""}),
    show: t("oldClient.showSharedScreen", {name: name || ""}),
  };
  const title = titles[mode] || titles.start;

  return (
    <Tooltip title={title} disableTouchListener={true}>
      <span>
        <IconButton
          aria-label={title}
          disabled={disabled || mode === "busy"}
          onClick={() => action()}
          size="large"
        >
          {mode === "stop" ? <StopScreenShare color="error"/> : <ScreenShareIcon color={mode === "show" ? "primary" : undefined}/>}
        </IconButton>
      </span>
    </Tooltip>
  );
};

export {ScreenShare};
export default ScreenShare;

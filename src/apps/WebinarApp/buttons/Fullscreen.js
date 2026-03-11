import React from "react";
import {Fullscreen as FullscreenIcon, FullscreenExit} from "@mui/icons-material";
import {Tooltip, IconButton} from "@mui/material";
import {useTranslation} from "react-i18next";
import {grey} from "@mui/material/colors";

const Fullscreen = (props) => {
  const {action, isOn, disabled, color = "default"} = props;
  const {t} = useTranslation();

  const handleAction = () => action();

  return (
    <Tooltip title={t(!isOn ? "oldClient.openFullScreen" : "oldClient.closeFullScreen")} disableTouchListener={true}>
      <span>
        <IconButton
          style={{color}}
          aria-label={t(!isOn ? "oldClient.openFullScreen" : "oldClient.closeFullScreen")}
          disabled={disabled}
          onClick={handleAction}
          size="large"
        >
          {isOn ? <FullscreenExit /> : <FullscreenIcon />}
        </IconButton>
      </span>
    </Tooltip>
  );
};

export {Fullscreen};
export default Fullscreen;

import React from "react";
import {Fullscreen as FullscreenIcon, FullscreenExit} from "@material-ui/icons";
import {Tooltip, IconButton} from "@material-ui/core";
import {useTranslation} from "react-i18next";
import {grey} from "@material-ui/core/colors";

const Fullscreen = (props) => {
  const {action, isOn, disabled, color = grey["800"]} = props;
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
        >
          {isOn ? <FullscreenExit /> : <FullscreenIcon />}
        </IconButton>
      </span>
    </Tooltip>
  );
};

export {Fullscreen};
export default Fullscreen;

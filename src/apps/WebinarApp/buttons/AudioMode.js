import React from "react";
import {Hearing} from "@mui/icons-material";
import {Tooltip, IconButton} from "@mui/material";

const AudioMode = (props) => {
  const {action, isOn, disabled, t} = props;
  const handleAction = () => action(isOn);

  return (
    <Tooltip title={t(isOn ? "oldClient.fullMode" : "oldClient.audioMode")} disableTouchListener={true}>
      <span>
        <IconButton
          aria-label={t(isOn ? "oldClient.fullMode" : "oldClient.audioMode")}
          disabled={disabled}
          onClick={() => handleAction()}
          size="large"
        >
          {isOn ? <Hearing color="secondary" /> : <Hearing />}
        </IconButton>
      </span>
    </Tooltip>
  );
};

export {AudioMode};
export default AudioMode;

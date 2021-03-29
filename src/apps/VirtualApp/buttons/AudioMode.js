import React from "react";
import {Hearing} from "@material-ui/icons";
import {Tooltip, IconButton} from "@material-ui/core";

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
        >
          {isOn ? <Hearing color="secondary" /> : <Hearing />}
        </IconButton>
      </span>
    </Tooltip>
  );
};

export {AudioMode};
export default AudioMode;

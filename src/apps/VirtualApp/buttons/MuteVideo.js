import React from "react";
import {Videocam, VideocamOff} from "@mui/icons-material";
import {Tooltip, IconButton} from "@mui/material";

const MuteVideo = (props) => {
  const {action, isOn, disabled, t} = props;
  const handleAction = () => {
    action(isOn);
  };

  return (
    <Tooltip title={t(isOn ? "oldClient.startVideo" : "oldClient.stopVideo")} disableTouchListener={true}>
      <span>
        <IconButton
          aria-label={t(isOn ? "oldClient.startVideo" : "oldClient.stopVideo")}
          disabled={disabled}
          onClick={() => handleAction()}
          size="large"
        >
          {isOn ? <VideocamOff color="secondary" /> : <Videocam />}
        </IconButton>
      </span>
    </Tooltip>
  );
};

export {MuteVideo};
export default MuteVideo;

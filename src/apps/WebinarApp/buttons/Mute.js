import React from "react";
import {Mic, MicOff} from "@mui/icons-material";
import {Tooltip, IconButton, Box} from "@mui/material";

const Mute = React.forwardRef((props, ref) => {
  const {action, isOn, disabled, t} = props;
  const handleAction = () => action(isOn);

  return (
    <Box style={{position: "relative"}}>
      <canvas
        className={isOn ? "hidden" : "vumeter"}
        ref={ref}
        id="canvas1"
        style={{
          width: "45px",
          height: "45px",
        }}
        width="45"
        height="45"
      />
      <Tooltip title={t(isOn ? "oldClient.unMute" : "oldClient.mute")} disableTouchListener={true}>
        <span>
          <IconButton
            aria-label={t(isOn ? "oldClient.unMute" : "oldClient.mute")}
            disabled={disabled}
            onClick={() => handleAction()}
            size="large"
          >
            {isOn ? <MicOff color="secondary" /> : <Mic />}
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
});

export {Mute};
export default Mute;

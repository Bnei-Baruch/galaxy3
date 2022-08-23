import React from "react";
import {Tooltip, IconButton} from "@mui/material";
import {LiveHelp} from "@mui/icons-material";

const AskQuestion = (props) => {
  const {action, isOn, disabled, t} = props;
  const handleAction = () => action();

  return (
    <Tooltip title={t(isOn ? "oldClient.cancelQuestion" : "oldClient.askQuestion")} disableTouchListener={true}>
      <span>
        <IconButton
          aria-label={t(isOn ? "oldClient.cancelQuestion" : "oldClient.askQuestion")}
          disabled={disabled}
          onClick={() => handleAction()}
          size="large"
        >
          {isOn ? <LiveHelp color="secondary" /> : <LiveHelp />}
        </IconButton>
      </span>
    </Tooltip>
  );
};

export {AskQuestion};
export default AskQuestion;

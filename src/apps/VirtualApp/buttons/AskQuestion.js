import React from "react";
import {Tooltip, IconButton} from "@material-ui/core";
import {LiveHelp} from "@material-ui/icons";

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
        >
          {isOn ? <LiveHelp color="secondary" /> : <LiveHelp />}
        </IconButton>
      </span>
    </Tooltip>
  );
};

export {AskQuestion};
export default AskQuestion;

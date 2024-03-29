import React from "react";
import {makeStyles} from "tss-react/mui";
import {ForumRounded} from "@mui/icons-material";
import ButtonBase from "@mui/material/ButtonBase";
import Badge from "@mui/material/Badge";

const useStyles = makeStyles()({
  label: {
    width: "100%",
    display: "block",
    marginTop: "5px",
    whiteSpace: "nowrap",
  },
  disabled: {
    opacity: 0.5,
  },
  button: {
    display: "flex",
    flexDirection: "column",
    margin: "0.5em 1em",
  },
  badge: {
    top: "1px",
    right: "5px",
  },
});

const OpenChat = (props) => {
  const {action, isOn, disabled, t, counter} = props;

  const {classes} = useStyles();

  const handleAction = () => action(isOn);
  const renderButton = () => (
    <ButtonBase
      variant="contained"
      color="secondary"
      disabled={disabled}
      onClick={() => handleAction()}
      classes={{
        root: classes.button,
        disabled: classes.disabled,
      }}
    >
      <ForumRounded />
      <span className={classes.label}>{t(isOn ? "oldClient.closeChat" : "oldClient.openChat")}</span>
    </ButtonBase>
  );

  return counter > 0 ? (
    <Badge badgeContent={counter} color="secondary" className={classes.badge}>
      {renderButton()}
    </Badge>
  ) : (
    renderButton()
  );
};

export {OpenChat};
export default OpenChat;

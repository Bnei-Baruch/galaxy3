import React, {useRef, useState} from "react";
import {useTranslation} from "react-i18next";

import {Button, ListItem, ListItemText, ListItemSecondaryAction, Popper, List, ClickAwayListener} from "@mui/material";
import {AccountBox, ArrowDropDown, ArrowDropUp, ExitToApp} from "@mui/icons-material";
import {grey} from "@mui/material/colors";
import {makeStyles} from "tss-react/mui";

import {kc} from "../../../components/UserManager";
import {updateSentryUser} from "../../../shared/sentry";

const useStyles = makeStyles()({
  root: {
    textTransform: "none",
  },
  label: {
    display: "inline-block",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  popper: {
    zIndex: 1,
    background: grey[50],
  },
});
const LogoutDropdown = ({display}) => {
  const {t} = useTranslation();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef();
  const {classes} = useStyles();

  const handleClose = () => setOpen(false);

  const handleOpen = () => setOpen(true);

  return (
    <>
      <Button
        ref={anchorRef}
        variant="outlined"
        onClick={handleOpen}
        className={classes.root}
        endIcon={open ? <ArrowDropUp /> : <ArrowDropDown />}
        size="small"
      >
        <span className={classes.label}>{display}</span>
      </Button>
      <Popper anchorEl={anchorRef.current} className={classes.popper} disablePortal open={open}>
        <ClickAwayListener onClickAway={handleClose}>
          <List>
            <ListItem
              button
              key={"signOut"}
              onClick={() => {
                kc.logout();
                updateSentryUser(null);
              }}
            >
              <ListItemText primary={t("oldClient.signOut")} />
              <ListItemSecondaryAction>
                <ExitToApp />
              </ListItemSecondaryAction>
            </ListItem>
            <ListItem
              button
              key={"account"}
              onClick={() => {
                window.open("https://accounts.kab.info/auth/realms/main/account", "_blank");
                handleClose();
              }}
            >
              <ListItemText primary={t("oldClient.myAccount")} />
              <ListItemSecondaryAction>
                <AccountBox />
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </ClickAwayListener>
      </Popper>
    </>
  );
};

export default LogoutDropdown;

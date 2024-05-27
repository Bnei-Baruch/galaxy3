import React, {useRef, useState} from "react";

import {
  Collapse,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemSecondaryAction,
  ListItemText,
  Menu,
} from "@mui/material";
import {AccountBox, Close, ExitToApp, Menu as MenuIcon, Settings, Translate} from "@mui/icons-material";
import {grey} from "@mui/material/colors";
import {makeStyles} from "tss-react/mui";

import {kc} from "../../../components/UserManager";
import {updateSentryUser} from "../../../shared/sentry";
import {languagesOptions, setLanguage} from "../../../i18n/i18n";

const useStyles = makeStyles()(() => ({
  submenuItem: {
    paddingLeft: "2em",
    background: grey[300],
  },
}));

export const TopMenu = ({t, openSettings, open = false, setOpen, notApproved, i18n, user}) => {
  const {classes} = useStyles();
  const menuRef = useRef();
  const [openLanguages, setOpenLanguages] = useState(false);

  const handleClose = () => {
    setOpen(false);
  };

  const toggleMenu = (o = !open) => setOpen(o);

  const renderLanguage = ({key, text, value}) => {
    return (
      <ListItemButton key={key} className={classes.submenuItem} onClick={(e) => setLanguage(value)}>
        <ListItemText primary={text} />
        <Divider />
      </ListItemButton>
    );
  };

  const renderMenu = () => {
    return (
      <List>
        <ListItem style={{fontWeight: "bold"}}>{t("oldClient.user")}</ListItem>
        <ListItemButton
          key={"account"}
          onClick={() => window.open("https://accounts.kab.info/auth/realms/main/account", "_blank")}
        >
          <ListItemText>{t("oldClient.myAccount")}</ListItemText>
          <ListItemSecondaryAction>
            <AccountBox />
          </ListItemSecondaryAction>
        </ListItemButton>
        {notApproved ? (
          <>
            <ListItemButton key={"languages"} onClick={() => setOpenLanguages(!openLanguages)}>
              <ListItemText>{t("oldClient.language")}</ListItemText>
              <ListItemSecondaryAction>
                <Translate />
              </ListItemSecondaryAction>
            </ListItemButton>
            <Collapse in={openLanguages} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {languagesOptions.map(renderLanguage)}
              </List>
            </Collapse>
          </>
        ) : (
          <ListItemButton key={"settings"} onClick={openSettings}>
            <ListItemText>{t("oldClient.settings")}</ListItemText>
            <ListItemSecondaryAction>
              <Settings />
            </ListItemSecondaryAction>
          </ListItemButton>
        )}
        <ListItemButton
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
        </ListItemButton>
        <Divider />

        <ListItem style={{fontWeight: "bold"}}>{t("oldClient.usefulLinks")}</ListItem>
        <ListItemButton onClick={() => window.open("https://kabbalahgroup.info/internet/", "_blank")}>
          <ListItemText>{t("oldClient.SvivaTova")}</ListItemText>
        </ListItemButton>
        <ListItemButton onClick={() => window.open("https://bb.kli.one", "_blank")}>
          <ListItemText>{t("oldClient.LiveGroups")}</ListItemText>
        </ListItemButton>
        <ListItemButton onClick={() => window.open("https://ktuviot.kbb1.com/three_languages", "_blank")}>
          <ListItemText>{t("oldClient.WorkshopQuestions")}</ListItemText>
        </ListItemButton>
        <ListItemButton onClick={() => window.open("https://kabbalahmedia.info/", "_blank")}>
          <ListItemText>{t("oldClient.KabbalahMedia")}</ListItemText>
        </ListItemButton>
      </List>
    );
  };

  return (
    <>
      <IconButton
        edge="start"
        color="inherit"
        onClick={() => toggleMenu(true)}
        style={{margin: "0 1em"}}
        ref={menuRef}
        size="large"
      >
        {open ? <Close /> : <MenuIcon />}
      </IconButton>
      <Menu
        id="help-menu"
        anchorEl={menuRef.current}
        open={open}
        onClose={handleClose}
        anchorOrigin={{vertical: "bottom", horizontal: "center"}}
        transformOrigin={{vertical: "top", horizontal: "center"}}
      >
        {renderMenu()}
      </Menu>
    </>
  );
};

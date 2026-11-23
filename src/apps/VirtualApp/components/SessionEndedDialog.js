import * as React from "react";
import {useCallback, useEffect, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import {AUTH_LOGOUT_EVENT, kc} from "../../../components/UserManager";
import {kcLocale} from "../../../i18n/i18n";

// sessionStorage key: after the re-login redirect the client rejoins the room automatically
export const REJOIN_ROOM_KEY = "rejoin_room_after_login";

// Seconds before redirecting to login on our own. MQTT drops the connection
// once the access token expires, so the user has to log in again quickly.
const REDIRECT_SECONDS = 10;

export const SessionEndedDialog = ({inRoom}) => {
  const {t, i18n} = useTranslation();
  const [secondsLeft, setSecondsLeft] = useState(null);
  const inRoomRef = useRef(inRoom);
  inRoomRef.current = inRoom;

  const login = useCallback(() => {
    if (inRoomRef.current) {
      sessionStorage.setItem(REJOIN_ROOM_KEY, "true");
    }
    kc.login({redirectUri: window.location.href, locale: kcLocale(i18n.language)});
  }, [i18n]);

  useEffect(() => {
    const onLogout = (e) => {
      e.preventDefault();
      setSecondsLeft((s) => (s === null ? REDIRECT_SECONDS : s));
    };
    window.addEventListener(AUTH_LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onLogout);
  }, []);

  useEffect(() => {
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) {
      login();
      return;
    }
    const timer = setTimeout(() => setSecondsLeft(secondsLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, login]);

  return (
    <Dialog open={secondsLeft !== null} disableEscapeKeyDown style={{zIndex: 1301}}>
      <DialogTitle>{t("loginPage.sessionEndedTitle")}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t("loginPage.sessionEndedText")}</DialogContentText>
        <DialogContentText sx={{mt: 2}}>
          {t("loginPage.sessionEndedRedirect", {seconds: Math.max(secondsLeft ?? 0, 0)})}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={login} variant="contained" autoFocus>
          {t("loginPage.login")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

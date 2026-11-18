import React, {useState} from "react";
import {ScreenShare as ScreenShareIcon, StopScreenShare} from "@mui/icons-material";
import {Tooltip, IconButton} from "@mui/material";
import {useTranslation} from "react-i18next";
import {
  SCREEN_SHARE_NEW_BADGE_DAYS,
  SCREEN_SHARE_NEW_BADGE_KEY,
  SCREEN_SHARE_NEW_BADGE_SINCE_KEY,
} from "../../../shared/consts";

// The badge is "seen" once clicked, or SCREEN_SHARE_NEW_BADGE_DAYS after it was first shown.
const readBadgeSeen = () => {
  try {
    if (localStorage.getItem(SCREEN_SHARE_NEW_BADGE_KEY) === "true") return true;
    const now = Date.now();
    let since = Number(localStorage.getItem(SCREEN_SHARE_NEW_BADGE_SINCE_KEY));
    if (!since) {
      since = now;
      localStorage.setItem(SCREEN_SHARE_NEW_BADGE_SINCE_KEY, String(since));
    }
    return now - since > SCREEN_SHARE_NEW_BADGE_DAYS * 24 * 60 * 60 * 1000;
  } catch (_) {
    return false;
  }
};

const newBadgeStyle = {
  position: "absolute", top: 2, right: -2, zIndex: 1, pointerEvents: "none",
  padding: "1px 4px", borderRadius: 6, lineHeight: 1.2,
  background: "#d32f2f", color: "#fff", fontSize: 9, fontWeight: 700, textTransform: "uppercase",
};

// mode:
//  "start" - nobody is sharing, click starts sharing
//  "stop"  - we are sharing, click stops
//  "busy"  - somebody else is sharing and the screen is shown
//  "show"  - somebody else is sharing, but the broadcast is shown; click shows the screen
// A small red "New" badge is shown until the user clicks the button once,
// or for SCREEN_SHARE_NEW_BADGE_DAYS since the user first saw it.
const ScreenShare = ({mode, name, action, disabled}) => {
  const {t} = useTranslation();
  const [badgeSeen, setBadgeSeen] = useState(readBadgeSeen);

  const titles = {
    start: `${t("oldClient.shareScreen")} - ${t("oldClient.shareScreenHint")}`,
    stop: t("oldClient.stopShareScreen"),
    busy: t("oldClient.screenShareBusy", {name: name || ""}),
    show: t("oldClient.showSharedScreen", {name: name || ""}),
  };
  const title = titles[mode] || titles.start;

  const handleClick = () => {
    if (!badgeSeen) {
      setBadgeSeen(true);
      try { localStorage.setItem(SCREEN_SHARE_NEW_BADGE_KEY, "true"); } catch (_) { /* storage blocked */ }
    }
    action();
  };

  return (
    <Tooltip title={title} disableTouchListener={true}>
      <span style={{position: "relative", display: "inline-flex"}}>
        <IconButton
          aria-label={title}
          disabled={disabled || mode === "busy"}
          onClick={handleClick}
          size="large"
        >
          {mode === "stop" ? <StopScreenShare color="error"/> : <ScreenShareIcon color={mode === "show" ? "primary" : undefined}/>}
        </IconButton>
        {!badgeSeen && <span style={newBadgeStyle}>{t("oldClient.newFeature")}</span>}
      </span>
    </Tooltip>
  );
};

export {ScreenShare};
export default ScreenShare;

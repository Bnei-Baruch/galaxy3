import React, {useEffect, useRef, useState} from "react";
import classNames from "classnames";
import {useTranslation} from "react-i18next";
import {Button, CircularProgress} from "@mui/material";
import {Fullscreen, FullscreenExit, StopScreenShare} from "@mui/icons-material";
import {isFullScreen, toggleFullScreen} from "../FullScreenHelper";

const overlayStyle = {
  position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  gap: "14px", color: "#fff", textAlign: "center", padding: "8px", background: "#000",
};

const labelStyle = {
  position: "absolute", top: 8, left: 8, zIndex: 2, padding: "2px 8px", borderRadius: 4,
  background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "0.9em",
};

const fsButtonStyle = {
  position: "absolute", top: 8, right: 8, zIndex: 2, padding: 4, lineHeight: 0, cursor: "pointer",
  border: "none", borderRadius: 4, background: "rgba(0,0,0,0.6)", color: "#fff",
};

const stopBarStyle = {
  position: "absolute", bottom: 12, left: 0, right: 0, zIndex: 2,
  display: "flex", alignItems: "center", justifyContent: "center", gap: "12px",
  pointerEvents: "none",
};

// Shared screen shown in place of the broadcast panel.
// isMine: the local user is the one sharing - stream is a local video-only
// preview (muted: the sharer already hears the clip locally), with a Stop button.
const ScreenShareView = ({stream, isMine, name, onStop, isDoubleSize}) => {
  const {t} = useTranslation();
  const wrapperRef = useRef(null);
  const videoRef = useRef(null);
  const [, setFs] = useState(false);

  useEffect(() => {
    if (videoRef.current && videoRef.current.srcObject !== stream) {
      videoRef.current.srcObject = stream || null;
    }
  }, [stream, isMine]);

  useEffect(() => {
    const onFsChange = () => setFs(isFullScreen(wrapperRef.current));
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  const fullScreen = wrapperRef.current ? isFullScreen(wrapperRef.current) : false;
  const label = isMine ? t("oldClient.youAreSharing") : t("oldClient.sharedScreenOf", {name: name || ""});

  return (
    <div
      className={classNames("video video--broadcast video--screen", {"is-double-size": isDoubleSize})}
      ref={wrapperRef}
      style={{background: "#000"}}
    >
      <div style={labelStyle}>{label}</div>
      <button
        style={fsButtonStyle}
        title={t("oldClient.openFullScreen")}
        onClick={() => toggleFullScreen(wrapperRef.current)}
      >
        {fullScreen ? <FullscreenExit/> : <Fullscreen/>}
      </button>
      {!stream && (
        <div style={{...overlayStyle, zIndex: 1}}>
          <CircularProgress size={28} style={{color: "#ffb300"}}/>
          <span>{t("oldClient.screenShareConnecting")}</span>
        </div>
      )}
      {isMine && (
        <div style={stopBarStyle}>
          <Button
            variant="contained"
            color="error"
            startIcon={<StopScreenShare/>}
            onClick={onStop}
            style={{pointerEvents: "auto"}}
          >
            {t("oldClient.stopShareScreen")}
          </Button>
        </div>
      )}
      <div className="mediaplayer" style={{width: "100%", height: "100%"}}>
        <video
          ref={videoRef}
          autoPlay={true}
          playsInline={true}
          muted={isMine}
          controls={false}
          style={{width: "100%", height: "100%", objectFit: "contain", background: "#000"}}
        />
      </div>
    </div>
  );
};

export {ScreenShareView};
export default ScreenShareView;

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

// Shared screen shown in place of the broadcast panel.
// isMine: the local user is the one sharing — show a notice instead of a
// preview (a preview of the whole screen would produce an infinite mirror).
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

  return (
    <div
      className={classNames("video video--broadcast video--screen", {"is-double-size": isDoubleSize})}
      ref={wrapperRef}
      style={{background: "#000"}}
    >
      {isMine ? (
        <div style={overlayStyle}>
          <span style={{fontWeight: 700, fontSize: "1.4em"}}>{t("oldClient.youAreSharing")}</span>
          <Button variant="contained" color="error" startIcon={<StopScreenShare/>} onClick={onStop}>
            {t("oldClient.stopShareScreen")}
          </Button>
        </div>
      ) : (
        <>
          <div style={labelStyle}>{t("oldClient.sharedScreenOf", {name: name || ""})}</div>
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
          <div className="mediaplayer" style={{width: "100%", height: "100%"}}>
            <video
              ref={videoRef}
              autoPlay={true}
              playsInline={true}
              controls={false}
              style={{width: "100%", height: "100%", objectFit: "contain", background: "#000"}}
            />
          </div>
        </>
      )}
    </div>
  );
};

export {ScreenShareView};
export default ScreenShareView;

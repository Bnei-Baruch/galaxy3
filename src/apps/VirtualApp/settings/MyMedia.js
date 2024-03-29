import React, {useEffect, useRef} from "react";
import classNames from "classnames";
import {Icon} from "semantic-ui-react";
import {renderUserName, renderNoCam, renderQuestion} from "./helper";
import Box from "@mui/material/Box";

const MyMedia = (props) => {
  const {user, question, muted, cammuted, connectionIcon, video = {}} = props;
  const {setting: {height, width} = {}, stream} = video;
  const videoRef = useRef();

  useEffect(() => {
    stream && videoRef?.current && (videoRef.current.srcObject = stream);
  }, [stream, videoRef]);

  if (!video) return null;

  return (
    <Box className="video">
      <div className={classNames("video__overlay")}>
        {question ? renderQuestion() : null}
        <div className="video__title">
          {muted ? <Icon name="microphone slash" size="small" color="red" /> : ""}
          {renderUserName(user)}
          <Icon style={{marginLeft: "0.3rem"}} name="signal" size="small" color={connectionIcon} />
        </div>
      </div>
      {renderNoCam(cammuted)}
      <video
        ref={videoRef}
        id="localVideo"
        autoPlay={true}
        controls={false}
        muted={true}
        playsInline={true}
        style={{width: "100%"}}
      />
    </Box>
  );
};
export default MyMedia;

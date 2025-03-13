import React, {useEffect, useState} from "react";
import "./subtitles.scss";
import {messageManager, MSGS_NONE} from "./MessageManager";
import {SubtitlesView} from "./SubtitlesView";

export const WQ_LANG = "wq-language";
export const SUBTITLE_LANG = "subtitle-language";


export const SubtitlesContainer = ({playerLang, layout}) => {
  const [msgState, setMsgState] = useState({});
  const wqLang = localStorage.getItem(WQ_LANG) || playerLang;
  const subLang = localStorage.getItem(SUBTITLE_LANG) || playerLang;

  const handleOnMsg = (state) => {
    console.log("SubtitlesContainer handleOnMsg", state);
    setMsgState(state)
  }
  useEffect(() => {
    messageManager.init(subLang, wqLang, handleOnMsg);
    return () => messageManager.exit();
  }, [subLang, wqLang]);


  if (!msgState || msgState.display_status === MSGS_NONE.display_status)
    return null;

  return <SubtitlesView msgState={msgState}/>
};

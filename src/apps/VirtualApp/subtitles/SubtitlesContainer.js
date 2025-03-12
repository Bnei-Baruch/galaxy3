import React, {useEffect, useState} from "react";
import "./subtitles.scss";
import {messageManager} from "./MessageManager";
import {SubtitlesView} from "./SubtitlesView";

export const WQ_LANG = "wq-language";
export const SUBTITLE_LANG = "subtitle-language";


export const SubtitlesContainer = ({playerLang, layout}) => {
  const [last, setLast] = useState();
  const wqLang = localStorage.getItem(WQ_LANG) || playerLang;
  const subLang = localStorage.getItem(SUBTITLE_LANG) || playerLang;


  const onMsgHandler = (item = null) => setLast(item);

  useEffect(() => {
    messageManager.init(subLang, wqLang, onMsgHandler);
    return () => messageManager.exit();
  }, [subLang, wqLang]);


  if (!last) return null;

  return (
    <SubtitlesView
      last={last}
      layout={layout}
    />
  );
};

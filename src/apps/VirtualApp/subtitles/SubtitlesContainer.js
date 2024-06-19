import React, {useEffect, useState} from "react";
import "./subtitles.scss";
import {MessageManager, MSGS_TYPES} from "./MessageManager";
import {exitSubtitle, initSubtitle} from "./httpHelper";
import {SubtitlesView} from "./SubtitlesView";

export const WQ_LANG = "wq-language";
export const SUBTITLE_LANG = "subtitle-language";

const messageManager = new MessageManager();

const langForCloser = {};
export const SubtitlesContainer = ({playerLang, layout}) => {
  const [last, setLast] = useState();
  const wqLang = localStorage.getItem(WQ_LANG) || playerLang;
  const subtitleLang = localStorage.getItem(SUBTITLE_LANG) || playerLang;
  langForCloser.wqLang = wqLang;

  const wqAvailable = messageManager.getAvailableLangs();

  const onMsgHandler = (data) => {
    let item;
    const lang = data.type === MSGS_TYPES.workshop ? langForCloser.wqLang : subtitleLang;
    if (data.message === "clear") {
      item = messageManager.clear(data, lang);
    } else {
      item = messageManager.push(data, lang);
    }
    setLast(item);
  };

  useEffect(() => {
    subtitleLang && initSubtitle(subtitleLang, onMsgHandler);
    return () => exitSubtitle(subtitleLang, onMsgHandler);
  }, [subtitleLang]);

  useEffect(() => {
    async function fetchData() {
      if (wqLang) {
        const l = messageManager.getWQByLang(wqLang);
        setLast(l);
      }
    }

    fetchData()
  }, [wqLang]);

  if (!last && wqAvailable.length === 0) return null;

  return (
    <SubtitlesView
      last={last}
      available={wqAvailable}
      layout={layout}
      getWQByLang={messageManager.getWQByLang}
      wqLang={wqLang}
    />
  );
};

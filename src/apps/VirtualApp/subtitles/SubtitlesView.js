import React, {useState} from "react";
import "./subtitles.scss";
import {useTranslation} from "react-i18next";
import classNames from "classnames";
import Dropdown from "semantic-ui-react/dist/commonjs/modules/Dropdown";
import Flag from "semantic-ui-react/dist/commonjs/elements/Flag";
import Button from "semantic-ui-react/dist/commonjs/elements/Button";
import Icon from "semantic-ui-react/dist/commonjs/elements/Icon";
import Slider from "react-rangeslider";
import {messageManager, MSGS_QUESTION} from "./MessageManager";
import {subtitle_options} from "../../../shared/consts";

const flagByLang = {
  en: "gb",
  he: "il",
};
const FONT_SIZE_MAX = 35;
const FONT_SIZE_MIN = 14;
const WQ_FONT_SIZE = "wq-font-size";

const tagARegEx = /<a[^>]*>([^<]+)<\/a>/;

export const SubtitlesView = ({last}) => {
  const {t, i18n: {language}} = useTranslation();
  const {message, isRtl, type, slide} = last || {};

  const [fontSize, setFontSize] = useState(localStorage.getItem(WQ_FONT_SIZE) || (FONT_SIZE_MAX + FONT_SIZE_MIN) / 2);
  const [fontPop, setFontPop] = useState(false);
  const [settings, setSettings] = useState(false);
  const [showQuestion, setShowQuestion] = useState(true);

  const copyQuestion = () => {
    if (!message) return;
    navigator.clipboard.writeText(message).then(
      () => console.log("copyQuestion successful"),
      () => alert("Could not copy the question")
    );
  };

  const onSettingsBlur = ({relatedTarget}) => {
    if (!relatedTarget) {
      setSettings(false);
    }
  };

  const handleSwitchWqLang = (l) => messageManager.switchWqLang(l)

  const renderLanguags = () => {
    return (
      <div className={classNames("in-process show-question")}>
        <div className={classNames("in-process-text", {rtl: language === "he"})}>
          {subtitle_options.map((o) => (
            <Button
              compact
              key={o.key}
              content={<Flag name={flagByLang[o.value] || o.value}/>}
              onClick={() => handleSwitchWqLang(o.value)}
            />
          ))}
        </div>
        {/*<div key={availableSel} className={classNames("other-question", {rtl: availableSel === "he"})}>
          {getWQByLang(availableSel)?.message}
        </div>*/}
      </div>
    );
  };

  const renderMsg = () => {
    return (
      <div className="wq__question" style={{fontSize: `${fontSize}px`}}>
        <div
          className={classNames("lang-question message", {"show-question": message, rtl: isRtl})}
          dangerouslySetInnerHTML={{__html: message}}
        />
      </div>
    );
  };

  const renderEditFont = () => {
    return (
      <Dropdown.Item className="manage-font-size">
        <div
          className="manage-font-size-pop__container"
          style={{visibility: fontPop ? "visible" : "hidden"}}
        >
          <div className="manage-font-size-pop__context">
            <Icon name="font" className="decrease-font" aria-hidden="true"/>
            <Slider
              min={FONT_SIZE_MIN}
              max={FONT_SIZE_MAX}
              value={fontSize}
              tooltip={false}
              onChange={(v) => {
                setFontSize(v);
                localStorage.setItem(WQ_FONT_SIZE, v);
              }}
            />
            <Icon name="font" className="increase-font" aria-hidden="true"/>
          </div>
        </div>
        <Icon
          id="manage-font-size"
          name="font"
          title={t("workshop.manageFontSize")}
          onClick={(e) => {
            setFontPop(!fontPop);
            e.stopPropagation();
          }}
        />
      </Dropdown.Item>
    );
  };

  const renderSettings = () => {
    return (
      <div className="wq__toolbar">
        <Dropdown
          className="wq-settings"
          upward
          compact
          icon={null}
          open={settings}
          selectOnBlur={false}
          onBlur={onSettingsBlur}
          trigger={
            <Icon
              name="cog"
              onClick={() => {
                setSettings(!settings);
                setFontPop(false);
              }}
            />
          }
        >
          <Dropdown.Menu>
            {renderEditFont()}
            <Dropdown.Item disabled={!message}>
              <Icon name="copy outline" title={t("workshop.copyQuestion")} onClick={() => copyQuestion()}/>
            </Dropdown.Item>
            <Dropdown.Item>
              <Icon name="eye slash" title={t("workshop.hideQuestion")} onClick={() => setShowQuestion(false)}/>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>
    );
  };

  const isLink = tagARegEx.test(slide);

  return (
    <div className="wq-overlay overlay-visible">
      {isLink ? (
        <div className="subtitle_link" dangerouslySetInnerHTML={{__html: message}}/>
      ) : (
        <div className="wq-container">
          {(type === MSGS_QUESTION.type) && renderLanguags()}
          <div className={classNames("question-container", {"overlay-visible": showQuestion})}>
            {renderMsg()}
            {renderSettings()}
          </div>
          <div className={classNames("show-wq", {"overlay-visible": !showQuestion})}>
            <Button compact icon="eye" title={t("workshop.showQuestion")} onClick={() => setShowQuestion(true)}/>
          </div>
        </div>
      )}
    </div>
  );
};

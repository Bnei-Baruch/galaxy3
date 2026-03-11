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
import {Slide} from "../../../components/Slide";

const flagByLang = {
  en: "gb",
  he: "il",
};
const SLIDE_SIZE_MAX = 30;
const SLIDE_SIZE_MIN = -30;
const DEFAULT_SLIDE_SIZE = 0;
const WQ_SLIDE_SIZE = "wq-slide-size";

const tagARegEx = /<a[^>]*>([^<]+)<\/a>/;

export const SubtitlesView = ({msgState}) => {
  let {msg: {message, isLtr, slide, renderer} = {}, language, wqLangs, display_status} = msgState;

  const {t} = useTranslation();
  const _initSlideSize = Number.parseInt(localStorage.getItem(WQ_SLIDE_SIZE) || DEFAULT_SLIDE_SIZE);
  const [slideSize, setSlideSize] = useState(_initSlideSize);

  // FontSize applied to non-slide content, like a link.
  const fontSize = (slideSize + 30)*0.3 + 14;  // From 14 to 32.
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

  const renderEditFont = () => {
    return (
      <Dropdown.Item className="manage-font-size">
        <div
          className={classNames("manage-font-size-pop__container")}
          style={{visibility: fontPop ? "visible" : "hidden"}}
        >
          <div className="manage-font-size-pop__context">
            <Icon name="font" className="decrease-font" aria-hidden="true"/>
            <Slider
              min={SLIDE_SIZE_MIN}
              max={SLIDE_SIZE_MAX}
              reverse={true}
              value={slideSize}
              tooltip={false}
              onChange={(v) => {
                if (v >= -4 && v <= 4) {
                  // This will have a nice snap effect while dragging the slider.
                  v = 0;
                }
                setSlideSize(v);
                localStorage.setItem(WQ_SLIDE_SIZE, v);
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
      <div className={classNames("wq__toolbar")}>
        <Dropdown
          className={classNames("wq-settings")}
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
        {display_status === MSGS_QUESTION.display_status && message != '' && wqLangs.length > 1 &&
          <Dropdown
              className="wq-language"
              upward
              compact
              options={wqLangs.map((l) => ({key: l, text: l, value: l}))}
              value={language}
              onChange={(event, data) => {
                messageManager.switchWqLang(data.value);
              }}
          />
        }
      </div>
    );
  };

  const isLink = tagARegEx.test(slide);
  const controls = renderSettings();

  return (
    <div className={classNames("wq-overlay", "overlay-visible", {"is-link": isLink})}>
      { isLink ? (
        <div className="subtitle_link" dangerouslySetInnerHTML={{__html: message}}/>
      ) : (
        <div className="wq-container">
          <div className={classNames("question-container")}>
            <div style={{height: 0, width: "100%", color: "transparent", overflow: "hidden"}}>
              spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer
              spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer
              spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer
              spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer
              spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer
              spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer
              spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer
              spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer
              spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer
              spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer
              spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer
              spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer
              spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer
              spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer
              spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer
              spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer spacer
            </div>
            <Slide
                content={message}
                isLtr={isLtr}
                controls={controls}
                isQuestion={display_status === MSGS_QUESTION.display_status}
                slideSize={slideSize}
                alternatives={wqLangs}
                switchLang={(l) => messageManager.switchWqLang(l)}
                overlayVisible={showQuestion}
                renderer={renderer}
            />
            <div className={classNames("show-wq", "ltr", {"overlay-visible": !showQuestion})}>
              <Button compact icon="eye" title={t("workshop.showQuestion")} onClick={() => setShowQuestion(true)}/>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

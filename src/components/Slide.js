import React, { useCallback, useEffect, useRef } from "react";
import markdownit from "markdown-it";
import "./slide.scss";
import {useTranslation} from "react-i18next";
import classNames from "classnames";

export const createMarkdownit = () => {
  return markdownit({ html: true, breaks: false }).disable(['lheading', 'list']);
}

export const Slide = ({ content, isLtr, isQuestion, controls, slideSize, alternatives, switchLang, overlayVisible }) => {
  const outerRef = useRef();  // slide-container
  const slideRef = useRef();  // slide-content
  const blueStripeRef = useRef();
  const greyStripeRef = useRef();
  const md = createMarkdownit();
  const backgroundColor = "#01cd27";
  const {t, i18n: {language: uiLang}} = useTranslation();

  // slideSize [-30,30] should affect the following:
  const slideContentFontSize = (slideSize < 0 ? slideSize*0.85 : slideSize*0.43) + 62;
  const heightFactor = 0.5 + (slideSize+30)/60;

  const handleResize = useCallback(() => {
    if (!outerRef || !outerRef.current || !slideRef || !slideRef.current) {
      return;
    }
    const scale = outerRef.current.clientWidth / 1920;
    slideRef.current.style.transform = `scale(${scale})`;
    slideRef.current.style.transformOrigin = "top left";
    slideRef.current.style.fontSize = `${slideContentFontSize}px`;
    if (isQuestion) {
      slideRef.current.style.height = `${heightFactor * 246}px`;
      outerRef.current.style.height = `${heightFactor * scale * 246}px`;
      outerRef.current.style.bottom = `${scale * 38}px`;
    } else {
      slideRef.current.style.height = `${heightFactor * 315}px`;
      outerRef.current.style.height = `${heightFactor * scale * 310}px`;
      outerRef.current.style.bottom = `0px`;
    }
    blueStripeRef.current.style.height = `${scale * 15}px`;
    greyStripeRef.current.style.height = `${scale * 15}px`;
  }, [outerRef, slideRef, blueStripeRef, greyStripeRef, isQuestion, slideSize]);

  useEffect(() => {
    if (!outerRef || !outerRef.current) {
      return;
    }

    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        handleResize();
      }
    });
    resizeObserver.observe(outerRef.current);

    handleResize();

    return () => {
      resizeObserver.disconnect();
    };
  }, [handleResize, outerRef]);

  useEffect(() => {
    if (content) {
      slideRef.current.innerHTML = md.render(content);
    }
  }, [content, md]);

  return (
    <div
      ref={outerRef}
      className={classNames("slide-container", {"slide-question" : isQuestion, "overlay-visible": overlayVisible})}
    >
      {controls}
      <div className="stripes">
        <div ref={blueStripeRef} className="blue-stripe"></div>
        <div ref={greyStripeRef} className="grey-stripe"></div>
      </div>
      <div
        ref={slideRef}
        className={classNames("slide-content", {"ltr": isLtr, "rtl" : !isLtr})}
      >
        {!content &&
          <p className={classNames("alternatives", {"ui-rtl": uiLang === "he", "ui-ltr": uiLang !== "he"})}>
            {t("workshop.inProcess")}
            {alternatives && alternatives.map((l) => <a id={l} onClick={() => switchLang(l)}>{' '}{l}</a>)}
          </p>
        }
      </div>
    </div>
  );
};

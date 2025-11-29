import React, { useCallback, useEffect, useRef } from "react";
import markdownit from "markdown-it";
import "./slide.scss";
import {useTranslation} from "react-i18next";
import classNames from "classnames";

const smallPlugin = (md) => {
  // This is the core function that parses the syntax
  function smallRule(state, silent) {
    const start = state.pos;
    const marker = state.src.charCodeAt(start);

    // 1. Check if it's the '@' character (0x40)
    if (marker !== 0x40) {
      return false;
    }

    // 2. Check for valid open/close:
    //    - No empty content: @@
    //    - No space after opening marker: @ word
    if (state.src.charCodeAt(start + 1) === 0x40 ||
        state.src.charCodeAt(start + 1) === 0x20) {
      return false;
    }

    // 3. Scan for the closing '@'
    let end = -1;
    for (let i = start + 1; i < state.posMax; i++) {
      if (state.src.charCodeAt(i) === 0x40) {
        end = i;
        break;
      }
    }

    // 4. If no end marker, fail
    if (end === -1) {
      return false;
    }

    // 5. Check for valid close:
    //    - No space before closing marker: word @
    if (state.src.charCodeAt(end - 1) === 0x20) {
      return false;
    }

    // 6. If we're in "silent" mode, we just report success
    //    This is for the parser to check if a rule can be applied
    if (silent) {
      return true;
    }

    // 7. Get the content between the markers
    const content = state.src.slice(start + 1, end);

    // 8. Add the tokens to the state
    state.push('small_open', 'small', 1); // <small>
    state.push('text', '', 0).content = content;
    state.push('small_close', 'small', -1); // </small>

    // 9. Update the parser position to be *after* the closing marker
    state.pos = end + 1;
    return true;
  }

  // Add the new rule to the inline parser
  // We add it 'after' the 'emphasis' rule (for * and _)
  md.inline.ruler.after('emphasis', 'small', smallRule);
};

export const createMarkdownit = () => {
  const md = markdownit({ html: true, breaks: false });
  md.disable(['lheading', 'list']);
  md.use(smallPlugin);
  return md;
}

export const Slide = ({ content, isLtr, isQuestion, controls, slideSize, alternatives, switchLang, overlayVisible, renderer }) => {
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
      className={classNames("slide-container", "renderer-" + renderer, {"slide-question" : isQuestion, "overlay-visible": overlayVisible})}
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

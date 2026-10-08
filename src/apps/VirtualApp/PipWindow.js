// Document Picture-in-Picture window (Chrome/Edge 116+).

import createCache from "@emotion/cache";

let pipWindow = null;
let pipCache = null;
let onCloseCallback = null;

export const isPipSupported = () => "documentPictureInPicture" in window;

export const getPipWindow = () => pipWindow;

// Emotion (MUI) cache that injects styles into PiP document
export const getPipCache = () => pipCache;

export const setOnPipClose = (cb) => {
  onCloseCallback = cb;
};

const copyStyles = (source, target) => {
  Array.from(source.styleSheets).forEach((sheet) => {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch (e) {
      // Cross-origin stylesheet, fallback to link below.
    }

    if (rules && !sheet.href) {
      const style = target.createElement("style");
      style.textContent = Array.from(rules).map((r) => r.cssText).join("\n");
      target.head.appendChild(style);
    } else if (sheet.href) {
      const link = target.createElement("link");
      link.rel = "stylesheet";
      link.href = sheet.href;
      target.head.appendChild(link);
    }
  });
};

// Must be called from user gesture (click) or from "enterpictureinpicture" media session action.
export const openPipWindow = async ({width, height}) => {
  if (pipWindow) return pipWindow;

  const win = await window.documentPictureInPicture.requestWindow({width, height});
  copyStyles(document, win.document);
  win.document.body.style.margin = "0";
  win.document.body.style.background = "#000";
  win.document.body.style.overflow = "hidden";

  win.addEventListener("pagehide", () => {
    pipWindow = null;
    pipCache = null;
    onCloseCallback?.();
  });

  pipCache = createCache({key: "pip", container: win.document.head});
  pipWindow = win;
  return win;
};

export const closePipWindow = () => pipWindow?.close();

export const closeCrisp = () => {
  if (!window.$crisp) return;
  window.$crisp.push(["do", "chat:hide"]);
};

export const openCrisp = () => {
  if (!window.$crisp) return;
  window.$crisp.push(["do", "chat:open"]);
  window.$crisp.push(["do", "chat:show"]);
};

export const initCrisp = (user, locale) => {
  if (window.$crisp) {
    const script = document.querySelector("#crisp");
    if (script) {
      script.remove();
    }
    window.$crisp = undefined;
  }

  window.CRISP_READY_TRIGGER = function () {
    window.$crisp.push(["do", "chat:hide"]);
    window.$crisp.push(["do", "chat:close"]);
    window.$crisp.push(["on", "chat:closed", closeCrisp]);
    window.$crisp.push(["on", "message:received", openCrisp]);
  };

  window.$crisp = [["safe", true]];

  if (user) {
    window.$crisp.push(["set", "user:email", [user.email]]);
    window.$crisp.push(["set", "user:nickname", [user.display]]);
    window.CRISP_RUNTIME_CONFIG = {session_merge: true, locale};
    window.CRISP_TOKEN_ID = user.id;
  }
  window.CRISP_WEBSITE_ID = "a88f7eac-d881-450b-b589-ab82160fb08a";
  (() => {
    let d = document;
    let s = d.createElement("script");
    s.id = "crisp";

    s.src = "https://client.crisp.chat/l.js";
    s.async = 1;
    d.getElementsByTagName("head")[0].appendChild(s);
  })();
};

export const configCrisp = (locale) => {
  if (!window.$crisp) return initCrisp(null, locale);
  window.CRISP_RUNTIME_CONFIG.locale = locale;
  resetCrisp();
};

export const resetCrisp = () => {
  window.$crisp.push(["do", "session:reset"]);
};

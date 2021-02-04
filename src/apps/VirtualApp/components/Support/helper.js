export const openCrisp = () => {
  if (window.$crisp) {
    window.$crisp.push(['do', 'chat:show']);
    window.$crisp.push(['do', 'chat:open']);
  }
};

export const initCrisp = (locale, uiLocale, user, callback) => {
  if (window.$crisp) {
    const script = document.querySelector('#crisp');
    if (script) {
      script.remove();
    }
    window.$crisp = undefined;
  }
  if (!window.$crisp) {
    window.$crisp = [
      ['do', 'chat:hide'],
      ["on", "chat:closed", () => window.$crisp.push(['do', 'chat:hide'])],
      ["on", "message:received", openCrisp],
    ];
    if (user) {
      window.$crisp.push(["set", "user:email", [user.email]]);
      window.$crisp.push(["set", "user:nickname", [user.display]]);
    }
    if (callback) {
      window.$crisp.push(['on', 'session:loaded', callback]);
    }
    window.CRISP_WEBSITE_ID = "a88f7eac-d881-450b-b589-ab82160fb08a";
    window.CRISP_RUNTIME_CONFIG = {locale: locale || uiLocale};

    (() => {
      var d = document;
      var s = d.createElement("script");
      s.id = 'crisp';

      s.src = "https://client.crisp.chat/l.js";
      s.async = 1;
      d.getElementsByTagName("head")[0].appendChild(s);
    })();
  }
};

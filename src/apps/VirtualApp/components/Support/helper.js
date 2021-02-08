let isInit              = false;

export const closeCrisp = () => {
  if (!window.$crisp) return;
  window.$crisp.push(['do', 'chat:hide']);
};

export const openCrisp = () => {
  if (!window.$crisp) return;
  window.$crisp.push(['do', 'chat:open']);
  window.$crisp.push(['do', 'chat:show']);
};

export const initCrisp = () => {
  if (isInit) return;
  isInit = true;

  window.CRISP_WEBSITE_ID    = 'a88f7eac-d881-450b-b589-ab82160fb08a';
  window.CRISP_READY_TRIGGER = function () {
    window.$crisp.push(['do', 'chat:hide']);
    window.$crisp.push(['do', 'chat:close']);
  };

  (() => {
    var d = document;
    var s = d.createElement('script');
    s.id  = 'crisp';

    s.src   = 'https://client.crisp.chat/l.js';
    s.async = 1;
    d.getElementsByTagName('head')[0].appendChild(s);
  })();
};

export const configCrisp = (locale, uiLocale, user) => {
  if (!window.$crisp) return;

  if (user) {
    window.$crisp.push(['set', 'user:email', [user.email]]);
    window.$crisp.push(['set', 'user:nickname', [user.display]]);
  }

  window.$crisp.push(['on', 'chat:closed', closeCrisp]);
  window.$crisp.push(['on', 'message:received', openCrisp]);

  window.CRISP_RUNTIME_CONFIG = { locale: locale || uiLocale };
  window.$crisp.push(['do', 'session:reset', [false]]);
};

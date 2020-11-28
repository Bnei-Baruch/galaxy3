import React, { useEffect, useRef, useState } from 'react';
import { Button, Popup } from 'semantic-ui-react';
import {languagesOptions} from '../../../i18n/i18n';

const openCrisp = () => {
  if (window.$crisp) {
    window.$crisp.push(['do', 'chat:show']);
    window.$crisp.push(['do', 'chat:open']);
  }
};

const initCrisp = (locale, uiLocale, user, callback) => {
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
    window.CRISP_WEBSITE_ID = "7feb1b3b-d46d-409c-b8ee-7a69ad7db06c";
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

const usePrevious = (value) => {
  const ref = useRef();
  useEffect(() => {
        ref.current = value;
      });
  return ref.current;
}

export const Help = ({t, i18n, user}) => {
  const [crispState, setCrispState] = useState({locale: undefined, open: false});
  const prevLocale = usePrevious(crispState.locale);
  const prevUser = usePrevious(user);

  useEffect(() => {
    setCrispState({locale: localStorage.getItem('crisp_locale') || '', open: false});
  }, [])

  useEffect(() => {
    if (crispState.locale !== undefined) {
      const locale = crispState.locale || i18n.language;
      if (prevLocale === undefined || (prevLocale !== undefined && locale && prevLocale !== locale) || !!prevUser !== !!user) {
        initCrisp(crispState.locale, i18n.language, user, crispState.open ? () => openCrisp() : undefined);
      }
    }
  }, [crispState, user])

  if (crispState.locale) {
    return (
      <Button primary onClick={openCrisp} style={{margin: 'auto', marginRight: '10px', backgroundColor: 'rgb(39, 78, 19)'}}>? {t('loginPage.support')}</Button>
    );
  }

  const updateCrispLocale = (locale) => {
    setCrispState({locale, open: true});
    localStorage.setItem('crisp_locale', locale);
  }

  return (
    <Popup
      trigger={<Button primary style={{margin: 'auto', marginRight: '10px', backgroundColor: 'rgb(39, 78, 19)'}}>? {t('loginPage.support')}</Button>}
      on="click"
      position="bottom right"
    >
      <Popup.Content>
        {languagesOptions.map(({value, text}) => <Button basic fluid key={value} onClick={() => updateCrispLocale(value)}>{text}</Button>)}
      </Popup.Content>
    </Popup>
  );
};

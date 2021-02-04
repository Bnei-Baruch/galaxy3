import React, { useEffect, useRef, useState } from 'react';
import { Button, Popup } from 'semantic-ui-react';
import { languagesOptions } from '../../../../i18n/i18n';
import { initCrisp, openCrisp } from './helper';

const usePrevious = (value) => {
  const ref = useRef();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
};

export const SupportOld = ({ t, i18n, user }) => {
  const [crispState, setCrispState] = useState({ locale: undefined, open: false });
  const prevLocale                  = usePrevious(crispState.locale);
  const prevUser                    = usePrevious(user);

  useEffect(() => {
    setCrispState({ locale: localStorage.getItem('crisp_locale') || '', open: false });
  }, []);

  useEffect(() => {
    if (crispState.locale !== undefined) {
      const locale = crispState.locale || i18n.language;
      if (prevLocale === undefined || (locale && prevLocale !== locale) || !!prevUser !== !!user) {
        initCrisp(crispState.locale, i18n.language, user, crispState.open ? () => openCrisp() : undefined);
      }
    }
  }, [crispState, user]);

  if (crispState.locale) {
    return (
      <Button primary onClick={openCrisp} style={{
        margin: 'auto',
        marginRight: '10px',
        backgroundColor: 'rgb(39, 78, 19)'
      }}>? {t('loginPage.support')}</Button>
    );
  }

  const updateCrispLocale = (locale) => {
    setCrispState({ locale, open: true });
    localStorage.setItem('crisp_locale', locale);
  };

  return (
    <Popup
      trigger={<Button primary style={{
        margin: 'auto',
        marginRight: '10px',
        backgroundColor: 'rgb(39, 78, 19)'
      }}>? {t('loginPage.support')}</Button>}
      on="click"
      position="bottom right"
    >
      <Popup.Content>
        {languagesOptions.map(({ value, text }) =>
          <Button basic fluid key={value} onClick={() => updateCrispLocale(value)}>{text}</Button>)}
      </Popup.Content>
    </Popup>
  );
};

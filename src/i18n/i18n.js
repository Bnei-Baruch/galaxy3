import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { resources } from './translations';

export const UI_LANGUAGES = ['en', 'es', 'he', 'ru'];

export const DEFAULT_LANGUAGE = 'en';

export const getLanguage = () => localStorage.getItem('lng') || DEFAULT_LANGUAGE;

export const setLanguage = value => {
  i18n.changeLanguage(value);
  localStorage.setItem('lng', value);
};

const languages = new Map([
  ['en',
    [
      { key: 'en', value: 'en', text: 'English', },
      { key: 'es', value: 'es', text: 'Spanish', },
      { key: 'he', value: 'he', text: 'Hebrew', },
      { key: 'ru', value: 'ru', text: 'Russian', },
    ]
  ],
  ['es',
    [
      { key: 'en', value: 'en', text: 'Ingles', },
      { key: 'es', value: 'es', text: 'Español', },
      { key: 'he', value: 'he', text: 'Hebreo', },
      { key: 'ru', value: 'ru', text: 'Ruso', },
    ]
  ],
  ['he',
    [
      { key: 'en', value: 'en', text: 'אנגלית', },
      { key: 'es', value: 'es', text: 'ספרדית', },
      { key: 'he', value: 'he', text: 'עברית', },
      { key: 'ru', value: 'ru', text: 'רוסית', },
    ]
  ],
  ['ru',
    [
      { key: 'en', value: 'en', text: 'Английский', },
      { key: 'es', value: 'es', text: 'Испанский', },
      { key: 'he', value: 'he', text: 'Иврит', },
      { key: 'ru', value: 'ru', text: 'Русский', },
    ]
  ],
]);

export const mapNameToLanguage = name => languages.get(name) || 'en';

// instance for client side
i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources,
    lng: getLanguage(),

    languages: UI_LANGUAGES,
    fallbackLng: 'en',
    ns: ['common'],
    defaultNS: 'common',

    debug: true,

    interpolation: {
      escapeValue: false, // react already safes from xss
    },

    react: {
      useSuspense: false,
    }
  });

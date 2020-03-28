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
      { key: 'en', value: 'en', text: 'English', flag: 'us', },
      { key: 'es', value: 'es', text: 'Spanish', flag: 'es', },
      { key: 'he', value: 'he', text: 'Hebrew', flag: 'il', },
      { key: 'ru', value: 'ru', text: 'Russian', flag: 'ru', },
    ]
  ],
  ['es',
    [
      { key: 'en', value: 'en', text: 'Ingles', flag: 'us', },
      { key: 'es', value: 'es', text: 'Español', flag: 'es', },
      { key: 'he', value: 'he', text: 'Hebreo', flag: 'il', },
      { key: 'ru', value: 'ru', text: 'Ruso', flag: 'ru', },
    ]
  ],
  ['he',
    [
      { key: 'en', value: 'en', text: 'אנגלית', flag: 'us', },
      { key: 'es', value: 'es', text: 'ספרדית', flag: 'es', },
      { key: 'he', value: 'he', text: 'עברית', flag: 'il', },
      { key: 'ru', value: 'ru', text: 'רוסית', flag: 'ru', },
    ]
  ],
  ['ru',
    [
      { key: 'en', value: 'en', text: 'Английский', flag: 'us', },
      { key: 'es', value: 'es', text: 'Испанский', flag: 'es', },
      { key: 'he', value: 'he', text: 'Иврит', flag: 'il', },
      { key: 'ru', value: 'ru', text: 'Русский', flag: 'ru', },
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

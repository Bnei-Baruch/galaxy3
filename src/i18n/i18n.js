import i18n from "i18next";
import {initReactI18next} from "react-i18next";

import {resources} from "./translations";

export const UI_LANGUAGES = ["en", "es", "he", "ru"];

export const DEFAULT_LANGUAGE = "en";

export const getLanguage = () => localStorage.getItem("lng") || DEFAULT_LANGUAGE;

export const setLanguage = (value) => {
  i18n.changeLanguage(value);
  localStorage.setItem("lng", value);
};

export const kcLocale = (lang) => {
  if (lang === "he") {
    return "il";
  }
  return lang;
};

export const languagesOptions = [
  {key: "en", value: "en", text: "English"},
  {key: "es", value: "es", text: "Español"},
  {key: "he", value: "he", text: "עברית"},
  {key: "ru", value: "ru", text: "Русский"},
];

// instance for client side
i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources,
    lng: getLanguage(),

    languages: UI_LANGUAGES,
    fallbackLng: "en",
    ns: ["common"],
    defaultNS: "common",

    debug: false,

    interpolation: {
      escapeValue: false, // react already safes from xss
    },

    react: {
      useSuspense: false,
    },
  });

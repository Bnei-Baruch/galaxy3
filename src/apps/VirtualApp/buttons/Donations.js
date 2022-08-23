import React from "react";
import {useTranslation} from "react-i18next";
import {Button} from "@mui/material";

const params = new URLSearchParams({
  utm_source: "arvut_system",
  utm_medium: "button",
  utm_campaign: "donations",
  utm_id: "donations",
  utm_content: "header_button_donate",
  utm_term: "heb",
});

const iso2ByIso1 = {
  he: "heb",
  en: "eng",
  ru: "rus",
  es: "spa",
};

const Donations = () => {
  const {
    t,
    i18n: {language},
  } = useTranslation();

  const isHe = language === "he";
  params.set("utm_term", iso2ByIso1[language]);
  const href = `https://www.kab1.com${isHe ? "" : "/" + language}?${params.toString()}`;

  return (
    <Button
      component={"a"}
      href={href}
      className={"top-toolbar__item donate"}
      dir={isHe ? "rtl" : "ltr"}
      target="_blank"
      color="primary"
      variant="outlined"
      size="small"
    >
      {t("oldClient.donate")}
      <span>❤</span>
    </Button>
  );
};

export default Donations;

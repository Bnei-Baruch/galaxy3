import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, CircularProgress, Dialog, DialogTitle, DialogActions, DialogContent, DialogContentText, Grid, MenuItem, TextField } from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import countries from "i18n-iso-countries";

import { LANGUAGES } from "../../../shared/consts";
import { AUTH_API_BACKEND, REGISTRATION_FORM_FIELDS, REGISTRATION_FORM_URL } from "../../../shared/env";
import api from "../../../shared/Api";

let countryById;
const fetchCountriesByLang = (lang = "en") => {
  countries.registerLocale(require(`i18n-iso-countries/langs/en.json`));
  if (lang !== "en") countries.registerLocale(require(`i18n-iso-countries/langs/${lang}.json`));
  countryById = countries.getNames(lang, { select: "official" });
  return Object.keys(countryById);
};

export const RegistrationForm = ({
  user: { familyname, username, email },
  id,
  onClose,
  onSubmit,
  isOpen
}) => {
  const [city, setCity] = useState();
  const [countryIds, setCountryIds] = useState([]);
  const [country, setCountry] = useState();
  const [gender, setGender] = useState();
  const [telephone, setTelephone] = useState();
  const [aboutYou, setAboutYou] = useState();
  const [ten, setTen] = useState();
  const [errors, setErrors] = useState({});
  const [isProgress, setIsProgress] = useState(false);

  const [userLanguage, setUserLanguage] = useState();
  const { t, i18n: { language } } = useTranslation();

  const isRTL = language === "he";

  useEffect(() => {
    const ids = fetchCountriesByLang(language);
    setCountryIds(ids);
  }, [language]);

  const handleCityChange = ({ target: { value } }) => {
    deleteErrorByKey("city");
    setCity(value);
  };
  const handleGenderChange = ({ target: { value } }) => {
    deleteErrorByKey("gender");
    setGender(value);
  };
  const handleTelephoneChange = ({ target: { value } }) => {
    deleteErrorByKey("telephone");
    setTelephone(value);
  };
  const handleAboutYouChange = ({ target: { value } }) => setAboutYou(value);

  const handleTenChange = ({ target: { value } }) => setTen(value);

  const handleCountryChange = (e, op) => {
    deleteErrorByKey("country");
    if (!op) return;
    setCountry(op);
  };

  const handleLanguageChange = (e, op) => {
    deleteErrorByKey("language");
    if (!op) return;
    setUserLanguage(op);
  };

  const deleteErrorByKey = (key) => {
    if (!errors[key]) return;
    const newErr = { ...errors };
    delete newErr[key];
    setErrors(newErr);
  };

  const renderCountries = () => {
    return (
      countryIds && (
        <Autocomplete
          variant="outlined"
          value={country}
          options={countryIds}
          getOptionLabel={(id) => countryById[id]}
          onChange={handleCountryChange}
          fullWidth
          renderInput={(params) => (
            <TextField
              {...params}
              label={t("onboarding.registration.selectCountry")}
              variant="outlined"
              required
              error={errors.country} />
          )} />
      )
    );
  };

  const renderLanguages = () => {
    return (
      LANGUAGES && (
        <Autocomplete
          variant="outlined"
          value={userLanguage}
          options={LANGUAGES}
          getOptionLabel={(r) => r.nativeName}
          onChange={handleLanguageChange}
          fullWidth
          renderInput={(params) => (
            <TextField
              {...params}
              label={t("onboarding.registration.selectLanguage")}
              variant="outlined"
              required
              error={errors.language} />
          )} />
      )
    );
  };

  const renderGender = () => (
    <TextField
      select
      fullWidth
      variant="outlined"
      label={t("onboarding.registration.selectGender")}
      onChange={handleGenderChange}
      value={gender}
      required
      error={errors.gender}>
      <MenuItem key="male" value="male">
        {t("onboarding.registration.male")}
      </MenuItem>
      <MenuItem key="female" value="female">
        {t("onboarding.registration.female")}
      </MenuItem>
    </TextField>
  );

  const submit = async () => {
    if (!validateForm()) return;

    setIsProgress(true);
    let hasError = false;
    try {
      const formOpt = {
        method: "POST",
        body: buildRequestBody(),
        mode: "no-cors",
      };
      await fetch(REGISTRATION_FORM_URL, formOpt);
    } catch (e) {
      e.status === 403 && (hasError = true);
    }

    if (hasError) {
      setIsProgress(false);
      return onSubmit();
    }

    try {
      await updateKCStatus();
      window.location.reload()
    } catch (e) {
      console.log("change kc status error", e);
      window.location.reload()
    }
    setIsProgress(false);
    onSubmit();
  };

  const validateForm = () => {
    let e = {};
    if (!city) e.city = true;
    if (!country) e.country = true;
    if (!userLanguage) e.language = true;
    if (!telephone) e.telephone = true;
    if (!gender) e.gender = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const buildRequestBody = () => {
    const body = new FormData();
    body.set(REGISTRATION_FORM_FIELDS.country, countries.getName(country, "en", { select: "official" }));
    body.set(REGISTRATION_FORM_FIELDS.city, city);
    body.set(REGISTRATION_FORM_FIELDS.aboutYou, aboutYou);
    body.set(REGISTRATION_FORM_FIELDS.gender, gender);
    body.set(REGISTRATION_FORM_FIELDS.ten, ten);
    body.set(REGISTRATION_FORM_FIELDS.telephone, telephone);
    body.set(REGISTRATION_FORM_FIELDS.language, userLanguage.name);
    body.set(REGISTRATION_FORM_FIELDS.userId, id);
    body.set(REGISTRATION_FORM_FIELDS.firstName, username);
    body.set(REGISTRATION_FORM_FIELDS.familyName, familyname);
    body.set(REGISTRATION_FORM_FIELDS.email, email);
    return body;
  };

  const updateKCStatus = async () => {
    const opt = api.defaultOptions();
    opt.method = "POST";
    return await fetch(`${AUTH_API_BACKEND}/pending`, opt);
  };

  const renderForm = () => (
    <Grid container spacing={3} p={3}>
      <Grid item md={6} xs={12} size={{md: 6, xs: 12}}>
        {renderCountries()}
      </Grid>
      <Grid item md={6} xs={12} size={{md: 6, xs: 12}}>
        <TextField
          label={t("onboarding.registration.groupCity")}
          variant="outlined"
          onChange={handleCityChange}
          value={city}
          fullWidth
          required
          error={errors.city} />
      </Grid>
      <Grid item md={6} xs={12} size={{md: 6, xs: 12}}>
        {renderGender()}
      </Grid>
      <Grid item md={6} xs={12} size={{md: 6, xs: 12}}>
        {renderLanguages()}
      </Grid>
      <Grid item md={6} xs={12} size={{md: 6, xs: 12}}>
        <TextField
          label={t("onboarding.registration.telephone")}
          variant="outlined"
          onChange={handleTelephoneChange}
          value={telephone}
          fullWidth
          required
          error={errors.telephone} />
      </Grid>
      <Grid item md={6} xs={12} size={{md: 6, xs: 12}}>
        <TextField
          label={t("onboarding.registration.selectGroup")}
          variant="outlined"
          onChange={handleTenChange}
          value={ten}
          fullWidth />
      </Grid>
      <Grid item xs={12} size={12}>
        <TextField
          label={t("onboarding.registration.aboutYou")}
          variant="outlined"
          onChange={handleAboutYouChange}
          value={aboutYou}
          multiline
          fullWidth />
      </Grid>
    </Grid>
  );

  return <Dialog
    open={isOpen}
    onClose={onClose}
    aria-labelledby="form-dialog-title"
    sx={{ direction: isRTL ? "rtl" : "inherit" }}>
    <DialogTitle id="form-dialog-title">{t("onboarding.registration.title")}</DialogTitle>
    <DialogContent>
      <DialogContentText>
        {t("onboarding.registration.form_text")}
      </DialogContentText>
      {renderForm()}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} color="primary" variant="outlined">
        {t("onboarding.registration.cancel")}
      </Button>
      <Button onClick={submit} color="info" variant="contained"
        sx={{
          marginRight: isRTL ? "8px" : "0",
          marginLeft: isRTL ? "0" : "8px"
        }}>
        {t("onboarding.registration.submit")}
        {isProgress ? <CircularProgress /> : null}
      </Button>
    </DialogActions>
  </Dialog>
};

import React, {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";

import {
  adaptV4Theme,
  Box,
  Button,
  CircularProgress,
  Divider,
  Grid,
  MenuItem,
  Modal,
  TextField,
  Typography,
} from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import {green} from "@mui/material/colors";
import {createTheme, StyledEngineProvider, ThemeProvider} from "@mui/material/styles";
import {makeStyles} from "tss-react/mui";
import countries from "i18n-iso-countries";

import {LANGUAGES} from "../../shared/consts";
import {AUTH_API_BACKEND, REGISTRATION_FORM_FIELDS, REGISTRATION_FORM_URL} from "../../shared/env";

import api from "../../shared/Api";
import RTL from "../../components/RTL";

const rtlTheme = createTheme(
  adaptV4Theme({
    direction: "rtl",
  })
);
const ltrTheme = createTheme(
  adaptV4Theme({
    direction: "ltr",
  })
);

const useStyles = makeStyles()(() => ({
  container: {
    backgroundColor: "white",
    padding: "2em",
    fontSize: "2rem",
    height: "100%",
  },
  textSize: {
    fontSize: "2rem",
  },
  inputTextSize: {
    fontSize: "2.5rem",
    lineHeight: "3rem",
  },
  inputLabelSize: {
    fontSize: "2.5rem",
    lineHeight: "2rem",
  },
  button: {
    background: green[700],
    color: "white",
    fontWeight: "bold",
    fontSize: "2rem",
  },
}));

let countryById;
const fetchCountriesByLang = (lang = "en") => {
  countries.registerLocale(require(`i18n-iso-countries/langs/en.json`));
  if (lang !== "en") countries.registerLocale(require(`i18n-iso-countries/langs/${lang}.json`));
  countryById = countries.getNames(lang, {select: "official"});
  return Object.keys(countryById);
};

export const RegistrationForm = ({
  user: {familyname, username, email, display},
  id,
  onClose,
  onSubmit,
  isOpen,
  language,
}) => {
  const {classes} = useStyles();
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
  const {t} = useTranslation();

  const isRtl = language === "he";

  useEffect(() => {
    const ids = fetchCountriesByLang(language);
    setCountryIds(ids);
  }, [language]);

  const handleCityChange = ({target: {value}}) => {
    deleteErrorByKey("city");
    setCity(value);
  };
  const handleGenderChange = ({target: {value}}) => {
    deleteErrorByKey("gender");
    setGender(value);
  };
  const handleTelephoneChange = ({target: {value}}) => {
    deleteErrorByKey("telephone");
    setTelephone(value);
  };
  const handleAboutYouChange = ({target: {value}}) => setAboutYou(value);

  const handleTenChange = ({target: {value}}) => setTen(value);

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
    const newErr = {...errors};
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
          classes={{option: classes.inputTextSize}}
          renderInput={(params) => (
            <TextField
              {...params}
              label={t("registration.selectCountry")}
              variant="outlined"
              required
              error={errors.country}
              InputProps={{
                ...params.InputProps,
                classes: {root: classes.inputTextSize},
              }}
              InputLabelProps={{
                classes: {
                  root: classes.inputLabelSize,
                },
              }}
            />
          )}
        />
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
          classes={{option: classes.inputTextSize}}
          renderInput={(params) => (
            <TextField
              {...params}
              label={t("registration.selectLanguage")}
              variant="outlined"
              required
              error={errors.language}
              InputProps={{
                ...params.InputProps,
                classes: {root: classes.inputTextSize},
              }}
              InputLabelProps={{
                classes: {
                  root: classes.inputLabelSize,
                },
              }}
            />
          )}
        />
      )
    );
  };

  const renderGender = () => (
    <TextField
      select
      fullWidth={true}
      variant="outlined"
      label={t("registration.selectGender")}
      onChange={handleGenderChange}
      value={gender}
      required
      error={errors.gender}
      className={classes.inputTextSize}
      InputProps={{
        classes: {
          root: classes.inputTextSize,
        },
      }}
      InputLabelProps={{
        classes: {
          root: classes.inputLabelSize,
        },
      }}
    >
      <MenuItem key="male" value="male" className={classes.inputTextSize}>
        {t("registration.male")}
      </MenuItem>
      <MenuItem key="female" value="female" className={classes.inputTextSize}>
        {t("registration.female")}
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
    } catch (e) {
      console.log("change kc status error", e);
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
    console.log("buildRequestBody", countries.getName(country, "en", {select: "official"}));
    body.set(REGISTRATION_FORM_FIELDS.country, countries.getName(country, "en", {select: "official"}));
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
    <>
      <Typography variant="h3" paragraph>
        {t("registration.welcome", {name: display})}
      </Typography>
      <Typography paragraph className={classes.textSize}>
        {t("registration.needVerifyAccount")}
      </Typography>
      <Typography paragraph className={classes.textSize}>
        {t("registration.tellAboutYou")}
      </Typography>
      <Grid container spacing={6}>
        <Grid item xs={6} sm={12}>
          {renderCountries()}
        </Grid>
        <Grid item xs={6} sm={12}>
          <TextField
            label={t("registration.groupCity")}
            variant="outlined"
            onChange={handleCityChange}
            value={city}
            fullWidth
            required
            error={errors.city}
            InputProps={{classes: {root: classes.inputTextSize}}}
            InputLabelProps={{
              classes: {
                root: classes.inputLabelSize,
              },
            }}
          />
        </Grid>
        <Grid item xs={6} sm={12}>
          {renderGender()}
        </Grid>
        <Grid item xs={6} sm={12}>
          {renderLanguages()}
        </Grid>
        <Grid item xs={6} sm={12}>
          <TextField
            label={t("registration.telephone")}
            variant="outlined"
            onChange={handleTelephoneChange}
            value={telephone}
            fullWidth
            required
            error={errors.telephone}
            InputProps={{classes: {root: classes.inputTextSize}}}
            InputLabelProps={{
              classes: {
                root: classes.inputLabelSize,
              },
            }}
          />
        </Grid>
        <Grid item xs={6} sm={12}>
          <TextField
            label={t("registration.selectGroup")}
            variant="outlined"
            onChange={handleTenChange}
            value={ten}
            fullWidth
            InputProps={{classes: {root: classes.inputTextSize}}}
            InputLabelProps={{
              classes: {
                root: classes.inputLabelSize,
              },
            }}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            label={t("registration.aboutYou")}
            variant="outlined"
            onChange={handleAboutYouChange}
            value={aboutYou}
            multiline
            fullWidth
            InputProps={{classes: {root: classes.inputTextSize}}}
            InputLabelProps={{
              classes: {
                root: classes.inputLabelSize,
              },
            }}
          />
        </Grid>
        <Grid container justifyContent="center">
          <Button variant="contained" onClick={submit} className={classes.button} disabled={isProgress}>
            {t("registration.submit")}
            {isProgress ? <CircularProgress /> : null}
          </Button>
        </Grid>
      </Grid>
    </>
  );

  return (
    <RTL>
      <StyledEngineProvider injectFirst>
        <ThemeProvider theme={isRtl ? rtlTheme : ltrTheme}>
          <Modal open={isOpen} onClose={onClose}>
            <Box className={classes.container} maxWidth="md" dir={isRtl ? "rtl" : "ltr"}>
              <Grid container spacing={5}>
                <Grid item xs={12}>
                  {renderForm()}
                </Grid>
                <Grid item xs={12}>
                  <Divider variant="middle" />
                </Grid>
                <Grid item xs={12}>
                  <Box style={{marginTop: "2em"}}>
                    <Typography paragraph style={{fontSize: "1.2em"}}>
                      {t("registration.asGuestYouCan")}
                    </Typography>
                    <Grid container justifyContent="center">
                      <Button variant="contained" onClick={onClose} className={classes.button}>
                        {t("galaxyApp.continueAsGuest")}
                      </Button>
                    </Grid>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Modal>
        </ThemeProvider>
      </StyledEngineProvider>
    </RTL>
  );
};

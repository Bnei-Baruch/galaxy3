import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';

import makeStyles from '@material-ui/core/styles/makeStyles';
import {Button, Modal, Typography, TextField, Grid, MenuItem} from '@material-ui/core';
import Box from '@material-ui/core/Box';
import Autocomplete from '@material-ui/lab/Autocomplete';

import {green, grey} from '@material-ui/core/colors';
import {COUNTRIES, LANGUAGES, TENS} from './optionsData';
import LogoutDropdown from '../settings/LogoutDropdown';
import {REGISTRATION_FORM_FIELDS} from '../../../shared/env';
import api from '../../../shared/Api';

const useStyles = makeStyles(() => ({
  container: {
    backgroundColor: grey[100]
  },
  button: {
    background: green[400],
  }
}));

export const RegistrationForm = ({display, id, onClose, isOpen}) => {
    const classes = useStyles();
    const [tens, setTens] = useState();
    const [city, setCity] = useState();
    const [country, setCountry] = useState();
    const [gender, setGender] = useState('man');
    const [telephone, setTelephone] = useState();
    const [aboutYou, setAboutYou] = useState();
    const [ten, setTen] = useState();
    const [errors, setErrors] = useState({});

    const [userLanguage, setUserLanguage] = useState();
    const {t} = useTranslation();

    useEffect(() => {
      fetchRooms();
    }, []);
    const fetchRooms = () => {
      api.fetchAvailableRooms()
        .then(d => {
          const _tens = d.rooms.map(r => r.description).filter(t => !t.match(/test|info/i));
          setTens(_tens);
        })
        .catch(e => {
          console.log('Need to add permissions for stitt not approved members');
          setTens(TENS);
        });
    };

    const handleCityChange = ({target: {value}}) => {
      errors.city && (delete errors.city);
      setCity(value);
    };
    const handleGenderChange = ({target: {value}}) => setGender(value);
    const handleTelephoneChange = ({target: {value}}) => setTelephone(value);
    const handleAboutYouChange = ({target: {value}}) => setAboutYou(value);
    const handleTenChange = (e, op) => {
      if (!op)
        return;
      setTen(op);
    };
    const handleCountryChange = (e, op) => {
      errors.country && (delete errors.country);
      if (!op)
        return;
      setCountry(op);
    };

    const handleLanguageChange = (e, op) => {
      errors.language && (delete errors.language);
      if (!op)
        return;
      setUserLanguage(op);
    };

    const renderTens = () => {
      return tens && (
        <Autocomplete
          variant="outlined"
          value={ten}
          options={tens}
          getOptionLabel={r => r}
          onChange={handleTenChange}
          renderInput={
            (params) => (
              <TextField {...params} label={t('registration.selectGroup')} variant="outlined"/>
            )
          }
        />
      );
    };

    const renderCountries = () => {
      return (
        <Autocomplete
          variant="outlined"
          value={country}
          options={COUNTRIES}
          getOptionLabel={r => r.name}
          onChange={handleCountryChange}
          renderInput={
            (params) => (
              <TextField
                {...params}
                label={t('registration.selectCountry')}
                variant="outlined"
                required
                error={errors.country}
              />
            )
          }
        />
      );
    };

    const renderLanguages = () => {
      return (
        <Autocomplete
          variant="outlined"
          value={userLanguage}
          options={LANGUAGES}
          getOptionLabel={r => r.nativeName}
          onChange={handleLanguageChange}
          renderInput={
            (params) => (
              <TextField
                {...params}
                label={t('registration.selectLanguage')}
                variant="outlined"
                required
                error={errors.language}
              />
            )
          }
        />
      );
    };

    const renderGender = () => (
      <TextField
        select
        fullWidth={true}
        variant="outlined"
        label={t('registration.selectGender')}
        onChange={handleGenderChange}
        value={gender}
        required
      >
        <MenuItem key="man" value="man">
          {t('registration.man')}
        </MenuItem>
        <MenuItem key="woman" value="woman">
          {t('registration.woman')}
        </MenuItem>
      </TextField>
    );

    const submit = async () => {
      if (!validateForm())
        return;

      let hasError = false;
      try {
        const formOpt = {
          method: 'POST',
          body: buildRequestBody(),
          mode: 'no-cors'
        };
        await fetch('https://docs.google.com/forms/u/0/d/e/1FAIpQLSdQZ1TZ2WihdhyuWrT7mVT8AoTHfX4dNjYtEoB5HBFP_9HttA/formResponse', formOpt);
      } catch (e) {
        (e.status === 403) && (hasError = true);
      }

      if (hasError)
        return onClose();

      try {
        await updateKCStatus();
      } catch (e) {
        console.log('send form error: this is not error');
      }
      onClose();
    };

    const validateForm = () => {
      let e = {};
      if (!city) e.city = true;
      if (!country) e.country = true;
      if (!userLanguage) e.language = true;
      setErrors(e);
      return Object.keys(e).length === 0;
    };

    const buildRequestBody = () => {
      const body = new FormData();
      body.set(REGISTRATION_FORM_FIELDS.country, country.code);
      body.set(REGISTRATION_FORM_FIELDS.city, city);
      body.set(REGISTRATION_FORM_FIELDS.aboutYou, aboutYou);
      body.set(REGISTRATION_FORM_FIELDS.gender, gender);
      body.set(REGISTRATION_FORM_FIELDS.ten, ten);
      body.set(REGISTRATION_FORM_FIELDS.telephone, telephone);
      body.set(REGISTRATION_FORM_FIELDS.language, userLanguage.code);
      body.set(REGISTRATION_FORM_FIELDS.userId, id);
      body.set(REGISTRATION_FORM_FIELDS.display, display);
      return body;
    };

    const updateKCStatus = async () => {
      const opt = api.defaultOptions();
      return await fetch('https://acc.kli.one/api/pending', opt);
    };

    const renderForm = () => (
      <>
        <Typography variant="h4" display={'block'} paragraph>
          {t('registration.welcome', {name: display})}
        </Typography>
        <Typography paragraph>
          {t('registration.needVerifyAccount')}
        </Typography>
        <Typography paragraph>
          {t('registration.tellAboutYou')}
        </Typography>

        <Grid container spacing={6}>
          <Grid item xs={6}>
            {renderCountries()}
          </Grid>
          <Grid item xs={6}>
            <TextField
              label={t('registration.groupCity')}
              variant="outlined"
              onChange={handleCityChange}
              value={city}
              fullWidth
              required
              error={errors.city}
            />
          </Grid>
          <Grid item xs={6}>
            {renderGender()}
          </Grid>
          <Grid item xs={6}>
            {renderLanguages()}
          </Grid>
          <Grid item xs={6}>
            <TextField
              label={t('registration.telephone')}
              variant="outlined"
              onChange={handleTelephoneChange}
              value={telephone}
              fullWidth
            />
          </Grid>
          <Grid item xs={6}>
            {renderTens()}
          </Grid>
          <Grid item xs={12}>
            <TextField
              label={t('registration.aboutYou')}
              variant="outlined"
              onChange={handleAboutYouChange}
              value={aboutYou}
              multiline
              fullWidth
            />
          </Grid>
          <Grid container justify="center">
            <Button
              variant="contained"
              onClick={submit}
              className={classes.button}
            >
              {t('registration.submit')}
            </Button>
          </Grid>
        </Grid>
      </>
    );

    return (
      <Modal
        open={isOpen}
        onClose={onClose}

        style={{verticalAlign: 'middle'}}
      >
        <Box
          className={classes.container}
          maxWidth="md"
          m={10}
          p={10}
        >
          <Grid container spacing={5}>
            <Grid item xs={7}>
              {renderForm()}
            </Grid>
            <Grid item xs={5}>
              <Grid container justify="flex-end">
                <LogoutDropdown display={display}/>
              </Grid>
              <Box style={{marginTop: '10em'}}>
                <Typography paragraph>
                  {t('registration.asGuestYouCan')}
                </Typography>
                <Grid container justify="center">
                  <Button
                    variant="contained"
                    onClick={onClose}
                    className={classes.button}
                  >
                    {t('galaxyApp.continueAsGuest')}
                  </Button>
                </Grid>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Modal>
    );
  }
;


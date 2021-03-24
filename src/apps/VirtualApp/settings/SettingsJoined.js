import React, { memo, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Modal,
  Grid,
  Divider,
  Typography,
  IconButton,
  TextField,
  Tooltip,
  FormControlLabel,
  Checkbox, Box, Button, ListItem
} from '@material-ui/core';
import { AccountCircle, ArrowBackIos, Close, Computer, Mic, Videocam } from '@material-ui/icons';
import { makeStyles, useTheme } from '@material-ui/core/styles';

import { audiog_options2, subtitle_options, vsettings_list } from '../../../shared/consts';
import MyMedia from './MyMedia';
import CheckMySelf from './CheckMySelf';
import { SelectViewLanguage } from '../components/SelectViewLanguage';
import green from '@material-ui/core/colors/green';
import { ThemeContext } from '../components/ThemeSwitcher/ThemeSwitcher';
import { SUBTITLE_LANG, WQ_LANG } from '../subtitles/SubtitlesContainer';

const useStyles = makeStyles(() => ({
  content: {
    outline: 'none',
  },
  modal: {
    border: 'none',
    outline: 'none',

  },
  paper: {
    padding: '2em 2em 0',
    outline: 'none',
    overflowX: 'hidden',
    overflowY: 'auto',
    height: '100%',
    maxWidth: 900,
    margin: '0 auto',
  },
  backBtn: {
    background: green[500]
  },
  icon: { fontSize: '2em', marginRight: '0.5rem' }
}));

const SettingsJoined = (props) => {
  const classes                                = useStyles();
  const { t }                                  = useTranslation();
  const { palette: { background: { paper } } } = useTheme();
  const { isDark, toggleTheme }                = useContext(ThemeContext);

  const [subtitleWQ, setSubtitleWQ]     = useState(localStorage.getItem(WQ_LANG));
  const [subtitleMQTT, setSubtitleMQTT] = useState(localStorage.getItem(SUBTITLE_LANG));

  const { audio, video, audios = 2, isOpen = false, closeModal, userDisplay, audioModeChange, isAudioMode } = props;

  const audio_device = audio?.audio_device || audio?.devices[0]?.deviceId;
  const audioLabel   = audio?.devices.find(d => d.deviceId === audio_device)?.label;

  const video_device = video?.video_device || video?.devices[0]?.deviceId;
  const videoLabel   = video?.devices.find(d => d.deviceId === video_device)?.label;

  const settingsLabel = vsettings_list.find(d => JSON.stringify(video?.setting) === JSON.stringify(d.value))?.text;

  useEffect(() => {
    const op  = audiog_options2.find(op => op.value === audios);
    const key = op.langKey || op.key;
    if (!localStorage.getItem(WQ_LANG)) setSubtitleWQ(key);
    if (!localStorage.getItem(SUBTITLE_LANG)) setSubtitleMQTT(key);

  }, [audios]);

  const handleAudioModeChange = () => audioModeChange();

  const renderHeader = () => (
    <>
      <Grid item xs={11}>
        <Typography variant="h5" display="block" color="textPrimary">
          {t('oldClient.settings')}
        </Typography>
      </Grid>
      <Grid item xs={1}>
        <IconButton onClick={closeModal} color="textPrimary">
          <Close />
        </IconButton>
      </Grid>
    </>
  );

  const renderUserSettings = () => {
    return (
      <>
        <Grid item xs={4}>
          <AccountCircle className={classes.icon} color="action" />
          <Typography variant="h6" display="inline" style={{ verticalAlign: 'top' }} color="textPrimary">
            {t('settings.userSettings')}
          </Typography>
        </Grid>
        <Grid item={true} xs={4}>
          <TextField
            label={t('settings.screenName')}
            fullWidth={true}
            variant="outlined"
            value={userDisplay}
            disabled
            color="textPrimary"
          />
        </Grid>
        <Grid item={true} xs={4}>
          <SelectViewLanguage />
        </Grid>
      </>
    );
  };

  const renderSubtitleSettings = () => {
    return (
      <>
        <Grid item={true} xs={4}>
          <Computer className={classes.icon} color="action" />
          <Typography variant="h6" display="inline" style={{ verticalAlign: 'top' }} color="textPrimary">
            {t('settings.subtitlesSettings')}
          </Typography>
        </Grid>
        <Grid item={true} xs={4}>
          <TextField
            variant="outlined"
            fullWidth
            label={t('settings.workshopLanguage')}
            onChange={({ target: { value } }) => {
              localStorage.setItem(WQ_LANG, value);
              setSubtitleWQ(value);
            }}
            value={subtitleWQ}
            select
          >
            {subtitle_options.map(({ key, text }) =>
              (
                <ListItem key={key} value={key} button>
                  <Typography>{text}</Typography>
                </ListItem>
              )
            )}
          </TextField>
        </Grid>
        <Grid item={true} xs={4}>
          <TextField
            variant="outlined"
            fullWidth
            label={t('settings.subtitleLanguage')}
            onChange={({ target: { value } }) => {
              localStorage.setItem(SUBTITLE_LANG, value);
              setSubtitleMQTT(value);
            }}
            value={subtitleMQTT}
            select
          >
            {subtitle_options.map(({ key, text }) =>
              (
                <ListItem key={key} value={key} button>
                  <Typography>{text}</Typography>
                </ListItem>
              )
            )}
          </TextField>
        </Grid>
      </>
    );
  };

  const renderMediaSettings = () => {
    return (
      <>
        <Grid item xs={6}>
          <Grid container spacing={4}>
            <Grid item xs={12}>
              <Videocam className={classes.icon} color="action" />
              <Typography variant="h6" display="inline" style={{ verticalAlign: 'top' }} color="textPrimary">
                {t('settings.cameraSettings')}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Tooltip title={videoLabel} arrow>
                <TextField
                  label={t('settings.cameraSource')}
                  fullWidth={true}
                  disabled={true}
                  variant="outlined"
                  value={videoLabel}
                  color="textPrimary"
                />
              </Tooltip>
            </Grid>
            <Grid item xs={6}>
              <Tooltip title={settingsLabel} arrow>
                <TextField
                  label={t('settings.cameraQuality')}
                  fullWidth={true}
                  variant="outlined"
                  disabled={true}
                  value={settingsLabel}
                  color="textPrimary"
                />
              </Tooltip>
            </Grid>
            <Grid item xs={12}>
              <MyMedia video={{ stream: video.stream }} />
            </Grid>
          </Grid>
        </Grid>
        <Grid item xs={6}>
          <Grid container spacing={4}>
            <Grid item xs={12}>
              <Mic className={classes.icon} color="action" />
              <Typography variant="h6" display="inline" style={{ verticalAlign: 'top' }} color="textPrimary">
                {t('settings.microphoneSettings')}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Tooltip title={audioLabel} arrow>
                <TextField
                  label={t('settings.micSource')}
                  fullWidth={true}
                  variant="outlined"
                  disabled={true}
                  value={audioLabel}
                />
              </Tooltip>
            </Grid>
            <Grid item xs={12}>
              <CheckMySelf audio={audio} />
            </Grid>
          </Grid>
        </Grid>
      </>
    );
  };

  const renderContent = () => {
    return (
      <Grid container spacing={4} className={classes.content}>
        {renderHeader()}
        <Divider variant="fullWidth" style={{ width: '100%' }} />
        {renderUserSettings()}
        <Divider variant="fullWidth" style={{ width: '100%' }} />
        {renderSubtitleSettings()}
        <Divider variant="fullWidth" style={{ width: '100%' }} />
        {renderMediaSettings()}

        <Grid item xs={3}>
          <FormControlLabel
            label={
              <Typography color="textPrimary">
                {t('oldClient.audioMode')}
              </Typography>
            }
            control={
              <Checkbox
                checked={!!isAudioMode}
                onChange={handleAudioModeChange}
                name="isAudioMode"
              />
            }
          />
        </Grid>
        <Grid item xs={9}>
          <FormControlLabel
            label={
              <Typography color="textPrimary">
                {t('oldClient.darkTheme')}
              </Typography>
            }
            control={
              <Checkbox
                checked={isDark}
                onChange={toggleTheme}
                name="isAudioMode"
                color="secondary"
              />
            }
          />
        </Grid>
        <Grid item xs={12}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={closeModal}
            className={classes.backBtn}
          >
            <ArrowBackIos />
            {t('settings.backToTen')}
          </Button>
        </Grid>
      </Grid>
    );
  };

  return (
    <Modal
      open={isOpen}
      disableBackdropClick={true}
      BackdropProps={{
        style: { backgroundColor: paper }
      }}
      className={classes.modal}
    >
      <Box className={classes.paper}>
        {renderContent()}
      </Box>
    </Modal>
  );
};

export default memo(SettingsJoined, ((prevProps, nextProps) => {
  const { videoLength, isOpen, audios, userDisplay } = prevProps;
  return (
    videoLength === nextProps.videoLength
    && userDisplay === nextProps.userDisplay
    && isOpen === nextProps.isOpen
    && audios === nextProps.audios
  );
}));

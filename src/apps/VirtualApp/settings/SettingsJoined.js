import React, {useContext, useEffect, useState} from "react";
import {useTranslation} from "react-i18next";

import {
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  ListItemButton,
  MenuItem,
  Modal,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {AccountCircle, ArrowBackIos, Close, Computer, Mic, Videocam} from "@mui/icons-material";
import {makeStyles} from "tss-react/mui";
import {useTheme} from "@mui/material/styles";

import {audiog_options2, subtitle_options, vsettings_list} from "../../../shared/consts";
import MyMedia from "./MyMedia";
import CheckMySelf from "./CheckMySelf";
import {SelectViewLanguage} from "../components/SelectViewLanguage";
import {ThemeContext} from "../components/ThemeSwitcher/ThemeSwitcher";
import {SUBTITLE_LANG, WQ_LANG} from "../subtitles/SubtitlesContainer";

const mapDevice = ({label, deviceId}) => ({text: label, value: deviceId});
const mapOption = ({text, value}) => {
  return (
    <MenuItem key={value} value={value} button>
      {text}
    </MenuItem>
  );
};

const useStyles = makeStyles()(() => ({
  content: {
    outline: "none",
  },
  modal: {
    border: "none",
    outline: "none",
  },
  paper: {
    padding: "2em 2em 0",
    outline: "none",
    overflowX: "hidden",
    overflowY: "auto",
    height: "100%",
    maxWidth: 900,
    margin: "0 auto",
  },
  submitRoot: {height: "100%"},
  icon: {fontSize: "2em", marginRight: "0.5rem"},
}));

const SettingsJoined = (props) => {
  const {classes} = useStyles();
  const {t} = useTranslation();
  const {
    palette: {
      background: {paper},
    },
  } = useTheme();

  const {isDark, toggleTheme} = useContext(ThemeContext);

  const [subtitleWQ, setSubtitleWQ] = useState(localStorage.getItem(WQ_LANG));
  const [subtitleMQTT, setSubtitleMQTT] = useState(localStorage.getItem(SUBTITLE_LANG));

  const {
    audio,
    video,
    audios = 2,
    isOpen = false,
    closeModal,
    userDisplay,
    audioModeChange,
    isAudioMode,
    setAudioDevice,
    audioDevice = audio.devices[0]?.deviceId,
    hideUserDisplays,
    toggleUsersDisplays,
  } = props;

  const audio_device = audio?.device || audio?.devices[0]?.deviceId;
  const audioLabel = audio?.devices.find((d) => d.deviceId === audio_device)?.label;

  const video_device = video?.device || video?.devices[0]?.deviceId;
  const videoLabel = video?.devices.find((d) => d.deviceId === video_device)?.label;

  const settingsLabel = vsettings_list.find((d) => JSON.stringify(video?.setting) === JSON.stringify(d.value))?.text;

  const handleAudioChange = (e) => setAudioDevice(e.target.value);

  useEffect(() => {
    const op = audiog_options2.find((op) => op.value === audios);
    const key = op.langKey || "en";
    if (!localStorage.getItem(WQ_LANG)) setSubtitleWQ(key);
    if (!localStorage.getItem(SUBTITLE_LANG)) setSubtitleMQTT(key);
  }, [audios]);

  const handleAudioModeChange = () => audioModeChange();

  const handleUsersDisplays = () => toggleUsersDisplays()

  const renderHeader = () => (
    <>
      <Grid item xs={11}>
        <Typography variant="h5" display="block" color="textPrimary">
          {t("oldClient.settings")}
        </Typography>
      </Grid>
      <Grid item xs={1}>
        <IconButton onClick={closeModal} color="primary" size="large">
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
          <Typography variant="h6" display="inline" style={{verticalAlign: "top"}} color="textPrimary">
            {t("settings.userSettings")}
          </Typography>
        </Grid>
        <Grid item={true} xs={4}>
          <TextField
            label={t("settings.screenName")}
            fullWidth={true}
            variant="outlined"
            value={userDisplay}
            disabled
            color="primary"
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
          <Typography variant="h6" display="inline" style={{verticalAlign: "top"}} color="textPrimary">
            {t("settings.subtitlesSettings")}
          </Typography>
        </Grid>
        <Grid item={true} xs={4}>
          <TextField
            variant="outlined"
            fullWidth
            label={t("settings.workshopLanguage")}
            onChange={({target: {value}}) => {
              localStorage.setItem(WQ_LANG, value);
              setSubtitleWQ(value);
            }}
            value={subtitleWQ}
            select
          >
            {subtitle_options.map(({key, text}) => (
              <ListItemButton key={key} value={key}>
                <Typography>{text}</Typography>
              </ListItemButton>
            ))}
          </TextField>
        </Grid>
        <Grid item={true} xs={4}>
          <TextField
            variant="outlined"
            fullWidth
            label={t("settings.subtitleLanguage")}
            onChange={({target: {value}}) => {
              localStorage.setItem(SUBTITLE_LANG, value);
              setSubtitleMQTT(value);
            }}
            value={subtitleMQTT}
            select
          >
            {subtitle_options.map(({key, text}) => (
              <ListItemButton key={key} value={key}>
                <Typography>{text}</Typography>
              </ListItemButton>
            ))}
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
              <Typography variant="h6" display="inline" style={{verticalAlign: "top"}} color="textPrimary">
                {t("settings.cameraSettings")}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Tooltip title={videoLabel} arrow>
                <TextField
                  label={t("settings.cameraSource")}
                  fullWidth={true}
                  disabled={true}
                  variant="outlined"
                  value={videoLabel}
                  color="primary"
                />
              </Tooltip>
            </Grid>
            <Grid item xs={6}>
              <Tooltip title={settingsLabel} arrow>
                <TextField
                  label={t("settings.cameraQuality")}
                  fullWidth={true}
                  variant="outlined"
                  disabled={true}
                  value={settingsLabel}
                  color="primary"
                />
              </Tooltip>
            </Grid>
            <Grid item xs={12}>
              <MyMedia video={{stream: video.stream}} />
            </Grid>
          </Grid>
        </Grid>
        <Grid item xs={6}>
          <Grid container spacing={4}>
            <Grid item xs={12}>
              <Mic className={classes.icon} color="action" />
              <Typography variant="h6" display="inline" style={{verticalAlign: "top"}} color="textPrimary">
                {t("settings.microphoneSettings")}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Tooltip title={audioLabel} arrow>
                <TextField
                  variant="outlined"
                  fullWidth={true}
                  onChange={handleAudioChange}
                  value={audioDevice}
                  label={t("settings.selectMic")}
                  select
                >
                  {audio.devices.map(mapDevice).map(mapOption)}
                </TextField>
              </Tooltip>
            </Grid>
            <Grid item xs={12}>
              <CheckMySelf />
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
        <Divider variant="fullWidth" sx={{width: "100%", marginTop: "2em"}} />
        {renderUserSettings()}
        <Divider variant="fullWidth" sx={{width: "100%", marginTop: "2em"}} />
        {renderSubtitleSettings()}
        <Divider variant="fullWidth" sx={{width: "100%", marginTop: "2em"}} />
        {renderMediaSettings()}

        <Grid item xs={12}>
          <FormControlLabel
            label={<Typography color="textPrimary">{t("oldClient.audioMode")}</Typography>}
            control={<Checkbox checked={!!isAudioMode} onChange={handleAudioModeChange} name="isAudioMode" />}
          />
          <FormControlLabel
            label={<Typography color="textPrimary">{t("oldClient.darkTheme")}</Typography>}
            control={<Checkbox checked={isDark} onChange={toggleTheme} name="isDark" color="secondary" />}
          />
          <FormControlLabel
            label={<Typography color="textPrimary">{t("oldClient.hideDisplays")}</Typography>}
            control={<Checkbox checked={hideUserDisplays} onChange={handleUsersDisplays} name="hideDisplays" color="primary"/>}
          />
        </Grid>
        <Grid item xs={12}>
          <Button
            variant="contained"
            color="success"
            size="large"
            onClick={closeModal}
            classes={{root: classes.submitRoot}}
          >
            <ArrowBackIos sx={{color: "white"}} />
            <Typography color="white">{t("settings.backToTen")}</Typography>
          </Button>
        </Grid>
      </Grid>
    );
  };

  return (
    <Modal open={isOpen} componentsProps={{backdrop: {style: {backgroundColor: paper}}}} className={classes.modal}>
      <Box className={classes.paper}>{renderContent()}</Box>
    </Modal>
  );
};

export default SettingsJoined;

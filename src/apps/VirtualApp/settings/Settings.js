import React, {memo, useContext, useEffect, useState} from "react";
import {useTranslation} from "react-i18next";

import {
  Button,
  Checkbox,
  FormControlLabel,
  Modal,
  Grid,
  Typography,
  TextField,
  MenuItem,
  Divider,
  Box,
} from "@material-ui/core";
import Autocomplete from "@material-ui/lab/Autocomplete";
import {makeStyles, useTheme} from "@material-ui/core/styles";
import green from "@material-ui/core/colors/green";

import MyMedia from "./MyMedia";
import CheckMySelf from "./CheckMySelf";
import {vsettings_list} from "../../../shared/consts";
import LogoutDropdown from "./LogoutDropdown";
import {SelectViewLanguage} from "../components/SelectViewLanguage";
import {AccountCircle, Mic, Videocam} from "@material-ui/icons";
import {ThemeContext} from "../components/ThemeSwitcher/ThemeSwitcher";
import {Support} from "../components/Support";

const settingsList = vsettings_list.map(({key, text, value}) => ({key, text, value: JSON.stringify(value)}));
const mapDevice = ({label, deviceId}) => ({text: label, value: deviceId});
const mapOption = ({text, value}) => {
  return (
    <MenuItem key={value} value={value} button>
      {text}
    </MenuItem>
  );
};

const useStyles = makeStyles(() => ({
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
  submitRoot: {
    background: green[500],
    height: "100%",
  },
  submitDisabled: {
    opacity: "0.8",
  },
  icon: {fontSize: "2em", marginRight: "0.5rem"},
}));

const roomDescriptionById = new Map();

const Settings = (props) => {
  const classes = useStyles();

  const [roomInput, setRoomInput] = useState();

  const {t} = useTranslation();
  const {
    palette: {
      background: {paper},
    },
  } = useTheme();
  const {isDark, toggleTheme} = useContext(ThemeContext);

  const {
    audio,
    video,
    rooms,
    isAudioMode,
    initClient,
    selectedRoom,
    selectRoom,
    setAudioDevice,
    setVideoDevice,
    settingsChange,
    audioModeChange,
    videoLength,
    videoSettings,
    audioDevice = audio.devices[0]?.deviceId,
    videoDevice = video?.devices[0]?.deviceId,
    userDisplay,
    wip,
    setWip,
    startLocalMedia,
    stopLocalMedia,
    cammuted,
  } = props;

  useEffect(() => {
    for (const r of rooms) {
      roomDescriptionById.set(r.room, r);
    }
  }, [rooms]);

  const renderCameras = () => {
    if (!videoLength) return null;

    return (
      <TextField
        select
        fullWidth={true}
        variant="outlined"
        label={t("settings.selectCamera")}
        onChange={handleVideoChange}
        value={videoDevice}
      >
        {video.devices.map(mapDevice).map(mapOption)}
      </TextField>
    );
  };

  const toggleCamera = () => {
    if (!video || !video.stream) return;

    if (!video.stream.active) {
      startLocalMedia();
    } else {
      stopLocalMedia();
    }
  };

  const renderVideoSize = () => (
    <TextField
      select
      fullWidth={true}
      variant="outlined"
      label={t("settings.selectSize")}
      onChange={handleSettingsChange}
      value={videoSettings}
      color="primary"
    >
      {settingsList.map(mapOption)}
    </TextField>
  );

  const renderSounds = () => {
    if (!audio?.devices || audio.devices.length === 0) return null;

    return (
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
    );
  };

  const renderRooms = () => {
    if (!rooms || rooms.length === 0) return null;

    return (
      <Autocomplete
        variant="outlined"
        value={roomDescriptionById.size !== 0 ? roomDescriptionById.get(selectedRoom) : {}}
        inputValue={roomInput}
        onInputChange={(e, v) => setRoomInput(v)}
        options={rooms}
        getOptionLabel={(option) => option.description}
        renderOption={({description, num_users}) => (
          <Grid container>
            <Grid item xs={11}>
              {description}
            </Grid>
            <Grid item xs={1}>
              {num_users}
            </Grid>
          </Grid>
        )}
        onChange={handleRoomChange}
        renderInput={(params) => <TextField {...params} variant="outlined" label={t("oldClient.selectRoom")} />}
      />
    );
  };

  const handleVideoChange = (e) => setVideoDevice(e.target.value);

  const handleSettingsChange = (e) => settingsChange(JSON.parse(e.target.value));

  const handleAudioChange = (e) => setAudioDevice(e.target.value);

  const handleAudioModeChange = () => audioModeChange();

  const handleRoomChange = (e, op) => {
    if (!op?.room) return;

    const num = Number(op.room);
    !isNaN(num) && selectRoom(num);
  };

  const handleInitClient = () => {
    initClient(false);
    setWip(true);
  };

  const renderHeader = () => (
    <>
      <Grid item xs={8}>
        <Typography variant="h4" display={"block"} color="textPrimary">
          {t("settings.helloUser", {name: userDisplay})}
        </Typography>
        <Typography color="textPrimary">{t("settings.beforeConnecting")}</Typography>
      </Grid>
      <Grid item xs={4}>
        <Grid container justify="flex-end" spacing={2}>
          <Grid item>
            <LogoutDropdown display={userDisplay} />
          </Grid>
          <Grid item>
            <Support />
          </Grid>
        </Grid>
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
          />
        </Grid>
        <Grid item={true} xs={4}>
          <SelectViewLanguage />
        </Grid>
      </>
    );
  };

  const renderContent = () => {
    return (
      <Grid container spacing={4} className={classes.content}>
        {renderHeader()}
        <Divider variant="fullWidth" style={{width: "100%"}} />
        {renderUserSettings()}
        <Divider variant="fullWidth" style={{width: "100%"}} />

        <Grid item xs={6}>
          <Videocam className={classes.icon} color="action" />
          <Typography variant="h6" display="inline" style={{verticalAlign: "top"}} color="textPrimary">
            {t("settings.cameraSettings")}
          </Typography>
        </Grid>
        <Grid item xs={4}>
          <Mic className={classes.icon} color="action" />
          <Typography variant="h6" display="inline" style={{verticalAlign: "top"}} color="textPrimary">
            {t("settings.microphoneSettings")}
          </Typography>
        </Grid>

        <Grid item xs={3}>
          {renderCameras()}
        </Grid>
        <Grid item xs={3}>
          {renderVideoSize()}
        </Grid>

        <Grid item xs={6}>
          {renderSounds()}
        </Grid>

        <Grid item xs={6}>
          {<MyMedia cammuted={cammuted} video={video} />}
        </Grid>
        <Grid item xs={6}>
          {<CheckMySelf />}
        </Grid>

        <Grid item xs={12}>
          <FormControlLabel
            label={<Typography color="textPrimary">{t("oldClient.stopVideo")}</Typography>}
            control={<Checkbox checked={cammuted} onChange={toggleCamera} name="turnOffCamera" color="secondary" />}
          />

          <FormControlLabel
            label={<Typography color="textPrimary">{t("oldClient.audioMode")}</Typography>}
            color="textPrimary"
            control={
              <Checkbox checked={!!isAudioMode} onChange={handleAudioModeChange} name="isAudioMode" color="secondary" />
            }
          />
          <FormControlLabel
            label={<Typography color="textPrimary">{t("oldClient.darkTheme")}</Typography>}
            control={<Checkbox checked={isDark} onChange={toggleTheme} name="isAudioMode" color="secondary" />}
          />
        </Grid>

        <Grid item xs={6}>
          {renderRooms()}
        </Grid>
        <Grid item xs={4}>
          <Button
            variant="contained"
            color="primary"
            classes={{
              root: classes.submitRoot,
              disabled: classes.submitDisabled,
            }}
            size="large"
            disabled={
              !selectedRoom ||
              wip ||
              !roomInput ||
              (roomDescriptionById.size !== 0 && roomInput !== roomDescriptionById.get(selectedRoom).description)
            }
            onClick={handleInitClient}
          >
            {t("oldClient.joinRoom")}
          </Button>
        </Grid>
      </Grid>
    );
  };

  return (
    <Modal
      open={true}
      disableBackdropClick={true}
      BackdropProps={{
        style: {backgroundColor: paper},
      }}
      className={classes.modal}
    >
      <Box className={classes.paper}>{renderContent()}</Box>
    </Modal>
  );
};

export default Settings

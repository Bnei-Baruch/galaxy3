import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Button,
  Checkbox,
  FormControlLabel,
  Modal,
  Grid,
  Typography,
  TextField,
  MenuItem,
  Divider, Box
} from '@material-ui/core';
import Autocomplete from '@material-ui/lab/Autocomplete';
import makeStyles from '@material-ui/core/styles/makeStyles';
import green from '@material-ui/core/colors/green';

import MyMedia from './MyMedia';
import CheckMySelf from './CheckMySelf';
import { vsettings_list } from '../../../shared/consts';
import LogoutDropdown from './LogoutDropdown';
import { SelectViewLanguage } from '../components/SelectViewLanguage';
import { AccountCircle, Mic, Videocam } from '@material-ui/icons';

const settingsList = vsettings_list.map(({ key, text, value }) => ({ key, text, value: JSON.stringify(value) }));
const mapDevice    = ({ label, deviceId }) => ({ text: label, value: deviceId });
const mapOption    = ({ text, value }) => {
  return (
    <MenuItem key={value} value={value} button>
      {text}
    </MenuItem>
  );
};

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
  submitRoot: {
    background: green[500],
    height: '100%'
  },
  submitDisabled: {
    opacity: '0.8'
  },

}));

const Settings = (props) => {
  const classes = useStyles();

  const { t } = useTranslation();
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
          userDisplay
        }     = props;

  const renderCameras = () => {
    if (!videoLength)
      return null;

    return (
      <TextField
        select
        fullWidth={true}
        variant="outlined"
        label={t('settings.selectCamera')}
        onChange={handleVideoChange}
        value={videoDevice}
      >
        {video.devices.map(mapDevice).map(mapOption)}
      </TextField>
    );
  };

  const renderVideoSize = () => (
    <TextField
      select
      fullWidth={true}
      variant="outlined"
      label={t('settings.selectSize')}
      onChange={handleSettingsChange}
      value={videoSettings}>
      {
        settingsList.map(mapOption)
      }
    </TextField>
  );

  const renderSounds = () => {
    if (!audio?.devices || audio.devices.length === 0)
      return null;

    return (
      <TextField
        variant="outlined"
        fullWidth={true}
        onChange={handleAudioChange}
        value={audioDevice}
        label={t('settings.selectMic')}
        select
      >
        {audio.devices.map(mapDevice).map(mapOption)}
      </TextField>
    );
  };

  const renderRooms = () => {
    if (!rooms || rooms.length === 0)
      return null;

    return (
      <Autocomplete
        variant="outlined"
        value={rooms.find(op => op.room === selectedRoom)}
        options={rooms}
        getOptionLabel={(option) => option.description}
        renderOption={
          ({ description, num_users }) => (
            <Grid container>
              <Grid item xs={11}>{description}</Grid>
              <Grid item xs={1}>{num_users}</Grid>
            </Grid>

          )
        }
        onChange={handleRoomChange}
        renderInput={
          (params) => (
            <TextField
              {...params}
              variant="outlined"
              label={t('oldClient.selectRoom')}
            />
          )
        }
      />
    );
  };

  const handleVideoChange = e => setVideoDevice(e.target.value);

  const handleSettingsChange = e => settingsChange(JSON.parse(e.target.value));

  const handleAudioChange = e => setAudioDevice(e.target.value);

  const handleAudioModeChange = () => audioModeChange();

  const handleRoomChange = (e, op) => {
    if (!op?.room)
      return;

    const num = Number(op.room);
    !isNaN(num) && selectRoom(num);
  };

  const handleInitClient = () => initClient(false);

  const renderHeader = () => (
    <>
      <Grid item xs={9}>
        <Typography variant="h4" display={'block'}>
          {t('settings.helloUser', { name: userDisplay })}
        </Typography>
        <Typography>
          {t('settings.beforeConnecting')}
        </Typography>
      </Grid>
      <Grid item xs={3}>
        <Grid container justify="flex-end">
          <LogoutDropdown display={userDisplay} />
        </Grid>
      </Grid>
    </>
  );

  const renderUserSettings = () => {
    return (
      <>
        <Grid item xs={4}>
          <AccountCircle style={{ fontSize: '2em' }} />
          <Typography variant="h6" display="inline" style={{ verticalAlign: 'top' }}>
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
        <Divider variant="fullWidth" style={{ width: '100%' }} />
        {renderUserSettings()}
        <Divider variant="fullWidth" style={{ width: '100%' }} />

        <Grid item xs={6}>
          <Videocam style={{ fontSize: '2em' }} />
          <Typography variant="h6" display="inline" style={{ verticalAlign: 'top' }}>
            {t('settings.cameraSettings')}
          </Typography>
        </Grid>
        <Grid item xs={4}>
          <Mic style={{ fontSize: '2em' }} />
          <Typography variant="h6" display="inline" style={{ verticalAlign: 'top' }}>
            {t('settings.microphoneSettings')}
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
          {<MyMedia cammuted={false} video={video} />}
        </Grid>
        <Grid item xs={6}>
          {<CheckMySelf audio={audio} />}
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel
            label={t('oldClient.audioMode')}
            control={
              <Checkbox
                checked={!!isAudioMode}
                onChange={handleAudioModeChange}
                name="isAudioMode"
              />
            }
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
              disabled: classes.submitDisabled
            }}
            size="large"
            disabled={!selectedRoom}
            onClick={handleInitClient}>
            {t('oldClient.joinRoom')}
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
        style: { backgroundColor: 'white' }
      }}
      className={classes.modal}
    >
      <Box className={classes.paper}>
        {renderContent()}
      </Box>
    </Modal>
  );
};

export default memo(Settings, (props, next) => {
    return (
      props.videoLength === next.videoLength
      && props.audioDevice === next.audioDevice
      && props.videoDevice === next.videoDevice
      && props.videoSettings === next.videoSettings
      && props.isAudioMode === next.isAudioMode
      && props.selectedRoom === next.selectedRoom
      && props.rooms === next.rooms
    );
  }
);

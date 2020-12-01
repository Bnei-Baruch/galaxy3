import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Checkbox, FormControlLabel, Modal, Grid, Typography, TextField, MenuItem } from '@material-ui/core';
import Autocomplete from '@material-ui/lab/Autocomplete';
import makeStyles from '@material-ui/core/styles/makeStyles';
import green from '@material-ui/core/colors/green';

import MyMedia from './MyMedia';
import CheckMySelf from './CheckMySelf';
import { vsettings_list } from '../../../shared/consts';
import LogoutDropdown from './LogoutDropdown';

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
    maxWidth: 800,
    outline: 'none'
  },
  modal: {
    backgroundColor: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none'
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

  const renderContent = () => {
    return (
      <Grid container spacing={4} className={classes.content}>
        <Grid item xs={9}>
          <Typography variant="h3" display={'block'}>
            {t('settings.helloUser', { name: userDisplay })}
          </Typography>
          <Typography>
            {t('settings.beforeConnecting')}
          </Typography>
        </Grid>
        <Grid item xs={3} style={{ justifyContent: 'flex-end', display: 'flex', alignItems: 'center' }}>
          <LogoutDropdown display={userDisplay} />
        </Grid>
        <Grid item xs={4}>
          {renderCameras()}
        </Grid>
        <Grid item xs={4}>
          {renderVideoSize()}
        </Grid>
        <Grid item xs={4}>
          {renderSounds()}
        </Grid>
        <Grid item xs={8}>
          {<MyMedia cammuted={false} video={video} />}
        </Grid>
        <Grid item xs={4}>
          {<CheckMySelf device={audioDevice} />}
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

        <Grid item xs={8}>
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
      {renderContent()}
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

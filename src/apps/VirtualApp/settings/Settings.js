import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Checkbox, FormControl, InputLabel, Select, FormControlLabel, Modal, Grid } from '@material-ui/core';
import Autocomplete from '@material-ui/lab/Autocomplete';
import makeStyles from '@material-ui/core/styles/makeStyles';

import MyMedia from './MyMedia';
import SelfTest from './SelfTest';
import { vsettings_list } from '../../../shared/consts';
import TextField from '@material-ui/core/TextField';

const settingsList = vsettings_list.map(({ key, text, value }) => ({ key, text, value: JSON.stringify(value) }));
const mapDevice    = ({ label, deviceId }) => ({ text: label, value: deviceId });
const mapOption    = ({ text, value }) => (<option key={value} value={value}>{text}</option>);

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
  }
}));

const Settings = (props) => {
  const classes = useStyles();

  const { t } = useTranslation();
  const {
          media,
          rooms,
          isAudioMode,
          initClient,
          selectedRoom,
          selectRoom,
          setAudioDevice,
          setVideoDevice,
          settingsChange,
          audioModeChange
        }     = props;

  const { audio, video } = media;
  const audio_device     = audio?.audio_device || audio?.devices[0]?.deviceId;
  const video_device     = video?.video_device || video?.devices[0]?.deviceId;

  const renderCameras = () => {
    if (!video?.devices || video.devices.length === 0)
      return null;

    return (
      <FormControl>
        <InputLabel>{t('settings.selectCamera')}</InputLabel>
        <Select
          native
          variant="outlined"
          onChange={handleVideoChange}
          value={video_device}
        >
          {video.devices.map(mapDevice).map(mapOption)}
        </Select>
      </FormControl>
    );
  };

  const renderVideoSize = () => (
    <FormControl>
      <InputLabel>{t('settings.selectSize')}</InputLabel>
      <Select
        native
        variant="outlined"
        onChange={handleSettingsChange}
        value={JSON.stringify(video.setting)}>
        {
          settingsList.map(mapOption)
        }
      </Select>
    </FormControl>
  );

  const renderSounds = () => {
    if (!audio?.devices || audio.devices.length === 0)
      return null;

    return (
      <FormControl>
        <InputLabel>{t('settings.selectMic')}</InputLabel>
        <Select
          native
          variant="outlined"
          onChange={handleAudioChange}
          value={audio_device}
        >
          {audio.devices.map(mapDevice).map(mapOption)}
        </Select>
      </FormControl>
    );
  };

  const renderRooms = () => {
    if (!rooms || rooms.length === 0 || !selectedRoom)
      return null;

    return (
      <Autocomplete
        id="rooms_autocomplite"
        variant="outlined"
        defaultValue={rooms.find(op => op.room === selectedRoom)}
        options={rooms}
        getOptionLabel={(option) => option.description}
        renderInput={
          (params) => (
            <TextField {...params} label={t('settings.selectRoom')} variant="outlined" />
          )
        }
      />
    );
  };

  const handleVideoChange = e => setVideoDevice(e.target.value);

  const handleSettingsChange = e => settingsChange(JSON.parse(e.target.value));

  const handleAudioChange = e => setAudioDevice(e.target.value);

  const handleAudioModeChange = () => audioModeChange();

  const handleRoomChange = e => {
    const num = Number.parseInt(e.target.value);
    !isNaN(num) && selectRoom(num);
  };

  const handleInitClient = () => initClient(false);

  const renderContent = () => {
    return (
      <Grid container spacing={4} className={classes.content}>
        <Grid item xs={4}>
          {renderCameras()}
        </Grid>
        <Grid item xs={4}>
          {renderSounds()}
        </Grid>
        <Grid item xs={4}>
          {renderVideoSize()}
        </Grid>
        <Grid item xs={8}>
          {<MyMedia cammuted={false} video={video} />}
        </Grid>
        <Grid item xs={4}>
          {<SelfTest device={audio?.audio_device} />}
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel control={
            <Checkbox checked={!!isAudioMode} onChange={handleAudioModeChange} name="isAudioMode" />} label="Audio Mode" />
        </Grid>

        <Grid item xs={8}>
          {renderRooms()}
        </Grid>
        <Grid item xs={4}>
          <Button variant="contained" color="primary" onClick={handleInitClient}>
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

export default Settings;
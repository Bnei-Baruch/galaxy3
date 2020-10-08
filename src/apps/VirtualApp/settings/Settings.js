import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Checkbox, FormControl, InputLabel, Select, FormControlLabel, Modal, Grid } from '@material-ui/core';
import Autocomplete from '@material-ui/lab/Autocomplete';
import makeStyles from '@material-ui/core/styles/makeStyles';

import MyMedia from './MyMedia';
import CheckMySelf from './CheckMySelf';
import { vsettings_list } from '../../../shared/consts';
import TextField from '@material-ui/core/TextField';
import green from '@material-ui/core/colors/green';
import { white } from 'color-name';

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

const Settings = memo((props) => {
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
            videoDevice = video?.devices[0]?.deviceId
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
      if (!rooms || rooms.length === 0 || !selectedRoom)
        return null;

      return (
        <Autocomplete
          variant="outlined"
          value={rooms.find(op => op.room === selectedRoom)}
          options={rooms}
          getOptionLabel={(option) => option.description}
          onChange={handleRoomChange}
          renderInput={
            (params) => (
              <TextField {...params} label={t('oldClient.selectRoom')} variant="outlined" />
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
              style={{ background: green[500], height: '100%' }}
              size="large"
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
  },
  (props, next) => {
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
export default Settings;
import React, { useContext, useEffect, useState } from 'react';
import Grid from '@material-ui/core/Grid';

import MyMedia from './MyMedia';
import { Select, Paper, FormControl, InputLabel, Checkbox, Button } from '@material-ui/core';
import { useTranslation } from 'react-i18next';
import { vsettings_list } from '../../../../shared/consts';
import SelfTest from './SelfTest';

import '../../VirtualClient.scss';
import '../../VideoConteiner.scss';
import '../../CustomIcons.scss';
import 'eqcss';
import { AudioModeContext } from '../AudioModeContext';
import FormControlLabel from '@material-ui/core/FormControlLabel';

const settingsList = vsettings_list.map(({ key, text, value }) => ({ key, text, value: JSON.stringify(value) }));
const mapDevice    = ({ label, deviceId }, i) => ({ key: i, text: label, value: deviceId });
const mapOption    = ({ key, text, value }) => (<option key={key} value={value}>{text}</option>);

const Settings = (props) => {
  const { isAudioMode, updateAudioMode }           = useContext(AudioModeContext);
  const { video, audio, handleReloadMedia, handleJoinRoom, rooms, } = props;
  const { t }                                      = useTranslation();
  const [room, setRoom]                            = useState();

  const renderCameras = () => (
    <FormControl>
      <InputLabel>{t('camera.select')}</InputLabel>
      <Select native onChange={handleVideoChange}>
        {
          video?.devices ? video.devices.map(mapDevice).map(mapOption) : null
        }
      </Select>
    </FormControl>
  );

  const renderVideoSize = () => (
    <FormControl>
      <InputLabel>{t('camera.select')}</InputLabel>
      <Select native onChange={handleSettingsChange}>
        {
          settingsList.map(mapOption)
        }
      </Select>
    </FormControl>
  );

  const renderSounds = () => (
    <FormControl>
      <InputLabel>{t('camera.select')}</InputLabel>
      <Select native onChange={handleAudioChange}>
        {
          audio?.devices ? audio.devices.map(mapDevice).map(mapOption) : null
        }
      </Select>
    </FormControl>
  );

  const renderRooms = () => (
    <FormControl>
      <InputLabel>{t('oldClient.selectRoom')}</InputLabel>
      <Select native onChange={handleRoomChange}>
        {
          rooms.map((data, i) => {
            const { room, description } = data;
            return <option key={i} value={room}>{description}</option>;
          })
        }
      </Select>
    </FormControl>
  );

  const handleVideoChange = e => {
    localStorage.setItem('video_device', e.target.value);
    handleReloadMedia();
  };

  const handleSettingsChange = e => {
    localStorage.setItem('video_setting', e.target.value);
    handleReloadMedia();
  };

  const handleAudioChange = e => {
    localStorage.setItem('audio_device', e.target.value);
    handleReloadMedia();
  };

  const handleAudioModeChange = () => {
    updateAudioMode();
  };

  const handleRoomChange = e => setRoom(e.target.value);

  const connectToRoom = () => {
    localStorage.setItem('room', room);
    handleJoinRoom();
  }

  return (
    <Grid container spacing={4}>
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
        <Button onClick={connectToRoom}>
          {t('oldClient.joinRoom')}
        </Button>
      </Grid>
    </Grid>
  );
};

export default Settings;
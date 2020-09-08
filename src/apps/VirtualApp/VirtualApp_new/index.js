import React, { useMemo, useState, createContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@material-ui/core';
import LoginPage from '../../../components/LoginPage';
import { kc } from '../../../components/UserManager';
import SettingsContainer from './settings/SettingsContainer';
import VideoRoomContainer from './app/VideoRoomContainer';
import { AudioModeContext } from './AudioModeContext';

const adaptUser = (data) => {
  const { display, email, id, role } = data;
  return { display, email, id, role };
};

const VirtualClient = (props) => {
  const { t }                         = useTranslation();
  const [user, setUser]               = useState({});
  const [isAudioMode, setIsAudioMode] = useState(localStorage.getItem('audio_mode'));
  const [room, setRoom]               = useState(localStorage.getItem('room'));

  const updateAudioMode = () => {
    console.log('index updateAudioMode is audio mode', isAudioMode);
    localStorage.setItem('audio_mode', !isAudioMode);
    setIsAudioMode(!isAudioMode);
  };

  const checkPermission = (user) => {
    const pending_approval = kc.hasRealmRole('pending_approval');
    const gxy_user         = kc.hasRealmRole('gxy_user');
    user.role              = pending_approval ? 'ghost' : 'user';
    if (gxy_user || pending_approval) {
      setUser(adaptUser(user));
    } else {
      alert('Access denied!');
      kc.logout();
      setUser({});
    }
  };

  return (
    <AudioModeContext.Provider value={{ isAudioMode, updateAudioMode }}>
      {
        !user?.id
          ? <LoginPage user={user} checkPermission={checkPermission} />
          /*: room
          ? <VideoRoomContainer />*/
          : <SettingsContainer user={user} handleJoinRoom={setRoom} />
      }
    </AudioModeContext.Provider>
  );
};

export default VirtualClient;
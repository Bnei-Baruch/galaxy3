import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@material-ui/core';
import Settings from './Settings';
import { kc } from '../../../../components/UserManager';
import { GuaranteeDeliveryManager } from '../../../../shared/GuaranteeDelivery';
import { checkNotification, geoInfo, getMedia, micLevel } from '../../../../shared/tools';
import platform from 'platform';
import { GEO_IP_INFO } from '../../../../shared/env';
import api from '../../../../shared/Api';
import ConfigStore from '../../../../shared/ConfigStore';
import GxyJanus from '../../../../shared/janus-utils';
import Container from '@material-ui/core/Container';

const SettingsContainer = (props) => {

  const { user: userFromProps, handleJoinRoom } = props;
  const { t }                             = useTranslation();
  const [user, setUser]                   = useState(userFromProps);
  const [rooms, setRooms]                 = useState([]);
  const [premodStatus, setPremodStatus]   = useState([]);
  const [cammuted, setCammuted]           = useState(false);
  const [audio, setAudio]                 = useState();
  const [video, setVideo]                 = useState();

  let gdm, system, browser;

  useEffect(() => {
    gdm = new GuaranteeDeliveryManager(user.id);
    checkNotification();
    system      = navigator.userAgent;
    user.system = system;
    browser     = platform.parse(system);
    if (!(/Safari|Firefox|Chrome/.test(browser.name))) {
      alert(t('oldClient.browserNotSupported'));
      return;
    }

    geoInfo(`${GEO_IP_INFO}`, init);
  }, []);

  const init = async ({ ip = '127.0.0.1', country = 'XX' }) => {
    try {
      setUser({ ...user, ip, country });

      const config = await api.fetchConfig();
      ConfigStore.setGlobalConfig(config);
      GxyJanus.setGlobalConfig(config);
      const { rooms } = await api.fetchAvailableRooms({ with_num_users: true });

      setPremodStatus(ConfigStore.dynamicConfig(ConfigStore.PRE_MODERATION_KEY) === 'true');
      setRooms(rooms);
      await handleReloadMedia();
    } catch (err) {
      console.error('[User] error initializing app', err);
      // this.setState({ appInitError: err });
    }
  };

  const handleReloadMedia = async () => {
    const media = await getMedia();
    console.log('Got media: ', media);
    const { audio, video } = media;
    let cammuted           = false;

    if (audio.error && video.error) {
      alert(t('oldClient.noInputDevices'));
      cammuted = true;
    } else if (audio.error) {
      alert('audio device not detected');
    } else if (video.error) {
      alert(t('oldClient.videoNotDetected'));
      cammuted = true;
    }

    setCammuted(cammuted);
    setVideo(video);
    setAudio(audio);
  };

  return (
    <Container fixed>
      <Settings video={video} audio={audio} handleReloadMedia={handleReloadMedia} rooms={rooms} handleJoinRoom={handleJoinRoom} />
    </Container>
  );
};

export default SettingsContainer;
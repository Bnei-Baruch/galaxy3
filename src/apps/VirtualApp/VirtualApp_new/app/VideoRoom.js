import React, { useEffect, useState } from 'react';
import Grid from '@material-ui/core/Grid';

import { ButtonGroup, Button, AppBar, Toolbar } from '@material-ui/core';
import { useTranslation } from 'react-i18next';

import '../../VirtualClient.scss';
import '../../VideoConteiner.scss';
import '../../CustomIcons.scss';
import 'eqcss';
import Badge from '@material-ui/core/Badge';
import BottomNavigation from '@material-ui/core/BottomNavigation';
import BottomNavigationAction from '@material-ui/core/BottomNavigationAction';
import Media from '../components/Media';
import { getMedia, wkliLeave } from '../../../../shared/tools';
import api from '../../../../shared/Api';
import { Janus } from '../../../../lib/janus';
import { PROTOCOL_ROOM } from '../../../../shared/consts';
import makeStyles from '@material-ui/core/styles/makeStyles';
import BottomToolBar from './BottomToolBar';
import VirtualStreaming from '../../VirtualStreaming';
import VirtualStreamingJanus from '../../../../shared/VirtualStreamingJanus';

const VideoRoom = (props) => {
  const { user, virtualStreamingJanus, feeds = [], mids } = props;

  const { t } = useTranslation();

  const [attachedSource, setAttachedSource] = useState(true);
  const [videos, setVideos]                 = useState();
  const [shidur, setShidur]                 = useState(true);

  const toggleShidur = () => {
    if (shidur) {
      virtualStreamingJanus.destroy();
    } else {
      const { ip, country } = user;
      virtualStreamingJanus.init(ip, country);
      //setSourceLoading(true);
    }
    setShidur(!shidur);
  };

  return (
    <Grid container spacing={1}>
      <Grid item xs={6}>
        {
          <VirtualStreaming
            virtualStreamingJanus={virtualStreamingJanus}
            attached={attachedSource}
            closeShidur={toggleShidur}
            videos={videos}
            setVideo={v => setVideos(v)}
            setDetached={() => setAttachedSource(false)}
            setAttached={() => setAttachedSource(true)}
          />
        }

      </Grid>
      {
        feeds.map((feed, i) => (
          <Grid item xs={4} key={i}>
            <Media feed={feed} />
          </Grid>
        ))
      }
      <BottomToolBar />
    </Grid>
  );
};

export default VideoRoom;
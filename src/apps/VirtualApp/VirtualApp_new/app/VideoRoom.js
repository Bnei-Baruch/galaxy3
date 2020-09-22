import React, { useEffect, useState } from 'react';
import Grid from '@material-ui/core/Grid';

import { useTranslation } from 'react-i18next';

import '../../VirtualClient.scss';
import '../../VideoConteiner.scss';
import '../../CustomIcons.scss';
import 'eqcss';
import Media from '../components/Media';
import BottomToolBar from './BottomToolBar';
import VirtualStreaming from '../../VirtualStreaming';

const VideoRoom = (props) => {
  const { user, virtualStreamingJanus, feeds = [], mids } = props;

  const { t } = useTranslation();

  const [attachedSource, setAttachedSource] = useState(true);
  const [videos, setVideos]                 = useState();
  const [broadcastOn, setBroadcastOn]       = useState(true);

  const onBroadcastHandler = () => {
    if (broadcastOn) {
      virtualStreamingJanus.destroy();
    } else {
      const { ip, country } = user;
      virtualStreamingJanus.init(ip, country);
    }
    setBroadcastOn(!broadcastOn);
  };
  const _feeds             = [...feeds, ...feeds, ...feeds];
  return (
    <Grid container spacing={1}>
      {
        virtualStreamingJanus && broadcastOn &&
        <Grid item xs={6}>
          <VirtualStreaming
            virtualStreamingJanus={virtualStreamingJanus}
            attached={attachedSource}
            closeShidur={onBroadcastHandler}
            videos={videos}
            setVideo={v => setVideos(v)}
            setDetached={() => setAttachedSource(false)}
            setAttached={() => setAttachedSource(true)}
          />
        </Grid>
      }
      {

        _feeds.map((feed, i) => (
          <Grid item xs={3} key={i}>
            <Media feed={feed} />
          </Grid>
        ))
      }
      <BottomToolBar onBroadcastHandler={onBroadcastHandler} broadcastOn={broadcastOn} />
    </Grid>
  );
};

export default VideoRoom;
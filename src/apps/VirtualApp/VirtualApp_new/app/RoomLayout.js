import React, { useEffect, useState } from 'react';
import Grid from '@material-ui/core/Grid';

import { ButtonGroup, Button, AppBar, Toolbar } from '@material-ui/core';
import { useTranslation } from 'react-i18next';

import '../../VirtualClient.scss';
import '../../VideoConteiner.scss';
import '../../CustomIcons.scss';
import 'eqcss';
import Badge from '@material-ui/core/Badge';
import VirtualChat from '../../VirtualChat';
import VideoRoom from './VideoRoom';

let chat = null;

const RoomLayout = (props) => {
  const { janus, room, user, virtualStreamingJanus, feeds, mids } = props;
  console.log('RoomLayout call component', feeds, mids);

  const { t }                   = useTranslation();
  const [lSideBar, setLSideBar] = useState('');
  const [rSideBar, setRSideBar] = useState('');

  const renderLeftAside = () => {
    let content;

    switch (lSideBar) {
    case 'drawing':
      content = 'drawing';
      break;
    case 'material':
      content = 'material';
      break;
    default:
      return null;
    }

    return <Grid item xs={3}>{content}</Grid>;
  };

  const renderRightAside = () => {
    let content;
    switch (rSideBar) {
    case 'chat':
      content = (
        <VirtualChat
          t={t}
          ref={ch => {
            chat = ch;
          }}
          visible={rSideBar === 'chat'}
          janus={janus}
          room={room}
          user={user}
          onNewMsg={this.onChatMessage} />
      );
      break;
    case 'support':
      content = 'support';
      break;
    case 'question':
      content = 'question';
      break;
    default:
      return null;
    }
    return <Grid item xs={3}>{content}</Grid>;
  };

  const renderTopBar = () => (
    <AppBar position="static">
      <Toolbar>
        <ButtonGroup
          variant="contained"
          color="primary"
        >
          <Badge color="secondary" badgeContent={0} showZero>
            <Button onClick={() => handleLeftBar('drawing')}>{t('button.drawing')}</Button>
          </Badge>
          <Button onClick={() => handleLeftBar('material')}>{t('button.material')}</Button>
        </ButtonGroup>

        <ButtonGroup
          variant="contained"
          color="primary"
        >
          <Badge color="secondary" badgeContent={0} showZero>
            <Button onClick={() => handleRightBar('chat')}>{t('button.chat')}</Button>
          </Badge>
          <Button onClick={() => handleRightBar('support')}>{t('button.support')}</Button>
          <Button onClick={() => handleRightBar('question')}>{t('button.question')}</Button>
        </ButtonGroup>
      </Toolbar>
    </AppBar>
  );

  const handleRightBar = (name) => {
    const newName = name === rSideBar ? null : name;
    setRSideBar(newName);
  };

  const handleLeftBar = (name) => {
    const newName = name === lSideBar ? null : name;
    setLSideBar(newName);
  };

  return (
    <>
      {renderTopBar()}

      <Grid container spacing={1}>
        {renderLeftAside()}
        <Grid item xs={6 + (!lSideBar && 3) + (!rSideBar && 3)}>
          <VideoRoom user={user} virtualStreamingJanus={virtualStreamingJanus} feeds={feeds} mids={mids} />
        </Grid>
        {renderRightAside()}
      </Grid>
    </>
  );
};

export default RoomLayout;
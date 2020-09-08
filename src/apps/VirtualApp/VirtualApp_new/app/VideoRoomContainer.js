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

const mapDevice = ({ label, deviceId }, i) => ({ key: i, text: label, value: deviceId });
const mapOption = ({ key, text, value }) => (<option key={key} value={value}>{text}</option>);

const VideoRoomContainer = (props) => {
  const { video, audio, cammuted } = props;
  const { t }                      = useTranslation();
  const [feeds, setFeeds]          = useState();
  const [open, setOpen]            = useState(false);
  const [lSideBar, setLSideBar]    = useState('');
  const [rSideBar, setRSideBar]    = useState('');

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
      content = 'chat';
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

      <Grid container spacing={1}>
        {renderLeftAside()}

        <Grid item xs={6 + (!lSideBar && 3) + (!rSideBar && 3)}>
          media

          {/*          <AppBar position="fixed" color="primary">
            <Toolbar></Toolbar>
          </AppBar>*/}
        </Grid>

        {renderRightAside()}
      </Grid>
    </>
  );
};

export default VideoRoomContainer;
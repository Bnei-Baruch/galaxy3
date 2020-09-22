import { AppBar, Button, ButtonGroup, Grid, Toolbar } from '@material-ui/core';
import React, { useContext, useState } from 'react';
import makeStyles from '@material-ui/core/styles/makeStyles';
import {
  PanTool,
  Mic, MicOff,
  Tv, TvOff,
  Videocam, VideocamOff,
  Visibility, VisibilityOff,
  Help, HelpOutline
} from '@material-ui/icons';
import Box from '@material-ui/core/Box';
import { ButtonActionsContext } from '../ButtonActionsContext';
import { Button as OldButton, Menu, Popup } from 'semantic-ui-react';
import { useTranslation } from 'react-i18next';

const useStyles = makeStyles(() => ({
  appBar: {
    top: 'auto',
    bottom: 0,
  },
}));

const getLayoutIcon = (layout) => {
  switch (layout) {
  case 'double':
    return 'layout-double';
  case 'split':
    return 'layout-split';
  default:
    return 'layout-equal';
  }
};

const BottomToolBar = (props) => {
  const { onBroadcastHandler, broadcastOn }                                                        = props;
  const { handleMic, handleExitRoom, handleCamera, handleAudioMode, handleLayout, handleQuestion } = useContext(ButtonActionsContext);
  const { micOn, cameraOn, audioModeOn, questionOn }                                               = useContext(ButtonActionsContext);
  const { layout, setLayout }                                                                      = useState();
  const classes                                                                                    = useStyles();

  const { t } = useTranslation();

  function updateLayout(equal) {

  }

  return (
    <AppBar position="sticky" color="transparent" className={classes.appBar}>

      <Grid container spacing={1}>
        <Grid item xs={1}>
          {
            micOn
              ? <Mic style={{ fontSize: 30 }} onClick={handleMic}>mic</Mic>
              : <MicOff style={{ fontSize: 30 }} onClick={handleMic}>mic</MicOff>
          }
          {
            cameraOn
              ? <Videocam style={{ fontSize: 30 }} onClick={handleCamera} />
              : <VideocamOff style={{ fontSize: 30 }} onClick={handleCamera} />
          }
        </Grid>
        <Grid item xs={3}></Grid>
        <Grid item xs={2}>
          {
            broadcastOn
              ? <Tv style={{ fontSize: 30 }} onClick={onBroadcastHandler} />
              : <TvOff style={{ fontSize: 30 }} onClick={onBroadcastHandler} />
          }

          <Popup
            trigger={
              <Menu.Item disabled={!broadcastOn} icon={{ className: `icon--custom ${getLayoutIcon(layout)}` }} name={t('oldClient.layout')} />}
            disabled={!broadcastOn}
            on='click'
            position='bottom center'
          >
            <Popup.Content>
              <OldButton.Group>
                <OldButton onClick={() => updateLayout('double')} active={layout === 'double'} icon={{ className: 'icon--custom layout-double' }} /> {/* Double first */}
                <OldButton onClick={() => updateLayout('split')} active={layout === 'split'} icon={{ className: 'icon--custom layout-split' }} /> {/* Split */}
                <OldButton onClick={() => updateLayout('equal')} active={layout === 'equal'} icon={{ className: 'icon--custom layout-equal' }} /> {/* Equal */}
              </OldButton.Group>
            </Popup.Content>
          </Popup>
          {audioModeOn
            ? <VisibilityOff style={{ fontSize: 30 }} onClick={handleAudioMode} />
            : <Visibility style={{ fontSize: 30 }} onClick={handleAudioMode} />
          }
        </Grid>
        <Grid item xs={1}></Grid>
        <Grid item xs={1}>
          {
            questionOn
              ? <Help style={{ fontSize: 30 }} onClick={handleQuestion} />
              : <HelpOutline style={{ fontSize: 30 }} onClick={handleQuestion} />
          }
          <PanTool style={{ fontSize: 30 }} onClick={handleAudioMode} />
        </Grid>
        <Grid item xs={2}></Grid>
        <Grid item xs={1}>

          <ButtonGroup
            variant="contained"
            color="primary"
          >
            <Button onClick={handleExitRoom} color={'secondary'}>Exit</Button>
          </ButtonGroup>
        </Grid>
      </Grid>
    </AppBar>
  );
};
export default BottomToolBar;
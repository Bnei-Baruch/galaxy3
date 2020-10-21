import React from 'react';
import { useTranslation } from 'react-i18next';

import { Select, Modal, Grid, FormControl, Divider } from '@material-ui/core';
import makeStyles from '@material-ui/core/styles/makeStyles';

import MyMedia from './MyMedia';
import SelfTest from './SelfTest';
import { vsettings_list } from '../../../shared/consts';
import TextField from '@material-ui/core/TextField';
import { getLanguage, languagesOptions, setLanguage } from '../../../i18n/i18n';
import { Popup } from 'semantic-ui-react';
import { AccountCircle, Computer } from '@material-ui/icons';

const settingsList = vsettings_list.map(({ key, text, value }) => ({ key, text, value: JSON.stringify(value) }));
const mapDevice    = ({ label, deviceId }, i) => ({ key: i, text: label, value: deviceId });
const mapOption    = ({ key, text, value }) => (<option key={key} value={value}>{text}</option>);

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

const SettingsJoined = (props) => {
  const classes = useStyles();

  const { t } = useTranslation();
  const {
          media,
          selectedRoom,
          isOpen,
          closeModal
        }     = props;

  const { audio, video } = media;
  const audio_device     = audio?.audio_device || audio?.devices[0]?.deviceId;
  const video_device     = video?.video_device || video?.devices[0]?.deviceId;

  const renderContent = () => {
    return (
      <Grid container spacing={4} className={classes.content}>
        <Grid item xs={4}>
          <AccountCircle />
          {t('oldClient.userSettings')}
        </Grid>
        <Grid item xs={4}>
          <TextField
            id="standard-full-width"
            label={t('oldClient.screenName')}
            fullWidth
            margin="normal"
            variant="outlined"
          />
        </Grid>
        <Grid item xs={4}>
          <Select native onChange={e => setLanguage(e.target.value)} value={getLanguage()}>
            {
              languagesOptions.map(({ key, value, text }) => {
                return <option key={key} value={value}>{text}</option>;
              })
            }
          </Select>
        </Grid>
        <Divider />
        <Grid item xs={4}>
          <Computer />
          {t('oldClient.broadcastSettings')}
        </Grid>
        <Grid item xs={4}>
          <TextField
            id="standard-full-width"
            label={t('oldClient.screenName')}
            fullWidth
            margin="normal"
            variant="outlined"
          />
        </Grid>
        <Grid item xs={4}>
          <Select native onChange={e => setLanguage(e.target.value)} value={getLanguage()}>
            {
              languagesOptions.map(({ key, value, text }) => {
                return <option key={key} value={value}>{text}</option>;
              })
            }
          </Select>
        </Grid>
      </Grid>
    );
  };

  return (
    <Modal
      open={isOpen}
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

export default SettingsJoined;
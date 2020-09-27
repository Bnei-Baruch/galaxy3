import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { Videocam, VideocamOff } from '@material-ui/icons';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import ButtonBase from '@material-ui/core/ButtonBase';
import audioModeSvg from '../../../shared/audio-mode.svg';
import fullModeSvg from '../../../shared/full-mode.svg';
import SvgIcon from '@material-ui/core/SvgIcon';
import Icon from '@material-ui/core/Icon';

const useStyles = makeStyles({
  label: {
    width: '100%',
    display: 'block',
    marginTop: '7px'
  },
  disabled: {
    opacity: 0.5
  },
  button: {
    display: 'flex',
    flexDirection: 'column'
  }
});

const AudioMode = (props) => {
  const { action, isOn, disabled, t } = props;

  const classes = useStyles();

  const handleAction = () => action(isOn);

  return (
    <ButtonBase
      variant="contained"
      color="secondary"
      disabled={disabled}
      onClick={() => handleAction()}
      classes={{
        root: classes.button,
        disabled: classes.disabled
      }}
    >
      <Icon classes={{root: classes.iconRoot}}>
        <img src={isOn ? audioModeSvg : fullModeSvg}/>
      </Icon>
      <span className={classes.label}>
        {t(isOn ? 'oldClient.fullMode' : 'oldClient.audioMode')}
      </span>
    </ButtonBase>
  );

};

export default AudioMode;
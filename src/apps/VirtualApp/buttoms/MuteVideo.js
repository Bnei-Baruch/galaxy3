import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { Videocam, VideocamOff } from '@material-ui/icons';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import ButtonBase from '@material-ui/core/ButtonBase';

const useStyles = makeStyles({
  label: {
    width: '100%',
    display: 'block',
    marginTop: '5px'
  },
  disabled: {
    opacity: 0.5
  },
  button: {
    display: 'flex',
    flexDirection: 'column'
  }
});

const MuteVideo = (props) => {
  const { action, isOn, disabled, text } = props;

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
      {isOn ? <Videocam /> : <VideocamOff />}
      <span className={classes.label}>{text}</span>
    </ButtonBase>
  );

};

export default MuteVideo;
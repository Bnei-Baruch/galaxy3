import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { Mic, Videocam, VideocamOff } from '@material-ui/icons';
import ButtonBase from '@material-ui/core/ButtonBase';
import red from '@material-ui/core/colors/red';

const useStyles = makeStyles({
  label: {
    width: '100%',
    display: 'block',
    marginTop: '3px',
    whiteSpace: 'nowrap'
  },
  disabled: {
    opacity: 0.5
  },
  button: {
    display: 'flex',
    flexDirection: 'column',
    margin: '0.5em 1em'
  }
});

const MuteVideo = (props) => {
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
      {
        isOn
          ? <VideocamOff style={{ color: red[500], fontSize: '1.8rem' }} />
          : <Videocam style={{ fontSize: '1.8rem' }} />
      }
      <span className={classes.label}>
        {t(isOn ? 'oldClient.startVideo' : 'oldClient.stopVideo')}
      </span>
    </ButtonBase>
  );

};

export { MuteVideo };
export default MuteVideo;
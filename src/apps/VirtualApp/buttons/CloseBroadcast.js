import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { DesktopAccessDisabled, DesktopWindows } from '@material-ui/icons';
import ButtonBase from '@material-ui/core/ButtonBase';

const useStyles = makeStyles({
  label: {
    width: '100%',
    display: 'block',
    marginTop: '5px',
    whiteSpace: 'nowrap'
  },
  disabled: {
    opacity: 0.5
  },
  button: {
    display: 'flex',
    flexDirection: 'column',
    margin: '0.5em 1em'
  },
  badge: {
    top: '1px',
    right: '5px'

  }
});

const CloseBroadcast = (props) => {
  const { action, isOn, disabled, t, question } = props;

  const classes = useStyles();

  const handleAction = () => action();

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
      {isOn ? <DesktopWindows /> : <DesktopAccessDisabled />}
      <span className={classes.label}>
        {isOn ? t('oldClient.closeBroadcast') : t('oldClient.openBroadcast')}
      </span>
    </ButtonBase>
  );

};

export { CloseBroadcast };
export default CloseBroadcast;
import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { ForumRounded, Videocam, VideocamOff } from '@material-ui/icons';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import ButtonBase from '@material-ui/core/ButtonBase';
import audioModeSvg from '../../../shared/audio-mode.svg';
import fullModeSvg from '../../../shared/full-mode.svg';
import SvgIcon from '@material-ui/core/SvgIcon';
import Icon from '@material-ui/core/Icon';
import Badge from '@material-ui/core/Badge';

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
  },
  badge: {
    top: '1px',
    right: '5px'

  }
});

const OpenChat = (props) => {
  const { action, isOn, disabled, t, counter } = props;

  const classes = useStyles();

  const handleAction = () => action(isOn);
  const renderButton = () => (
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
      <ForumRounded />
      <span className={classes.label}>
        {t(isOn ? 'oldClient.closeChat' : 'oldClient.openChat')}
      </span>
    </ButtonBase>
  );

  return (
    counter > 0
      ? <Badge badgeContent={counter} color="secondary" className={classes.badge}>{renderButton()}</Badge>
      : renderButton()
  );

};

export default OpenChat;
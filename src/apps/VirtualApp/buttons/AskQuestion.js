import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { HelpOutline } from '@material-ui/icons';
import ButtonBase from '@material-ui/core/ButtonBase';
import green from '@material-ui/core/colors/green';

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

const AskQuestion = (props) => {
  const { action, isOn, disabled, t } = props;

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
      <HelpOutline style={{ color: isOn ? green[500] : '' }} />
      <span className={classes.label} style={{ color: isOn ? green[500] : '' }}>
        {t('oldClient.askQuestion')}
      </span>
    </ButtonBase>
  );

};

export { AskQuestion };
export default AskQuestion;
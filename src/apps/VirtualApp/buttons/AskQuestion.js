import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { green, grey } from '@material-ui/core/colors';
import { Typography, ButtonBase } from '@material-ui/core';

const useStyles = makeStyles(isOn => (
    {
      label: {
        width: '100%',
        display: 'block',
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
      },
      textColor: {
        color: !isOn ? green[500] : grey[0]
      },
      sign: {
        fontSize: '2.5em',
        fontWeight: 'bold',
        lineHeight: '1.06em'
      }

    }
  )
);

const AskQuestion = (props) => {
  const { action, isOn, disabled, t } = props;

  const classes = useStyles(isOn);

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
      <Typography className={`${classes.textColor} ${classes.sign}`}>?</Typography>
      <span className={`${classes.textColor} ${classes.label}`}>
        {t('oldClient.askQuestion')}
      </span>
    </ButtonBase>
  );

};

export { AskQuestion };
export default AskQuestion;
import React, { useRef } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import {  PanToolOutlined} from '@material-ui/icons';
import ButtonBase from '@material-ui/core/ButtonBase';
import Popover from '@material-ui/core/Popover';

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

const Vote = (props) => {
  const { disabled, t, id } = props;
  const classes             = useStyles();
  const [open, setOpen]     = React.useState(false);
  const ref                 = useRef();

  const handleClick = (event) => {
    setOpen(!open);
  };
  const handleClose = () => {
    setOpen(false);
  };

  return (
    <ButtonBase
      variant="contained"
      color="secondary"
      disabled={disabled}
      onClick={handleClick}
      ref={ref}
      classes={{
        root: classes.button,
        disabled: classes.disabled
      }}
    >
      <PanToolOutlined />
      <span className={classes.label}>
        {t('oldClient.vote')}
      </span>
      <Popover
        open={open}
        anchorEl={ref.current}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
      >
        <iframe src={`https://vote.kli.one/button.html?answerId=1&userId=${id}`} width="40px" height="36px" frameBorder="0"></iframe>
        <iframe src={`https://vote.kli.one/button.html?answerId=2&userId=${id}`} width="40px" height="36px" frameBorder="0"></iframe>
      </Popover>
    </ButtonBase>
  );

};

export { Vote };
export default Vote;
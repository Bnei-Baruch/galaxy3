import React, { useRef } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import ButtonBase from '@material-ui/core/ButtonBase';
import ButtonGroup from '@material-ui/core/ButtonGroup';
import { Box } from '@material-ui/core';
import Popper from '@material-ui/core/Popper';
import Paper from '@material-ui/core/Paper';
import ClickAwayListener from '@material-ui/core/ClickAwayListener';

const useStyles = makeStyles({
  label: {
    width: '100%',
    display: 'block',
    marginTop: '11px'
  },
  disabled: {
    opacity: 0.5
  },
  button: {
    display: 'flex',
    flexDirection: 'column',
    zIndex: 100
  },
  icon: {
    fontSize: '1.5em !important',
  },
  popupIcon: {
    lineHeight: '1em'
  }
});

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

const Layout = (props) => {
  const { disabled, t, iconDisabled, action, active } = props;

  const classes         = useStyles();
  const [open, setOpen] = React.useState(null);

  const anchorRef = useRef();

  const handleMenuItemClick = (type) => {

    console.log('layout type', type);
    action(type);
    setOpen(false);
  };

  const handleToggle = () => {
    setOpen((prevOpen) => !prevOpen);
  };

  const handleClose = (event) => {
    if (anchorRef.current && anchorRef.current.contains(event.target)) {
      return;
    }

    setOpen(false);
  };

  const getButtonByName = (name) => (
    <Button
      onClick={() => handleMenuItemClick(name)}
      variant={active === name ? 'outlined' : ''}
      disabled={iconDisabled}
    >
      <Box component="i" className={`icon icon--custom layout-${name} ${classes.icon} ${classes.popupIcon}`} />
    </Button>
  );

  const renderPopup = () => (
    <Popper
      open={open}
      anchorEl={anchorRef.current}
      onClose={handleClose}
    >
      <Paper>
        <ClickAwayListener onClickAway={handleClose}>
          {
            <ButtonGroup variant="contained" color="default">
              {getButtonByName('double')}
              {getButtonByName('split')}
              {getButtonByName('equal')}
            </ButtonGroup>
          }
        </ClickAwayListener>
      </Paper>
    </Popper>
  );

  return (
    <ButtonBase
      ref={anchorRef}
      variant="contained"
      color="secondary"
      disabled={disabled}
      onClick={handleToggle}
      classes={{
        root: classes.button,
        disabled: classes.disabled
      }}
    >
      <Box component="i" className={`icon icon--custom ${getLayoutIcon(active)} ${classes.icon}`} />
      <span className={classes.label}>{t('oldClient.layout')}</span>
      {renderPopup()}
    </ButtonBase>
  );

};

export { Layout };
export default Layout;
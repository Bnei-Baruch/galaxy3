import { AppBar, Button, ButtonGroup, Toolbar } from '@material-ui/core';
import React, { useState } from 'react';
import makeStyles from '@material-ui/core/styles/makeStyles';
import IconButton from '@material-ui/core/IconButton';
import { Camera, Mic, ViewCompact, VisibilityOff } from '@material-ui/icons';

const useStyles = makeStyles(() => ({
  appBar: {
    top: 'auto',
    bottom: 0,
  },
}));

const BottomToolBar = (props) => {
  const { exitRoom }      = props;
  const classes           = useStyles();
  const [delay, setDelay] = useState();

  return (
    <AppBar position="sticky" color="primary" className={classes.appBar}>
      <ButtonGroup
        variant="contained"
        color="primary"
      >
        <Button className={classes.button} startIcon={<Mic />}> Mic </Button>
        <Button className={classes.button} startIcon={<Camera />}> Camera </Button>
      </ButtonGroup>

      <ButtonGroup
        variant="contained"
        color="primary"
      >

        <Button startIcon={<ViewCompact />}> ViewCompact </Button>
      </ButtonGroup>

      <ButtonGroup
        variant="contained"
        color="primary"
      >
        <Button onClick={() => exitRoom(false)}>Exit room</Button>
      </ButtonGroup>
    </AppBar>
  );
};
export default BottomToolBar;
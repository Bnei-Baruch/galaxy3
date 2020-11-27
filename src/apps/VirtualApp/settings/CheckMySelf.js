import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import makeStyles from '@material-ui/core/styles/makeStyles';
import {Button, Modal, Typography, CircularProgress} from '@material-ui/core';

import {getMediaStream, recordAudio, sleep} from '../../../shared/tools';
import Box from '@material-ui/core/Box';

const INTERVAL_STEP_MLS = 250;

const useStyles = makeStyles((theme) => ({
    modal: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      backgroundColor: 'white',
      border: '2px solid #000',
      height: 200,
      width: 300,
    }
  }))
;
let recorder;

const CheckMySelf = ({device}) => {
  const classes = useStyles();

  const {t} = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [process, setProcess] = useState(0);
  const [stream, setStream] = useState(0);

  useEffect(() => {
    updateStream();
  }, [device]);

  const updateStream = async () => {
    const deviceId = localStorage.getItem('audio_device') ?? null;
    const [s, error] = await getMediaStream(true, false, {}, deviceId, null);
    if (error)
      return console.log(error);
    setStream(s);
  };

  const runInterval = async (processVal = 0, increase = 1) => {
    for (let i = 0; i < 10; i++) {
      await sleep(INTERVAL_STEP_MLS);
      const next = processVal + increase * i * 10;
      setProcess(next);
    }
  };

  const run = async () => {
    recorder = await recordAudio(stream);
    recorder.start();
    await runInterval(10);
    const rec = await recorder.stop();
    rec.play();
    await runInterval(90, -1);
  };

  const handleOpen = async (e) => {
    setProcess(0);
    setIsOpen(true);
    await run();
    setIsOpen(false);
  };

  const handleClose = (e) => {
    setIsOpen(false);
    recorder.broke();
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        variant={'contained'}
        color="primary"
        fullWidth
      >
        {t('oldClient.selfAudioTest')}
      </Button>
      <Modal
        className={classes.modal}
        open={isOpen}
        onClose={handleClose}
        disableBackdropClick={true}
      >
        <Box position="relative" display="inline-flex" style={{backgroundColor: 'white'}}>
          <CircularProgress variant="static" value={process} style={{height: '100px', width: '100px'}}/>
          <Box
            top={0}
            left={0}
            bottom={0}
            right={0}
            position="absolute"
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Typography variant="caption" component="div" color="textSecondary">{`${Math.round(process)}%`}</Typography>
          </Box>
        </Box>
      </Modal>
    </>
  );

};

export default CheckMySelf;

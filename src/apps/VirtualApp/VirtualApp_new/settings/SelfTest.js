import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CircularProgress from '@material-ui/core/CircularProgress';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { Button, Modal, Typography } from '@material-ui/core';

import { getMediaStream, recordAudio, sleep } from '../../../../shared/tools';

const INTERVAL_STEP_MLS = 500;

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
        },
        btnOpen: {
          backgroundColor: 'green',
        }
      }))
;
let recorder;

const SelfTest = ({ device }) => {
  const classes = useStyles();

  const { t }                 = useTranslation();
  const [isOpen, setIsOpen]   = useState(false);
  const [process, setProcess] = useState(0);
  const [stream, setStream]   = useState(0);

  useEffect(() => {
    updateStream();
  }, ['device']);

  const updateStream = async () => {
    const deviceId   = localStorage.getItem('audio_device') ?? null;
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
      <Button onClick={handleOpen} className={classes.btnOpen}>
        {t('oldClient.selfAudioTest')}
      </Button>
      <Modal
        className={classes.modal}
        open={isOpen}
        onClose={handleClose}
      >
        <div className={classes.content}>
          <Typography variant="subtitle1" id="simple-modal-description">
            {t('oldClient.recording') + ' ' + process}
          </Typography>
          <CircularProgress variant="static" value={process} />
        </div>
      </Modal>
    </>
  );

};

export default SelfTest;
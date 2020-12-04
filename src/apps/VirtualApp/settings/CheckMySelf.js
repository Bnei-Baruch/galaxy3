import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { Button, Typography } from '@material-ui/core';

import { micLevel, recordAudio, sleep } from '../../../shared/tools';
import Box from '@material-ui/core/Box';
import { FiberManualRecord, PlayCircleFilled } from '@material-ui/icons';
import { red } from '@material-ui/core/colors';

const INTERVAL_STEP_MLS = 250;

const useStyles = makeStyles(() => (
  {
    canvas: { margin: '0 1em', width: '15px', verticalAlign: 'bottom' },
    controlBtn: { fontSize: 30, color: red[500] },
    text: { fontSize: '1.2em', margin: '0 1em' }
  }
));

let recorder;

const CheckMySelf = ({ audio }) => {
  const classes   = useStyles();
  const canvasRef = useRef();

  const { t }                         = useTranslation();
  const [process, setProcess]         = useState(0);
  const [processType, setProcesstype] = useState();

  useEffect(() => {
    if (audio.stream && canvasRef.current) {
      micLevel(audio.stream, canvasRef.current, audioContext => {
        audio.context = audioContext;
      });
    }
  }, [audio.stream, canvasRef]);// eslint-disable-line  react-hooks/exhaustive-deps

  const runInterval = async (processVal = 0, increase = 1) => {
    for (let i = 0; i < 10; i++) {
      await sleep(INTERVAL_STEP_MLS);
      setProcess(i);
    }
  };

  const run = async () => {
    setProcess(0);
    recorder = await recordAudio(audio.stream);
    recorder.start();
    setProcesstype('recording');
    await runInterval(10);

    setProcesstype('playing');
    await runInterval(0);
    await recorder.stop();
    setProcesstype(null);
  };

  return (
    <>
      <Typography variant="h6" paragraph>
        {t('oldClient.selfAudioTest')}
      </Typography>
      <Box style={{ display: 'flex' }}>
        <Box className={classes.canvas}>
          <canvas ref={canvasRef} width="15" height="35" />
        </Box>
        <Button
          onClick={run}
          variant={'contained'}
          disabled={!!processType}
        >
          {
            processType === 'playing' ?
              <PlayCircleFilled className={classes.controlBtn} />
              : <FiberManualRecord className={classes.controlBtn} />
          }
        </Button>
        <Typography variant="caption" className={classes.text}>
          {processType && `${t('oldClient.' + processType)} - ${Math.round(process)}`}
        </Typography>
      </Box>
    </>
  );

};

export default CheckMySelf;

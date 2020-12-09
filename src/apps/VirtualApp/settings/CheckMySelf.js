import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { Button, Grid, Box } from '@material-ui/core';

import { micLevel, recordAudio, sleep } from '../../../shared/tools';

const INTERVAL_STEP_MLS = 1000;
const CANVAS_WIDTH      = 150;
const CANVAS_HEIGHT     = 30;
const useStyles         = makeStyles(() => (
  {
    canvas: {
      width: `${CANVAS_WIDTH}px`,
      height: `${CANVAS_HEIGHT}px`,
      border: '1px solid black'
    },
    runButton: { textTransform: 'none' },
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
      }, false);
    }
  }, [audio.stream, canvasRef]);// eslint-disable-line  react-hooks/exhaustive-deps

  const runInterval = async (processVal = 0, increase = 1) => {
    for (let i = 0; i <= 10; i++) {
      await sleep(INTERVAL_STEP_MLS);
      const next = processVal + increase * i;
      setProcess(next);
    }
  };

  const run = async () => {
    setProcess(0);
    recorder = await recordAudio(audio.stream);
    recorder.start();
    setProcesstype('recording');
    await runInterval(0);

    const a = await recorder.stop();
    a.play();
    setProcesstype('playing');
    await runInterval(10, -1);
    setProcesstype(null);
  };

  return (
    <Grid container spacing={1}>
      <Grid item>
        <Button
          onClick={run}
          color="primary"
          variant={!processType ? 'contained' : 'outlined'}
          disabled={!!processType}
          className={classes.runButton}
        >
          {
            !processType ? t('oldClient.selfAudioTest') : `${t('oldClient.' + processType)} - ${Math.round(process)}`
          }
        </Button>

      </Grid>
      <Grid item>
        <Box className={classes.canvas}>
          <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
        </Box>
      </Grid>
    </Grid>
  );

};

export default CheckMySelf;

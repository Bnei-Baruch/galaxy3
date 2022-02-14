import React, {useEffect, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import makeStyles from "@material-ui/core/styles/makeStyles";
import {Button, Grid, Box} from "@material-ui/core";
import log from "loglevel";
import {recordAudio, sleep} from "../../../shared/tools";
import devices from "../../../lib/devices";

const INTERVAL_STEP_MLS = 1000;
const CANVAS_WIDTH = 150;
const CANVAS_HEIGHT = 30;
const useStyles = makeStyles(() => ({
  canvas: {
    width: `${CANVAS_WIDTH}px`,
    height: `${CANVAS_HEIGHT + 2}px`,
    border: "1px solid black",
  },
  runButton: {textTransform: "none"},
  text: {fontSize: "1.2em", margin: "0 1em"},
}));

let recorder;

const CheckMySelf = () => {
  const classes = useStyles();
  const canvasRef = useRef();

  const {t} = useTranslation();
  const [process, setProcess] = useState(0);
  const [processType, setProcesstype] = useState();

  useEffect(() => {
    micVolume(devices.audio.context)
    return () => {
      if(devices.audio.context)
        devices.audio.context.suspend()
      devices.micLevel = null;
    }
  }, []); // eslint-disable-line  react-hooks/exhaustive-deps

  const micVolume = () => {
    const c = canvasRef.current
    let cc = c.getContext("2d");
    const w = c.width;
    const h = c.height;
    let gradient = cc.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, "green");
    gradient.addColorStop(0.3, "#80ff00");
    gradient.addColorStop(0.5, "orange");
    gradient.addColorStop(1, "red");
    devices.micLevel = (volume) => {
      cc.clearRect(0, 0, c.width, c.height);
      cc.fillStyle = gradient;
      cc.fillRect(0, 0, volume * 500, c.height);
    }
    if(devices.audio.context)
      devices.audio.context.resume()
  }

  const runInterval = async (processVal = 0, increase = 1) => {
    for (let i = 0; i <= 10; i++) {
      await sleep(INTERVAL_STEP_MLS);
      const next = processVal + increase * i;
      setProcess(next);
    }
  };

  const run = async () => {
    setProcess(0);
    recorder = await recordAudio(devices.audio.stream);
    recorder.start();
    setProcesstype("recording");
    await runInterval(0);

    const a = await recorder.stop();
    a.play();
    setProcesstype("playing");
    await runInterval(10, -1);
    setProcesstype(null);
  };

  return (
    <Grid container spacing={1}>
      <Grid item>
        <Button
          onClick={run}
          color="primary"
          variant={!processType ? "contained" : "outlined"}
          disabled={!devices.audio.stream || !!processType}
          className={classes.runButton}
        >
          {!processType ? t("oldClient.selfAudioTest") : `${t("oldClient." + processType)} - ${Math.round(process)}`}
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

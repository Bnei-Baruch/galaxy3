import React, {useEffect, useState} from "react";
import {Message} from "semantic-ui-react";
import {useTranslation} from "react-i18next";
import {Box, Button, Typography, TextField} from "@mui/material";
import {makeStyles} from "tss-react/mui";
import {grey, blue, green} from "@mui/material/colors";

const useStyles = makeStyles()({
  disabled: {
    opacity: 0.8,
    background: `${green[500]} !important`,
  },
  root: {
    color: "white",
    background: green[500],
  },
});

const SendQuestion = ({questions, send, user = {}}) => {
  const [name, setName] = useState();
  const [galaxyRoom, setGalaxyRoom] = useState();
  const [content, setContent] = useState();
  const {t} = useTranslation();
  const {classes} = useStyles();

  useEffect(() => {
    !name && setName(user.name);
    !galaxyRoom && setGalaxyRoom(user.galaxyRoom);
  }, [user.name, user.galaxyRoom]); // eslint-disable-line  react-hooks/exhaustive-deps

  const handleNameChange = ({target: {value}}) => setName(value);

  const handleGalaxyRoomChange = ({target: {value}}) => setGalaxyRoom(value);

  const handleContentChange = ({target: {value}}) => setContent(value);

  const handleSubmit = async () => {
    await send({name, content, galaxyRoom});
    setContent("");
  };

  const renderQuestion = (q, i) => {
    const {askForMe, time, galaxyRoom: room, name: userName, direction, textAlign, content: msgContent} = q;

    return (
      <Typography key={i} style={{direction, textAlign}}>
        <Typography style={{color: grey["500"]}}>
          {time} - {room} -
          <Typography display="inline" style={{color: !askForMe ? green["A700"] : blue["300"]}}>
            {userName}
          </Typography>
          :
        </Typography>
        <Typography color="textPrimary">{msgContent}</Typography>
      </Typography>
    );
  };

  return (
    <Box className="chat-panel">
      <Message attached className="messages_list">
        <span className="messages-wrapper">{questions?.map(renderQuestion)}</span>
      </Message>

      <TextField
        fullWidth
        label={t("questions.userName")}
        value={name}
        variant="outlined"
        onChange={handleNameChange}
        margin="dense"
      />
      <TextField
        fullWidth
        label={t("questions.galaxyRoom")}
        value={galaxyRoom}
        variant="outlined"
        onChange={handleGalaxyRoomChange}
        margin="dense"
        disabled
      />
      <TextField
        fullWidth
        multiline
        label={t("questions.enterQuestion")}
        value={content}
        variant="outlined"
        onChange={handleContentChange}
        margin="dense"
      />
      <Button
        onClick={handleSubmit}
        variant="contained"
        classes={{...classes}}
        disabled={!name || !galaxyRoom || !content}
      >
        {t("questions.sendQuestion")}
      </Button>
    </Box>
  );
};

export default SendQuestion;

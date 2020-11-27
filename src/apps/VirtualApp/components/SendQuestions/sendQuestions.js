import React, { useState } from 'react';
import { Message } from 'semantic-ui-react';
import { useTranslation } from 'react-i18next';
import { Box, Button } from '@material-ui/core';
import TextField from '@material-ui/core/TextField';
import green from '@material-ui/core/colors/green';
import ButtonBase from '@material-ui/core/ButtonBase';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles({
  disabled: {
    opacity: 0.8,
  },
  root: {
    color: 'white',
    background: green[500]
  }
});

const SendQuestion = ({ questions, send, user = {} }) => {
  const [name, setName]             = useState();
  const [galaxyRoom, setGalaxyRoom] = useState();
  const [content, setContent]       = useState();
  const { t }                       = useTranslation();
  const classes                     = useStyles();

  const handleNameChange = ({ target: { value } }) => setName(value);

  const handleGalaxyRoomChange = ({ target: { value } }) => setGalaxyRoom(value);

  const handleContentChange = ({ target: { value } }) => setContent(value);

  const handleSubmit = async () => {
    await send({ name, content, galaxyRoom });
    setContent('');
  };

  const renderQuestion = (q, i) => {
    const { askForMe, time, galaxyRoom: room, name: userName, direction, textAlign, content: msgContent } = q;

    return (
      <p key={i} style={{ direction, textAlign }}>
        <span style={{ display: 'block' }}>
          <i style={{ color: 'grey' }}>{time}</i> -
          <i style={{ color: 'grey' }}>{room}</i> -
          <b style={{ color: !askForMe ? 'green' : 'blue' }}>{userName}</b>:
        </span>
        {msgContent}
      </p>
    );
  };

  return (
    <Box className="chat-panel">
      <Message attached className='messages_list'>
        <span className='messages-wrapper'>
          {questions?.map(renderQuestion)}
        </span>
      </Message>

      <TextField
        fullWidth
        label={t('name')}
        value={name}
        variant="outlined"
        onChange={handleNameChange}
        margin="dense"
      />
      <TextField
        fullWidth
        label={t('galaxyRoom')}
        value={galaxyRoom}
        variant="outlined"
        onChange={handleGalaxyRoomChange}
        margin="dense"
      />
      <TextField
        fullWidth
        multiline
        label={t('content')}
        value={content}
        variant="outlined"
        onChange={handleContentChange}
        margin="dense"
      />
      <Button
        onClick={handleSubmit}
        variant="contained"
        classes={{ ...classes }}
        disabled={!name || !galaxyRoom || !content}
      >
        {t('virtualChat.sendQuestion')}
      </Button>

    </Box>
  );
};

export default SendQuestion;

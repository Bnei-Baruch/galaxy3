import React, { useState } from 'react';
import { Button, Input, Message, TextArea, Form } from 'semantic-ui-react';
import { useTranslation } from 'react-i18next';
import { isRTLString } from '../../../../shared/tools';

const SendQuestion = ({ questions, send }) => {
  const [userName, setUserName]   = useState();
  const [userGroup, setUserGroup] = useState();
  const [content, setContent]     = useState();
  const { t }                     = useTranslation();

  const handleUserNameChange = ({ value }) => setUserName(value);

  const handleUserGroupChange = ({ value }) => setUserGroup(value);

  const handleContentChange = ({ value }) => setContent(value);

  const handleSend = async () => {
    const res = await send(userName, content);
  };

  const renderQuestion = (q, i) => {
    let { askForMe, time, galaxyRoom: room, userName: name, direction, textAlign, content } = q;

    return (
      <p key={i} style={{ direction, textAlign }}>
        <span style={{ display: 'block' }}>
          <i style={{ color: 'grey' }}>{time}</i> -
          <i style={{ color: 'grey' }}>{room}</i> -
          <b style={{ color: !askForMe ? 'green' : 'blue' }}>{name}</b>:
        </span>
        {content}
      </p>
    );
  };

  return (
    <div className="chat-panel">
      <Message attached className='messages_list'>
        <div className='messages-wrapper'>
          {questions.map(renderQuestion)}
        </div>
      </Message>

      <div className={'questions_form'}>
        <Input ref='input'
               fluid type='text'
               action
               value={userName}
               placeholder={user.name}
               onChange={handleUserNameChange}
               dir={isRTLString(userName) ? 'rtl' : 'ltr'}
               style={{ textAlign: isRTLString(userName) ? 'right' : 'left' }}
        />
        <Input ref='input'
               fluid
               type='text'
               action
               value={userGroup}
               placeholder={user.group}
               onChange={handleUserGroupChange}
               dir={isRTLString(userGroup) ? 'rtl' : 'ltr'}
               style={{ textAlign: isRTLString(userGroup) ? 'right' : 'left' }}
        />
        <Form>
          <TextArea
            rows='4'
            value={this.state.quest_input_message}
            placeholder={t('virtualChat.enterQuestion')}
            onChange={handleContentChange}
            dir={isRTLString(content) ? 'rtl' : 'ltr'}
            style={{ textAlign: isRTLString(content) ? 'right' : 'left' }}>
          </TextArea>
        </Form>

        <Button positive onClick={handleSend}>{t('virtualChat.sendQuestion')}</Button>
      </div>
    </div>
  );
};

export default SendQuestion;

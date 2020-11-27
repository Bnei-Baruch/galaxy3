import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { sendQuestion, getQuestions } from './api.sendQuestions';
import { getDateString } from '../../../../shared/tools';
import SendQuestion from './sendQuestions';

const SendQuestionContainer = ({ user }) => {
  const [messages, setMessages] = useState();
  const { t }                   = useTranslation();

  const send = async ({ userName = user.name, content, userGroup = user.group }) => {
    const { galaxyRoom, group } = user;

    let msg = {
      serialUserId: user.id,
      question: { content },
      user: {
        name: userName,
        gender: !group.match(/^W\s/) ? 'male' : 'female',
        galaxyRoom
      }
    };

    try {
      await sendQuestion(msg);
      await fetchData();
      return true;
    } catch (e) {
      console.error(' error saving questions', user.name, e);
      return false;
    }
  };

  const fetchData = async () => {
    try {
      const { feed } = await getQuestions({ serialUserId: user.id });
      setMessages(feed.map(mapMessage));
    } catch (err) {
      console.error('error getting questions', err);
    }
  };

  const mapMessage = ({ content, timestamp }) => {
    const { galaxyRoom, name, group } = user;
    return {
      time: getDateString(new Date(timestamp)),
      galaxyRoom,
      userName: user.name,
      gender: !user.group.match(/^W\s/) ? 'male' : 'female'
      direction: isRTLString(content) ? 'rtl' : 'ltr',
      textAlign: isRTLString(content) ? 'right' : 'left',
      content: content
    };
  };

  return <SendQuestion questions={messages} send={send} />;
};

export default SendQuestionContainer;

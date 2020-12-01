import React, { useEffect, useState } from 'react';
import { sendQuestion, getQuestions } from './api.sendQuestions';
import { getDateString, isRTLString } from '../../../../shared/tools';
import SendQuestion from './sendQuestions';

const SendQuestionContainer = ({ user = {} }) => {
  const [messages, setMessages] = useState();
  const [userInfo, setUserInfo] = useState();

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    user && setUserInfo(mapUserInfo(user));
  }, [user]);

  const mapUserInfo = (data) => {
    const { id, group, name } = data;
    return {
      id, name,
      galaxyRoom: group,
      gender: !group.match(/^W\s/) ? 'male' : 'female',
    };
  };

  const send = async (payload) => {
    const { gender, id }                = userInfo;
    const { name, content, galaxyRoom } = payload;

    let msg = {
      serialUserId: id,
      question: { content },
      user: { name, gender, galaxyRoom }
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

  const mapMessage = (feed) => {
    const { question: { content, askForMe }, user: { galaxyRoom, name }, timestamp } = feed;
    return {
      galaxyRoom, name, content, askForMe,
      time: getDateString(new Date(timestamp)),
      direction: isRTLString(content) ? 'rtl' : 'ltr',
      textAlign: isRTLString(content) ? 'right' : 'left',
    };
  };

  return <SendQuestion questions={messages} send={send} user={userInfo} />;
};

export default SendQuestionContainer;

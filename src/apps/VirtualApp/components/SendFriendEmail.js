import React, { useMemo, useState } from 'react';
import {
  Header,
  Input,
  Segment,
} from 'semantic-ui-react';
import { useTranslation } from 'react-i18next';
import {
  AUTH_API_BACKEND,
} from "../../../shared/env";


const EMAIL_RE = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
const emailValid = (email) => !!EMAIL_RE.test(String(email).toLowerCase());

const SendFriendEmail = (props) => {
  const {t} = useTranslation();
  const {user: {access_token}} = props;
  const [email, setEmail] = useState('');
  const valid = useMemo(() => emailValid(email), [email]);

  const sendEmailToFriend = () => {
    if (valid) {
      fetch(`${AUTH_API_BACKEND}/check?email=${email}`, {
        headers: {
          'Authentication': `bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
      }).then((response) => {
        if (response.ok) {
          return response.json();
        } else {
          throw new Error(`Fetch error: ${response.status}`);
        }
      }).then((data) => {
        console.log('Data', data);
      })
      .catch((error) => {
        console.error('Check email error:', error);
      });
    }
  };

  return (
    <Segment textAlign="center" style={{backgroundColor: 'lightyellow'}}>
      <Header style={{textAlign: 'justify'}}>{t('oldClient.welcomeGuest')}</Header>
      <Input action={{
               color: 'green',
               content: 'Send',
               onClick: sendEmailToFriend,
             }}
             error={email && !valid}
             onChange={e => setEmail(e.target.value)}
             placeholder={t('galaxyApp.typeFriendEmail')} />
    </Segment>
  );
};

export default SendFriendEmail;

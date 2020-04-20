import React, { useState } from 'react';
import { Button, Container, Grid, Icon, Message } from 'semantic-ui-react';
import { useTranslation } from 'react-i18next';
import {userLogin} from "./UserManager";

const LoginMessage = () => {
  const [visible, setVisible] = useState(true);
  const { t, i18n }           = useTranslation();
  const rtl                   = i18n.language === 'he' ? 'rtl' : '';

  let login          = (<Button primary size='massive' onClick={() => userLogin('https://galaxy.kli.one/user')} >{t('loginMessage.login')}</Button>);
  const firstColumn  = (<Grid.Column width={13} tablet={12} mobile={10} style={{ direction: rtl }}>
    <span style={rtl ? {paddingRight: '10px'} : {}}>
    {t('loginMessage.loginWarning1')} <a href='#' onClick={() => userLogin('https://galaxy.kli.one/user')} >{t('loginMessage.register')}</a> {t('loginMessage.loginWarning2')}
    </span>
  </Grid.Column>);
  const secondColumn = (<Grid.Column width={3} textAlign='left'>
    <Icon>{login}</Icon>
  </Grid.Column>);

  const row = (
    rtl
      ? <Grid.Row reversed>{secondColumn}{firstColumn}</Grid.Row>
      : <Grid.Row reversed>{firstColumn}{secondColumn}</Grid.Row>
  );

  return visible
    ? (
      <Container textAlign='center' className="login-message">
        <Message icon visible negative size='huge' onDismiss={() => setVisible(false)} className={rtl ? 'rtl' : 'ltr'}>
          <Message.Content>
            <Grid celled>
              {row}
            </Grid>
          </Message.Content>
        </Message>
      </Container>
    )
    : null;
};

export default LoginMessage;

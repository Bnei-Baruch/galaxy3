import React, { useState } from 'react';
import { Button, Container, Grid, Icon, Message } from 'semantic-ui-react';
import { useTranslation } from 'react-i18next';

const LoginMessage = () => {
  const [visible, setVisible] = useState(true);
  const { t }                 = useTranslation();

  let login = (<Button primary size='massive' onClick={() => window.open('https://galaxy.kli.one/user', '_self')}>{t('loginMessage.login')}</Button>);

  return visible
    ? (
      <Container textAlign='center' className="login-message">
        <Message icon visible negative size='huge' onDismiss={() => setVisible(false)}>
          <Message.Content>
            <Grid celled>
              <Grid.Row reversed>
                <Grid.Column width={13} tablet={12} mobile={10}>
                  {t('loginMessage.loginWarning1')} <a href='#' onClick={() => window.open('https://galaxy.kli.one/user', '_self')}>{t('loginMessage.register')}</a> {t('loginMessage.loginWarning2')}
                </Grid.Column>
                <Grid.Column width={3} textAlign='left'>
                  <Icon>{login}</Icon>
                </Grid.Column>
              </Grid.Row>
            </Grid>
          </Message.Content>
        </Message>
      </Container>
    )
    : null;
};

export default LoginMessage;

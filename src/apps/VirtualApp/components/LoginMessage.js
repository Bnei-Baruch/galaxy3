import React, { useState } from 'react';
import {Button, Container, Grid, Icon, Message, Modal} from 'semantic-ui-react';
import { useTranslation } from 'react-i18next';
import {userLogin} from "../../../components/UserManager";

const LoginMessage = () => {
  const [visible, setVisible] = useState(true);
  const [open, setOpen] = useState(true);
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

  const popup = (
      <Modal open size='small'>
        <Modal.Content>
          <h1 style={{ direction: rtl }}>{t('loginMessage.popupMessage1')} <a href='#' onClick={() => userLogin('https://galaxy.kli.one/user')} >{t('loginMessage.register2')}</a> {t('loginMessage.popupMessage2')}</h1>
        </Modal.Content>
        <Modal.Actions>
          <Button color='green' onClick={() => setOpen(false)} >
            <Icon name='checkmark' /> Ok
          </Button>
        </Modal.Actions>
      </Modal>
  )

  return visible
    ? (
      <Container textAlign='center' className="login-message">
        <Message icon visible negative size='huge' onDismiss={() => setVisible(false)} className={rtl ? 'rtl' : 'ltr'}>
          <Message.Content>
            <Grid celled>
              {row}
              {open ? popup : null}
            </Grid>
          </Message.Content>
        </Message>
      </Container>
    )
    : null;
};

export default LoginMessage;

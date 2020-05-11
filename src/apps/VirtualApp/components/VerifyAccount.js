import React, { useMemo, useState, useEffect } from 'react';
import {
  Button,
  Checkbox,
  Header,
  Icon,
  Input,
  Modal,
  Segment,
  Table,
} from 'semantic-ui-react';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/Api';
import {getUserRemote} from "../../../components/UserManager";


const EMAIL_RE = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
const emailValid = (email) => !!EMAIL_RE.test(String(email).toLowerCase());

const VerifyAccount = (props) => {
  const {loginPage, i18n, onUserUpdate} = props;
  const {t} = useTranslation();
  const {user, user: {access_token}} = props;
  const [email, setEmail] = useState('');
  const valid = useMemo(() => emailValid(email), [email]);
  const [requestSent, setRequestSent] = useState(false);
  const [closedModal, setClosedModal] = useState(false);
  const [pendingState, setPendingState] = useState({});
  const [error, setError] = useState('');
  const [formClosed, setFormClosed] = useState(false);
  const direction = i18n.language === 'he' ? 'rtl' : '';
  const textAlign = i18n.language === 'he' ? 'right' : '';

  useEffect(() => {
    if (user.pending && user.pending.length) {
      const updatePendingState = user.pending.reduce((acc, pending_user) => {
        acc[pending_user] = '';
        return acc;
      }, {});
      setPendingState(updatePendingState);
    }
  }, [user.pending]);

  const updateUserPendingState = (email, state) => {
    setPendingState(Object.assign({}, pendingState, {[email]: state}));
  }

  const applyPendingStates = () => {
    for (let [pendingEmail, state] of Object.entries(pendingState)) {

      if (['ignore', 'approve'].includes(state)) {
        api.verifyUser(pendingEmail, state).then((data) => {
          if (data && data.result === 'success') {
            getUserRemote((user) => onUserUpdate(user));
          }
        });
      }
    }
  }

  const askFriendToVerify = () => {
    if (valid) {
      api.requestToVerify(email).then((data) => {
        if (data && data.result === 'success') {
          setRequestSent(true);
          setClosedModal(false);
          getUserRemote((user) => onUserUpdate(user));
        }
      }).catch((error) => {
        console.error('Request error:', error);
        //} else if (response.status === 404) {
        //  setError(t('galaxyApp.requestedVerificationBadEmailPopup'));
      });
    }
  };

  console.log('RENDER', user.role, 'closedModal', closedModal, 'requestSent', requestSent, 'user.request', user.request, 'user.pending', user.pending, 'USER', user);
  const ret = [];
  if (!formClosed && !requestSent && user && user.role === 'ghost' && (!user.request || user.request.length === 0)) {
    ret.push(<Segment textAlign="center" style={{backgroundColor: loginPage ? '' : 'lightyellow', direction}} basic={loginPage}>
      <Header style={{fontWeight: 'normal',
                      maxWidth: '1300px',
                      margin: 'auto',
                      textAlign: loginPage ? (i18n.language === 'he' ? 'right' : 'left') : 'center',
                      marginBottom: loginPage ? '10px' : ''}}>
        {loginPage ? t('galaxyApp.verifyAccount') : t('galaxyApp.welcomeGuestForm')}
      </Header>
      <Input error={!!email && !valid}
             onChange={e => setEmail(e.target.value)}
             placeholder={t('galaxyApp.typeFriendEmail')} />
      <Button color="green" style={{margin: '2px'}} onClick={askFriendToVerify}>{t('virtualChat.send')}</Button>
      {loginPage ? null : <Icon name="close" style={{cursor: 'pointer', position: 'absolute', top: '5px', right: '5px'}} onClick={() => setFormClosed(true)} />}
    </Segment>);
  }

  if (!loginPage && requestSent && user && user.role === 'ghost' && !closedModal) {
    ret.push(<Modal open={true} style={{direction, textAlign}}>
      <Modal.Content>
        <Header>{t('galaxyApp.requestedVerificationPopup')}</Header>
      </Modal.Content>
      <Modal.Actions>
        <Button color='green' onClick={() => setClosedModal(true)}>{t('galaxyApp.ok')}</Button>
      </Modal.Actions>
    </Modal>);
  }

  if (!loginPage && !requestSent && user && user.role === 'ghost' && !closedModal) {
    ret.push(<Modal open={true} style={{direction, textAlign}}>
      <Modal.Content>
        <Header>{(user.request) ? t('galaxyApp.welcomeGuestPopupRequested') : t('galaxyApp.welcomeGuestPopup')}</Header>
      </Modal.Content>
      <Modal.Actions>
        <Button color='green' onClick={() => setClosedModal(true)}>{t('galaxyApp.ok')}</Button>
      </Modal.Actions>
    </Modal>);
  }

  if (!loginPage && user && user.role === 'user' && user.pending && user.pending.length && !closedModal) {
    ret.push(<Modal open={true} style={{direction, textAlign}}>
      <Modal.Content textAlign='center'>
        <Header>{t('galaxyApp.approveVerificationHeader').replace('[UserFirstName]', user.title)}</Header>
        <Table style={{textAlign}}>
          <Table.Header>
            <Table.Row>
              <Table.Cell>{t('galaxyApp.approveVerificationEmail')}</Table.Cell>
              <Table.Cell>{t('galaxyApp.approveVerificationVerify')}</Table.Cell>
              <Table.Cell>{t('galaxyApp.approveVerificationIgnore')}</Table.Cell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {user.pending.map((pendingEmail, index) => (<Table.Row key={index}>
              <Table.Cell>{pendingEmail}</Table.Cell>
              <Table.Cell>
                <Checkbox checked={pendingState[pendingEmail] === 'approve'}
                          onClick={(e, { checked }) => updateUserPendingState(pendingEmail, checked ? 'approve' : '') } />
              </Table.Cell>
              <Table.Cell>
                <Checkbox checked={pendingState[pendingEmail] === 'ignore'}
                          onClick={(e, { checked }) => updateUserPendingState(pendingEmail, checked ? 'ignore' : '') } />
              </Table.Cell>
            </Table.Row>))}
          </Table.Body>
        </Table>
      </Modal.Content>
      <Modal.Actions>
        <Button color='green' onClick={() => {
          applyPendingStates();
          setClosedModal(true);
        }}>{t('galaxyApp.ok')}</Button>
        <Button onClick={() => setClosedModal(true)}>{t('galaxyApp.cancel')}</Button>
      </Modal.Actions>
    </Modal>);
  }

  if (error) {
    ret.push(<Modal open={true} style={{direction, textAlign}}>
      <Modal.Content>
        <Header>{error}</Header>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => setError('')}>{t('galaxyApp.close')}</Button>
      </Modal.Actions>
    </Modal>);
  }

  return ret.length ? ret : null;
};

export default VerifyAccount;

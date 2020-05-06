import React, { useMemo, useState, useEffect } from 'react';
import {
  Button,
  Checkbox,
  Header,
  Input,
  Modal,
  Segment,
  Table,
} from 'semantic-ui-react';
import { useTranslation } from 'react-i18next';
import {
  AUTH_API_BACKEND,
} from "../../../shared/env";
import {silentSignin} from "../../../components/UserManager";


const EMAIL_RE = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
const emailValid = (email) => !!EMAIL_RE.test(String(email).toLowerCase());

const VerifyAccount = (props) => {
  const {loginPage, i18n} = props;
  const {t} = useTranslation();
  const {user, user: {access_token}} = props;
  const [email, setEmail] = useState('');
  const valid = useMemo(() => emailValid(email), [email]);
  const [requestSent, setRequestSent] = useState(false);
  const [closedModal, setClosedModal] = useState(false);
  const [pendingState, setPendingState] = useState({});
  const [error, setError] = useState('');
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
        fetch(`${AUTH_API_BACKEND}/verify?email=${pendingEmail}&action=${state}`, {
          headers: {
            'Authorization': `bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
        }).then((response) => {
          if (response.ok) {
            return response.json();
          } else {
            throw new Error(`Fetch error: ${response.status}`);
          }
        }).then((data) => {
          if (data && data.result === 'success') {
            silentSignin();  // Update user data from oidc. Same as renew signin after 10 minutes.
          }
        })
        .catch((error) => {
          console.error('Verify error:', error);
        });
      }
    }
  }

  const askFriendToVerify = () => {
    if (valid) {
      fetch(`${AUTH_API_BACKEND}/request?email=${email}`, {
        headers: {
          'Authorization': `bearer ${access_token}`,
          'Content-Type': 'application/json',
        },
      }).then((response) => {
        if (response.ok) {
          return response.json();
        } else if (response.status === 404) {
          setError(t('galaxyApp.requestedVerificationBadEmailPopup'));
        } else {
          throw new Error(`Fetch error: ${response.status}`);
        }
      }).then((data) => {
        if (data && data.result === 'success') {
          setRequestSent(true);
          setClosedModal(false);
          silentSignin();  // Update user data from oidc. Same as renew signin after 10 minutes.
        }
      })
      .catch((error) => {
        console.error('Request error:', error);
      });
    }
  };

  // console.log('RENDER', user.role, 'closedModal', closedModal, 'requestSent', requestSent, 'user.request', user.request, 'user.pending', user.pending, 'USER', user);
  const ret = [];
  if (!requestSent && user && user.role === 'ghost' && (!user.request || user.request.length === 0)) {
    ret.push(<Segment textAlign="center" style={{backgroundColor: 'lightyellow', direction}}>
      <Header style={{textAlign: 'justify'}}>{t('galaxyApp.welcomeGuestForm')}</Header>
      <Input error={!!email && !valid}
             onChange={e => setEmail(e.target.value)}
             placeholder={t('galaxyApp.typeFriendEmail')} />
      <Button color="green" style={{margin: '2px'}} onClick={askFriendToVerify}>Send</Button>
    </Segment>);
  }

  if (requestSent && user && user.role === 'ghost' && !closedModal) {
    ret.push(<Modal open={true} style={{direction, textAlign}}>
      <Modal.Content>
        <Header>{t('galaxyApp.requestedVerificationPopup')}</Header>
      </Modal.Content>
      <Modal.Actions>
        <Button color='green' onClick={() => setClosedModal(true)}>OK</Button>
      </Modal.Actions>
    </Modal>);
  }

  if (!loginPage && !requestSent && user && user.role === 'ghost' && !closedModal) {
    ret.push(<Modal open={true} style={{direction, textAlign}}>
      <Modal.Content>
        <Header>{(user.request) ? t('galaxyApp.welcomeGuestPopupRequested') : t('galaxyApp.welcomeGuestPopup')}</Header>
      </Modal.Content>
      <Modal.Actions>
        <Button color='green' onClick={() => setClosedModal(true)}>OK</Button>
      </Modal.Actions>
    </Modal>);
  }

  if (!loginPage && user && user.role === 'user' && user.pending && user.pending.length && !closedModal) {
    ret.push(<Modal open={true} style={{direction, textAlign}}>
      <Modal.Content textAlign="center">
        <Header>{t('galaxyApp.approveVerificationHeader').replace('[UserFirstName]', user.title)}</Header>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Cell>Email</Table.Cell>
              <Table.Cell>Verify</Table.Cell>
              <Table.Cell>Ignore</Table.Cell>
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
        }}>OK</Button>
        <Button onClick={() => setClosedModal(true)}>Cancel</Button>
      </Modal.Actions>
    </Modal>);
  }

  if (error) {
    ret.push(<Modal open={true} style={{direction, textAlign}}>
      <Modal.Content>
        <Header>{error}</Header>
      </Modal.Content>
      <Modal.Actions>
        <Button onClick={() => setError('')}>Close</Button>
      </Modal.Actions>
    </Modal>);
  }

  return ret.length ? ret : null;
};

export default VerifyAccount;
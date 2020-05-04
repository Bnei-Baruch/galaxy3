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


const EMAIL_RE = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
const emailValid = (email) => !!EMAIL_RE.test(String(email).toLowerCase());

const SendFriendEmail = (props) => {
  const {t} = useTranslation();
  const {user, user: {access_token}} = props;
  const [email, setEmail] = useState('');
  const valid = useMemo(() => emailValid(email), [email]);
  const [closedModal, setClosedModal] = useState(false);
  const [pendingState, setPendingState] = useState({});

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
          console.log('Data', data);
        })
        .catch((error) => {
          console.error('Verify error:', error);
        });
      }
    }
  }

  console.log('USER', user);

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
        } else {
          throw new Error(`Fetch error: ${response.status}`);
        }
      }).then((data) => {
        console.log('Data', data);
      })
      .catch((error) => {
        console.error('Request error:', error);
      });
    }
  };

  if (user && user.role === 'guest' && (!user.request || user.request.length === 0)) {
    return (<Segment textAlign="center" style={{backgroundColor: 'lightyellow'}}>
      <Header style={{textAlign: 'justify'}}>{t('galaxyApp.welcomeGuest')}</Header>
      <Input action={{
               color: 'green',
               content: 'Send',
               onClick: askFriendToVerify,
             }}
             error={email && !valid}
             onChange={e => setEmail(e.target.value)}
             placeholder={t('galaxyApp.typeFriendEmail')} />
    </Segment>);
  }

  if (user && user.role === 'guest' && !closedModal) {
    return (<Modal open={true}>
      <Modal.Content>
        <Header>{user.request ? t('galaxyApp.welcomeGuestRequested') : t('galaxyApp.welcomeGuest')}</Header>
      </Modal.Content>
      <Modal.Actions>
        <Button color='green' onClick={() => setClosedModal(true)}>OK</Button>
      </Modal.Actions>
    </Modal>);
  }

  if (user && user.role === 'user' && user.pending && user.pending.length && !closedModal) {
    return (<Modal open={true}>
      <Modal.Content>
        <Header>Hello {user.title}</Header>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Cell>Email</Table.Cell>
              <Table.Cell>Verify</Table.Cell>
              <Table.Cell>Ignore</Table.Cell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {user.pending.map((pendingEmail) => (<Table.Row>
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
  return null;
};

export default SendFriendEmail;

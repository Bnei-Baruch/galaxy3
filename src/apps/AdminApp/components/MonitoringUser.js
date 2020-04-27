import React, {useEffect, useState} from 'react';
import {Dimmer, Header, Loader, Table} from 'semantic-ui-react';
import {MONITORING_BACKEND} from '../../../shared/env';
import {userRow} from '../../../shared/MonitoringUtils';

const MonitoringUser = (props) => {
  const [loadingCount, setLoadingCount] = useState(0);
  const [userData, setUserData] = useState({});
  const [fetchingError, setFetchingError] = useState('');
  const [, forceUpdate] = useState(true);  // Rerender to show progress in time since.

  const fetchUser = (onUserData) => {
    setLoadingCount(prev => prev + 1);
    fetch(`${MONITORING_BACKEND}/user_metrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({user_id: props.user.id}),
    }).then((response) => {
      if (response.ok) {
        return response.json();
      } else {
        throw new Error(`Fetch error: ${response.url} ${response.status} ${response.statusText}`);
      }
    }).then((data) => {
      onUserData(data);
    })
    .catch((error) => {
      console.error('Fetching monitoring users data error:', error);
      setFetchingError(error.toString());
    }).finally(() => {
      setLoadingCount(prev => prev - 1);
    });
  }

  useEffect(() => {
    fetchUser((data) => {
      setUserData(data);
    });
  }, [props.user]);

  useEffect(() => {
    const handler = setInterval(() => forceUpdate(b => !b), 60 * 1000);  // Refresh every minute to update login since.
    return () => {
      clearInterval(handler);
    };
  }, []);

  const loading = (
    <Dimmer active inverted>
      <Loader size='massive' style={{position: 'absolute', top: '100px'}}/>
    </Dimmer>);

  const objectToTable = (obj, key) => {
    if (Array.isArray(obj)) {
      return <div key={key}>{obj.map((elem, index) => (<span style={{display: 'inline-block'}}key={index}>{index}: {objectToTable(elem)}</span>))}</div>;
    } else if (obj !== null && typeof obj === 'object') {
      return <div style={{border: 'black solid 2px'}} key={key}>{Object.entries(obj).map(([key, value]) => <div key={key}>{key}: {objectToTable(value, key)}</div>)}</div>;
    } else {
      return <span style={{marginRight: '5px'}} key={key}>{String(obj)}</span>;
    }
  };

  const now = new Date();

  return (
    <div>
      {fetchingError === '' ? null : <Header color='red'>Error: {fetchingError}</Header>}
      {loadingCount !== 0 ? loading: null}
      <Table>
        <Table.Body>
          {userRow(props.user, props.stats, now)}
        </Table.Body>
      </Table>
      {objectToTable(props.user, 'user')}
      {objectToTable(userData, 'data')}
    </div>
  );
}

export default MonitoringUser;

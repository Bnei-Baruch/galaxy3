import React, {
	useState,
	useEffect,
} from 'react';
import {
	Button,
	Icon,
	Popup,
  Dimmer,
  Header,
  Loader,
  Table,
} from 'semantic-ui-react';

import {
  fetchData,
  popup,
  shortNumber,
  sinceTimestamp,
  system,
  userRow,
} from '../../../shared/MonitoringUtils';


const MonitoringAdmin = (props) => {
  const [loadingCount, setLoadingCount] = useState(0);
  const [fetchingError, setFetchingError] = useState('');

  const [users, setUsers] = useState({});
	const [usersData, setUsersData] = useState({});
  const [{view, column, direction}, setUsersTableView] = useState({
    view: [],
    column: '',
    direction: '',
  });
  const [usersToShow, setUsersToShow] = useState(100);
	const [, forceUpdate] = useState(true);  // Rerender to show progress in time since.

	const tableParentRef = (node) => {
		if (node) {
			const tableHeaderTop = node.querySelector('thead').getBoundingClientRect().top;
			const ths = node.querySelectorAll('thead th')
			ths.forEach(th => {
        if (th.style.position !== 'sticky') {
          th.style.top = th.getBoundingClientRect().top - tableHeaderTop + "px";
          th.style.position = 'sticky';
        }
			});
		}
  };

	const updateUsersData = () => {
    setLoadingCount(prev => prev + 1);
    fetchData('users_data').then(data => {
      if (data.users_data) {
        setUsersData(data.users_data);
      } else {
        throw new Error(`Expected users_data in response, got ${JSON.stringify(data)}`);
      }
    }).catch(error => {
      setFetchingError(error.toString());
    }).finally(() => {
      setLoadingCount(prev => prev - 1);
    });
	};

	const updateUsers = () => {
    setLoadingCount(prev => prev + 1);
    fetchData('users').then(data => {
      if (data.users) {
        const usersObj = {};
        data.users.forEach(user => {
          if (!user.id) {
            console.log('BAD USER', user);
          } else {
            usersObj[user.id] = user;
          }
        });
        setUsers(usersObj);
      } else {
        throw new Error(`Expected users in response, got ${JSON.stringify(data)}`);
      }
		}).catch(error => {
      setFetchingError(error.toString());
    }).finally(() => {
      setLoadingCount(prev => prev - 1);
    });
	}

  useEffect(() => {
		updateUsers();
		updateUsersData();
		setInterval(() => forceUpdate(b => !b), 60 * 1000);  // Refresh every minute to update login since.
  }, []);

  useEffect(() => {
    const view = Object.values(users).map(user => ({
      user,
      stats: usersDataValues(user.id),
    }));
    setUsersTableView({view, column, direction});
  }, [users, usersData]);

	const now = new Date();
	const usersDataValues = (userId) => {
		const values = [[''], [''], [''], [''], [''], [''], ['']];
		if (userId in usersData) {
			const ud = usersData[userId];
			if (ud.timestamps && ud.timestamps.length) {
				values[0] = [ud.timestamps[0], sinceTimestamp(ud.timestamps[0], now)];
			}
			for (let [metric, index] of Object.entries(ud.index)) {
				let valueIndex = 1;
				let value = ud.data[index][0]
				if (metric.includes('video')) {
					valueIndex += 3;
				}
				const metricName = metric.split('.').slice(-1)[0];
				if (metricName === 'packetsLost') {
					valueIndex++;
				} else if (metricName === 'roundTripTime') {
					valueIndex += 2;
				} else if (metricName === 'jitter' && value !== null) {
					value = value.toFixed(5);
				}
				values[valueIndex][0] = [value, shortNumber(value) || ''];
        if (!isNaN(values[valueIndex][0][0])) {
          ud.stats[index].forEach(stats => {
            const stdev = Math.sqrt(stats.dsquared);
            values[valueIndex].push([stats.mean, shortNumber(stats.mean)]);
            values[valueIndex].push([stdev, shortNumber(stdev)]);
            values[valueIndex].push([stats.length, shortNumber(stats.length)]);
          });
        }
			}
		}
		return values;
	}

	const usersDataTimestamp = (userId) => {
		return (usersData[userId] && usersData[userId].timestamps && usersData[userId].timestamps[0]) || 0;
	}

  const compare = (a, b) => {
    if (a === b) {
      return 0;
    } else if (a === null) {
      return -1;
    } else if (b === null) {
      return 1;
    }
    return a - b;
  }

  const handleSort = (clickedColumn) => () => {
    if (column !== clickedColumn) {
      setUsersTableView({
        column: clickedColumn,
        direction: clickedColumn.startsWith('audio') ||
          clickedColumn.startsWith('video') ||
          ['login', 'update'].includes(clickedColumn) ? 'descending' : 'ascending',
        view: view.sort((a, b) => {
					if (['group', 'janus'].includes(clickedColumn)) {
						return a.user[clickedColumn].localeCompare(b.user[clickedColumn]);
					} else if (clickedColumn === 'name') {
						return a.user.display.localeCompare(b.user.display);
					} else if (clickedColumn === 'login') {
						return a.user.timestamp - b.user.timestamp;
					} else if (clickedColumn === 'system') {
						return system(a.user.system).localeCompare(system(b.user.system));
					} else if (clickedColumn === 'update') {
						return usersDataTimestamp(a.user.id) - usersDataTimestamp(b.user.id);
					} else if (clickedColumn.startsWith('audio') || clickedColumn.startsWith('video')) {
						const valuesA = a.stats;
						const valuesB = b.stats;
						let index = clickedColumn.startsWith('audio') ? 1 : 4;
						if (clickedColumn.endsWith('jitter')) {
							return compare(valuesB[index][0][0], valuesA[index][0][0]);
						} else if (clickedColumn.endsWith('packetslost')) {
							return compare(valuesB[index+1][0][0], valuesA[index+1][0][0]);
						} else if (clickedColumn.endsWith('rtt')) {
							return compare(valuesB[index+2][0][0], valuesA[index+2][0][0]);
						}
					}
					console.error('Should not get here!');
				}),
      })
    } else {
			setUsersTableView({
				view: view.reverse(),
				column,
				direction: direction === 'ascending' ? 'descending' : 'ascending',
			});
		}
  }

  const usersTable = (
		<div ref={tableParentRef}>
			<Table sortable celled>
				<Table.Header>
					<Table.Row textAlign='center'>
						<Table.HeaderCell colSpan="12">
              <Button icon onClick={() => { updateUsersData(); updateUsers(); }}><Icon name='refresh' /></Button>
              Showing {Math.min(usersToShow, view.length)} users out of {view.length}
            </Table.HeaderCell>
					</Table.Row>
					<Table.Row textAlign='center'>
						<Table.HeaderCell rowSpan="2"
															sorted={column === 'name' ? direction : null}
															onClick={handleSort('name')}>{popup('Name')}</Table.HeaderCell>
						<Table.HeaderCell rowSpan="2"
															sorted={column === 'group' ? direction : null}
															onClick={handleSort('group')}>{popup('Group')}</Table.HeaderCell>
						<Table.HeaderCell rowSpan="2"
															sorted={column === 'janus' ? direction : null}
															onClick={handleSort('janus')}>{popup('Janus')}</Table.HeaderCell>
						<Table.HeaderCell rowSpan="2"
															sorted={column === 'login' ? direction : null}
															onClick={handleSort('login')}>{popup('Login')}</Table.HeaderCell>
						<Table.HeaderCell rowSpan="2"
															sorted={column === 'system' ? direction : null}
															onClick={handleSort('system')}>{popup('System')}</Table.HeaderCell>
						<Table.HeaderCell rowSpan="2"
															sorted={column === 'update' ? direction : null}
															onClick={handleSort('update')}>{popup('Update')}</Table.HeaderCell>
						<Table.HeaderCell colSpan="3">{popup('Audio')}</Table.HeaderCell>
						<Table.HeaderCell colSpan="3">{popup('Video')}</Table.HeaderCell>
					</Table.Row>
					<Table.Row textAlign='center'>
						<Table.HeaderCell sorted={column === 'audio.jitter' ? direction : null}
															onClick={handleSort('audio.jitter')}>{popup('Jitter')}</Table.HeaderCell>
						<Table.HeaderCell sorted={column === 'audio.packetslost' ? direction : null}
															onClick={handleSort('audio.packetslost')}>{popup('Packets Lost')}</Table.HeaderCell>
						<Table.HeaderCell sorted={column === 'audio.rtt' ? direction : null}
															onClick={handleSort('audio.rtt')}>{popup('RTT')}</Table.HeaderCell>
						<Table.HeaderCell sorted={column === 'video.jitter' ? direction : null}
															onClick={handleSort('video.jitter')}>{popup('Jitter')}</Table.HeaderCell>
						<Table.HeaderCell sorted={column === 'video.packetslost' ? direction : null}
															onClick={handleSort('video.packetslost')}>{popup('Packets Lost')}</Table.HeaderCell>
						<Table.HeaderCell sorted={column === 'video.rtt' ? direction : null}
															onClick={handleSort('video.rtt')}>{popup('RTT')}</Table.HeaderCell>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{view.slice(0, usersToShow).map(({user, stats}, index) => userRow(user, stats, now, () => props.addUserTab(user, stats)))}
				</Table.Body>
        { usersToShow >= view.length ? null : (
          <Table.Footer>
            <Table.Row textAlign='center'>
              <Table.HeaderCell colSpan="12"><Button icon onClick={() => setUsersToShow(usersToShow + usersToShow)}><Icon name='angle double down' /></Button></Table.HeaderCell>
            </Table.Row>
          </Table.Footer>)
        }
			</Table>
		</div>
  );

  const loading = (
    <Dimmer active inverted>
      <Loader size='massive' style={{position: 'absolute', top: '100px'}}/>
    </Dimmer>);

  return (
		<div>
			{fetchingError === '' ? null : <Header color='red'>Error: {fetchingError}</Header>}
			{loadingCount !== 0 ? loading: null}
			{view.length ? usersTable : null}
		</div>
  );
}

export default MonitoringAdmin;

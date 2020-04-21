import React, {
	useState,
	useEffect,
} from 'react';
import {
	Button,
	Icon,
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
  const [now, setNow] = useState(0);

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
        setNow(Number(new Date()));
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
		const handler = setInterval(() => forceUpdate(b => !b), 60 * 1000);  // Refresh every minute to update login since.
    return () => {
      clearInterval(handler);
    };
  }, []);

  const statsNames = ['oneMin', 'threeMin', 'tenMin'];
  const audioVideoScore = (audioVideo) => {
    if (!audioVideo) {
      return 0;
    }
    let ret = 0;
    if (audioVideo.jitter && audioVideo.jitter.score.value > 0) {
      ret += 1000*(audioVideo.jitter.score.value);
    }
    if (audioVideo.packetsLost && audioVideo.packetsLost.score.value > 0) {
      ret += audioVideo.packetsLost.score.value;
    }
    if (audioVideo.roundTripTime && audioVideo.roundTripTime.score.value > 0) {
      ret += 100*(audioVideo.roundTripTime.score.value);
    }
    return ret;
  };
	const usersDataValues = (userId) => {
    const values = {};
		if (userId in usersData) {
			const ud = usersData[userId];
			if (ud.timestamps && ud.timestamps.length) {
				values.update = {value: ud.timestamps[0], view: sinceTimestamp(ud.timestamps[0], now)};
			}
			for (let [metric, index] of Object.entries(ud.index)) {
				const metricField = metric.includes('video') ? 'video' : 'audio';
        if (!(metricField in values)) {
          values[metricField] = {};
        }
				const metricName = metric.split('.').slice(-1)[0];
        values[metricField][metricName] = {};

				const value = ud.data[index][0];
				values[metricField][metricName].last = {value, view: shortNumber(value) || ''};
        if (!isNaN(value)) {
          ud.stats[index].forEach((stats, statsIndex) => {
            const stdev = Math.sqrt(stats.dsquared);
            values[metricField][metricName][statsNames[statsIndex]] = {
              mean: {value: stats.mean, view: shortNumber(stats.mean)},
              stdev: {value: stdev, view: shortNumber(stdev)},
              length: {value: stats.length, view: shortNumber(stats.length)},
            };
          });
          let metricScore = 0;
          if (values[metricField][metricName].oneMin && values[metricField][metricName].threeMin) {
            metricScore = values[metricField][metricName].oneMin.mean.value - values[metricField][metricName].threeMin.mean.value;
          } 
          values[metricField][metricName].score = {value: metricScore, view: shortNumber(metricScore)};
        }
			}
		}
    const score = audioVideoScore(values.audio) + audioVideoScore(values.video);
    values.score = {value: score, view: shortNumber(score)};
		return values;
	}

  useEffect(() => {
    console.log('Update view.');
    const view = Object.values(users).map(user => ({
      user,
      stats: usersDataValues(user.id),
    }));
    setUsersTableView({view, column: '', direction: ''});
  }, [users, usersData]);


  const handleSort = (clickedColumn) => () => {
    setLoadingCount(prev => prev + 1);
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
						return a.stats.update.value - b.stats.update.value;
					} else if (clickedColumn.startsWith('audio')) {
						if (clickedColumn.endsWith('jitter')) {
							return ((b.stats.audio && b.stats.audio.jitter.score.value) || 0) - ((a.stats.audio && a.stats.audio.jitter.score.value) || 0);
						} else if (clickedColumn.endsWith('packetsLost')) {
							return ((b.stats.audio && b.stats.audio.packetsLost.score.value) || 0) - ((a.stats.audio && a.stats.audio.packetsLost.score.value) || 0);
						} else if (clickedColumn.endsWith('roundTripTime')) {
							return ((b.stats.audio && b.stats.audio.roundTripTime.score.value) || 0) - ((a.stats.audio && a.stats.audio.roundTripTime.score.value) || 0);
						}
					} else if (clickedColumn.startsWith('video')) {
						if (clickedColumn.endsWith('jitter')) {
							return ((b.stats.video && b.stats.video.jitter.score.value) || 0) - ((a.stats.video && a.stats.video.jitter.score.value) || 0);
						} else if (clickedColumn.endsWith('packetsLost')) {
							return ((b.stats.video && b.stats.video.packetsLost.score.value) || 0) - ((a.stats.video && a.stats.video.packetsLost.score.value) || 0);
						} else if (clickedColumn.endsWith('roundTripTime')) {
							return ((b.stats.video && b.stats.video.roundTripTime.score.value) || 0) - ((a.stats.video && a.stats.video.roundTripTime.score.value) || 0);
						}
          } else if (clickedColumn === 'score') {
            return a.stats.score.value - b.stats.score.value;
          }
					console.error('Should not get here!');
          return 0;
				}),
      })
    } else {
			setUsersTableView({
				view: view.reverse(),
				column,
				direction: direction === 'ascending' ? 'descending' : 'ascending',
			});
		}
    setLoadingCount(prev => prev - 1);
  }

  const usersTable = (
		<div ref={tableParentRef}>
			<Table sortable celled>
				<Table.Header>
					<Table.Row textAlign='center'>
						<Table.HeaderCell colSpan="13">
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
						<Table.HeaderCell rowSpan="2"
															sorted={column === 'score' ? direction : null}
															onClick={handleSort('score')}>{popup('Score')}</Table.HeaderCell>
						<Table.HeaderCell colSpan="3">{popup('Audio')}</Table.HeaderCell>
						<Table.HeaderCell colSpan="3">{popup('Video')}</Table.HeaderCell>
					</Table.Row>
					<Table.Row textAlign='center'>
						<Table.HeaderCell sorted={column === 'audio.jitter' ? direction : null}
															onClick={handleSort('audio.jitter')}>{popup('Jitter')}</Table.HeaderCell>
						<Table.HeaderCell sorted={column === 'audio.packetsLost' ? direction : null}
															onClick={handleSort('audio.packetsLost')}>{popup('Packets Lost')}</Table.HeaderCell>
						<Table.HeaderCell sorted={column === 'audio.roundTripTime' ? direction : null}
															onClick={handleSort('audio.roundTripTime')}>{popup('Round trip time')}</Table.HeaderCell>
						<Table.HeaderCell sorted={column === 'video.jitter' ? direction : null}
															onClick={handleSort('video.jitter')}>{popup('Jitter')}</Table.HeaderCell>
						<Table.HeaderCell sorted={column === 'video.packetsLost' ? direction : null}
															onClick={handleSort('video.packetsLost')}>{popup('Packets Lost')}</Table.HeaderCell>
						<Table.HeaderCell sorted={column === 'video.roundTripTime' ? direction : null}
															onClick={handleSort('video.roundTripTime')}>{popup('Round trip time')}</Table.HeaderCell>
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

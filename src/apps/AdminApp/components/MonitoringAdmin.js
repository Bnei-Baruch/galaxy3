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
  Search,
  Table,
} from 'semantic-ui-react';

import './MonitoringAdmin.css';
import {
  audioVideoScore,
  dataValues,
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
  const [{fullView, filterOptions}, setFullView] = useState({
    filterView:[],
    filterOptions: {
      name: [],
      group: [],
      system: [],
    },
  });
  const [filters, setFilters] = useState({});
  const [{view, column, direction}, setUsersTableView] = useState({
    view: [],
    column: '',
    direction: '',
  });
  const [sortingColumn, setSortingColumn] = useState('');
  const [usersToShow, setUsersToShow] = useState(20);
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

  const usersDataValues = (userId) => {
    let ud = {};
    if (userId in usersData) {
      ud = usersData[userId];
    }
    const values = dataValues(ud, now);
    if (userId === 'c69d7189-4bda-4472-8fdf-812abe3f6bfc') {
      console.log(ud, values);
    }
    return values;
  }

  useEffect(() => {
    const filterOptions = {
      name: [],
      group: [],
      system: [],
    };

    const nameSet = new Set();
    const groupSet = new Set();
    const systemSet = new Set();

    const newFullView = Object.values(users).map(user => ({
      user,
      stats: usersDataValues(user.id),
    })).sort(sortView('score'));

    newFullView.forEach(({user, stats}) => {
      if (!nameSet.has(user.display)) {
        nameSet.add(user.display);
        filterOptions.name.push({title: user.display});
      }
      if (!groupSet.has(user.group)) {
        groupSet.add(user.group);
        filterOptions.group.push({title: user.group});
      }
      const s = system(user);
      if (!systemSet.has(s)) {
        systemSet.add(s);
        filterOptions.system.push({title: s});
      }
    });

    setFullView({fullView: newFullView, filterOptions});
    setUsersTableView({view: newFullView.slice().filter(filterView), column: 'score', direction: 'descending'});
  }, [users, usersData]);

  const filterView = ({user, stats}) => {
    for (const [name, re] of Object.entries(filters)) {
      if (name === 'name') {
        return re.test(user.display);
      } else if (name === 'group') {
        return re.test(user.group);
      } else if (name === 'system') {
        return re.test(system(user));
      }

    }
    return true;
  }

  const updateFilter = (name, value) => {
    const valueRe = new RegExp(value, 'i');
    if (!(name in filters) || filters[name].source !== value) {
      const newFilters = Object.assign({}, filters);
      if (!(name in filters)) {
        if (value) {
          newFilters[name] = valueRe;
        }
      } else {
        if (!value) {
          delete newFilters[name];  // Remove filter for empty value.
        } else {
          newFilters[name] = valueRe;
        }
      }
      setFilters(newFilters);
    }
  }

  useEffect(() => {
    if (fullView) {
      const filtered = fullView.slice().filter(filterView);
      setUsersTableView({view: filtered, column, direction});
    }
  }, [filters]);

  const compareArr = (aValues, bValues) => {
    const index = aValues.findIndex((value, index) => value !== bValues[index]);
    if (index === -1) {
      return 0;
    }
    return aValues[index] - bValues[index];
  }

  const sortView = columnToSort => (a, b) => {
    if (['group', 'janus'].includes(columnToSort)) {
      return a.user[columnToSort].localeCompare(b.user[columnToSort]);
    } else if (columnToSort === 'name') {
      return a.user.display.localeCompare(b.user.display);
    } else if (columnToSort === 'login') {
      return a.user.timestamp - b.user.timestamp;
    } else if (columnToSort === 'system') {
      return system(a.user).localeCompare(system(b.user));
    } else if (columnToSort === 'update') {
      return ((a.stats.update && a.stats.update.value) || 0) - ((b.stats.update && b.stats.update.value) || 0);
    } else if (columnToSort.startsWith('audio')) {
      if (columnToSort.endsWith('jitter')) {
        return ((b.stats.audio && b.stats.audio.jitter.score.value) || 0) - ((a.stats.audio && a.stats.audio.jitter.score.value) || 0);
      } else if (columnToSort.endsWith('packetsLost')) {
        return ((b.stats.audio && b.stats.audio.packetsLost.score.value) || 0) - ((a.stats.audio && a.stats.audio.packetsLost.score.value) || 0);
      } else if (columnToSort.endsWith('roundTripTime')) {
        return ((b.stats.audio && b.stats.audio.roundTripTime.score.value) || 0) - ((a.stats.audio && a.stats.audio.roundTripTime.score.value) || 0);
      }
    } else if (columnToSort.startsWith('video')) {
      if (columnToSort.endsWith('jitter')) {
        return ((b.stats.video && b.stats.video.jitter.score.value) || 0) - ((a.stats.video && a.stats.video.jitter.score.value) || 0);
      } else if (columnToSort.endsWith('packetsLost')) {
        return ((b.stats.video && b.stats.video.packetsLost.score.value) || 0) - ((a.stats.video && a.stats.video.packetsLost.score.value) || 0);
      } else if (columnToSort.endsWith('roundTripTime')) {
        return ((b.stats.video && b.stats.video.roundTripTime.score.value) || 0) - ((a.stats.video && a.stats.video.roundTripTime.score.value) || 0);
      }
    } else if (columnToSort === 'score') {
      return b.stats.score.value - a.stats.score.value;
    } else if (columnToSort.startsWith('misc')) {
      if (columnToSort.endsWith('iceState')) {
        return ((a.stats.misc && a.stats.misc.iceState.last.value) || '').localeCompare((b.stats.misc && b.stats.misc.iceState.last.value) || '');
      } else if (columnToSort.endsWith('slowLink')) {
        return compareArr([(b.stats.misc && b.stats.misc.slowLink.score.value) || 0, (b.stats.misc && b.stats.misc.slowLink.last.value) || 0],
                          [(a.stats.misc && a.stats.misc.slowLink.score.value) || 0, (a.stats.misc && a.stats.misc.slowLink.last.value) || 0]);
      } else if (columnToSort.endsWith('slowLinkLost')) {
        return compareArr([(b.stats.misc && b.stats.misc.slowLinkLost.score.value) || 0, (b.stats.misc && b.stats.misc.slowLinkLost.last.value) || 0],
                          [(a.stats.misc && a.stats.misc.slowLinkLost.score.value) || 0, (a.stats.misc && a.stats.misc.slowLinkLost.last.value) || 0]);
      }
    }
    console.error('Should not get here!');
    return 0;
  };

  useEffect(() => {
    if (sortingColumn) {
      if (column !== sortingColumn) {
        setUsersTableView({
          column: sortingColumn,
          direction: sortingColumn.startsWith('audio') ||
            sortingColumn.startsWith('video') ||
            (sortingColumn.startsWith('misc') && !sortingColumn.endsWith('iceState')) ||
            ['login', 'update', 'score'].includes(sortingColumn) ? 'descending' : 'ascending',
          view: view.sort(sortView(sortingColumn)),
        });
      } else {
        setUsersTableView({
          view: view.reverse(),
          column,
          direction: direction === 'ascending' ? 'descending' : 'ascending',
        });
      }
    }
    setSortingColumn('');
  }, [sortingColumn]);

  const handleSort = (clickedColumn) => () => {
    setSortingColumn(clickedColumn);
  }

  const usersTable = (
    <div ref={tableParentRef}>
      <Table sortable celled>
        <Table.Header>
          <Table.Row textAlign='center'>
            <Table.HeaderCell colSpan="13">
              <Button icon onClick={() => { updateUsersData(); updateUsers(); }}><Icon name='refresh' /></Button>
              Showing {Math.min(usersToShow, ((view && view.length) || 0))} users out of (filtered: {((view && view.length) || 0)}, total: {((fullView && fullView.length) || 0)})
            </Table.HeaderCell>
          </Table.Row>
          <Table.Row textAlign='center'>
            <Table.HeaderCell rowSpan="2"
                              sorted={column === 'name' ? direction : null}
                              onClick={handleSort('name')}>
              {popup('Name')}
            </Table.HeaderCell>
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
            <Table.HeaderCell colSpan="3">{popup('Misc')}</Table.HeaderCell>
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
            <Table.HeaderCell sorted={column === 'misc.iceState' ? direction : null}
                              onClick={handleSort('misc.iceState')}>{popup('iceState')}</Table.HeaderCell>
            <Table.HeaderCell sorted={column === 'misc.slowLink' ? direction : null}
                              onClick={handleSort('misc.slowLink')}>{popup('slowLink')}</Table.HeaderCell>
            <Table.HeaderCell sorted={column === 'misc.slowLinkLost' ? direction : null}
                              onClick={handleSort('misc.slowLinkLost')}>{popup('slowLink Lost')}</Table.HeaderCell>
          </Table.Row>
          <Table.Row>
            <Table.HeaderCell>
              <Search className='monitoring-search'
                minCharacters={0}
                onResultSelect={(e, search) => updateFilter('name', `^${search.result.title}$`)}
                onSearchChange={(e, search) => updateFilter('name', search.value)}
                results={filterOptions.name.filter(name => !filters.name || filters.name.test(name.title))}
              />
            </Table.HeaderCell>
            <Table.HeaderCell>
              <Search className='monitoring-search'
                minCharacters={0}
                onResultSelect={(e, search) => updateFilter('group', `^${search.result.title}$`)}
                onSearchChange={(e, search) => updateFilter('group', search.value)}
                results={filterOptions.group.filter(group => !filters.group || filters.group.test(group.title))}
              />
            </Table.HeaderCell>
            <Table.HeaderCell>
            </Table.HeaderCell>
            <Table.HeaderCell>
            </Table.HeaderCell>
            <Table.HeaderCell>
              <Search className='monitoring-search'
                minCharacters={0}
                onResultSelect={(e, search) => updateFilter('system', `^${search.result.title}$`)}
                onSearchChange={(e, search) => updateFilter('system', search.value)}
                results={filterOptions.system.filter(system => !filters.system || filters.system.test(system.title))}
              />
            </Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {view.slice(0, usersToShow).map(({user, stats}, index) => userRow(user, stats, now, () => props.addUserTab(user, stats)))}
        </Table.Body>
        { usersToShow >= view.length ? null : (
          <Table.Footer>
            <Table.Row textAlign='center'>
              <Table.HeaderCell colSpan="15"><Button icon onClick={() => setUsersToShow(usersToShow + usersToShow)}><Icon name='angle double down' /></Button></Table.HeaderCell>
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
      {loadingCount !== 0 || sortingColumn ? loading: null}
      {fullView && fullView.length ? usersTable : null}
    </div>
  );
}

export default MonitoringAdmin;

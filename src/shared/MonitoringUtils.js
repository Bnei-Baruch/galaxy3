import React from 'react';
import {Popup, Table} from 'semantic-ui-react';
import parser from 'ua-parser-js';
import {MONITORING_BACKEND} from "./env";

export const system = (userAgent) => {
  const ua = new parser(userAgent);
  const {name: browser, major: browserVersion} = ua.getBrowser();
  const {model: device} = ua.getDevice();
  const {name: os, version: osVersion} = ua.getOS();
  let ret = `${browser} ${browserVersion}`;
  if (device) {
    ret += `, ${device}`;
  }
  ret += `, ${os}`;
  if (osVersion) {
    ret += ` ${osVersion}`;
  }
  return ret;
}

export const sinceTimestamp = (ms, now) => {
  const pad = (number, size) => {
    let s = String(number);
    while (s.length < (size || 2)) {s = "0" + s;}
    return s;
  }
  const loginDate = new Date(ms);
  const diff = now - loginDate;
  const minutes = pad(parseInt((diff / (1000 * 60)) % 60, 10), 2);
  const hours = parseInt(diff / (1000 * 3600), 10);
  return `${hours}h:${minutes}m`;
};

const EXPONENT_RE = /e[+-][\d]+$/;
export const shortNumber = (number) => {
  if (isNaN(number)) {
    return number;
  }
  if (number < SMALL_FLOAT) {
    return '0';
  }
  const str = String(number);
  const dotIdx = str.indexOf('.');
  if (dotIdx === -1) {
    return str;
  }
  let nonZeros = 0;
  if (number > 99) {
    return String(Math.round(number * 10)/10);
  }
  if (number > 9) {
    return String(Math.round(number * 100)/100);
  }
  if (number >= 1) {
    return String(Math.round(number * 1000)/100);
  }
  let idx = dotIdx
  while (idx + 1 < str.length && nonZeros < 3) {
    if (str[idx + 1] !== '0' || nonZeros > 0) {
      nonZeros++;
    }
    idx++;
  }
  const m = str.match(EXPONENT_RE);
  if (m) {
    return `${str.slice(0, idx)}${m[0]}`;
  }
  return str.slice(0, idx);
};

export const fetchData = (path) => {
  return fetch(`${MONITORING_BACKEND}/${path}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  }).then((response) => {
    if (response.ok) {
      return response.json();
    } else {
      throw new Error(`Fetch error: ${response.url} ${response.status} ${response.statusText}`);
    }
  }).catch((error) => {
    console.error('Fetching monitoring users data error:', error);
    return Promise.reject(error);
  });
};

export const popup = (text, tooltip = '') => (<Popup trigger={<div style={{display: 'inline-block'}}>{String(text)}</div>} content={tooltip || String(text)} mouseEnterDelay={300} mouseLeaveDelay={800} on='hover' />);

export const userRow = (user, stats, now, onUser) => {
  let color = '';
  if (stats.score && stats.score.value > 100) {
    color = 'rgb(255, 100, 100)';
  }
  return (
    <Table.Row key={user.id} style={{backgroundColor: color}}>
      <Table.Cell><a style={{cursor: 'pointer'}} onClick={onUser ? () => onUser() : null}>{popup(user.display)}</a></Table.Cell>
      <Table.Cell>{popup(user.group)}</Table.Cell>
      <Table.Cell>{popup(user.janus)}</Table.Cell>
      <Table.Cell>{popup(sinceTimestamp(user.timestamp, now))}</Table.Cell>
      <Table.Cell>{popup(system(user.system))}</Table.Cell>
      <Table.Cell key={'update'}>
        {stats.update && stats.update.value !== undefined && stats.update.value !== null ? popup(stats.update.view) : null}
      </Table.Cell>
      <Table.Cell key={'score'}>
        {stats.score && stats.score.value !== undefined && stats.score.value !== null ? popup(stats.score.view) : null}
      </Table.Cell>
      <Table.Cell key={'audio.jitter'} textAlign='center'>
        {stats.audio && stats.audio.jitter ? statTable(stats.audio.jitter) : null}
      </Table.Cell>
      <Table.Cell key={'audio.packetsLost'} textAlign='center'>
        {stats.audio && stats.audio.packetsLost ? statTable(stats.audio.packetsLost) : null}
      </Table.Cell>
      <Table.Cell key={'audio.roundTripTime'} textAlign='center'>
        {stats.audio && stats.audio.roundTripTime ? statTable(stats.audio.roundTripTime) : null}
      </Table.Cell>
      <Table.Cell key={'video.jitter'} textAlign='center'>
        {stats.video && stats.video.jitter ? statTable(stats.video.jitter) : null}
      </Table.Cell>
      <Table.Cell key={'video.packetsLost'} textAlign='center'>
        {stats.video && stats.video.packetsLost ? statTable(stats.video.packetsLost) : null}
      </Table.Cell>
      <Table.Cell key={'video.roundTripTime'} textAlign='center'>
        {stats.video && stats.video.roundTripTime ? statTable(stats.video.roundTripTime) : null}
      </Table.Cell>
    </Table.Row>
  );
}

const SMALL_FLOAT = 0.00001;
const statTable = (stats) => {
  if (!stats.last) {
    return null;
  }
  let color = '';
  if (stats.score) {
    if (stats.score.value < -SMALL_FLOAT) {
      color = 'lightgreen';
    } else if (stats.score.value > SMALL_FLOAT) {
      color = 'rgb(255, 150, 150)';
    }
  }
  return (
    <table style={{padding: '1px', border: 'none', backgroundColor: color}}>
      <tbody>
        <tr style={{padding: '1px'}}>
          <td colSpan="3" style={{padding: '1px'}}>
            {!stats.last ? '' :
            <div style={{display: 'flex', justifyContent: 'space-evenly'}}>
              <div>{popup(stats.last.view, `${stats.last.value} last value from user`)}</div>
              <div style={{marginLeft: '2px', whiteSpace: 'nowrap'}}>&#916;{popup(stats.score.view, `${stats.score.value} Average diff between last minute and last 3 mintues.`)}</div>
            </div>}
          </td>
        </tr>
        {true || !stats.oneMin ? null :
        <tr style={{padding: '1px'}}>
          <td style={{padding: '1px'}}>{popup(stats.oneMin.mean.view, `${stats.oneMin.mean.value} average over 1 minute`)}</td>
          <td style={{padding: '1px'}}>{popup(stats.oneMin.stdev.view, `${stats.oneMin.stdev.value} stdev over 1 minute`)}</td>
          <td style={{padding: '1px'}}>{popup(stats.oneMin.length.view, `${stats.oneMin.length.value} number of samples for 1 minute`)}</td>
        </tr>}
        {true || !stats.threeMin ? null :
        <tr style={{padding: '1px'}}>
          <td style={{padding: '1px'}}>{popup(stats.threeMin.mean.view, `${stats.threeMin.mean.value} average over 3 minutes`)}</td>
          <td style={{padding: '1px'}}>{popup(stats.threeMin.stdev.view, `${stats.threeMin.stdev.value} stdev over 3 minutes`)}</td>
          <td style={{padding: '1px'}}>{popup(stats.threeMin.length.view, `${stats.threeMin.length.value} number of samples for 3 minutes`)}</td>
        </tr>}
        {true || !stats.tenMin ? null :
        <tr style={{padding: '1px'}}>
          <td style={{padding: '1px'}}>{popup(stats.tenMin.mean.view, `${stats.tenMin.mean.value} average over 10 minute`)}</td>
          <td style={{padding: '1px'}}>{popup(stats.tenMin.stdev.view, `${stats.tenMin.stdev.value} stdev over 10 minute`)}</td>
          <td style={{padding: '1px'}}>{popup(stats.tenMin.length.view, `${stats.tenMin.length.value} number of samples for 10 minute`)}</td>
        </tr>}
     </tbody>
    </table>
  );
};

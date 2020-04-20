import React from 'react';

import {
  Table,
  Popup,
} from 'semantic-ui-react';

import parser from 'ua-parser-js';

import {
  MONITORING_BACKEND,
} from "./consts";

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

export const popup = (text, tooltip = '') => (<Popup trigger={<div>{String(text)}</div>} content={tooltip || String(text)} mouseEnterDelay={300} mouseLeaveDelay={800} on='hover' />);

export const userRow = (user, stats, now, onUser) => (
  <Table.Row key={user.id}>
    <Table.Cell><a style={{cursor: 'pointer'}} onClick={onUser ? () => onUser() : null}>{popup(user.display)}</a></Table.Cell>
    <Table.Cell>{popup(user.group)}</Table.Cell>
    <Table.Cell>{popup(user.janus)}</Table.Cell>
    <Table.Cell>{popup(sinceTimestamp(user.timestamp, now))}</Table.Cell>
    <Table.Cell>{popup(system(user.system))}</Table.Cell>
    {stats.slice(0, 1).map((values) => (<Table.Cell key={5} textAlign='center'>{popup(values[1])}</Table.Cell>))}
    {stats.slice(1).map((values, index) => (<Table.Cell key={index + 6} textAlign='center'>{statValues(values)}</Table.Cell>))}
  </Table.Row>
);

const displayValue = (value) => value[0] === null ? '' : value[1];
const statValues = (values) => {
  if (!Array.isArray(values) || values.length !== 10) {
    // No data for user.
    return values;
  }
  return (
    <Table textAlign='center' style={{padding: '1px', border: 'none'}}>
      <Table.Body>
        <Table.Row style={{padding: '1px'}}>
          <Table.Cell colSpan="3" style={{padding: '1px'}}>{popup(displayValue(values[0]), 'last value from user')}</Table.Cell>
        </Table.Row>
        { values[3][0] === 0 ? null :
        <Table.Row style={{padding: '1px'}}>
          <Table.Cell style={{padding: '1px'}}>{popup(displayValue(values[1]), 'average over 1 minute')}</Table.Cell>
          <Table.Cell style={{padding: '1px'}}>{popup(displayValue(values[2]), 'stdev over 1 minute')}</Table.Cell>
          <Table.Cell style={{padding: '1px'}}>{popup(displayValue(values[3]), 'number of samples for 1 minute')}</Table.Cell>
        </Table.Row>}
        { values[6][0] === 0 ? null :
        <Table.Row style={{padding: '1px'}}>
          <Table.Cell style={{padding: '1px'}}>{popup(displayValue(values[4]), 'average over 3 minutes')}</Table.Cell>
          <Table.Cell style={{padding: '1px'}}>{popup(displayValue(values[5]), 'stdev over 3 minutes')}</Table.Cell>
          <Table.Cell style={{padding: '1px'}}>{popup(displayValue(values[6]), 'number of samples for 3 minutes')}</Table.Cell>
        </Table.Row>}
        { values[9][0] === 0 ? null :
        <Table.Row style={{padding: '1px'}}>
          <Table.Cell style={{padding: '1px'}}>{popup(displayValue(values[7]), 'average over 10 minutes')}</Table.Cell>
          <Table.Cell style={{padding: '1px'}}>{popup(displayValue(values[8]), 'stdev over 10 minutes')}</Table.Cell>
          <Table.Cell style={{padding: '1px'}}>{popup(displayValue(values[9]), 'number of samples for 10 minutes')}</Table.Cell>
        </Table.Row>}
      </Table.Body>
    </Table>
  );
};

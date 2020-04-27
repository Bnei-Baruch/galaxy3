import React from 'react';
import ReactDOM from 'react-dom';
import * as Sentry from '@sentry/browser';
import {SENTRY_KEY} from './shared/env';
import './index.css';
import App from './App';

import * as serviceWorker from './serviceWorker';

Sentry.init({dsn: `https://${SENTRY_KEY}@sentry.kli.one/2`});

ReactDOM.render(<App />, document.getElementById('root'));

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();

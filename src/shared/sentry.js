import * as Sentry from "@sentry/react";

import {SENTRY_KEY} from './env';
import version from '../Version';

export const updateSentryUser = (user) => {
  Sentry.setUser(user);
}

export const initSentry = () => {
  Sentry.init({
    dsn: `https://${SENTRY_KEY}@sentry.kli.one/2`,
    release: version,
    environment: process.env.NODE_ENV,
    attachStacktrace: true,
    maxBreadcrumbs: 100,
  });

  Sentry.configureScope((scope) => {
    const isDeb = window.location.host.startsWith('bbdev6') ||
      new URL(window.location.href).searchParams.has('deb');
    scope.setTag('deb', isDeb);
  });
};

export const captureException = (exception, data = {}) => {
  Sentry.withScope(scope => {
    scope.setExtras(data);
    Sentry.captureException(exception);
  });
}

export const captureMessage = (title, data = {}, level = 'info') => {
	 Sentry.withScope(scope => {
    // Always group by title when reporting manually to Sentry.
    scope.setFingerprint([title]);  
    scope.setExtras(data);
    scope.setLevel(level);
    Sentry.captureMessage(title);
  });
}

export const sentryDebugAction = () => {
	console.log('stack: ' + (new Error()).stack);
	//this.tryThisOut();  // Should generate runtime exception and send to Sentry.
  //try {
  //  throw new Error('This is an error');
  //} catch (e) {
  //  captureException(e, {source: 'some-src'});
  //}
  captureMessage('Try capture message', {source: 'sentry-test'}, 'error');
}

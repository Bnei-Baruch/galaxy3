import * as Sentry from "@sentry/react";

import {SENTRY_KEY} from './env';
import version from '../Version';

export const updateSentryUser = (user) => {
  Sentry.setUser(user);
}

export const initSentry = () => {
  Sentry.init({
    dsn: `https://${SENTRY_KEY}@sentry.kli.one/2`,
    release: process.env.NODE_ENV === 'development' ? 'dev' : version,
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

export const reportToSentry = (title, data = {}, level = 'info') => {
  Sentry.withScope(scope => {
    Object.keys(data).forEach((key) => {
        scope.setExtra(key, data[key]);
    });
    scope.setLevel(level);
    Sentry.captureMessage(title);
  });
}

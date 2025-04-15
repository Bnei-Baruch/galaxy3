import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";
import { Replay } from "@sentry/replay";
import { SENTRY_DSN } from "./env";
import version from "../apps/VirtualApp/Version";

export const updateSentryUser = (user) => {
  Sentry.setUser(user);
};

export const setSentryGeo = (user, data) => {
  user.geo = {};
  user.geo.country_code = data.code;
  user.geo.city = data.city;
  user.geo.region = data.country;
  Sentry.setUser(user);
};

export const initSentry = () => {
  const integrations = [
    new BrowserTracing({
      tracePropagationTargets: ["localhost", "bbdev6", /^\//],
    }),
    new Replay({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ];

  Sentry.init({
    dsn: `${SENTRY_DSN}`,
    integrations,
    release: version,
    environment: process.env.NODE_ENV,
    attachStacktrace: true,
    maxBreadcrumbs: 100,
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "InvalidAccessError: There is no sender or receiver for the track",
    ],
    tracesSampleRate: 1.0,
    // Enable debug mode in development
    debug: process.env.NODE_ENV !== 'production',
    // Set replays sample rate
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });

  const isDeb = window.location.host.startsWith("bbdev6") || new URL(window.location.href).searchParams.has("deb");
  Sentry.setTag("deb", isDeb);
};

export const captureException = (exception, data = {}) => {
  Sentry.withScope((scope) => {
    scope.setExtras(data);
    scope.addEventProcessor((event) => {
      if (event.exception?.values) {
        event.exception.values[0] = {
          ...event.exception.values[0],
          type: exception,
        };
      }
      return event;
    });
    scope.setTransactionName("captured error");
    Sentry.captureException(exception);
  });
};

export const captureMessage = (title, data = {}, level = "info") => {
  Sentry.withScope((scope) => {
    // Always group by title when reporting manually to Sentry.
    scope.setFingerprint([title]);
    scope.setExtras(data);
    scope.setLevel(level);
    scope.addEventProcessor((event) => {
      if (event.exception?.values) {
        event.exception.values[0] = {
          ...event.exception.values[0],
          type: title,
        };
      }
      return event;
    });
    scope.setTransactionName(level);
    Sentry.captureMessage(title);
  });
};

export const sentryDebugAction = () => {
  const error = new Error("error message here");
  error.name = "this is new";
  Sentry.captureException(error);

  captureMessage(error, {source: "sentry-test"}, "error");
};

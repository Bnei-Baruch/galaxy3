import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";
import { Replay } from "@sentry/replay";
import { SENTRY_DSN } from "./env";
import version from "../apps/VirtualApp/Version";
import log from "loglevel";

export const updateSentryUser = (user) => {
  Sentry.setUser(user);
};

export const setSentryGeo = (user, data) => {
  user.geo = {};
  user.geo.country_code = data.code;
  user.geo.city = data.city;
  user.geo.region = data.country;
  Sentry.setUser(user);
  Sentry.setTag("isp", data.isp);
  Sentry.setTag("isp_code", data.isp_code);
};

export const setSentryTag = (tag) => {
  Sentry.setTag("gxy", tag);
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

export const captureException = (exception, data = {}, level = "error") => {
  Sentry.withScope((scope) => {
    scope.setFingerprint([exception]);
    scope.setExtras(data);
  });
  exception.name = exception.message
  exception.message = level
  Sentry.captureException(exception);
};

export const captureMessage = (title, data = {}, level = "info") => {
  const error = new Error(title);
  error.name = level;
  Sentry.withScope((scope) => {
    scope.setFingerprint([title]);
    scope.setExtras(data);
    scope.setLevel(level);
    error.name = error.message
    error.message = level
    Sentry.captureMessage(error);
  });
};

export const sentryDebugAction = () => {
  const error = new Error("error message here");
  error.name = "this is new";
  Sentry.captureException(error);

  captureMessage(error, {source: "sentry-test"}, "error");
};

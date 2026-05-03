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
    debug: process.env.NODE_ENV !== "production",
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
};

export const captureException = (exception, data = {}, level = "error") => {
  // Preserve historical Sentry grouping: title = original message, subtitle = level.
  exception.name = exception.message;
  exception.message = level;
  Sentry.withScope((scope) => {
    scope.setTag("gxy_manual", "true");
    scope.setFingerprint([exception.name]);
    scope.setExtras(data);
    scope.setLevel(level);
    Sentry.captureException(exception);
  });
};

export const captureMessage = (title, data = {}, level = "info") => {
  const error = new Error(title);
  error.name = title;
  error.message = level;
  Sentry.withScope((scope) => {
    scope.setTag("gxy_manual", "true");
    scope.setFingerprint([title]);
    scope.setExtras(data);
    scope.setLevel(level);
    Sentry.captureMessage(error);
  });
};

export const sentryDebugAction = () => {
  const error = new Error("error message here");
  error.name = "this is new";
  Sentry.captureException(error);
  captureMessage(error, {source: "sentry-test"}, "error");
};

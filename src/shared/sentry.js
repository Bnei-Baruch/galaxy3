import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";
import { Replay } from "@sentry/replay";
import { SENTRY_DSN } from "./env";
import version from "../apps/VirtualApp/Version";
import log from "loglevel";

// --- network-issue window -------------------------------------------------
// Set by markNetworkIssue() from VirtualMqttClient whenever we detect an
// ongoing network problem ("conference reconnect", "ice failed", mqtt
// "disconnected"). During this window beforeSend() drops known cascading
// WebRTC/janus teardown errors so Sentry only receives the meaningful
// manually-captured events plus breadcrumbs. Outside the window those same
// errors are still delivered, since they would indicate a real bug.

let networkIssueUntil = 0;
const DEFAULT_NETWORK_ISSUE_WINDOW_MS = 60 * 1000;

export const markNetworkIssue = (windowMs = DEFAULT_NETWORK_ISSUE_WINDOW_MS) => {
  const until = Date.now() + windowMs;
  if (until > networkIssueUntil) networkIssueUntil = until;
};

export const isNetworkIssueWindowActive = () => Date.now() < networkIssueUntil;

// Errors that only make sense as symptoms of a network outage. If any of
// these fire while we know the network is broken, drop them; otherwise let
// Sentry receive them as normal.
const CASCADE_DURING_NETWORK_ISSUE_PATTERNS = [
  /Failed to execute 'removeTrack' on 'RTCPeerConnection'/i,
  /Failed to execute 'stop' on 'RTCRtpTransceiver'/i,
  /Failed to execute 'setRemoteDescription' on 'RTCPeerConnection'/i,
  /Failed to execute 'setLocalDescription' on 'RTCPeerConnection'/i,
  /Failed to execute 'getStats' on 'RTCPeerConnection'/i,
  /Cannot set properties of null \(setting 'direction'\)/i,
  /Cannot read properties of null \(reading '(sender|receiver|track|getTransceivers|janusHandleId|pluginName)'\)/i,
];

const extractMessage = (event, hint) => {
  const err = hint && hint.originalException;
  if (err) {
    if (typeof err === "string") return err;
    if (err.message) return err.message;
    try { return String(err); } catch (_) { /* ignore */ }
  }
  if (event && event.message) return event.message;
  const values = event && event.exception && event.exception.values;
  if (values && values.length) {
    const first = values[0] || {};
    return (first.type ? first.type + ": " : "") + (first.value || "");
  }
  return "";
};

const matchesAny = (msg, patterns) => !!msg && patterns.some((rx) => rx.test(msg));

// --- public helpers -------------------------------------------------------

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
      // Janus signalling layer cleanup noise — almost always a symptom of
      // either our own teardown or an unreachable gateway.
      "[janus] Transaction timed out",
      "[janus] Janus is not connected",
      "[janus] transaction cancelled during cleanup",
      "[janus] unknown plugin",
      // Plugin transactions fired after the underlying janus session is gone
      // (covers "[publisher] / [streaming] / [subscriber] JanusPlugin is not connected").
      "JanusPlugin is not connected",
      // Raw promise rejections forwarded from janus json responses.
      "Non-Error promise rejection captured with value",
      "Object captured as promise rejection with keys: data, json",
      "Object captured as promise rejection with keys: error, janus, session_id, transaction",
      // Config not loaded yet when gatewayNames() is called.
      "Cannot read properties of undefined (reading 'streaming')",
      // Telegram WebApp SDK postEvent calls that only work inside TG clients.
      "Error invoking postEvent: Method not found",
    ],
    tracesSampleRate: 1.0,
    debug: process.env.NODE_ENV !== "production",
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event, hint) {
      // Always allow events we captured on purpose (captureException /
      // captureMessage below tag them). They carry the narrative we care
      // about plus breadcrumbs.
      if (event && event.tags && event.tags.gxy_manual === "true") return event;

      // During an active network incident suppress WebRTC/peer teardown
      // cascades. The meaningful event is the manual capture that opened
      // the window; everything else here is noise.
      if (isNetworkIssueWindowActive()) {
        const msg = extractMessage(event, hint);
        if (matchesAny(msg, CASCADE_DURING_NETWORK_ISSUE_PATTERNS)) {
          return null;
        }
      }
      return event;
    },
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

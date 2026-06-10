import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";
import { Replay } from "@sentry/replay";
import { SENTRY_DSN } from "./env";
import version from "../apps/VirtualApp/Version";

// --- Bucketing helpers (low-cardinality tag values) -------------------------

const bucket = (v, edges, labels) => {
  if (v == null || !isFinite(v)) return "na";
  for (let i = 0; i < edges.length; i++) if (v < edges[i]) return labels[i];
  return labels[labels.length - 1];
};

const RTT_LABELS = ["lt50", "50_150", "150_300", "gt300"];
const RTT_EDGES = [50, 150, 300];
const LOSS_LABELS = ["0", "lt1", "1_3", "3_10", "gt10"];
const LOSS_EDGES = [0.0001, 1, 3, 10];
const JIT_LABELS = ["lt30", "30_50", "gt50"];
const JIT_EDGES = [30, 50];
const BR_LABELS = ["lt100k", "100_500k", "500k_1m", "gt1m"];
const BR_EDGES = [100_000, 500_000, 1_000_000];
const DOWNLINK_LABELS = ["lt1", "1_5", "5_20", "gt20"];
const DOWNLINK_EDGES = [1, 5, 20];
const UPTIME_LABELS = ["lt5s", "5_30s", "30s_2m", "2m_10m", "gt10m"];
const UPTIME_EDGES = [5_000, 30_000, 120_000, 600_000];
const RECON_LABELS = ["0", "1_5", "5_20", "gt20"];
const RECON_EDGES = [1, 6, 21];

export const bucketRtt = (v) => bucket(v, RTT_EDGES, RTT_LABELS);
export const bucketLoss = (v) => bucket(v, LOSS_EDGES, LOSS_LABELS);
export const bucketJitter = (v) => bucket(v, JIT_EDGES, JIT_LABELS);
export const bucketBitrate = (v) => bucket(v, BR_EDGES, BR_LABELS);
export const bucketDownlink = (v) => bucket(v, DOWNLINK_EDGES, DOWNLINK_LABELS);
export const bucketUptime = (v) => bucket(v, UPTIME_EDGES, UPTIME_LABELS);
export const bucketReconnects = (v) => bucket(v, RECON_EDGES, RECON_LABELS);

// --- Device detection (mobile / tablet / desktop) ---------------------------

const detectDevice = () => {
  if (typeof navigator === "undefined") {
    return {
      deviceType: "unknown", os: "unknown", touch: false, pwa: false,
      screenBucket: "unknown", orientation: "unknown",
    };
  }
  const ua = navigator.userAgent || "";
  const uaData = navigator.userAgentData || null;
  const touch = (navigator.maxTouchPoints || 0) > 0;

  let os = "other";
  const platform = (uaData && uaData.platform) || "";
  if (/iPhone|iPad|iPod/i.test(ua) || platform === "iOS") os = "ios";
  else if (/Android/i.test(ua) || platform === "Android") os = "android";
  else if (/Mac/i.test(ua) || platform === "macOS") os = "mac";
  else if (/Win/i.test(ua) || platform === "Windows") os = "win";
  else if (/Linux|X11/i.test(ua) || platform === "Linux") os = "linux";

  let deviceType;
  if (uaData && typeof uaData.mobile === "boolean") {
    deviceType = uaData.mobile ? "mobile" : "desktop";
    // iPad on iPadOS 13+ reports a macOS desktop UA.
    if (deviceType === "desktop" && os === "mac" && touch && navigator.maxTouchPoints > 1) {
      deviceType = "tablet";
      os = "ios";
    }
  } else {
    const isTablet = /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua);
    const isMobile = /Mobi|iPhone|iPod|Android.*Mobile|BlackBerry|Opera Mini|IEMobile/i.test(ua);
    if (isTablet) deviceType = "tablet";
    else if (isMobile) deviceType = "mobile";
    else deviceType = "desktop";
  }

  const minSide = (typeof screen !== "undefined")
    ? Math.min(screen.width || 0, screen.height || 0)
    : 0;
  let screenBucket;
  if (minSide === 0) screenBucket = "unknown";
  else if (minSide < 768) screenBucket = "phone";
  else if (minSide < 1024) screenBucket = "tablet";
  else if (minSide < 1920) screenBucket = "desktop";
  else screenBucket = "large";

  let orientation = "unknown";
  if (typeof window !== "undefined") {
    if (window.screen && window.screen.orientation && window.screen.orientation.type) {
      orientation = /portrait/i.test(window.screen.orientation.type) ? "portrait" : "landscape";
    } else if (window.innerWidth && window.innerHeight) {
      orientation = window.innerWidth < window.innerHeight ? "portrait" : "landscape";
    }
  }

  const pwa =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches;

  return { deviceType, os, touch, pwa, screenBucket, orientation };
};

// --- Link snapshot provider --------------------------------------------------
// VirtualMqttClient registers a getter so that captureNetworkEvent can pull a
// pre-failure connection snapshot without sentry.js depending on MonitoringData.

let _linkSnapshotProvider = null;
export const setLinkSnapshotProvider = (fn) => {
  _linkSnapshotProvider = (typeof fn === "function") ? fn : null;
};
const safeGetLinkSnapshot = () => {
  try {
    return _linkSnapshotProvider ? _linkSnapshotProvider() : null;
  } catch (_e) {
    return null;
  }
};

// --- User & static tags ------------------------------------------------------

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
  // Janus server identifier — kept under a namespaced key so that filters in
  // Sentry don't collide with the gxy.* prefix used by network events.
  Sentry.setTag("gxy.janus", tag);
};

const installRuntimeListeners = () => {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const setVisibility = () => {
    Sentry.setTag("app.visibility", document.visibilityState || "unknown");
  };
  setVisibility();
  document.addEventListener("visibilitychange", setVisibility);

  const setOnline = () => {
    Sentry.setTag("app.online", String(navigator.onLine !== false));
  };
  setOnline();
  window.addEventListener("online", setOnline);
  window.addEventListener("offline", setOnline);

  if (window.screen && window.screen.orientation) {
    window.screen.orientation.addEventListener("change", () => {
      const t = window.screen.orientation.type || "";
      Sentry.setTag("app.orientation", /portrait/i.test(t) ? "portrait" : "landscape");
    });
  }

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    const setNet = () => {
      if (conn.effectiveType) Sentry.setTag("net.effective", conn.effectiveType);
      if (conn.type) Sentry.setTag("net.type", conn.type);
      if (typeof conn.saveData === "boolean") Sentry.setTag("net.saveData", String(conn.saveData));
      if (typeof conn.downlink === "number") Sentry.setTag("net.downlink_bucket", bucketDownlink(conn.downlink));
    };
    setNet();
    if (typeof conn.addEventListener === "function") conn.addEventListener("change", setNet);
  }
};

// --- Sentry init -------------------------------------------------------------

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
    maxBreadcrumbs: 50,
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "InvalidAccessError: There is no sender or receiver for the track",
      /Non-Error promise rejection captured/,
      // Telegram WebApp postEvent on browsers that aren't Telegram clients.
      /Method not found/,
      // Stale build cached on the client (bumps on next reload).
      /Can't find variable: logMutedMessage/,
      // Synthetic Error from JanusMqtt._cleanupTransactions — by
      // definition a non-actionable side-effect of session teardown
      // (pending plugin transactions get rejected when the session
      // is destroyed). Filter out so the issue feed stays meaningful.
      /\[janus\] transaction cancelled during cleanup/,
    ],
    denyUrls: [
      /chrome-extension:\/\//i,
      /moz-extension:\/\//i,
      /telegram-web-app/i,
    ],
    tracesSampleRate: 0.05,
    debug: process.env.NODE_ENV !== "production",
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      try {
        const tags = event.tags || {};
        // Background tabs — most browsers throttle WebRTC, ICE failures there
        // are expected and should not pollute the issue tracker.
        if (tags["app.visibility"] === "hidden" && tags["gxy.kind"] === "ice_failed") {
          return null;
        }
        // Telegram WebApp postEvent noise — usually surfaces only when the
        // page is opened from non-Telegram contexts.
        const frames = (event.exception && event.exception.values && event.exception.values[0]
          && event.exception.values[0].stacktrace && event.exception.values[0].stacktrace.frames) || [];
        if (frames.some((f) => /telegram-web-app|chrome-extension:|moz-extension:/i.test(f.filename || ""))) {
          return null;
        }
      } catch (_e) { /* never break sending */ }
      return event;
    },
    beforeBreadcrumb(b) {
      // Avoid logging every console.log into breadcrumbs — blows up payload
      // and rarely useful for our flows.
      if (b && b.category === "console" && b.level === "log") return null;
      return b;
    },
  });

  const dev = detectDevice();
  Sentry.setTag("app.deviceType", dev.deviceType);
  Sentry.setTag("app.os", dev.os);
  Sentry.setTag("app.touch", String(dev.touch));
  Sentry.setTag("app.screenBucket", dev.screenBucket);
  Sentry.setTag("app.orientation", dev.orientation);
  Sentry.setTag("app.pwa", String(dev.pwa));
  Sentry.setTag(
    "app.telegram",
    String(!!(typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp))
  );

  installRuntimeListeners();
};

// --- Network telemetry event (ice_failed, conference_reconnect, ...) --------
// Single entry point for "this is connection telemetry, not a real bug".
// All such events go to the same Sentry project as bugs but get a stable set
// of tags so they can be filtered out of the issue feed.
//
// kind:    "ice_failed" | "conference_reconnect" | "conference_reconnect_failed"
//          | "disconnected" | "h264_profile" | <other>
// source:  "publisher" | "subscriber" | "mqtt" | "janus" | "streaming" | <other>
// extras:  { room, attempt, reconnectsInSession, joinedAt, sessionId, handleId,
//            role, isGroup, shidur, numVU, feeds, hasVideo, ... }
// level:   "warning" by default, "error" only for terminal failures.
export const captureNetworkEvent = (kind, source, extras = {}, level = "warning") => {
  const snap = safeGetLinkSnapshot() || {
    linkState: "unknown", iceState: "unknown", category: "unknown",
    rttMs: null, jitterMs: null, lossPct: null, qualityLimit: null,
    iceCandidate: null, relayProtocol: null, audioCodec: null, videoCodec: null,
    bitrateBps: null, samples: 0, reason: null,
  };

  // Synthetic Error: both name and message would otherwise be `kind`, which
  // makes the Sentry issue title and subtitle identical (e.g. "ice_failed /
  // ice_failed"). Put the kind into name (title) and a useful at-a-glance
  // descriptor into message (subtitle) so issues are scannable in the list.
  const subtitle = `${level}: ${source || "unknown"}/${snap.category || "unknown"}`;
  const error = new Error(subtitle);
  error.name = kind;

  Sentry.withScope((scope) => {
    scope.setLevel(level);
    scope.setTag("gxy.kind", kind);
    scope.setTag("gxy.source", source || "unknown");
    if (extras.room != null) scope.setTag("gxy.room", String(extras.room));
    if (extras.attempt != null) scope.setTag("gxy.attempt", String(extras.attempt));
    if (extras.reconnectsInSession != null) {
      scope.setTag("gxy.reconnectsInSession", bucketReconnects(extras.reconnectsInSession));
    }
    if (extras.joinedAt) {
      scope.setTag("gxy.uptimeBucket", bucketUptime(Date.now() - extras.joinedAt));
    }
    if (extras.role) scope.setTag("gxy.role", String(extras.role));
    if (extras.isGroup != null) scope.setTag("gxy.isGroup", String(!!extras.isGroup));
    if (extras.shidur != null) scope.setTag("gxy.shidur", String(!!extras.shidur));
    if (extras.numVU != null) scope.setTag("gxy.numVU", String(extras.numVU));
    if (extras.feeds != null) {
      const f = Number(extras.feeds);
      const feedsBucket = !isFinite(f) ? "na"
        : f === 0 ? "0"
        : f <= 5 ? "1_5"
        : f <= 15 ? "6_15"
        : "16_25";
      scope.setTag("gxy.feedsBucket", feedsBucket);
    }
    if (extras.hasVideo != null) scope.setTag("gxy.hasVideo", String(!!extras.hasVideo));

    scope.setTag("net.linkState", snap.linkState || "unknown");
    scope.setTag("net.iceState", snap.iceState || "unknown");
    scope.setTag("net.category", snap.category || "unknown");
    scope.setTag("net.iceCandidate", snap.iceCandidate || "unknown");
    scope.setTag("net.turnProtocol", snap.relayProtocol || "none");
    scope.setTag("net.rtt_bucket", bucketRtt(snap.rttMs));
    scope.setTag("net.loss_bucket", bucketLoss(snap.lossPct));
    scope.setTag("net.jitter_bucket", bucketJitter(snap.jitterMs));
    scope.setTag("net.qualityLimit", snap.qualityLimit || "none");
    scope.setTag("net.bitrate_bucket", bucketBitrate(snap.bitrateBps));
    if (snap.videoCodec) scope.setTag("gxy.codec.video", snap.videoCodec);
    if (snap.audioCodec) scope.setTag("gxy.codec.audio", snap.audioCodec);

    // Distinct fingerprint per (kind, source, category) — turns "ice_failed"
    // into separate Sentry issues for "weak_link" / "sudden_drop" / "cold_start"
    // so they can be triaged independently.
    scope.setFingerprint(["gxy", kind, source || "unknown", snap.category || "unknown"]);

    scope.setContext("gxy_link", {
      ...snap,
      kind,
      source,
      ...extras,
    });

    Sentry.captureException(error);
  });
};

// --- Plain capture wrappers (kept for non-network code paths) ---------------

export const captureException = (exception, data = {}, level = "error") => {
  // Note: previously this swapped exception.name <-> exception.message to
  // mirror old issue titles. That broke Sentry's stacktrace-based grouping
  // for real bugs (every issue ended up fingerprinted by message text).
  // Restored: let Sentry group naturally.
  Sentry.withScope((scope) => {
    scope.setTag("gxy_manual", "true");
    scope.setExtras(data);
    scope.setLevel(level);
    Sentry.captureException(exception);
  });
};

export const captureMessage = (title, data = {}, level = "info") => {
  // Same trick as captureNetworkEvent: avoid title===subtitle in the issue list.
  const error = new Error(level);
  error.name = title;
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
  captureMessage(error, { source: "sentry-test" }, "error");
};

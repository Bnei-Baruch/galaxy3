# Sentry Telemetry & Error Reporting

Single source of truth for how the **VirtualMqttClient** app reports issues to
Sentry, what tags are attached, and how to filter them in the dashboard.

All events — both real bugs and connection telemetry — go to the **same**
Sentry project (`galaxy`). Telemetry is not split out to a separate project;
instead it is identifiable and filterable via a stable set of tags so the
issue feed can be sliced however you need.

---

## Files involved

| File | Purpose |
| --- | --- |
| `src/shared/sentry.js` | Initialization, device detection, network event helper, `beforeSend` filter, runtime listeners. |
| `src/shared/MonitoringData.js` | Per-second connection sampler from `pc.getStats()`. Exposes `getLinkSnapshot()` for Sentry. |
| `src/apps/VirtualApp/VirtualMqttClient.js` | Call sites: `iceFailed`, `reinitClient`, `joinRoom`, `selectRoom`, `disconnected`, `h264_profile`. |

`CheckAlive` and `VirtualHttpClient` are **out of scope** — `CheckAlive` is
dead code (not imported anywhere), `VirtualHttpClient` is not routed in this
app.

---

## Two kinds of events

### 1. Network telemetry — `captureNetworkEvent(kind, source, extras, level)`

Used for everything that is *expected to happen on a flaky network*:
ICE failures, conference reconnects, MQTT disconnects, codec quirks. These
events are not bugs by themselves — they are facts about connectivity.

- All such events carry **`gxy.kind`** + a fixed `net.*` snapshot of the link
  state at the moment of failure.
- Default `level` is **`warning`**, escalated to **`error`** only on terminal
  failures (`conference_reconnect_failed`).
- Distinct fingerprint per `(kind, source, category)` → each variant becomes
  its own Sentry issue and can be resolved/muted independently.

### 2. Real exceptions — `captureException(exception, data, level)` & uncaught

Untouched normal Sentry flow. No fingerprint override, no name/message
swap — Sentry groups by stacktrace as designed. Shows up in the issue feed
**without** a `gxy.kind` tag, which is the cleanest filter to separate them
from telemetry (`!has:gxy.kind`).

---

## The link snapshot (`MonitoringData.getLinkSnapshot()`)

Returned to `captureNetworkEvent` and attached to every network event as
both **tags** (low-cardinality buckets) and **`event.contexts.gxy_link`**
(precise numbers).

```js
{
  linkState:   "init" | "good" | "medium" | "weak" | "unknown",
  iceState:    "new" | "checking" | "connected" | "completed" | "disconnected" | "failed" | "closed" | "unknown",
  category:    "weak_link" | "sudden_drop" | "cold_start" | "unknown",
  rttMs:       number | null,    // mean over the last 30s window
  jitterMs:    number | null,
  lossPct:     number | null,    // % packet loss
  qualityLimit: "none" | "cpu" | "bandwidth" | "other" | null,
  iceCandidate: "host" | "srflx" | "prflx" | "relay" | null,
  relayProtocol: "udp" | "tcp" | "tls" | null,  // only when iceCandidate === "relay"
  audioCodec:  "opus" | "g722" | ... | null,
  videoCodec:  "H264" | "VP8" | "VP9" | "AV1" | ... | null,
  bitrateBps:  number | null,    // outgoing video+audio over the window
  samples:     number,           // how many getStats samples informed the snapshot
  windowMs:    30000,
  reason:      string | null,    // last formula from local quality scorer
}
```

### `category` — the most important field

This is what tells "noise from a flaky link" apart from "the link was fine,
something else broke".

- **`weak_link`** — `lastQualityStatus` is `weak`/`medium`, OR ≥50% of samples
  in the window had elevated rtt/jitter/loss. *Almost certainly noise.*
- **`sudden_drop`** — link was nominally `good` and degraded abruptly.
  *Investigate first* — likely a server, route or our-side issue.
- **`cold_start`** — failure during warmup (`init` link state, <2 samples).
  Usually means the user couldn't even reach Janus on first try.
- **`unknown`** — no monitoring data was available (e.g. `getLinkSnapshot()`
  threw, or no PC was up yet).

---

## Tag reference

### `gxy.*` — application context (per event)

| Tag | Values | Meaning |
| --- | --- | --- |
| `gxy.kind` | `ice_failed`, `conference_reconnect`, `conference_reconnect_failed`, `disconnected`, `h264_profile`, ... | Type of telemetry event. **Absent on real exceptions** — use `!has:gxy.kind` to see only bugs. |
| `gxy.source` | `publisher`, `subscriber`, `mqtt`, `janus`, `streaming` | Where in the stack it happened. |
| `gxy.room` | `1234`, ... | Numeric Galaxy room id. Set in `selectRoom` and stays set on the scope; carried by all subsequent events. |
| `gxy.attempt` | `1`–`30` | Reconnect attempt counter inside a single incident. |
| `gxy.reconnectsInSession` | `0`, `1_5`, `5_20`, `gt20` | How many times this user has reconnected since page load. **`gt20` = client is stuck in a loop**, that's a bug, not flaky network. |
| `gxy.uptimeBucket` | `lt5s`, `5_30s`, `30s_2m`, `2m_10m`, `gt10m` | How long the user was in the room before failure. `lt5s` = bad join, `gt10m` = mid-session flap. |
| `gxy.role` | `user`, `guest`, `admin`, `ghost`, ... | Galaxy user role. |
| `gxy.isGroup` | `true` / `false` | Group session (multiple Virtual Users on one page). |
| `gxy.shidur` | `true` / `false` | Watching the broadcast in addition to publishing. Heavier PC load. |
| `gxy.numVU` | `1`, `2`, `3`, `4` | Number of virtual users on this tab. >1 is the aggressive case. |
| `gxy.feedsBucket` | `0`, `1_5`, `6_15`, `16_25` | Other publishers visible at the time of event. |
| `gxy.hasVideo` | `true` / `false` | Whether the local video track was attached. |
| `gxy.codec.video` | `H264`, `VP8`, `VP9`, `AV1` | Negotiated outgoing video codec. |
| `gxy.codec.audio` | `opus`, `g722`, ... | Negotiated outgoing audio codec. |
| `gxy.janus` | `gxy3-eu-1`, ... | Janus server identifier (was `gxy`, renamed for namespacing). Set once on each `initJanus`. |
| `gxy_manual` | `true` | Marker for plain `captureException` / `captureMessage` paths (not network telemetry). |

### `net.*` — connection snapshot (per event)

| Tag | Values | Meaning |
| --- | --- | --- |
| `net.linkState` | `init`, `good`, `medium`, `weak`, `unknown` | Local quality scorer status at moment of event. Also kept fresh on the scope so any uncaught exception inherits it. |
| `net.iceState` | `new`, `checking`, `connected`, `completed`, `disconnected`, `failed`, `closed`, `unknown` | `pc.connectionState` from the publisher. |
| `net.category` | `weak_link`, `sudden_drop`, `cold_start`, `unknown` | See above — main classification. |
| `net.iceCandidate` | `host`, `srflx`, `prflx`, `relay`, `unknown` | Selected local ICE candidate type. **`relay` = traffic goes through TURN**. |
| `net.turnProtocol` | `udp`, `tcp`, `tls`, `none` | Only meaningful when `net.iceCandidate:relay`. TCP/TLS often means corporate firewall. |
| `net.rtt_bucket` | `lt50`, `50_150`, `150_300`, `gt300`, `na` | Mean round-trip time over the 30s window. |
| `net.loss_bucket` | `0`, `lt1`, `1_3`, `3_10`, `gt10`, `na` | Packet loss % over the window. |
| `net.jitter_bucket` | `lt30`, `30_50`, `gt50`, `na` | Mean jitter (ms). |
| `net.qualityLimit` | `none`, `cpu`, `bandwidth`, `other` | Encoder limitation reason. `cpu` = client overloaded; `bandwidth` = either real BWE backoff or our application cap. |
| `net.bitrate_bucket` | `lt100k`, `100_500k`, `500k_1m`, `gt1m`, `na` | Outgoing total bps. |
| `net.effective` | `slow-2g`, `2g`, `3g`, `4g`, `5g` | From `navigator.connection.effectiveType`. Updated on `connection.change`. |
| `net.type` | `wifi`, `cellular`, `ethernet`, `wimax`, `other` | From `navigator.connection.type` if available. |
| `net.saveData` | `true` / `false` | User has Data Saver enabled. |
| `net.downlink_bucket` | `lt1`, `1_5`, `5_20`, `gt20`, `na` | Estimated downlink Mbps from Network Information API. |

### `app.*` — device & runtime context (mostly static, per session)

Set once in `initSentry` and updated by runtime listeners.

| Tag | Values | Meaning |
| --- | --- | --- |
| `app.deviceType` | `mobile`, `tablet`, `desktop`, `unknown` | UA Client Hints + UA-regex fallback. iPad on iPadOS 13+ is corrected from "desktop" → "tablet". **Use this to slice mobile vs desktop in one filter.** |
| `app.os` | `ios`, `android`, `mac`, `win`, `linux`, `other` | Normalized OS, low cardinality. |
| `app.touch` | `true` / `false` | `navigator.maxTouchPoints > 0`. Catches touchscreen laptops. |
| `app.screenBucket` | `phone` (<768px), `tablet` (768–1024), `desktop` (1024–1920), `large` (>1920), `unknown` | Min screen side, robust to orientation. |
| `app.orientation` | `portrait`, `landscape`, `unknown` | Updated on `orientationchange`. |
| `app.pwa` | `true` / `false` | Running in standalone display-mode (installed PWA). |
| `app.telegram` | `true` / `false` | Page opened from the Telegram WebApp wrapper. |
| `app.visibility` | `visible`, `hidden`, `prerender`, `unknown` | Updated on `visibilitychange`. **`hidden` + `ice_failed` is dropped in `beforeSend`** — background tabs naturally lose ICE. |
| `app.online` | `true` / `false` | Updated on `online`/`offline`. |

### Geo (already existed, unchanged)

| Tag | Values | Meaning |
| --- | --- | --- |
| `isp` | string | ISP name from geo lookup. |
| `isp_code` | string | ISP code. |

User context (`Sentry.setUser`) carries `geo.country_code`, `geo.city`,
`geo.region`.

---

## `event.contexts.gxy_link` (per network event)

Full snapshot, not bucketed — for drilling into a single issue. Visible in
the right-hand panel of the event details page. Contains everything from
`getLinkSnapshot()` plus the `extras` passed by the caller (room, attempt,
joinedAt, role, isGroup, shidur, numVU, feeds, hasVideo, etc.) plus `kind`
and `source`. Cardinality-unsafe values like raw `rttMs`, `jitterMs`,
`lossPct`, `bitrateBps`, `reason` live here, not as tags.

---

## Issue title and subtitle convention

Synthetic events created by `captureNetworkEvent` and `captureMessage` go
through a **swap** so the issue list is scannable:

- **Title** = `error.name` = the `kind` (e.g. `ice_failed`).
- **Subtitle** = `error.message` = `${level}: ${source}/${category}` (e.g.
  `warning: subscriber/weak_link`).

This avoids the `kind / kind` duplication you would otherwise get because
`captureNetworkEvent` always wraps an `Error(kind)`. Real `captureException`
calls do **not** apply this swap — Sentry uses the original `name`/`message`
from the actual `Error` instance and groups by stacktrace.

The "culprit" line of telemetry events will read `captureNetworkEvent(main)`
because the helper is the topmost frame. That is intentional — the actual
call site is identified by the `gxy.source` tag and the contents of
`event.contexts.gxy_link`.

---

## `beforeSend` filters

Implemented in `src/shared/sentry.js`:

1. **Background-tab ICE failures.** `app.visibility:hidden` + `gxy.kind:ice_failed`
   → dropped. Browsers throttle WebRTC in hidden tabs by design.
2. **Browser extensions / Telegram WebApp.** Any frame matching
   `chrome-extension://`, `moz-extension://` or `telegram-web-app` →
   dropped. These produce noisy `Method not found` style events that have
   nothing to do with our code.

Plus `Sentry.init` exclusions:

- `ignoreErrors`: `ResizeObserver loop ...`, `InvalidAccessError: There is no sender or receiver for the track`, `Non-Error promise rejection captured`, `Method not found`, `Can't find variable: logMutedMessage` (stale build), `[janus] transaction cancelled during cleanup` (synthetic teardown signal — see below).
- `denyUrls`: `chrome-extension://`, `moz-extension://`, `telegram-web-app`.

### `[janus] transaction cancelled during cleanup`

Synthetic `Error` thrown by `JanusMqtt._cleanupTransactions()` in
`src/lib/janus-mqtt.js` when a session is being destroyed and there are
still in-flight plugin transactions in `this.transactions` (publish,
subscribe, configure, keepalive, ...). It is **not a bug** — it is the
expected way pending promises get released so callers don't hang
forever. Triggered from the three teardown paths: `init().disconnect`,
`destroy()` connected branch, `destroy()` not-connected branch.

The `Error` is tagged with `name: "JanusCleanupCancelled"` and
`cancelled: true` so callers that wrap plugin transactions can early-
return without treating it as a real failure:

```js
.catch((err) => {
  if (err && err.cancelled) return;
  // ...real error handling
})
```

`_cleanupTransactions` itself wraps every step in `try/catch` to
guarantee it always reaches the end (cleared transactions map, removed
MQTT listeners) regardless of any individual reject handler or MQTT
exit failure.

`beforeBreadcrumb` drops `console.log`-level breadcrumbs to keep payloads
small.

Sample rates: `tracesSampleRate: 0.05`, `replaysSessionSampleRate: 0.01`,
`replaysOnErrorSampleRate: 1.0`. Replays still attach 1.0 to events, just
the random session sampling is reduced.

---

## Where each event is emitted

| `gxy.kind` | `gxy.source` | Site | Trigger |
| --- | --- | --- | --- |
| `ice_failed` | `publisher` / `subscriber` | `VirtualMqttClient.iceFailed` | `pc.connectionState === "failed"` on either plugin. |
| `conference_reconnect` | `mqtt` | `VirtualMqttClient.reinitClient` (only on the **first** of a series of attempts) | A reconnect cycle started. Subsequent retries up to 30 are **not** re-reported — they're breadcrumbs. |
| `conference_reconnect_failed` | `mqtt` | `VirtualMqttClient.reinitClient` (after 30 attempts) | Final give-up; user sees the alert. Logged with `level: error`. |
| `disconnected` | `mqtt` | `VirtualMqttClient.initMQTT` callback | MQTT broker dropped the connection (followed by `window.location.reload()`). |
| `h264_profile` | `publisher` | `VirtualMqttClient.joinRoom` after `videoroom.publish` | Server picked an H.264 profile other than `42e01f`. Informational, `level: info`. |

What was **removed**:

- `captureMessage("join room", …)` — was a probe, no longer interesting.
- The old `captureException(new Error("conference reconnect"))` / `captureException(new Error("ice failed"))` shapes — they masqueraded as exceptions and crowded the bug feed.

---

## Practical Sentry queries

### Triage feed — only real bugs, no telemetry

```
!has:gxy.kind  is:unresolved
```

### Network telemetry, sorted by category

```
has:gxy.kind  net.category:sudden_drop      # investigate first — link was fine
has:gxy.kind  net.category:weak_link        # noise — review only in aggregate
has:gxy.kind  net.category:cold_start       # server reachability problems
```

### Specific failure modes

```
gxy.kind:ice_failed net.iceCandidate:relay net.turnProtocol:tcp
    → corporate firewall pushes traffic over TURN/TCP

gxy.kind:ice_failed net.iceCandidate:host net.category:sudden_drop
    → not a TURN issue, user had a direct path that suddenly broke

gxy.kind:conference_reconnect_failed
    → terminal: user actually got kicked; high priority

gxy.reconnectsInSession:gt20
    → client is in a reconnect loop — bug, not network

gxy.uptimeBucket:lt5s gxy.janus:<server>
    → users can't even land on this Janus; check server health

gxy.kind:ice_failed app.visibility:hidden
    → should be 0 — already filtered in beforeSend; if non-zero, filter is broken
```

### Slicing by device

```
app.deviceType:mobile                       # only mobile
app.deviceType:desktop                      # only desktop
app.os:ios !has:gxy.kind                    # iOS-specific bugs
app.deviceType:tablet net.iceCandidate:relay
```

### Slicing by user / room / server

```
gxy.room:1234                               # everything in this room
gxy.janus:gxy3-eu-1                         # everything on this Janus server
gxy.role:guest                              # only guest users
gxy.isGroup:true                            # only group sessions
```

### Encoder problems

```
net.qualityLimit:cpu                        # client CPU bottleneck
net.qualityLimit:bandwidth net.loss_bucket:[1_3,3_10,gt10]
    → real bandwidth pressure, not just app-side cap
```

---

## Recommended alerts

1. **"New issue in galaxy" alert** — add condition `event.tags[gxy.kind] is empty`
   so it only fires for real exceptions (without this you'll be paged for every
   new combination of kind/source/category, which is just network weather).
2. **Spike alert: terminal reconnect failures** — condition
   `gxy.kind:conference_reconnect_failed`, threshold e.g. >10 events / 5min
   over the prior week's baseline. This is users actually getting kicked.
3. **Spike alert: server-side suspicion** — condition
   `gxy.kind:[ice_failed,conference_reconnect] AND net.category:sudden_drop`,
   group by `gxy.janus`. A spike on a single server name = that server
   is degrading.
4. **Spike alert: cold-start failures** — condition
   `gxy.kind:[ice_failed,conference_reconnect] AND net.category:cold_start`,
   group by `gxy.janus`. Means users can't reach a specific Janus.
5. **`weak_link` events should NOT have an alert.** They are reported for
   completeness and dashboarding, not as on-call signal.

---

## Extending the system

### Adding a new telemetry kind

1. Pick a stable string for `gxy.kind` (snake_case, lowercase, e.g. `mqtt_publish_timeout`).
2. Pick a `gxy.source` value from the existing set if possible.
3. Call `captureNetworkEvent(kind, source, extras, level?)` at the call site.
4. Pass everything you'd want to filter by in `extras` (`room`, `attempt`,
   `role`, `isGroup`, `shidur`, `numVU`, `feeds`, `hasVideo`, …) — these are
   automatically translated into tags.
5. **Don't** add new tags directly with `Sentry.setTag` from feature code —
   keep all tag schema-shaping inside `captureNetworkEvent` so the dashboard
   stays predictable.
6. Default `level` is `warning`. Use `error` only for terminal failures
   (something the user noticed).

### Adding a new always-on tag

1. Add it to `installRuntimeListeners()` in `sentry.js` if it has a runtime
   value, or to the static block at the end of `initSentry()` if it's
   one-shot.
2. Document it in this file.
3. Make sure values come from a small bounded set — Sentry rejects tags
   with very high cardinality and the dashboard becomes useless.

### Adding a new field to the link snapshot

1. Extend the `sample` object in `MonitoringData.extractQualitySample_`.
2. If the field needs data not already present in `pc.getStats(audioTrack)` /
   `pc.getStats(videoTrack)` results, plumb it through the synthetic
   `transport` section assembled from `pc.getStats(null)`.
3. Surface it in `getLinkSnapshot()`.
4. In `captureNetworkEvent`, decide whether it's a tag (bounded values →
   `scope.setTag`) or context (any value → automatically picked up by
   `setContext("gxy_link", …)`).

---

## Sample rates & quotas

- `tracesSampleRate: 0.05` — 5% of transactions go to performance.
- `replaysSessionSampleRate: 0.01` — 1% of sessions get baseline replay.
- `replaysOnErrorSampleRate: 1.0` — 100% of sessions that hit an error get a
  replay attached.
- `maxBreadcrumbs: 50`.

These are set conservatively after observing ~12k events/24h dominated by
network telemetry. If volume drops after these changes you can crank
`tracesSampleRate` back up.


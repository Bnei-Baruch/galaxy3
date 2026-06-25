// Centralized MQTT topic names for WebinarApp.
//
// All live messaging topics live under the `webinar/` namespace, which the
// shared router (src/shared/mqtt.js watch()) maps to the same events as the
// `galaxy/` namespace. The user-state DB ingest uses its own `wnrdb/users`
// topic (separate from the main `gxydb/users`).
export const NS = "webinar";

// --- users (global / personal) ---------------------------------------------
export const USERS_NOTIFICATION = `${NS}/users/notification`;
export const USERS_BROADCAST = `${NS}/users/broadcast`;
export const USERS_CHAT = `${NS}/users/chat`;
// Operator subscription to every user's question subtopic.
export const QUESTIONS_SUB = `${NS}/users/questions/+`;
// Personal topic of a single user (commands + private messages).
export const userTopic = (id) => `${NS}/users/${id}`;
// Per-user retained question topic.
export const questionsTopic = (id) => `${NS}/users/questions/${id}`;

// --- rooms ------------------------------------------------------------------
export const roomTopic = (room) => `${NS}/room/${room}`;
export const roomChatTopic = (room) => `${NS}/room/${room}/chat`;
// Retained broadcast (air) queue snapshot.
export const AIR_QUEUE = `${NS}/room/air_queue`;

// --- user DB ingest ---------------------------------------------------------
// WebinarApp users are ingested into the webinar DB, not the main one.
export const USERS_DB = "wnrdb/users";

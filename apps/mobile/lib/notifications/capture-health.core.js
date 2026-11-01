/**
 * What each linked app has done lately, kept apart from the capture log: the log holds 50 entries
 * across every app on the phone, so a chatty app pushes a bank's history out within hours.
 *
 * CommonJS, because the headless task writes it. Sources are keyed by canonical package.
 *
 * {
 *   listenerHeardAt: ISO | null   last notification from any app: the listener is alive
 *   accessOffDismissedAt: ISO | null   "Not now" on the access alert; the next notification clears it
 *   sources: { [package]: {
 *     lastHeardAt: ISO | null     last notification of any kind from this app
 *     lastCapturedAt: ISO | null  last alert that became a capture
 *     captureDays: string[]       local YYYY-MM-DD with a capture, newest first
 *     missed: ISO[]               reported missed transactions, newest first
 *     linkedAt: ISO | null        the user last linked this app
 *     quietDismissedAt: ISO | null
 *   } }
 * }
 */
const { CAPTURED_NOTIFICATIONS_KEY } = require('./capture-status.core');
const { canonicalNotificationPackage } = require('./notification-package-aliases.core');

const CAPTURE_HEALTH_KEY = 'capture_health';
// Enough to see a weekly rhythm and survive a holiday, and small enough to rewrite on every alert.
const MAX_CAPTURE_DAYS = 60;
const MAX_MISSED = 20;

const CAPTURED_STATUSES = new Set(['added', 'auto_added', 'waiting_for_review']);

function localDay(iso) {
  const date = new Date(iso);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function emptySource() {
  return {
    lastHeardAt: null,
    lastCapturedAt: null,
    captureDays: [],
    missed: [],
    linkedAt: null,
    quietDismissedAt: null,
  };
}

function latest(a, b) {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

function sourceFor(health, packageName) {
  const key = canonicalNotificationPackage(packageName);
  health.sources[key] = { ...emptySource(), ...health.sources[key] };
  return health.sources[key];
}

function addCapture(source, at) {
  source.lastCapturedAt = latest(source.lastCapturedAt, at);
  source.captureDays = [...new Set([localDay(at), ...source.captureDays])]
    .sort()
    .reverse()
    .slice(0, MAX_CAPTURE_DAYS);
}

/** First read after an update: the log still knows the last few captures. */
function seedFromLog(storage) {
  const health = { listenerHeardAt: null, accessOffDismissedAt: null, sources: {} };
  let entries = [];
  try {
    entries = JSON.parse(storage.getString(CAPTURED_NOTIFICATIONS_KEY) || '[]');
  } catch {
    return health;
  }
  if (!Array.isArray(entries)) return health;
  for (const entry of entries) {
    if (!entry?.receivedAt || Number.isNaN(Date.parse(entry.receivedAt))) continue;
    health.listenerHeardAt = latest(health.listenerHeardAt, entry.receivedAt);
    if (!entry.packageName || !entry.packageLinked) continue;
    const source = sourceFor(health, entry.packageName);
    source.lastHeardAt = latest(source.lastHeardAt, entry.receivedAt);
    if (CAPTURED_STATUSES.has(entry.status)) addCapture(source, entry.receivedAt);
  }
  return health;
}

function readCaptureHealth(storage) {
  const raw = storage.getString(CAPTURE_HEALTH_KEY);
  if (!raw) return seedFromLog(storage);
  try {
    const parsed = JSON.parse(raw);
    return {
      listenerHeardAt: parsed?.listenerHeardAt ?? null,
      accessOffDismissedAt: parsed?.accessOffDismissedAt ?? null,
      sources: parsed?.sources && typeof parsed.sources === 'object' ? parsed.sources : {},
    };
  } catch {
    return seedFromLog(storage);
  }
}

// The headless task writes this before it queues the alert, and a health record is never worth
// losing a capture over.
function updateCaptureHealth(storage, change) {
  try {
    const health = readCaptureHealth(storage);
    change(health);
    storage.set(CAPTURE_HEALTH_KEY, JSON.stringify(health));
  } catch (e) {
    console.error('[CaptureHealth] not recorded:', e?.message ?? e);
  }
}

/** Every notification, from any app. Only a linked app gets a source. */
function recordHeard(storage, { packageName, linked, at }) {
  updateCaptureHealth(storage, (health) => {
    health.listenerHeardAt = latest(health.listenerHeardAt, at);
    health.accessOffDismissedAt = null;
    if (!linked) return;
    const source = sourceFor(health, packageName);
    source.lastHeardAt = latest(source.lastHeardAt, at);
  });
}

/** An alert became a proposal or a transaction, not merely passed the prefilter. */
function recordCapture(storage, { packageName, at }) {
  if (!packageName) return;
  updateCaptureHealth(storage, (health) => addCapture(sourceFor(health, packageName), at));
}

function recordMissed(storage, { packageName, at }) {
  updateCaptureHealth(storage, (health) => {
    const source = sourceFor(health, packageName);
    source.missed = [at, ...source.missed].slice(0, MAX_MISSED);
  });
}

function recordLinked(storage, { packageName, at }) {
  updateCaptureHealth(storage, (health) => {
    sourceFor(health, packageName).linkedAt = at;
  });
}

function recordQuietDismissed(storage, { packageName, at }) {
  updateCaptureHealth(storage, (health) => {
    sourceFor(health, packageName).quietDismissedAt = at;
  });
}

function recordAccessOffDismissed(storage, { at }) {
  updateCaptureHealth(storage, (health) => {
    health.accessOffDismissedAt = at;
  });
}

module.exports = {
  CAPTURE_HEALTH_KEY,
  MAX_CAPTURE_DAYS,
  emptySource,
  localDay,
  readCaptureHealth,
  recordAccessOffDismissed,
  recordCapture,
  recordHeard,
  recordLinked,
  recordMissed,
  recordQuietDismissed,
};

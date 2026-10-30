// Per-user data for tasks, bills and savings. Signed-out visitors ("misafir")
// keep using this browser's localStorage; a signed-in user's data lives in their
// own Firestore document (see account.mjs). app.js only talks to the store.
import { isTaskLog } from './task-log.mjs';

export const GUEST_STORAGE_KEYS = Object.freeze({
  tasks: 'sunobeti-tasks-v3',
  billHistory: 'sunobeti-bill-history-v1',
  verifiedSavings: 'sunobeti-verified-savings-v1',
  verifiedHistory: 'sunobeti-verified-history-v1'
});
export const USER_DATA_FIELDS = Object.freeze(Object.keys(GUEST_STORAGE_KEYS));

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const VALIDATORS = {
  // Daily log { 'YYYY-MM-DD': ids } or, in older records, a bare array of ids.
  tasks: isTaskLog,
  billHistory: value => Array.isArray(value) && value.every(isRecord),
  verifiedSavings: isRecord,
  verifiedHistory: value => Array.isArray(value) && value.every(isRecord)
};

// Keeps only known fields with the expected shape, so a corrupted or tampered
// record never reaches the UI.
export function sanitizeUserData(raw) {
  const clean = {};
  if (!isRecord(raw)) return clean;
  for (const field of USER_DATA_FIELDS) {
    if (field in raw && VALIDATORS[field](raw[field])) clean[field] = raw[field];
  }
  return clean;
}

export function hasUserData(data) {
  return USER_DATA_FIELDS.some(field => {
    const value = data?.[field];
    if (field === 'tasks' && isRecord(value)) return Object.keys(value).length > 0;
    return Array.isArray(value) ? value.length > 0 : isRecord(value);
  });
}

export function createLocalBackend(storage) {
  return {
    kind: 'guest',
    async load() {
      const raw = {};
      for (const [field, key] of Object.entries(GUEST_STORAGE_KEYS)) {
        try {
          const text = storage.getItem(key);
          if (text !== null) raw[field] = JSON.parse(text);
        } catch { /* blocked storage or broken JSON: treat as empty */ }
      }
      return sanitizeUserData(raw);
    },
    save(field, value) {
      try {
        if (value === undefined) storage.removeItem(GUEST_STORAGE_KEYS[field]);
        else storage.setItem(GUEST_STORAGE_KEYS[field], JSON.stringify(value));
      } catch { /* storage may be blocked; the in-memory copy still works */ }
    },
    clear() {
      for (const key of Object.values(GUEST_STORAGE_KEYS)) {
        try { storage.removeItem(key); } catch { /* ignore */ }
      }
    }
  };
}

// Synchronous reads from an in-memory copy; writes go to the active backend.
export function createUserStore(initialBackend) {
  let backend = initialBackend;
  let data = {};
  return {
    get kind() { return backend.kind; },
    get(field, fallback) {
      return field in data ? structuredClone(data[field]) : fallback;
    },
    set(field, value) {
      if (!USER_DATA_FIELDS.includes(field)) throw new Error(`Bilinmeyen alan: ${field}`);
      data[field] = structuredClone(value);
      backend.save(field, value);
    },
    remove(field) {
      delete data[field];
      backend.save(field, undefined);
    },
    snapshot() {
      return structuredClone(data);
    },
    async use(nextBackend) {
      const loaded = await nextBackend.load();
      backend = nextBackend;
      data = sanitizeUserData(loaded);
      return this.snapshot();
    }
  };
}

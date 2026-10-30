import test from 'node:test';
import assert from 'node:assert/strict';
import { createUserStore, createLocalBackend, sanitizeUserData, hasUserData, GUEST_STORAGE_KEYS } from '../user-store.mjs';
import { accountsConfigured, authErrorMessage, initials } from '../account.mjs';

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
}

function memoryBackend(initial = {}) {
  const saved = { ...initial };
  return { kind: 'account', saved, load: async () => ({ ...saved }), save(field, value) { if (value === undefined) delete saved[field]; else saved[field] = value; } };
}

test('guest data is read from the existing browser keys, so old visits keep their records', async () => {
  const storage = memoryStorage({ [GUEST_STORAGE_KEYS.tasks]: '["brush","shower"]', [GUEST_STORAGE_KEYS.billHistory]: '[{"total":12,"days":30}]' });
  const store = createUserStore(createLocalBackend(storage));
  await store.use(createLocalBackend(storage));
  assert.deepEqual(store.get('tasks', []), ['brush', 'shower']);
  assert.equal(store.get('billHistory', []).length, 1);
  store.set('tasks', ['brush']);
  assert.equal(storage.getItem(GUEST_STORAGE_KEYS.tasks), '["brush"]');
});

test('two accounts never see each other\'s tasks or bills', async () => {
  const ayse = memoryBackend({ tasks: ['brush'], billHistory: [{ total: 10, days: 30 }] });
  const mehmet = memoryBackend({ tasks: ['laundry', 'leaks'] });
  const store = createUserStore(createLocalBackend(memoryStorage()));
  await store.use(ayse);
  assert.deepEqual(store.get('tasks', []), ['brush']);
  store.set('tasks', ['brush', 'shower']);
  await store.use(mehmet);
  assert.deepEqual(store.get('tasks', []), ['laundry', 'leaks']);
  assert.deepEqual(store.get('billHistory', []), []);
  store.set('billHistory', [{ total: 8, days: 33 }]);
  assert.deepEqual(ayse.saved.tasks, ['brush', 'shower']);
  assert.equal(ayse.saved.billHistory.length, 1);
  assert.deepEqual(mehmet.saved.billHistory, [{ total: 8, days: 33 }]);
});

test('returned values are copies; mutating them does not change stored data', async () => {
  const store = createUserStore(memoryBackend());
  await store.use(memoryBackend({ tasks: ['brush'] }));
  store.get('tasks', []).push('shower');
  assert.deepEqual(store.get('tasks', []), ['brush']);
});

test('removing a field clears it in the backend', async () => {
  const backend = memoryBackend({ verifiedSavings: { eligible: true } });
  const store = createUserStore(backend);
  await store.use(backend);
  store.remove('verifiedSavings');
  assert.equal(store.get('verifiedSavings', null), null);
  assert.equal('verifiedSavings' in backend.saved, false);
});

test('unknown fields and wrong shapes are dropped', () => {
  assert.deepEqual(sanitizeUserData({ tasks: 'brush', billHistory: [{ total: 1 }], admin: true, verifiedSavings: [] }), { billHistory: [{ total: 1 }] });
  assert.deepEqual(sanitizeUserData(null), {});
  assert.deepEqual(sanitizeUserData({ tasks: { '2026-10-30': ['brush'] } }), { tasks: { '2026-10-30': ['brush'] } });
  assert.deepEqual(sanitizeUserData({ tasks: { dün: ['brush'] } }), {});
  assert.throws(() => createUserStore(memoryBackend()).set('admin', true));
});

test('guest data detection for the first-sign-in move', () => {
  assert.equal(hasUserData({}), false);
  assert.equal(hasUserData({ tasks: [] }), false);
  assert.equal(hasUserData({ tasks: ['brush'] }), true);
  assert.equal(hasUserData({ verifiedSavings: { eligible: false } }), true);
  assert.equal(hasUserData({ tasks: {} }), false);
  assert.equal(hasUserData({ tasks: { '2026-10-30': ['brush'] } }), true);
});

test('blocked browser storage does not break the guest store', async () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  const store = createUserStore(createLocalBackend(broken));
  await store.use(createLocalBackend(broken));
  store.set('tasks', ['brush']);
  assert.deepEqual(store.get('tasks', []), ['brush']);
});

test('accounts stay off until the Firebase config is filled in', () => {
  assert.equal(accountsConfigured({ apiKey: '', projectId: '', appId: '', authDomain: '' }), false);
  assert.equal(accountsConfigured({ apiKey: 'k', projectId: 'p', appId: 'a', authDomain: 'p.firebaseapp.com' }), true);
});

test('auth errors are shown in Turkish without leaking raw codes', () => {
  assert.equal(authErrorMessage({ code: 'auth/invalid-credential' }), 'E-posta veya şifre hatalı.');
  assert.equal(authErrorMessage({ code: 'auth/something-new' }), 'Bir sorun oluştu. Lütfen tekrar dene.');
  assert.equal(initials('bahar türkmen'), 'BT');
  assert.equal(initials(''), '?');
});

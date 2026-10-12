import test from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_PROFILE_KEY, DEFAULT_DEMO_NAME, makeDemoProfile, loadDemoProfile, saveDemoProfile, signOutDemoProfile } from '../demo-profile.mjs';

function memoryStorage() {
  const data = new Map();
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
}

test('example profile is explicitly a demo persona with no password', () => {
  assert.deepEqual(makeDemoProfile(), { name: DEFAULT_DEMO_NAME, kind: 'demo' });
});
test('display names normalize safely', () => {
  assert.equal(makeDemoProfile('  Ece   Deniz  ').name, 'Ece Deniz');
  for (const name of ['', 'A', '<script>', 'a'.repeat(41), 'Deniz\nYılmaz\u0000']) assert.throws(() => makeDemoProfile(name));
});
test('demo profile persists and reloads from the same browser storage', () => {
  const s = memoryStorage();
  assert.equal(loadDemoProfile(s), null);
  const saved = saveDemoProfile(s, 'Deniz Yılmaz');
  assert.deepEqual(loadDemoProfile(s), saved);
});
test('logout removes only the persona, never bills or tasks', () => {
  const s = memoryStorage();
  s.setItem('sunobeti-bill-history-v1', '[{"total":12}]');
  s.setItem('sunobeti-tasks-v3', '["brush"]');
  saveDemoProfile(s, 'Deniz Yılmaz');
  signOutDemoProfile(s);
  assert.equal(loadDemoProfile(s), null);
  assert.equal(s.getItem('sunobeti-bill-history-v1'), '[{"total":12}]');
  assert.equal(s.getItem('sunobeti-tasks-v3'), '["brush"]');
});
test('malformed or non-demo stored profiles do not create a signed-in view', () => {
  const s = memoryStorage();
  for (const value of ['bad json', 'null', '{}', '{"kind":"demo"}', '{"kind":"real","name":"Deniz"}', '{"kind":"demo","name":"<script>"}']) {
    s.setItem(DEMO_PROFILE_KEY, value);
    assert.equal(loadDemoProfile(s), null);
  }
});
test('storage failures are surfaced, not a fabricated successful login', () => {
  const s = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(loadDemoProfile(s), null);
  assert.throws(() => saveDemoProfile(s, 'Deniz'));
});

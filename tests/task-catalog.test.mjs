import test from 'node:test';
import assert from 'node:assert/strict';
import { TASKS, HOUSEHOLD_QUESTIONS, normalizeHousehold, isHousehold, rotatingTaskFor, tasksForToday, dayProgress, oneTimeTasks } from '../task-catalog.mjs';
import { createUserStore, createLocalBackend, GUEST_STORAGE_KEYS } from '../user-store.mjs';

const defaults = normalizeHousehold(null).answers;
const ids = list => list.map(task => task.id);

test('task ids are unique and every requirement is a household question', () => {
  assert.equal(new Set(ids(TASKS)).size, TASKS.length);
  const questions = new Set(HOUSEHOLD_QUESTIONS.map(q => q.id));
  for (const task of TASKS) if (task.requires) assert.ok(questions.has(task.requires), task.id);
});

test('a normal day: daily habits plus exactly one rotating task, no level tasks', () => {
  const list = tasksForToday({ day: '2026-10-31', answers: defaults, level: 'normal' });
  assert.deepEqual(ids(list).slice(0, 5), ['brush', 'shower', 'flush', 'dishes', 'laundry']);
  assert.equal(list.filter(task => task.dayTag).length, 1);
  assert.equal(list.filter(task => task.levelTag).length, 0);
});

test('household answers hide tasks that do not apply and swap the dishes text', () => {
  const answers = { ...defaults, shower: false, dualFlush: false, dishwasher: false, washer: false };
  const list = tasksForToday({ day: '2026-10-31', answers, level: 'normal' });
  assert.ok(!ids(list).includes('shower') && !ids(list).includes('flush') && !ids(list).includes('laundry'));
  assert.equal(list.find(task => task.id === 'dishes').text, 'Bulaşığı akan suyun altında değil, leğende yıka.');
  // The rotating task never needs an appliance the household lacks.
  for (let d = 1; d <= 30; d += 1) {
    const day = `2026-11-${String(d).padStart(2, '0')}`;
    assert.ok(!['scrape', 'eco-program'].includes(rotatingTaskFor(day, answers).id), day);
  }
});

test('the rotating task changes by day and is the same for the same day', () => {
  const week = Array.from({ length: 8 }, (_, i) => rotatingTaskFor(`2026-11-0${i + 1}`, defaults).id);
  assert.equal(new Set(week).size, 8);
  assert.equal(rotatingTaskFor('2026-11-03', defaults).id, rotatingTaskFor('2026-11-03', defaults).id);
});

test('Dikkat and Kritik add their tasks on top, only where they apply', () => {
  const all = { ...defaults, car: true, balcony: true, garden: true };
  const dikkat = tasksForToday({ day: '2026-10-31', answers: all, level: 'dikkat' });
  assert.deepEqual(ids(dikkat.filter(t => t.levelTag)), ['car-wash', 'balcony-bucket']);
  const kritik = tasksForToday({ day: '2026-10-31', answers: all, level: 'kritik' });
  assert.deepEqual(ids(kritik.filter(t => t.levelTag)), ['car-wash', 'balcony-bucket', 'soap-off', 'saved-water-plants', 'water-jug']);
  assert.ok(kritik.filter(t => t.levelTag).every(t => t.levelTag === 'Kritik mod'));
  const acil = tasksForToday({ day: '2026-10-31', answers: defaults, level: 'acil' });
  assert.deepEqual(ids(acil.filter(t => t.levelTag)), ['soap-off', 'water-jug']);
});

test('seasonal watering shows only May–September and only with plants', () => {
  const garden = { ...defaults, garden: true };
  assert.ok(ids(tasksForToday({ day: '2026-07-10', answers: garden })).includes('watering-time'));
  assert.ok(!ids(tasksForToday({ day: '2026-10-31', answers: garden })).includes('watering-time'));
  assert.ok(!ids(tasksForToday({ day: '2026-07-10', answers: defaults })).includes('watering-time'));
});

test('optional laundry adds points but is not needed to complete the day', () => {
  const list = tasksForToday({ day: '2026-10-31', answers: defaults });
  const required = ids(list.filter(task => !task.optional));
  const p = dayProgress(list, required);
  assert.equal(p.complete, true);
  assert.equal(p.doneRequired, p.required);
  assert.ok(dayProgress(list, [...required, 'laundry']).points > p.points);
  assert.equal(dayProgress(list, ['laundry']).complete, false);
});

test('household records are validated and normalized; unknown one-time ids are dropped', () => {
  assert.equal(isHousehold({ answers: { car: 'yes' } }), false);
  assert.equal(isHousehold([]), false);
  const h = normalizeHousehold({ answers: { car: true }, setupDone: true, oneTime: { aerator: '2026-10-31', brush: '2026-10-31', 'fix-drip': 'dün' } });
  assert.equal(h.answers.car, true);
  assert.equal(h.answers.shower, true); // default for an unanswered question
  assert.deepEqual(h.oneTime, { aerator: '2026-10-31' });
  assert.deepEqual(ids(oneTimeTasks({ ...defaults, shower: false })), ['leak-test', 'aerator', 'fix-drip']);
});

test('a guest household is stored in this browser and a bad record is ignored', async () => {
  const data = new Map();
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
  const store = createUserStore(createLocalBackend(storage));
  await store.use(createLocalBackend(storage));
  store.set('household', { answers: { car: true }, setupDone: true, oneTime: {} });
  assert.equal(JSON.parse(data.get(GUEST_STORAGE_KEYS.household)).answers.car, true);
  data.set(GUEST_STORAGE_KEYS.household, '{"answers":{"car":"evet"}}');
  await store.use(createLocalBackend(storage));
  assert.equal(store.get('household', null), null);
});

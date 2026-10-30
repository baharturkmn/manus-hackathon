import test from 'node:test';
import assert from 'node:assert/strict';
import { istanbulDayKey, normalizeTaskLog, tasksForDay, withDayTasks, recentDays, currentStreak, isTaskLog, TASK_LOG_DAYS } from '../task-log.mjs';

test('days follow the Istanbul calendar, not UTC', () => {
  assert.equal(istanbulDayKey(new Date('2026-10-30T21:30:00Z')), '2026-10-31'); // 00:30 in Istanbul
  assert.equal(istanbulDayKey(new Date('2026-10-30T20:30:00Z')), '2026-10-30');
});

test('each day keeps its own selection and a new day starts empty', () => {
  let log = withDayTasks({}, '2026-10-30', ['brush', 'shower']);
  log = withDayTasks(log, '2026-10-31', ['laundry']);
  assert.deepEqual(tasksForDay(log, '2026-10-30'), ['brush', 'shower']);
  assert.deepEqual(tasksForDay(log, '2026-10-31'), ['laundry']);
  assert.deepEqual(tasksForDay(log, '2026-11-01'), []);
});

test('unticking everything removes the day; duplicates are dropped', () => {
  const log = withDayTasks(withDayTasks({}, '2026-10-30', ['brush', 'brush']), '2026-10-31', []);
  assert.deepEqual(log, { '2026-10-30': ['brush'] });
  assert.deepEqual(withDayTasks(log, '2026-10-30', []), {});
});

test('older records without dates count as today; only the last 90 days are kept', () => {
  assert.deepEqual(normalizeTaskLog(['brush', 'leaks'], '2026-10-30'), { '2026-10-30': ['brush', 'leaks'] });
  const old = { '2026-01-01': ['brush'], '2026-08-02': ['shower'], '2026-10-30': ['leaks'], '2026-12-01': ['laundry'] };
  assert.deepEqual(Object.keys(normalizeTaskLog(old, '2026-10-30')), ['2026-08-02', '2026-10-30']);
  assert.equal(TASK_LOG_DAYS, 90);
});

test('malformed logs are rejected', () => {
  assert.equal(isTaskLog({ '2026-10-30': ['brush'] }), true);
  assert.equal(isTaskLog(['brush']), true);
  assert.equal(isTaskLog({ yesterday: ['brush'] }), false);
  assert.equal(isTaskLog({ '2026-10-30': 'brush' }), false);
  assert.deepEqual(normalizeTaskLog({ bad: 1 }, '2026-10-30'), {});
});

test('the last seven days and the streak are summarised', () => {
  const log = { '2026-10-27': ['brush'], '2026-10-28': ['brush', 'shower'], '2026-10-29': ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], '2026-10-30': ['leaks'] };
  const days = recentDays(log, '2026-10-30');
  assert.equal(days.length, 7);
  assert.deepEqual(days.map(d => d.done), [0, 0, 0, 1, 2, 8, 1]);
  assert.equal(days.at(-1).weekday, 'Bugün');
  assert.equal(days.at(-2).label, '29 Eki');
  assert.equal(currentStreak(log, '2026-10-30'), 4);
  assert.equal(currentStreak(log, '2026-10-31'), 4); // nothing yet today: streak from yesterday still counts
  assert.equal(currentStreak(log, '2026-11-02'), 0);
});

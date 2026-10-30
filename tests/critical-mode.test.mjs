import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RULE, historyDays, appendToHistory, seasonalNormals, confirmedReadings, indicators, conditions, replayLevels, currentMode
} from '../critical-mode.mjs';
import { buildLiveFile, readLiveFile, parseDolulukPage } from '../live-data.mjs';

// A frozen copy of public/data/history.json as of 30 October 2026. The live
// file grows every hour, so tests must not depend on its current contents.
const history = JSON.parse(readFileSync(new URL('./fixtures/history-2026-10-30.json', import.meta.url), 'utf8'));
const liveHistory = JSON.parse(readFileSync(new URL('../public/data/history.json', import.meta.url), 'utf8'));

// A synthetic daily history: `years` full years at a constant level, then `tail` values.
function synthetic({ startYear = 2010, years = 6, level = 60, tail = [] } = {}) {
  const start = Date.UTC(startYear, 0, 1);
  const end = Date.UTC(startYear + years, 0, 1);
  const values = [];
  for (let ms = start; ms < end; ms += 864e5) values.push(level);
  return { start: new Date(start).toISOString().slice(0, 10), values: [...values, ...tail] };
}
const levelsOf = (h) => replayLevels(indicators(historyDays(h)));

test('append extends the history with gaps and overwrites a day only when the value changed', () => {
  const h = { start: '2026-10-01', values: [50, null] };
  const a = appendToHistory(h, [{ date: '2026-10-02', value: 49.5 }, { date: '2026-10-05', value: 48 }, { date: '2026-09-01', value: 40 }, { date: '2026-10-06', value: 140 }]);
  assert.equal(a.changed, true);
  assert.deepEqual(a.history.values, [50, 49.5, null, null, 48]);
  assert.equal(appendToHistory(a.history, [{ date: '2026-10-05', value: 48 }]).changed, false);
});

test('seasonal normal uses only earlier years and needs five of them', () => {
  const h = synthetic({ years: 6, level: 60, tail: [30, 30, 30] });
  const days = historyDays(h);
  const normals = seasonalNormals(days);
  assert.equal(normals.at(0), null); // first year: no earlier years
  assert.equal(normals.at(365 * 4 + 1 + 10), null); // fifth year: only four earlier years
  assert.equal(Math.round(normals.at(-1)), 60); // a later year: the earlier years' level, not its own
});

test('a large fall waits for the next reading before it counts', () => {
  const days = historyDays({ start: '2026-01-01', values: [50, 45, null, 45.2, 40] });
  assert.deepEqual(confirmedReadings(days), [50, 45, null, 45.2, null]);
});

test('levels: two days to enter, a week of recovery to leave', () => {
  // 6 years at 42 %, then 2 days at 39 (Dikkat), 2 at 24 (Kritik), 6 days at 41, then 46.
  const tail = [39, 39, 24, 24, ...Array(6).fill(41), ...Array(8).fill(46)];
  const t = levelsOf(synthetic({ level: 42, tail })).slice(-tail.length);
  assert.deepEqual(t.slice(0, 4), [0, 1, 1, 2]);
  // Six calm days at 41 % keep Kritik; the seventh calm day leaves it.
  assert.equal(t.at(9), 2);
  assert.equal(t.at(10), 0);
  assert.equal(t.at(-1), 0);
});

test('a sharp fall with a falling trend goes straight to Kritik', () => {
  // From a long 60 % to 39 % : at that 28-day pace 20 % is under 60 days away.
  const t = levelsOf(synthetic({ level: 60, tail: [39, 39] })).slice(-2);
  assert.deepEqual(t, [0, 2]);
});

test('a single day below a limit does not change the level', () => {
  const levels = levelsOf(synthetic({ tail: [24, 60, 60] }));
  assert.deepEqual(levels.slice(-3), [0, 0, 0]);
});

test('far below the seasonal normal is Kritik under 35 %, Dikkat above it', () => {
  const ind = { occ: 34, diff: -21, daysTo20: null };
  assert.deepEqual(conditions(ind), { kritik: ['seasonal'], dikkat: ['below', 'seasonal'] });
  assert.deepEqual(conditions({ occ: 45, diff: -22, daysTo20: null }), { kritik: [], dikkat: ['seasonal'] });
  assert.deepEqual(conditions({ occ: 50, diff: 3, daysTo20: 55 }), { kritik: ['pace'], dikkat: [] });
});

test('replayed on İSKİ 2000–2024 the rule matches the calibration backtest', () => {
  const days = historyDays(history).filter(day => day.date <= '2024-02-19');
  const levels = replayLevels(indicators(days));
  let kritikEntries = 0;
  levels.forEach((level, i) => { if (i && level === 2 && levels.at(i - 1) < 2) kritikEntries += 1; });
  assert.equal(kritikEntries, 6);
  // Days of uninterrupted Kritik before occupancy first fell below 25 %.
  const leads = [];
  days.forEach((day, i) => {
    const before = days.at(i - 30)?.occ, prev = days.at(i - 1)?.occ;
    if (i >= 30 && day.occ !== null && day.occ < 25 && !(prev !== null && prev < 25) && before > 25) {
      let j = i; while (j > 0 && levels.at(j - 1) === 2) j -= 1;
      leads.push(levels.at(i) === 2 ? i - j : -1);
    }
  });
  assert.deepEqual(leads, [42, 47, 168, 67, 302]);
});

test('current mode: today is Normal, stale data is flagged, an İSKİ notice overrides', () => {
  const mode = currentMode(history, { now: new Date('2026-10-30T12:00:00Z') });
  assert.equal(mode.level, 'normal');
  assert.equal(mode.measuredOn, '2026-10-30');
  assert.equal(mode.since, '2026-10-24'); // not carried across the 2024–2026 gap
  assert.equal(mode.stale, false);
  assert.ok(mode.indicators.normal > 40 && mode.indicators.normal < 55);
  assert.equal(mode.indicators.pace28, null); // trend still collecting readings
  assert.equal(currentMode(history, { now: new Date('2026-11-05T12:00:00Z') }).stale, true);
  const acil = currentMode(history, { now: new Date('2026-10-30T12:00:00Z'), official: { active: true, note: 'Planlı kesinti' } });
  assert.equal(acil.level, 'acil');
  assert.equal(acil.computedLevel, 'normal');
});

test('critical mode travels through live.json and survives a failed run', () => {
  const mode = currentMode(history, { now: new Date('2026-10-30T12:00:00Z') });
  const first = buildLiveFile({ reservoir: null, weather: null, criticalMode: mode });
  assert.equal(readLiveFile(JSON.parse(JSON.stringify(first))).criticalMode.level, 'normal');
  const second = buildLiveFile({ reservoir: null, weather: null, previous: first });
  assert.deepEqual(second.criticalMode, first.criticalMode);
  assert.equal(readLiveFile({ version: 1, criticalMode: { level: 'panik', measuredOn: '2026-10-30' } }).criticalMode, null);
});

test('the live history file is well formed', () => {
  assert.equal(liveHistory.start, history.start);
  assert.ok(liveHistory.values.length >= history.values.length);
  // The calibrated past never changes as new readings are appended.
  assert.deepEqual(liveHistory.values.slice(0, 8520), history.values.slice(0, 8520));
  assert.ok(liveHistory.values.every(v => v === null || (typeof v === 'number' && v >= 0 && v <= 100)));
});

test('the reservoir page yields every dated reading for the history', () => {
  const page = parseDolulukPage(readFileSync(new URL('./fixtures/dolulukorani-istanbul.html', import.meta.url), 'utf8'));
  assert.deepEqual(page.readings.at(-1), { date: '2026-10-29', value: 53.6 });
  assert.ok(page.readings.length >= page.trend.length);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { SEASONAL_INDEX, billEnd, billSeasonFactor, billMonthName, litresPerPersonDay, sameTimeLastYear, billInsights } from '../bill-insights.mjs';
import { normalizeHousehold, isHousehold } from '../task-catalog.mjs';

const bill = (total, days, period, lastRead) => ({ total, days, period, ...(lastRead ? { readings: { last: { date: lastRead } } } : {}) });

test('seasonal index is the 2011–2023 shape: low in winter, high in summer, mean near 100', () => {
  assert.equal(SEASONAL_INDEX.length, 12);
  const mean = SEASONAL_INDEX.reduce((a, b) => a + b, 0) / 12;
  assert.ok(Math.abs(mean - 100) < 0.5);
  assert.ok(SEASONAL_INDEX.at(1) < 95 && SEASONAL_INDEX.at(7) > 107);
});

test('a bill ends on its last meter reading, else mid-period; no period means no seasonal factor', () => {
  assert.equal(new Date(billEnd(bill(10, 30, '202607', '2026-07-03'))).toISOString().slice(0, 10), '2026-07-03');
  assert.equal(new Date(billEnd(bill(10, 30, '202607'))).toISOString().slice(0, 10), '2026-07-15');
  assert.equal(billSeasonFactor(bill(10, 30, '')), null);
  assert.equal(billMonthName(bill(10, 30, '202608')), 'ağustos 2026');
  assert.equal(billMonthName({ total: 10, days: 30, period: '', readings: { last: { date: '2026-08-03' } } }), 'temmuz 2026');
});

test('the season factor follows the days the bill covers', () => {
  // 30 days ending 15 July: half June, half July.
  const f = billSeasonFactor(bill(10, 30, '202607'));
  assert.ok(f > SEASONAL_INDEX.at(5) && f < SEASONAL_INDEX.at(6));
});

test('litres per person per day', () => {
  assert.equal(litresPerPersonDay(bill(9, 30, '202610'), 3), 100);
  assert.equal(litresPerPersonDay(bill(9, 30, '202610'), null), null);
  assert.equal(litresPerPersonDay(bill(9, 30, '202610'), 0), null);
});

test('flat use from May to July is a real saving once the season is taken into account', () => {
  const r = billInsights({ previous: bill(12, 30, '202605'), current: bill(12, 30, '202607'), people: 3 });
  assert.equal(r.seasonal.actual, 0);
  assert.ok(r.seasonal.expected > 0.05);
  assert.ok(r.seasonal.adjusted < -0.05);
  assert.match(r.lines.join(' '), /kişi başı günde yaklaşık 133 litre/);
  assert.match(r.lines.join(' '), /normalde %\d+,\d artar.*daha az kullanmışsın/);
  assert.deepEqual(r.needs, []);
});

test('a drop from September to November is mostly the season', () => {
  const r = billInsights({ previous: bill(12, 30, '202609'), current: bill(11.2, 30, '202611') });
  assert.ok(r.seasonal.actual < -0.05);
  assert.ok(Math.abs(r.seasonal.adjusted) < 0.03);
  assert.deepEqual(r.needs, ['people']);
});

test('missing periods ask for them instead of guessing the season', () => {
  const r = billInsights({ previous: bill(12, 30, ''), current: bill(11, 30, ''), people: 2 });
  assert.equal(r.seasonal, null);
  assert.deepEqual(r.needs, ['period']);
});

test('the bill closest to a year earlier is used for a same-season comparison', () => {
  const current = bill(10, 30, '202608');
  const history = [current, bill(11, 30, '202607'), bill(12, 30, '202508'), bill(13, 30, '202502')];
  assert.equal(sameTimeLastYear(history, current).period, '202508');
  const r = billInsights({ previous: history[1], current, people: 2, history });
  assert.match(r.lines.join(' '), /Geçen yılın aynı dönemine \(ağustos 2025\) göre günlük tüketimin %16,7 daha az/);
});

test('a previous bill from a year earlier gives one same-season sentence, not two', () => {
  const previous = bill(12, 30, '202509');
  const current = bill(11, 31, '202610');
  const r = billInsights({ previous, current, people: 3, history: [current, previous] });
  assert.equal(r.lines.length, 2);
  assert.match(r.lines.at(1), /^Önceki faturan yaklaşık bir yıl önceye \(eylül 2025\) ait/);
  assert.ok(!r.lines.some(line => /Geçen yılın aynı dönemine/.test(line)));
});

test('household size is stored as a whole number from 1 to 12', () => {
  assert.equal(normalizeHousehold({ people: 4 }).people, 4);
  assert.equal(normalizeHousehold({ people: 0 }).people, null);
  assert.equal(normalizeHousehold({}).people, null);
  assert.equal(isHousehold({ people: 2.5 }), false);
  assert.equal(isHousehold({ people: 3, answers: {}, oneTime: {} }), true);
});

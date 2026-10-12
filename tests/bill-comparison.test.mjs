import test from 'node:test';
import assert from 'node:assert/strict';
import { sortedBillHistory, resolveBillPair, calculateBillChange } from '../bill-comparison.mjs';

const bill = (total, days = 30, period = '') => ({ total, days, period });
const draft = (total, days = 30, period = '') => ({ ...bill(total, days, period), hasInput: true, totalEntered: true, daysEntered: true });
const empty = { total: 0, days: 0, period: '', hasInput: false };
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('empty fields select the two saved records', () => {
  const pair = resolveBillPair([bill(10), bill(12)], empty);
  assert.equal(pair.source, 'history');
  assert.equal(pair.previous.total, 12);
  assert.equal(pair.current.total, 10);
  const result = calculateBillChange(pair.previous, pair.current);
  near(result.reduction, 100 / 6);
  assert.equal(result.discount, 20);
});
test('new draft compares with saved previous record', () => {
  const pair = resolveBillPair([bill(12, 30, '202609')], draft(10, 30, '202610'));
  assert.equal(pair.source, 'draft');
  assert.equal(pair.previous.total, 12);
});
test('screenshot records are ordered by period, not upload time', () => {
  const pair = resolveBillPair([bill(11, 25, '202402'), bill(12, 30, '202509')], empty);
  assert.equal(pair.previous.period, '202402');
  assert.equal(pair.current.period, '202509');
  const result = calculateBillChange(pair.previous, pair.current);
  near(result.previousMonthly, 13.2);
  near(result.currentMonthly, 12);
  near(result.reduction, 100 / 11);
  assert.equal(result.discount, 10);
});
test('11 m³ over 25 days is an increase vs 12 m³ over 30 days', () => {
  const result = calculateBillChange(bill(12), bill(11, 25));
  near(result.change, 10);
  assert.equal(result.eligible, false);
});
test('unequal periods normalize fairly', () => {
  const result = calculateBillChange(bill(12, 30), bill(11, 33));
  near(result.currentMonthly, 10);
  assert.equal(result.discount, 20);
});
test('5% boundary unlocks small coupon despite floating point rounding', () => {
  assert.equal(calculateBillChange(bill(10), bill(9.5)).discount, 10);
});
test('10% boundary unlocks large coupon', () => {
  assert.equal(calculateBillChange(bill(10), bill(9)).discount, 20);
});
test('below 5%, unchanged, and increases do not unlock coupons', () => {
  for (const total of [9.6, 10, 11]) assert.equal(calculateBillChange(bill(10), bill(total)).eligible, false);
});
test('no records and one record return visible messages', () => {
  assert.match(resolveBillPair([], empty).error, /Henüz/);
  assert.match(resolveBillPair([bill(12)], empty).error, /Bir kayıt/);
});
test('partial draft does not silently fall back to saved history', () => {
  assert.match(resolveBillPair([bill(10), bill(12)], { ...draft(8), days: 0, daysEntered: false }).error, /tamamla/);
});
test('same saved bill in input never compares with itself', () => {
  const pair = resolveBillPair([bill(10, 30, '202610'), bill(12, 30, '202609')], draft(10, 30, '202610'));
  assert.equal(pair.previous.total, 12);
});
test('older uploads only compare against an earlier period', () => {
  assert.match(resolveBillPair([bill(12, 30, '202609')], draft(11, 25, '202402')).error, /daha eski/);
});
test('invalid period, fractional days, and zero baseline are rejected', () => {
  assert.match(resolveBillPair([bill(12)], draft(10, 30, '202613')).error, /Dönemi/);
  assert.match(resolveBillPair([bill(12)], draft(10, 30.5)).error, /tam sayı/);
  assert.match(resolveBillPair([bill(10), bill(0)], empty).error, /sıfır/);
});
test('malformed storage is safely ignored', () => {
  assert.deepEqual(sortedBillHistory(null), []);
  assert.deepEqual(sortedBillHistory([bill(Infinity), bill(10, 0), bill(-2), bill(12)]), [bill(12)]);
});
test('same period records require distinct billing periods', () => {
  assert.match(resolveBillPair([bill(10, 30, '202610'), bill(12, 30, '202610')], empty).error, /aynı döneme/);
});

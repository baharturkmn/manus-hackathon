import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_BILLS, newBillId, billKey, addBill, findBill, removeBill, withoutImage } from '../bill-records.mjs';

const bill = (total, period, extra = {}) => ({ id: `b${total}${period}`, total, days: 30, period, savedAt: '2026-10-31T10:00:00Z', ...extra });

test('ids are unique and safe as Firestore document ids', () => {
  const ids = new Set(Array.from({ length: 200 }, newBillId));
  assert.equal(ids.size, 200);
  for (const id of ids) assert.match(id, /^[A-Za-z0-9]{8,20}$/);
});

test('records saved before ids existed still get a stable key', () => {
  const old = { total: 12, days: 30, period: '202509', savedAt: '2026-09-01T00:00:00Z' };
  assert.equal(billKey(old), '2026-09-01T00:00:00Z|12|30|202509');
  assert.equal(findBill([old], billKey(old)), old);
});

test('new bills go first, duplicates are ignored, the oldest beyond the limit are returned for photo cleanup', () => {
  let history = [];
  for (let i = 1; i <= MAX_BILLS; i += 1) history = addBill(history, bill(i, `2025${String(i).padStart(2, '0')}`)).history;
  assert.equal(history.length, MAX_BILLS);
  assert.equal(addBill(history, bill(5, '202505')).history, history); // same numbers and period
  const { history: next, dropped } = addBill(history, bill(99, '202701', { hasImage: true }));
  assert.equal(next[0].total, 99);
  assert.equal(next.length, MAX_BILLS);
  assert.deepEqual(dropped.map(b => b.total), [1]);
});

test('a bill and its photo flag can be removed by key', () => {
  const history = [bill(8, '202002', { hasImage: true }), bill(12, '202509')];
  assert.equal(removeBill(history, 'b8202002').length, 1);
  const stripped = withoutImage(history, 'b8202002');
  assert.equal('hasImage' in stripped[0], false);
  assert.equal(stripped[0].total, 8);
  assert.equal(stripped[1], history[1]);
});

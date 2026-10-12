import test from 'node:test';
import assert from 'node:assert/strict';
import { milestoneReached, recommendHabitPartner } from '../habit-rewards.mjs';

test('milestone opens at exactly five and remains at eight', () => {
  assert.equal(milestoneReached(['a','b','c','d']), false);
  assert.equal(milestoneReached(['a','b','c','d','e']), true);
  assert.equal(milestoneReached(['a','b','c','d','e','f','g','h']), true);
  assert.equal(milestoneReached(['a','a','b','c','d']), false);
});
test('laundry progress recommends CleanCycle, not the old default', () => {
  assert.equal(recommendHabitPartner(['laundry']).codePrefix, 'CLEANCYCLE');
});
test('most reported shower tasks recommend PureWave', () => {
  assert.equal(recommendHabitPartner(['laundry','shower','shower-cold']).codePrefix, 'PUREWAVE');
});
test('dishwashing progress recommends SparkleWash', () => {
  assert.equal(recommendHabitPartner(['dishwasher','greywater']).codePrefix, 'SPARKLEWASH');
});
test('no-category fallback rotates deterministically across three fictional brands', () => {
  const results = ['a','b','c'].map(seed=>recommendHabitPartner([],seed));
  assert.equal(new Set(results.map(x=>x.codePrefix)).size, 3);
  assert.equal(results[0].hasHabitSignal, false);
  assert.deepEqual(recommendHabitPartner(['shower'],'a'),recommendHabitPartner(['shower'],'a'));
});

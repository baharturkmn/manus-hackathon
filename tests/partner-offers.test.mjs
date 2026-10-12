import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getPartnerOffer, discountForReduction } from '../partner-offers.mjs';
import { calculateBillChange } from '../bill-comparison.mjs';

const partners = ['BRIGHTSMILE', 'PUREWAVE', 'CLEANCYCLE', 'SPARKLEWASH'].map(codePrefix => ({ codePrefix }));

test('each brand has a distinct discount within the same consumption tier', () => {
  const reward = calculateBillChange({ total: 13.2, days: 30 }, { total: 12, days: 30 });
  const offers = partners.map(partner => getPartnerOffer(partner, reward));
  assert.deepEqual(offers.map(offer => offer.discount), [10, 12, 15, 8]);
  assert.equal(offers[0].code, 'SAVE9-BRIGHTSMILE');
  assert.equal(offers[1].code, 'SAVE9-PUREWAVE');
});
test('larger actual reduction raises the personal discount', () => {
  const reward = calculateBillChange({ total: 12, days: 30 }, { total: 10, days: 30 });
  assert.deepEqual(partners.map(partner => getPartnerOffer(partner, reward).discount), [20, 22, 25, 18]);
  assert.equal(getPartnerOffer(partners[0], reward).code, 'SAVE17-BRIGHTSMILE');
});
test('monthly normalization is used, not raw bill total', () => {
  const reward = calculateBillChange({ total: 12, days: 30 }, { total: 11, days: 25 });
  assert.equal(getPartnerOffer(partners[0], reward), null);
});
test('reduction boundaries are stable', () => {
  assert.equal(discountForReduction(4.99), 0);
  assert.equal(discountForReduction(5), 10);
  assert.equal(discountForReduction(9.99), 10);
  assert.equal(discountForReduction(10), 20);
  assert.equal(discountForReduction(50), 20);
});
test('unverified and invalid savings never create a coupon', () => {
  for (const reward of [null, { eligible: false, reduction: 20 }, { eligible: true, reduction: 4.9 }, { eligible: true, reduction: NaN }]) {
    assert.equal(getPartnerOffer(partners[0], reward), null);
  }
});
test('product render function has no coupon, copy button or offer timers', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  const renderer = source.slice(source.indexOf('function renderPartners('), source.indexOf('function wireCopyButtons('));
  assert.ok(!renderer.includes('data-coupon-prefix'));
  assert.ok(!renderer.includes('couponCopyMarkup'));
  assert.ok(renderer.includes('product-concept-note'));
  assert.ok(!source.includes('OFFER_REVEAL_DELAYS'));
  assert.ok(source.includes('data-reward-toggle aria-expanded="false"'));
  assert.ok(source.includes('id="personal-reward-panel" hidden'));
});

test('brand changes do not bypass the savings threshold and unknown brands fail closed', () => {
  for (const partner of partners) {
    assert.equal(discountForReduction(4.99, partner.codePrefix), 0);
    assert.ok(discountForReduction(10, partner.codePrefix) > discountForReduction(5, partner.codePrefix));
  }
  assert.equal(getPartnerOffer({ codePrefix: 'UNKNOWN' }, { eligible: true, reduction: 20 }), null);
});

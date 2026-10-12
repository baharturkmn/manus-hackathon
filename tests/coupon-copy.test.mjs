import test from 'node:test';
import assert from 'node:assert/strict';
import { couponCopyMarkup, copyCouponCode } from '../coupon-copy.mjs';

function fallbackDocument(copyResult = true) {
  const state = { removed: false, focusRestored: false, value: '', command: '' };
  const field = { style: {}, focus() {}, select() {}, setSelectionRange() {}, remove() { state.removed = true; } };
  return {
    state,
    document: {
      activeElement: { focus() { state.focusRestored = true; } },
      createElement(tag) { assert.equal(tag, 'textarea'); return field; },
      body: { appendChild(element) { state.value = element.value; } },
      execCommand(command) { state.command = command; return copyResult; }
    }
  };
}

test('copy control displays the exact savings-based code with accessible action', () => {
  const html = couponCopyMarkup('SAVE9-BRIGHTSMILE');
  assert.ok(html.includes('<code>SAVE9-BRIGHTSMILE</code>'));
  assert.ok(html.includes('data-copy-coupon="SAVE9-BRIGHTSMILE"'));
  assert.ok(html.includes('aria-label="SAVE9-BRIGHTSMILE kupon kodunu kopyala"'));
  assert.ok(html.includes('role="status"'));
});
test('invalid markup cannot be injected into a copy control', () => {
  assert.throws(() => couponCopyMarkup('<script>'), /Geçersiz/);
});
test('Clipboard API receives only the coupon code', async () => {
  let copied;
  await copyCouponCode('SAVE9-BRIGHTSMILE', { navigator: { clipboard: { async writeText(value) { copied = value; } } } });
  assert.equal(copied, 'SAVE9-BRIGHTSMILE');
});
test('denied Clipboard API falls back and restores focus', async () => {
  const fallback = fallbackDocument();
  await copyCouponCode('SAVE9-PUREWAVE', { navigator: { clipboard: { async writeText() { throw new Error('Permission denied'); } } }, document: fallback.document });
  assert.equal(fallback.state.value, 'SAVE9-PUREWAVE');
  assert.equal(fallback.state.command, 'copy');
  assert.ok(fallback.state.removed && fallback.state.focusRestored);
});
test('browsers without Clipboard API use the fallback', async () => {
  const fallback = fallbackDocument();
  await copyCouponCode('SAVE17-CLEANCYCLE', { navigator: {}, document: fallback.document });
  assert.equal(fallback.state.value, 'SAVE17-CLEANCYCLE');
});
test('blocked fallback fails honestly instead of reporting copied', async () => {
  const fallback = fallbackDocument(false);
  await assert.rejects(copyCouponCode('SAVE9-SPARKLEWASH', { navigator: {}, document: fallback.document }), /Panoya/);
  assert.ok(fallback.state.removed && fallback.state.focusRestored);
});

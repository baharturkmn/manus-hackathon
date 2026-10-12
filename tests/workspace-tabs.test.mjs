import test from 'node:test';
import assert from 'node:assert/strict';
import { TAB_HASHES, tabForHash, initializeWorkspaceTabs } from '../workspace-tabs.mjs';

function setup(hash = '') {
  const make = id => ({ id, hidden: true, tabIndex: -1, attrs: {}, events: {}, dataset: {},
    setAttribute(k, v) { this.attrs[k] = v; },
    addEventListener(k, fn) { this.events[k] = fn; },
    focus() { this.focused = true; }, scrollIntoView() { this.scrolled = true; } });
  const tabs = Object.keys(TAB_HASHES).map(name => Object.assign(make(`tab-${name}`), { dataset: { tab: name } }));
  const panels = Object.keys(TAB_HASHES).map(name => make(`panel-${name}`));
  const nav = make('workspace-nav');
  const previous = Object.fromEntries(['document', 'window', 'location', 'history'].map(k => [k, globalThis[k]]));
  const windowEvents = {}; const docEvents = {};
  globalThis.location = { hash };
  globalThis.history = { pushState(a, b, url) { globalThis.location.hash = url; } };
  globalThis.window = { addEventListener(k, fn) { windowEvents[k] = fn; } };
  globalThis.document = {
    querySelectorAll(selector) { return selector === '[data-tab]' ? tabs : panels; },
    getElementById(id) { return id === nav.id ? nav : null; },
    addEventListener(k, fn) { docEvents[k] = fn; }
  };
  initializeWorkspaceTabs();
  return { tabs, panels, nav, windowEvents, docEvents, restore() {
    Object.entries(previous).forEach(([k, v]) => v === undefined ? delete globalThis[k] : globalThis[k] = v);
  }};
}
function checkActive(state, name) {
  assert.deepEqual(state.panels.filter(p => !p.hidden).map(p => p.id), [`panel-${name}`]);
  assert.deepEqual(state.tabs.filter(t => t.attrs['aria-selected'] === 'true').map(t => t.id), [`tab-${name}`]);
  assert.deepEqual(state.tabs.filter(t => t.tabIndex === 0).map(t => t.id), [`tab-${name}`]);
}
test('known hashes resolve to the matching tab and unknown hashes default to today', () => {
  assert.equal(tabForHash('#fatura'), 'bills');
  assert.equal(tabForHash('#gorevler'), 'tasks');
  assert.equal(tabForHash('#urunler'), 'products');
  assert.equal(tabForHash('unknown'), 'today');
});
test('default shows only today and does not change the initial URL', () => {
  const s = setup(); try { checkActive(s, 'today'); assert.equal(location.hash, ''); } finally { s.restore(); }
});
test('bill deep link opens bills on initial load', () => {
  const s = setup('#fatura'); try { checkActive(s, 'bills'); assert.ok(s.nav.scrolled); } finally { s.restore(); }
});
test('clicking a tab changes one visible panel and updates the URL', () => {
  const s = setup(); try { s.tabs[3].events.click(); checkActive(s, 'products'); assert.equal(location.hash, '#urunler'); } finally { s.restore(); }
});
test('arrow keys wrap and Home/End select endpoints with keyboard focus', () => {
  const s = setup(); try {
    const key = (i, name) => s.tabs[i].events.keydown({ key: name, preventDefault() {} });
    key(0, 'ArrowLeft'); checkActive(s, 'about'); assert.ok(s.tabs[4].focused);
    key(4, 'ArrowRight'); checkActive(s, 'today');
    key(0, 'End'); checkActive(s, 'about');
    key(4, 'Home'); checkActive(s, 'today');
  } finally { s.restore(); }
});
test('browser history and hash changes reopen the correct panel', () => {
  const s = setup(); try {
    location.hash = '#fatura'; s.windowEvents.popstate(); checkActive(s, 'bills');
    location.hash = '#gorevler'; s.windowEvents.hashchange(); checkActive(s, 'tasks');
  } finally { s.restore(); }
});
test('existing section anchor opens its tab rather than leaving it hidden', () => {
  const s = setup('#fatura'); try {
    const link = { getAttribute() { return '#bugun'; } };
    s.docEvents.click({ target: { closest() { return link; } }, preventDefault() {} });
    checkActive(s, 'today'); assert.equal(location.hash, '#bugun');
  } finally { s.restore(); }
});

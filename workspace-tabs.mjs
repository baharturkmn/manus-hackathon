export const TAB_HASHES = { today: 'bugun', tasks: 'gorevler', bills: 'fatura', products: 'urunler', about: 'hakkinda' };

export function tabForHash(hash) {
  const value = String(hash || '').replace(/^#/, '');
  return Object.keys(TAB_HASHES).find(key => TAB_HASHES[key] === value) || 'today';
}

export function initializeWorkspaceTabs() {
  const tabs = [...document.querySelectorAll('[data-tab]')];
  const panels = [...document.querySelectorAll('.workspace-panel')];
  const nav = document.getElementById('workspace-nav');
  function activate(name, { focus = false, scroll = false, updateHash = true } = {}) {
    if (!TAB_HASHES[name]) return;
    tabs.forEach(tab => {
      const selected = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus({ preventScroll: true });
      if (selected && tab.parentElement) {
        const strip = tab.parentElement;
        const bounds = strip.getBoundingClientRect();
        const item = tab.getBoundingClientRect();
        if (item.left < bounds.left) strip.scrollLeft -= bounds.left - item.left;
        else if (item.right > bounds.right) strip.scrollLeft += item.right - bounds.right;
      }
    });
    panels.forEach(panel => { panel.hidden = panel.id !== `panel-${name}`; });
    if (updateHash && location.hash !== `#${TAB_HASHES[name]}`) history.pushState(null, '', `#${TAB_HASHES[name]}`);
    if (scroll) nav.scrollIntoView({ block: 'start', behavior: 'instant' });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab.dataset.tab, { scroll: true }));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      activate(tabs[next].dataset.tab, { focus: true, scroll: true });
    });
  });
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const hash = link.getAttribute('href');
    const target = document.getElementById(hash.slice(1));
    const panel = target?.closest('.workspace-panel');
    if (!panel && !Object.values(TAB_HASHES).includes(hash.slice(1))) return;
    event.preventDefault();
    activate(panel ? panel.id.replace('panel-', '') : tabForHash(hash), { scroll: true });
  });
  window.addEventListener('hashchange', () => activate(tabForHash(location.hash), { updateHash: false, scroll: true }));
  window.addEventListener('popstate', () => activate(tabForHash(location.hash), { updateHash: false, scroll: true }));
  activate(tabForHash(location.hash), { updateHash: false, scroll: Boolean(location.hash) });
}

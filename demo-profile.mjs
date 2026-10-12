// A local demonstration persona, NOT authentication, authorization or a secure account.
export const DEMO_PROFILE_KEY = 'sunobeti-demo-profile-v1';
export const DEFAULT_DEMO_NAME = 'Deniz Yılmaz';

export function makeDemoProfile(name = DEFAULT_DEMO_NAME) {
  const normalized = String(name).trim().replace(/\s+/g, ' ');
  if (normalized.length < 2 || normalized.length > 40 || /[<>\u0000-\u001f]/.test(normalized)) {
    throw new Error('Adını 2–40 karakterle yazabilirsin.');
  }
  return { name: normalized, kind: 'demo' };
}

export function loadDemoProfile(storage) {
  try {
    const value = JSON.parse(storage.getItem(DEMO_PROFILE_KEY));
    return value?.kind === 'demo' && typeof value.name === 'string' ? makeDemoProfile(value.name) : null;
  } catch { return null; }
}

export function saveDemoProfile(storage, name) {
  const profile = makeDemoProfile(name);
  storage.setItem(DEMO_PROFILE_KEY, JSON.stringify(profile));
  return profile;
}

export function signOutDemoProfile(storage) {
  storage.removeItem(DEMO_PROFILE_KEY);
}

export function initializeDemoProfile() {
  const dialog = document.getElementById('demo-profile-dialog');
  const trigger = document.getElementById('demo-profile-trigger');
  const triggerName = document.getElementById('demo-profile-trigger-name');
  const avatar = document.getElementById('demo-profile-avatar');
  const form = document.getElementById('demo-profile-form');
  const signedIn = document.getElementById('demo-profile-signed-in');
  const nameInput = document.getElementById('demo-profile-name');
  const error = document.getElementById('demo-profile-error');
  const title = document.getElementById('demo-profile-title');
  const status = document.getElementById('demo-profile-status');
  let profile = null;
  try { profile = loadDemoProfile(localStorage); } catch { /* Storage may be blocked. */ }
  let noticeTimer;
  function announce(message) {
    clearTimeout(noticeTimer);
    status.textContent = message;
    noticeTimer = setTimeout(() => { status.textContent = ''; }, 5000);
  }

  function render() {
    triggerName.textContent = profile ? profile.name : 'Demo giriş';
    trigger.setAttribute('aria-label', profile ? `${profile.name} demo profilini aç` : 'Örnek kullanıcı girişi');
    avatar.textContent = profile ? profile.name.split(' ').map(part => part[0]).slice(0, 2).join('').toLocaleUpperCase('tr') : 'D';
    trigger.dataset.signedIn = String(Boolean(profile));
    title.textContent = profile ? 'Su nöbetin, tek yerde.' : 'Su nöbetine katıl.';
    form.hidden = Boolean(profile);
    signedIn.hidden = !profile;
    error.hidden = true;
    document.getElementById('demo-profile-display-name').textContent = profile?.name || '';
    document.getElementById('demo-profile-task-count').textContent = `${document.getElementById('task-count').textContent}/8 görev`;
    document.getElementById('demo-profile-bill-count').textContent = document.getElementById('bill-history-count').textContent;
  }

  function open() {
    render();
    nameInput.value = DEFAULT_DEMO_NAME;
    dialog.showModal();
    if (!profile) nameInput.focus();
  }
  trigger.addEventListener('click', open);
  document.getElementById('demo-profile-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    try {
      profile = saveDemoProfile(localStorage, nameInput.value);
      render();
      announce(`${profile.name} demo profili açıldı. Gerçek hesap doğrulaması yapılmadı.`);
      document.getElementById('demo-profile-bills').focus();
    } catch (failure) {
      error.hidden = false;
      error.textContent = failure.message === 'Adını 2–40 karakterle yazabilirsin.'
        ? failure.message : 'Tarayıcı hafızasına erişilemedi. Demo giriş şu an kaydedilemiyor.';
    }
  });
  document.getElementById('demo-profile-logout').addEventListener('click', () => {
    try {
      signOutDemoProfile(localStorage);
      profile = null;
      render();
      announce('Demo profilden çıkış yapıldı. Faturalar ve görevler bu tarayıcıda korunuyor.');
      dialog.close();
    } catch {
      announce('Tarayıcı hafızasına erişilemedi; çıkış tamamlanamadı.');
    }
  });
  document.getElementById('demo-profile-bills').addEventListener('click', () => {
    dialog.close();
    document.getElementById('tab-bills').click();
  });
  render();
}

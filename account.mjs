// Real accounts: Firebase Authentication (e-mail/password, Google) and one
// Firestore document per user at users/{uid}, readable and writable only by
// that user (firestore.rules). Firebase is loaded only when firebase-config.mjs
// is filled in; otherwise visitors stay in guest mode with browser storage.
import { firebaseConfig, firebaseEmulatorHost } from './firebase-config.mjs';
import { createLocalBackend, hasUserData, USER_DATA_FIELDS } from './user-store.mjs';

const RECENT_LOGIN_MS = 5 * 60 * 1000;

export function accountsConfigured(config = firebaseConfig) {
  return Boolean(config?.apiKey && config?.projectId && config?.appId && config?.authDomain);
}

const AUTH_ERRORS = {
  'auth/invalid-email': 'E-posta adresini kontrol et.',
  'auth/missing-password': 'Şifreni yaz.',
  'auth/invalid-credential': 'E-posta veya şifre hatalı.',
  'auth/wrong-password': 'E-posta veya şifre hatalı.',
  'auth/user-not-found': 'E-posta veya şifre hatalı.',
  'auth/email-already-in-use': 'Bu e-posta ile zaten bir hesap var. Giriş yapmayı dene.',
  'auth/weak-password': 'Şifre en az 6 karakter olmalı.',
  'auth/too-many-requests': 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.',
  'auth/network-request-failed': 'Bağlantı kurulamadı. İnternetini kontrol et.',
  'auth/popup-closed-by-user': 'Google penceresi kapatıldı.',
  'auth/popup-blocked': 'Tarayıcı Google penceresini engelledi. Açılır pencerelere izin ver.',
  'auth/requires-recent-login': 'Güvenlik için tekrar giriş yapıp sonra yeniden dene.',
  'auth/unauthorized-domain': 'Bu site adresi Firebase’de yetkili alan olarak eklenmemiş.',
  'auth/operation-not-allowed': 'Bu giriş yöntemi Firebase’de açılmamış.',
  'permission-denied': 'Kayıtlara erişim izni yok. Oturumu kapatıp yeniden gir.',
  unavailable: 'Sunucuya ulaşılamadı; değişikliklerin bağlantı gelince kaydedilecek.'
};

export function authErrorMessage(error) {
  return AUTH_ERRORS[error?.code] || 'Bir sorun oluştu. Lütfen tekrar dene.';
}

export function initials(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).map(part => part[0]).slice(0, 2).join('').toLocaleUpperCase('tr') || '?';
}

function createFirestoreBackend({ fs, db, uid, onError }) {
  const ref = fs.doc(db, 'users', uid);
  const imageRef = id => fs.doc(db, 'users', uid, 'billImages', id);
  let pending = {};
  let timer = null;
  const backend = {
    kind: 'account',
    existed: false,
    async load() {
      const snapshot = await fs.getDoc(ref);
      backend.existed = snapshot.exists();
      return backend.existed ? snapshot.data() : {};
    },
    save(field, value) {
      pending[field] = value === undefined ? fs.deleteField() : value;
      clearTimeout(timer);
      timer = setTimeout(backend.flush, 400);
    },
    async flush() {
      clearTimeout(timer);
      if (!Object.keys(pending).length) return;
      const patch = pending;
      pending = {};
      try {
        await fs.setDoc(ref, { ...patch, updatedAt: fs.serverTimestamp() }, { merge: true });
      } catch (error) {
        onError(error);
      }
    },
    // Bill photos the user chose to keep, one document per bill.
    images: {
      async save(id, image) {
        await fs.setDoc(imageRef(id), { ...image, createdAt: fs.serverTimestamp() });
      },
      async load(id) {
        const snapshot = await fs.getDoc(imageRef(id));
        return snapshot.exists() ? snapshot.data() : null;
      },
      async remove(id) {
        await fs.deleteDoc(imageRef(id));
      },
      async removeAll() {
        const snapshot = await fs.getDocs(fs.collection(db, 'users', uid, 'billImages'));
        await Promise.all(snapshot.docs.map(item => fs.deleteDoc(item.ref)));
      }
    },
    async remove() {
      clearTimeout(timer);
      pending = {};
      // Firestore does not delete sub-collections with their parent.
      await backend.images.removeAll();
      await fs.deleteDoc(ref);
    }
  };
  return backend;
}

// Wires the account dialog. `store` is the user store from user-store.mjs;
// `onDataChanged` re-renders tasks and bills after the active user changes;
// `onSwitching(true|false)` brackets the load so the page can block edits that
// the incoming account data would otherwise overwrite.
export async function initializeAccount({ store, storage, onDataChanged, onSwitching = () => {} }) {
  const $ = id => document.getElementById(id);
  const dialog = $('account-dialog');
  const trigger = $('account-trigger');
  const status = $('account-status');
  const views = { setup: $('account-setup'), signedOut: $('account-signed-out'), signedIn: $('account-signed-in') };
  const error = $('account-error');
  const guestBackend = createLocalBackend(storage);
  let user = null;
  let accountBackend = null;
  let mode = 'signin';
  let noticeTimer;

  // Notices that arrive together (e.g. "account created" and "guest records
  // moved") are shown side by side instead of replacing each other.
  function announce(message) {
    clearTimeout(noticeTimer);
    status.textContent = status.textContent && !status.textContent.includes(message) ? `${status.textContent} ${message}` : message;
    noticeTimer = setTimeout(() => { status.textContent = ''; }, 6000);
  }
  function showError(failure) {
    error.hidden = false;
    error.textContent = typeof failure === 'string' ? failure : authErrorMessage(failure);
  }
  function setBusy(busy) {
    dialog.querySelectorAll('button, input').forEach(element => { if (element.id !== 'account-close') element.disabled = busy; });
  }
  function displayName() {
    return user?.displayName || user?.email?.split('@')[0] || '';
  }
  function render() {
    const configured = accountsConfigured();
    $('account-trigger-name').textContent = user ? displayName() : 'Giriş yap';
    $('account-trigger-kind').textContent = user ? 'HESAP' : 'MİSAFİR';
    $('account-avatar').textContent = user ? initials(displayName()) : '·';
    trigger.dataset.signedIn = String(Boolean(user));
    trigger.setAttribute('aria-label', user ? `${displayName()} hesabını aç` : 'Giriş yap veya hesap oluştur');
    views.setup.hidden = configured;
    views.signedOut.hidden = !configured || Boolean(user);
    views.signedIn.hidden = !user;
    $('account-title').textContent = user ? 'Su nöbetin, hesabında.' : 'Su nöbetine katıl.';
    $('account-mode-signin').setAttribute('aria-pressed', String(mode === 'signin'));
    $('account-mode-signup').setAttribute('aria-pressed', String(mode === 'signup'));
    $('account-name-row').hidden = mode !== 'signup';
    $('account-name').required = mode === 'signup';
    $('account-password').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    $('account-submit').textContent = mode === 'signup' ? 'HESAP OLUŞTUR' : 'GİRİŞ YAP';
    $('account-reset').hidden = mode === 'signup';
    if (user) {
      $('account-display-name').textContent = displayName();
      $('account-email').textContent = user.email || '';
      $('account-task-count').textContent = `${$('task-count').textContent}/${$('task-total')?.textContent || '?'} görev`;
      $('account-bill-count').textContent = $('bill-history-count').textContent;
    }
  }

  trigger.addEventListener('click', () => { error.hidden = true; render(); dialog.showModal(); });
  $('account-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  $('account-bills').addEventListener('click', () => { dialog.close(); $('tab-bills').click(); });
  for (const next of ['signin', 'signup']) {
    $(`account-mode-${next}`).addEventListener('click', () => { mode = next; error.hidden = true; render(); });
  }
  render();
  if (!accountsConfigured()) return;

  const [{ initializeApp }, auth, fs] = await Promise.all([
    import('firebase/app'), import('firebase/auth'), import('firebase/firestore')
  ]);
  const app = initializeApp(firebaseConfig);
  const authInstance = auth.getAuth(app);
  auth.useDeviceLanguage(authInstance);
  const db = fs.getFirestore(app);
  if (firebaseEmulatorHost) {
    auth.connectAuthEmulator(authInstance, `http://${firebaseEmulatorHost}:9099`, { disableWarnings: true });
    fs.connectFirestoreEmulator(db, firebaseEmulatorHost, 8080);
  }

  // Switches the store to the signed-in user's document. On a first sign-in,
  // records made as a guest on this device are moved into the new account.
  async function activate(nextUser) {
    onSwitching(true);
    if (accountBackend) await accountBackend.flush();
    user = nextUser;
    if (!nextUser) {
      accountBackend = null;
      await store.use(guestBackend);
    } else {
      accountBackend = createFirestoreBackend({ fs, db, uid: nextUser.uid, onError: failure => announce(authErrorMessage(failure)) });
      try {
        const guestData = await guestBackend.load();
        const loaded = await store.use(accountBackend);
        if (!accountBackend.existed && hasUserData(guestData)) {
          for (const field of USER_DATA_FIELDS) if (field in guestData) store.set(field, guestData[field]);
          await accountBackend.flush();
          guestBackend.clear();
          announce('Bu cihazdaki misafir kayıtların hesabına taşındı.');
        } else if (!accountBackend.existed && !hasUserData(loaded)) {
          store.set('tasks', {});
          await accountBackend.flush();
        }
      } catch (failure) {
        announce(authErrorMessage(failure));
      }
    }
    onDataChanged();
    onSwitching(false);
    render();
  }
  auth.onAuthStateChanged(authInstance, nextUser => { activate(nextUser); });

  async function run(action, success) {
    error.hidden = true;
    setBusy(true);
    try {
      await action();
      if (success) announce(success);
    } catch (failure) {
      showError(failure);
    } finally {
      setBusy(false);
      render();
    }
  }

  $('account-form').addEventListener('submit', event => {
    event.preventDefault();
    const email = $('account-email-input').value.trim();
    const password = $('account-password').value;
    const name = $('account-name').value.trim().replace(/\s+/g, ' ');
    if (mode === 'signup' && (name.length < 2 || name.length > 40 || /[<>\u0000-\u001f]/.test(name))) {
      showError('Adını 2–40 karakterle yaz.');
      return;
    }
    run(async () => {
      if (mode === 'signup') {
        const credential = await auth.createUserWithEmailAndPassword(authInstance, email, password);
        await auth.updateProfile(credential.user, { displayName: name });
        user = credential.user;
      } else {
        await auth.signInWithEmailAndPassword(authInstance, email, password);
      }
      $('account-password').value = '';
    }, mode === 'signup' ? 'Hesabın oluşturuldu.' : 'Giriş yapıldı.');
  });
  $('account-google').addEventListener('click', () => {
    run(() => auth.signInWithPopup(authInstance, new auth.GoogleAuthProvider()), 'Google ile giriş yapıldı.');
  });
  $('account-reset').addEventListener('click', () => {
    const email = $('account-email-input').value.trim();
    if (!email) { showError('Şifre sıfırlama bağlantısı için önce e-posta adresini yaz.'); return; }
    run(() => auth.sendPasswordResetEmail(authInstance, email), 'Şifre sıfırlama bağlantısı e-postana gönderildi.');
  });
  $('account-logout').addEventListener('click', () => {
    run(async () => {
      if (accountBackend) await accountBackend.flush();
      await auth.signOut(authInstance);
      dialog.close();
    }, 'Çıkış yapıldı. Kayıtların hesabında duruyor.');
  });
  $('account-delete').addEventListener('click', () => {
    if (!window.confirm('Hesabın ve hesabındaki tüm görev, fatura, fatura fotoğrafı ve tasarruf kayıtları kalıcı olarak silinecek. Emin misin?')) return;
    const current = authInstance.currentUser;
    // Firebase refuses to delete accounts after an old sign-in; check first so
    // the data is never deleted while the account itself stays.
    if (Date.now() - Date.parse(current?.metadata?.lastSignInTime || 0) > RECENT_LOGIN_MS) {
      showError('Güvenlik için önce çıkış yapıp yeniden giriş yap, sonra hesabını sil.');
      return;
    }
    run(async () => {
      await accountBackend?.remove();
      accountBackend = null;
      await auth.deleteUser(current);
      dialog.close();
    }, 'Hesabın ve kayıtların silindi.');
  });
}

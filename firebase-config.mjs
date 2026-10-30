// Firebase web app settings (Firebase Console → Project settings → Your apps →
// SDK setup and configuration → Config). Paste each value between the quotes.
// These values are public by design; access is enforced by firestore.rules.
// While apiKey is empty the site runs in guest mode (data stays in the browser).
// VITE_FIREBASE_* environment variables, if set at build time, take precedence.
const env = import.meta.env ?? {};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: env.VITE_FIREBASE_APP_ID || ''
};

// Local development only: host of the Firebase emulators (e.g. 127.0.0.1).
export const firebaseEmulatorHost = env.VITE_FIREBASE_EMULATOR_HOST || '';

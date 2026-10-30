// Firebase web app settings (Firebase Console → Project settings → Your apps →
// SDK setup and configuration → Config). Paste each value between the quotes.
// These values are public by design; access is enforced by firestore.rules.
// Project: manushackathon-da0ff (Firestore location europe-west2).
// With an empty apiKey the site would run in guest mode only.
// VITE_FIREBASE_* environment variables, if set at build time, take precedence.
const env = import.meta.env ?? {};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyCIy0DeH21CPw1B8JoCLMnpjChQy4vBm6w',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'manushackathon-da0ff.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'manushackathon-da0ff',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'manushackathon-da0ff.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '510676318351',
  appId: env.VITE_FIREBASE_APP_ID || '1:510676318351:web:79f1659061fe0575cc98fa'
};

// Local development only: host of the Firebase emulators (e.g. 127.0.0.1).
export const firebaseEmulatorHost = env.VITE_FIREBASE_EMULATOR_HOST || '';

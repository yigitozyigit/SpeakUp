import { auth, db } from './firebase-init.js';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { doc, getDoc, serverTimestamp, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { t } from './i18n/tr.js';

function timezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul'; }
  catch { return 'Europe/Istanbul'; }
}

export async function ensureProfile(user) {
  const ref = doc(db, 'users', user.uid);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    const displayName = (user.displayName || (user.email ? user.email.split('@')[0] : '') || t('server.defaultLearnerName')).slice(0, 120);
    await setDoc(ref, {
      displayName,
      email: user.email || null,
      createdAt: serverTimestamp(),
      timezone: timezone()
    });
    const created = await getDoc(ref);
    return created.data();
  }
  return snapshot.data();
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function currentUser() { return auth.currentUser; }

export async function login(email, password) {
  await setPersistence(auth, browserLocalPersistence);
  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  await ensureProfile(result.user);
  return result.user;
}

export async function register(email, password) {
  await setPersistence(auth, browserLocalPersistence);
  const result = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await ensureProfile(result.user);
  return result.user;
}

export async function loginWithGoogle() {
  await setPersistence(auth, browserLocalPersistence);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  await ensureProfile(result.user);
  return result.user;
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function logout() {
  await signOut(auth);
}

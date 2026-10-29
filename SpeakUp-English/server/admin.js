import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

let cached = null;

export function adminServices() {
  if (cached) return cached;
  let app = getApps()[0];
  if (!app) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('Firebase Admin credentials are not configured.');
    let serviceAccount;
    try { serviceAccount = JSON.parse(raw); }
    catch { throw new Error('Firebase Admin credentials are invalid.'); }
    if (!serviceAccount || !serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error('Firebase Admin credentials are incomplete.');
    }
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    app = initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
  }
  cached = { auth: getAuth(app), db: getFirestore(app), FieldValue };
  return cached;
}

export function resetAdminCacheForTests() { cached = null; }

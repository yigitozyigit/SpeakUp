import { t } from '../js/i18n/tr.js';

export const RATE_LIMITS = Object.freeze({ perMinute: 15, perDay: 300 });

export function checkRateLimit({ minuteCount = 0, dailyCount = 0 }) {
  if (dailyCount >= RATE_LIMITS.perDay) return { allowed: false, reason: 'daily' };
  if (minuteCount >= RATE_LIMITS.perMinute) return { allowed: false, reason: 'minute' };
  return { allowed: true, reason: null };
}

export function rateLimitMessage(reason) {
  return t(reason === 'daily' ? 'server.dailyLimit' : 'server.minuteLimit');
}

export async function consumeRateLimit(db, uid, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  const minute = now.toISOString().slice(11, 16).replace(':', '');
  const user = db.collection('users').doc(uid);
  const dailyRef = user.collection('usage').doc(date);
  const minuteRef = dailyRef.collection('minutes').doc(minute);
  return db.runTransaction(async function (transaction) {
    const dailySnap = await transaction.get(dailyRef);
    const minuteSnap = await transaction.get(minuteRef);
    const dailyCount = Number(dailySnap.exists ? dailySnap.data().requestCount || 0 : 0);
    const minuteCount = Number(minuteSnap.exists ? minuteSnap.data().requestCount || 0 : 0);
    const limit = checkRateLimit({ minuteCount: minuteCount, dailyCount: dailyCount });
    if (!limit.allowed) return limit;
    transaction.set(dailyRef, { requestCount: dailyCount + 1, updatedAt: now }, { merge: true });
    transaction.set(minuteRef, { requestCount: minuteCount + 1, updatedAt: now }, { merge: true });
    return { allowed: true, reason: null };
  });
}

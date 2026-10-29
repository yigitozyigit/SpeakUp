import { adminServices } from '../server/admin.js';
import { sendJson, setCors, verifyBearer } from '../server/http.js';
import { t } from '../js/i18n/tr.js';

export default async function handler(req, res) {
  if (!setCors(req, res, ['DELETE', 'OPTIONS'])) return;
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'DELETE') return sendJson(res, 405, { code: 'method_not_allowed', message: t('server.methodNotAllowed') }, { Allow: 'DELETE, OPTIONS' });
  try {
    const services = adminServices();
    const decoded = await verifyBearer(req, services.auth);
    if (!decoded) return sendJson(res, 401, { code: 'unauthenticated', message: t('server.unauthenticated') });
    const userRef = services.db.collection('users').doc(decoded.uid);
    await services.db.recursiveDelete(userRef);
    try { await services.auth.deleteUser(decoded.uid); }
    catch (error) { if (!error || error.code !== 'auth/user-not-found') throw error; }
    return sendJson(res, 200, { deleted: true });
  } catch {
    return sendJson(res, 500, { code: 'delete_failed', message: t('server.accountDeleteFailed') });
  }
}

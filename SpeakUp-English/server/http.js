import { t } from '../js/i18n/tr.js';

export function setCors(req, res, methods) {
  const configured = String(process.env.ALLOWED_ORIGIN || '').split(',').map(function (value) { return value.trim(); }).filter(Boolean);
  const origin = req.headers && req.headers.origin;
  if (!origin || !configured.includes(origin)) {
    sendJson(res, 403, { code: 'origin_not_allowed', message: t('server.originDenied') });
    return false;
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return true;
}

export function sendJson(res, status, payload, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  Object.entries(extraHeaders).forEach(function (entry) { res.setHeader(entry[0], entry[1]); });
  res.end(JSON.stringify(payload));
}

export function readJsonBody(req, maxBytes = 8192) {
  const contentLength = Number(req.headers && req.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) return { error: t('server.bodyTooLarge') };
  let body = req.body;
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > maxBytes) return { error: t('server.bodyTooLarge') };
    try { body = JSON.parse(body); }
    catch { return { error: t('server.invalidRequest') }; }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: t('server.invalidRequest') };
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > maxBytes) return { error: t('server.bodyTooLarge') };
  return { body: body };
}

export async function verifyBearer(req, auth) {
  const header = req.headers && req.headers.authorization;
  const match = typeof header === 'string' && header.match(/^Bearer ([A-Za-z0-9._~-]+)$/);
  if (!match) return null;
  try { return await auth.verifyIdToken(match[1], true); }
  catch { return null; }
}

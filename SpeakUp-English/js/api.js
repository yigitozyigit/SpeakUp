import { auth } from './firebase-init.js';
import { t } from './i18n/tr.js';

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function post(payload, forceRefresh) {
  const user = auth.currentUser;
  if (!user) throw new ApiError(t('app.authError'), 401, 'unauthenticated');
  const token = await user.getIdToken(forceRefresh);
  const controller = new AbortController();
  const timeout = window.setTimeout(function () { controller.abort(); }, 15000);
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(payload),
      signal: controller.signal,
      credentials: 'omit'
    });
    const data = await response.json().catch(function () { return {}; });
    if (!response.ok) {
      let message = t('app.serviceError');
      if (response.status === 401) message = t('app.authError');
      if (response.status === 429) message = t('app.rateLimitError');
      if (response.status === 429 && data.message) message = data.message;
      if (response.status === 400 && data.message) message = data.message;
      if (response.status === 409 && data.message) message = data.message;
      throw new ApiError(message, response.status, data.code || 'request_failed');
    }
    return data;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function chatRequest(payload) {
  try {
    return await post(payload, false);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && auth.currentUser) {
      return post(payload, true);
    }
    if (error && error.name === 'AbortError') throw new ApiError(t('app.timeoutError'), 0, 'timeout');
    if (error instanceof TypeError) throw new ApiError(t('app.networkError'), 0, 'network');
    throw error;
  }
}

export async function deleteAccountRequest() {
  const user = auth.currentUser;
  if (!user) throw new ApiError(t('app.authError'), 401, 'unauthenticated');
  const token = await user.getIdToken(true);
  const response = await fetch('/api/account', {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token },
    credentials: 'omit'
  });
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) throw new ApiError(t('app.deleteError'), response.status, data.code || 'delete_failed');
  return data;
}

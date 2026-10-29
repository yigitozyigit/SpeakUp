import { adminServices } from '../server/admin.js';
import { rateLimitMessage, consumeRateLimit } from '../server/rate-limit.js';
import { validTimezone } from '../server/date.js';
import { applyModelResult, prepareSession, responseForResume, SessionConflictError } from '../server/learning.js';
import { generateAiResponse } from '../server/gemini.js';
import { readJsonBody, sendJson, setCors, verifyBearer } from '../server/http.js';
import { t } from '../js/i18n/tr.js';

const actions = new Set(['start', 'continue', 'answer']);

export default async function handler(req, res) {
  if (!setCors(req, res, ['POST', 'OPTIONS'])) return;
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
  if (req.method !== 'POST') return sendJson(res, 405, { code: 'method_not_allowed', message: t('server.methodNotAllowed') }, { Allow: 'POST, OPTIONS' });
  const parsed = readJsonBody(req);
  if (parsed.error) return sendJson(res, 400, { code: 'invalid_request', message: parsed.error });
  const body = parsed.body;
  if (!actions.has(body.action)) return sendJson(res, 400, { code: 'invalid_action', message: t('server.invalidAction') });
  if (typeof body.requestId !== 'string' || !/^[A-Za-z0-9-]{8,80}$/.test(body.requestId)) {
    return sendJson(res, 400, { code: 'invalid_request_id', message: t('server.invalidRequestId') });
  }
  if (body.action === 'answer' && (typeof body.message !== 'string' || body.message.trim().length === 0 || body.message.length > 500)) {
    return sendJson(res, 400, { code: 'invalid_message', message: t('server.invalidMessage') });
  }

  try {
    const services = adminServices();
    const decoded = await verifyBearer(req, services.auth);
    if (!decoded) return sendJson(res, 401, { code: 'unauthenticated', message: t('server.unauthenticated') });
    const userRef = services.db.collection('users').doc(decoded.uid);
    const profileSnapshot = await userRef.get();
    if (!profileSnapshot.exists) return sendJson(res, 401, { code: 'profile_missing', message: t('server.profileMissing') });
    const profile = profileSnapshot.data();
    if (!profile.settings) return sendJson(res, 409, { code: 'onboarding_required', message: t('server.onboardingRequired') });
    const timezone = validTimezone(body.timezone) ? body.timezone : (validTimezone(profile.timezone) ? profile.timezone : 'Europe/Istanbul');
    if (profile.timezone !== timezone) await userRef.set({ timezone: timezone }, { merge: true });
    const prepared = await prepareSession({ db: services.db, userRef: userRef, profile: profile, timezone: timezone });
    const state = prepared.state;
    const cached = state.lastRequestId === body.requestId && state.lastResponse ? state.lastResponse : null;
    if (cached) return sendJson(res, 200, cached);

    const resumed = body.action === 'start' ? responseForResume(state, profile, prepared.daily, prepared.settings.dailyGoal) : null;
    if (resumed) return sendJson(res, 200, resumed);
    if (state.done) return sendJson(res, 200, responseForResume(state, profile, prepared.daily, prepared.settings.dailyGoal));

    if (body.action === 'continue' && !['intro', 'examples', 'practice'].includes(state.stage)) {
      return sendJson(res, 409, { code: 'wrong_stage', message: t('server.continueStage') });
    }
    if (body.action === 'answer' && state.stage !== 'awaiting_answer') {
      return sendJson(res, 409, { code: 'wrong_stage', message: t('server.answerStage') });
    }
    const quota = await consumeRateLimit(services.db, decoded.uid);
    if (!quota.allowed) {
      const retryAfter = quota.reason === 'minute' ? '60' : '3600';
      return sendJson(res, 429, { code: 'rate_limited', message: rateLimitMessage(quota.reason) }, { 'Retry-After': retryAfter });
    }

    const word = state.queue[state.index];
    if (!word) return sendJson(res, 503, { code: 'words_unavailable', message: t('server.noWords') });
    const stage = body.action === 'answer' ? 'feedback' : state.stage;
    const context = {
      task: stage,
      word: { word: word.word, pos: word.pos, meaningTr: word.tr },
      studentLevel: prepared.settings.level,
      attemptNumber: body.action === 'answer' ? Number(state.attempts || 0) + 1 : null,
      previousExercise: body.action === 'answer' ? state.practiceExercise : null,
      studentData: body.action === 'answer' ? { answer: body.message.trim() } : null
    };
    let result;
    try { result = await generateAiResponse(stage, prepared.settings.level, context); }
    catch { return sendJson(res, 502, { code: 'ai_unavailable', message: t('server.aiUnavailable') }); }

    try {
      const response = await applyModelResult({
        db: services.db,
        userRef: userRef,
        sessionRef: prepared.sessionRef,
        dailyRef: prepared.dailyRef,
        requestId: body.requestId,
        expectedRevision: Number(state.revision || 0),
        action: body.action === 'start' ? 'continue' : body.action,
        result: result,
        timezone: timezone
      });
      return sendJson(res, 200, response);
    } catch (error) {
      if (error instanceof SessionConflictError) return sendJson(res, 409, { code: 'session_changed', message: t('server.sessionChanged') });
      return sendJson(res, 500, { code: 'progress_unavailable', message: t('server.progressUnavailable') });
    }
  } catch {
    return sendJson(res, 500, { code: 'service_unavailable', message: t('server.serviceUnavailable') });
  }
}

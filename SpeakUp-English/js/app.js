import { auth, db } from './firebase-init.js';
import { ensureProfile, watchAuth } from './auth.js';
import { applyTranslations, t } from './i18n/tr.js';
import { applyTheme, renderCelebration, renderGamification, showToast } from './gamification.js';
import { appendMessage, clearMessages, setTyping } from './chat.js';
import { setupOnboarding } from './onboarding.js';
import { setupSettings } from './settings.js';
import { chatRequest } from './api.js';

applyTranslations();
setupOnboarding();
const loading = document.getElementById('loading-screen');
const shell = document.getElementById('app-shell');
const onboarding = document.getElementById('onboarding-screen');
const celebration = document.getElementById('celebration-screen');
const input = document.getElementById('answer-input');
const answerRow = document.getElementById('answer-row');
const sendButton = document.getElementById('send-answer');
const continueButton = document.getElementById('continue-button');
const controlHint = document.getElementById('control-hint');
let profile = null;
let busy = false;
let pendingOperation = null;
let currentProgress = null;
let retryErrorMessage = null;

function timezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul'; }
  catch { return 'Europe/Istanbul'; }
}

function showApp() {
  loading.hidden = true;
  onboarding.hidden = true;
  shell.hidden = false;
}

function setControls(mode, enabled = true) {
  answerRow.hidden = mode !== 'answer';
  continueButton.hidden = mode !== 'continue';
  sendButton.disabled = !enabled;
  continueButton.disabled = !enabled;
  input.disabled = !enabled;
  if (mode === 'answer') input.focus({ preventScroll: true });
}

function updateProfileHeader() {
  const name = profile.displayName || profile.email || t('app.learner');
  document.getElementById('user-name').textContent = name;
  const fallback = document.getElementById('avatar-fallback');
  fallback.textContent = String(name.trim().charAt(0) || 'S').toLocaleUpperCase('tr-TR');
  if (auth.currentUser && auth.currentUser.photoURL) {
    const avatar = document.getElementById('user-avatar');
    avatar.src = auth.currentUser.photoURL;
    avatar.alt = name;
    avatar.hidden = false;
    fallback.hidden = true;
  }
}

function showError(message, operation) {
  if (retryErrorMessage && retryErrorMessage.isConnected) retryErrorMessage.remove();
  const retryOperation = operation || pendingOperation;
  retryErrorMessage = appendMessage('ai', message || t('app.retryRequest'), {
    error: true,
    retry: retryOperation ? function () { perform(retryOperation, true); } : undefined
  });
  setControls(retryOperation && retryOperation.action === 'answer' ? 'answer' : 'continue', true);
}

function handleResponse(data) {
  pendingOperation = null;
  const reply = data.reply || {};
  currentProgress = data.progress || currentProgress;
  profile.stats = data.stats || profile.stats || {};
  profile.badges = data.badges || profile.badges || [];
  if (retryErrorMessage && retryErrorMessage.isConnected) retryErrorMessage.remove();
  retryErrorMessage = null;
  renderGamification(profile, currentProgress);
  if (reply.stage === 'feedback' && Number(data.earnedXp || 0) > 0) {
    showToast(t('app.xpEarned', { xp: data.earnedXp }));
    appendMessage('ai', reply.message_markdown, { correct: reply.is_correct });
  } else if (reply.message_markdown) {
    appendMessage('ai', reply.message_markdown, { speechText: data.speechText || null, speechKind: data.speechKind || 'word', correct: reply.is_correct });
  }

  if (data.done || reply.next_action === 'finish_day') {
    shell.hidden = true;
    renderCelebration(data);
    celebration.hidden = false;
    return;
  }
  if (reply.stage === 'practice' || reply.next_action === 'retry') {
    setControls('answer', true);
    controlHint.textContent = t('app.controlHint');
    return;
  }
  if (reply.stage === 'feedback' && !reply.is_correct && reply.next_action === 'next_word') {
    document.querySelector('.chat-card').classList.add('shake');
    window.setTimeout(function () { document.querySelector('.chat-card').classList.remove('shake'); }, 300);
  }
  setControls('continue', true);
}

async function perform(operation, isRetry = false) {
  if (busy) return;
  busy = true;
  pendingOperation = operation;
  setControls(operation.action === 'answer' ? 'answer' : 'continue', false);
  setTyping(true);
  try {
    const data = await chatRequest({
      action: operation.action,
      message: operation.message,
      requestId: operation.requestId,
      timezone: timezone()
    });
    setTyping(false);
    handleResponse(data);
  } catch (error) {
    setTyping(false);
    const message = error && error.message ? error.message : t('app.serviceError');
    showError(message, operation);
  } finally {
    busy = false;
    if (!pendingOperation) {
      sendButton.disabled = false;
      continueButton.disabled = false;
      input.disabled = false;
    }
  }
}

function newRequestId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
}

continueButton.addEventListener('click', function () {
  if (pendingOperation) return perform(pendingOperation, true);
  perform({ action: 'continue', requestId: newRequestId() });
});

async function sendAnswer() {
  if (pendingOperation) return perform(pendingOperation, true);
  const message = input.value.trim();
  if (!message || message.length > 500) {
    showToast(t('app.invalidAnswer'));
    input.focus();
    return;
  }
  appendMessage('user', message);
  input.value = '';
  perform({ action: 'answer', message: message, requestId: newRequestId() });
}

sendButton.addEventListener('click', sendAnswer);
input.addEventListener('keydown', function (event) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    sendAnswer();
  }
});

document.getElementById('celebration-settings').addEventListener('click', function () {
  celebration.hidden = true;
  shell.hidden = false;
  setControls('continue', true);
  document.getElementById('open-settings').click();
});
window.addEventListener('online', function () { document.getElementById('offline-banner').hidden = true; });
window.addEventListener('offline', function () { document.getElementById('offline-banner').hidden = false; });

window.addEventListener('speakup:onboarding-complete', async function (event) {
  profile.settings = event.detail.settings;
  applyTheme(profile.settings.theme);
  onboarding.hidden = true;
  showApp();
  setupSettings(profile);
  await beginLearning();
});

window.addEventListener('speakup:settings-updated', function (event) {
  profile.settings = event.detail.settings;
  renderGamification(profile, currentProgress);
});

async function beginLearning() {
  clearMessages();
  setControls('continue', false);
  const operation = { action: 'start', requestId: newRequestId() };
  await perform(operation);
}

let authHandled = false;
watchAuth(async function (user) {
  if (authHandled) return;
  authHandled = true;
  if (!user) {
    window.location.replace('/');
    return;
  }
  window.speakupUser = user;
  try {
    profile = await ensureProfile(user);
    updateProfileHeader();
    applyTheme(profile.settings ? profile.settings.theme : 'system');
    if (!profile.settings) {
      loading.hidden = true;
      onboarding.hidden = false;
      return;
    }
    renderGamification(profile, null);
    setupSettings(profile);
    showApp();
    if (!navigator.onLine) document.getElementById('offline-banner').hidden = false;
    await beginLearning();
  } catch {
    loading.hidden = true;
    appendMessage('ai', t('app.serviceError'), { error: true });
    shell.hidden = false;
  }
});

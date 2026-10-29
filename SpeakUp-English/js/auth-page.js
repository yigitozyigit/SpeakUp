import { applyTranslations, t } from './i18n/tr.js';
import { login, loginWithGoogle, register, resetPassword, watchAuth } from './auth.js';

applyTranslations();
const form = document.getElementById('auth-form');
const error = document.getElementById('auth-error');
const email = document.getElementById('email');
const password = document.getElementById('password');
const submit = document.getElementById('email-submit');
const title = document.getElementById('auth-title');
const subtitle = document.querySelector('.auth-card > .muted');
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const googleButton = document.getElementById('google-signin');
const resetButton = document.getElementById('forgot-password');
let mode = 'login';
let resetMode = false;

watchAuth(function (user) {
  if (user) window.location.replace('/app.html');
});

function showError(value) {
  error.textContent = value;
  error.classList.remove('form-success');
}

function firebaseMessage(err) {
  return t('auth.errors.' + (err && err.code ? err.code : 'fallback')) || t('auth.errors.fallback');
}

function setBusy(busy, button = submit) {
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
}

function renderMode() {
  resetMode = false;
  form.hidden = false;
  password.hidden = false;
  password.previousElementSibling.hidden = false;
  googleButton.hidden = false;
  document.querySelector('.divider').hidden = false;
  document.querySelector('.auth-tabs').hidden = false;
  resetButton.hidden = mode === 'register';
  resetButton.textContent = t('auth.forgot');
  title.textContent = t(mode === 'login' ? 'auth.loginTitle' : 'auth.registerTitle');
  subtitle.textContent = t('auth.subtitle');
  submit.textContent = t(mode === 'login' ? 'auth.loginAction' : 'auth.registerAction');
  password.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  loginTab.classList.toggle('is-active', mode === 'login');
  registerTab.classList.toggle('is-active', mode === 'register');
  loginTab.setAttribute('aria-selected', String(mode === 'login'));
  registerTab.setAttribute('aria-selected', String(mode === 'register'));
  showError('');
}

loginTab.addEventListener('click', function () { mode = 'login'; renderMode(); });
registerTab.addEventListener('click', function () { mode = 'register'; renderMode(); });

form.addEventListener('submit', async function (event) {
  event.preventDefault();
  showError('');
  if (!email.value.trim() || (!resetMode && !password.value)) {
    showError(t('auth.errors.required'));
    return;
  }
  setBusy(true);
  try {
    if (resetMode) {
      await resetPassword(email.value);
      showError(t('auth.resetSent'));
      error.classList.add('form-success');
    } else if (mode === 'login') {
      await login(email.value, password.value);
      window.location.assign('/app.html');
    } else {
      if (password.value.length < 8) {
        showError(t('auth.errors.auth/weak-password'));
        setBusy(false);
        return;
      }
      await register(email.value, password.value);
      window.location.assign('/app.html');
    }
  } catch (err) {
    showError(firebaseMessage(err));
  } finally {
    setBusy(false);
  }
});

googleButton.addEventListener('click', async function () {
  showError('');
  setBusy(true, googleButton);
  try {
    await loginWithGoogle();
    window.location.assign('/app.html');
  } catch (err) {
    showError(firebaseMessage(err));
  } finally {
    setBusy(false, googleButton);
  }
});

resetButton.addEventListener('click', function () {
  if (resetMode) {
    mode = 'login';
    renderMode();
    return;
  }
  resetMode = true;
  form.hidden = false;
  googleButton.hidden = true;
  document.querySelector('.divider').hidden = true;
  document.querySelector('.auth-tabs').hidden = true;
  password.hidden = true;
  password.previousElementSibling.hidden = true;
  resetButton.hidden = false;
  resetButton.textContent = t('auth.backToLogin');
  title.textContent = t('auth.resetTitle');
  subtitle.textContent = t('auth.resetSubtitle');
  submit.textContent = t('auth.resetAction');
  showError('');
  email.focus();
});

document.querySelector('.brand').addEventListener('click', function (event) { event.preventDefault(); });

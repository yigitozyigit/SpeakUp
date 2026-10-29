import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { db } from './firebase-init.js';
import { logout } from './auth.js';
import { deleteAccountRequest } from './api.js';
import { applyTheme } from './gamification.js';
import { t } from './i18n/tr.js';

export function setupSettings(profile) {
  const dialog = document.getElementById('settings-dialog');
  const level = document.getElementById('settings-level');
  const goal = document.getElementById('settings-goal');
  const theme = document.getElementById('settings-theme');
  const error = document.getElementById('settings-error');
  document.getElementById('open-settings').addEventListener('click', function () {
    const settings = profile.settings || { level: 'A1', dailyGoal: 10, theme: 'system' };
    level.value = settings.level;
    goal.value = String(settings.dailyGoal);
    theme.value = settings.theme;
    error.textContent = '';
    dialog.showModal();
  });
  document.getElementById('close-settings').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) dialog.close();
  });
  document.getElementById('save-settings').addEventListener('click', async function () {
    const button = document.getElementById('save-settings');
    button.disabled = true;
    error.textContent = '';
    const settings = { level: level.value, dailyGoal: Number(goal.value), theme: theme.value };
    try {
      await setDoc(doc(db, 'users', window.speakupUser.uid), { settings: settings }, { merge: true });
      Object.assign(profile, { settings: settings });
      applyTheme(settings.theme);
      window.dispatchEvent(new CustomEvent('speakup:settings-updated', { detail: { settings: settings } }));
      dialog.close();
    } catch {
      error.textContent = t('app.saveError');
    } finally {
      button.disabled = false;
    }
  });
  document.getElementById('sign-out').addEventListener('click', async function () {
    await logout();
    window.location.replace('/');
  });
  document.getElementById('delete-account').addEventListener('click', async function () {
    if (!window.confirm(t('settings.deleteFinal'))) return;
    const button = document.getElementById('delete-account');
    button.disabled = true;
    error.textContent = '';
    try {
      await deleteAccountRequest();
      await logout();
      window.location.replace('/');
    } catch {
      error.textContent = t('app.deleteError');
      button.disabled = false;
    }
  });
}

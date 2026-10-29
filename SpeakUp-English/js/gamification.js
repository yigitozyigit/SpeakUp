import { t } from './i18n/tr.js';

export function applyTheme(theme) {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', theme);
}

export function renderGamification(profile, progress) {
  const stats = profile.stats || {};
  const xp = Number(stats.totalXp || 0);
  const level = Math.floor(xp / 100) + 1;
  document.getElementById('streak-value').textContent = String(stats.currentStreak || 0);
  document.getElementById('xp-value').textContent = String(xp);
  document.getElementById('level-value').textContent = String(level);
  document.getElementById('level-progress').style.width = (xp % 100) + '%';
  document.getElementById('level-xp-label').textContent = t('app.levelProgress', { current: xp % 100 });
  const settings = profile.settings || {};
  const goal = Number((progress && progress.dailyGoal) || settings.dailyGoal || 10);
  const completed = Math.min(goal, Number((progress && progress.wordsCompleted) || 0));
  document.getElementById('goal-label').textContent = completed + ' / ' + goal;
  const bar = document.getElementById('goal-progress');
  bar.setAttribute('aria-valuemax', String(goal));
  bar.setAttribute('aria-valuenow', String(completed));
  document.getElementById('goal-progress-fill').style.width = goal ? (completed / goal * 100) + '%' : '0%';
  renderBadges(profile.badges || []);
}

function renderBadges(earned) {
  const definitions = [
    ['first_word', '✦', 'app.badgeFirstWord'],
    ['streak_7', '♨', 'app.badgeStreak7'],
    ['streak_30', '🔥', 'app.badgeStreak30'],
    ['xp_100', '★', 'app.badgeXp100'],
    ['xp_500', '🏆', 'app.badgeXp500'],
    ['words_50', '📚', 'app.badgeWords50']
  ];
  const list = document.getElementById('badge-list');
  while (list.firstChild) list.removeChild(list.firstChild);
  definitions.forEach(function (definition) {
    const isEarned = earned.includes(definition[0]);
    const chip = document.createElement('span');
    chip.className = 'badge-chip' + (isEarned ? ' is-earned' : '');
    chip.title = isEarned ? t(definition[2]) : t('app.badgeLocked');
    chip.setAttribute('aria-label', t(definition[2]) + (isEarned ? '' : ' · ' + t('app.badgeLocked')));
    const icon = document.createElement('span');
    icon.className = 'badge-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = definition[1];
    const label = document.createElement('span');
    label.textContent = t(definition[2]);
    chip.append(icon, label);
    list.append(chip);
  });
}

export function renderCelebration(data) {
  const progress = data.progress || {};
  const stats = data.stats || {};
  document.getElementById('celebration-message').textContent = t('celebration.message');
  document.getElementById('celebration-xp').textContent = String(progress.xpEarned || 0);
  document.getElementById('celebration-streak').textContent = String(stats.currentStreak || 0);
  const words = Array.isArray(progress.completedWords) ? progress.completedWords : [];
  document.getElementById('celebration-words').textContent = words.length
    ? t('celebration.words', { words: words.join(', ') })
    : t('celebration.emptyWords');
}

export function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(function () { toast.hidden = true; }, 2800);
}

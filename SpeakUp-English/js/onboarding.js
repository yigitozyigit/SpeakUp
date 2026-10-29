import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { db } from './firebase-init.js';
import { t } from './i18n/tr.js';

const levels = ['A1', 'A2', 'B1', 'B2'];
const goals = [5, 10, 15];

export function setupOnboarding() {
  const levelBox = document.getElementById('level-choices');
  const goalBox = document.getElementById('goal-choices');
  let selectedLevel = 'A1';
  let selectedGoal = 10;
  levels.forEach(function (level) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-card' + (level === selectedLevel ? ' is-selected' : '');
    button.dataset.value = level;
    const title = document.createElement('strong');
    title.textContent = level;
    const description = document.createElement('span');
    description.textContent = t('onboarding.levels.' + level);
    button.append(title, description);
    button.setAttribute('aria-pressed', String(level === selectedLevel));
    button.addEventListener('click', function () {
      selectedLevel = level;
      levelBox.querySelectorAll('button').forEach(function (item) {
        const selected = item.dataset.value === level;
        item.classList.toggle('is-selected', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
    });
    levelBox.append(button);
  });
  goals.forEach(function (goal) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'goal-choice' + (goal === selectedGoal ? ' is-selected' : '');
    button.dataset.value = String(goal);
    button.textContent = goal + ' · ' + t('onboarding.goals.' + goal);
    button.setAttribute('aria-pressed', String(goal === selectedGoal));
    button.addEventListener('click', function () {
      selectedGoal = goal;
      goalBox.querySelectorAll('button').forEach(function (item) {
        const selected = item.dataset.value === String(goal);
        item.classList.toggle('is-selected', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
    });
    goalBox.append(button);
  });

  document.getElementById('save-onboarding').addEventListener('click', async function () {
    const button = document.getElementById('save-onboarding');
    const error = document.getElementById('onboarding-error');
    const user = window.speakupUser;
    if (!user) return;
    button.disabled = true;
    error.textContent = '';
    try {
      await setDoc(doc(db, 'users', user.uid), {
        settings: { dailyGoal: selectedGoal, level: selectedLevel, theme: 'system' }
      }, { merge: true });
      window.dispatchEvent(new CustomEvent('speakup:onboarding-complete', {
        detail: { settings: { dailyGoal: selectedGoal, level: selectedLevel, theme: 'system' } }
      }));
    } catch {
      error.textContent = t('app.onboardingError');
      button.disabled = false;
    }
  });
}

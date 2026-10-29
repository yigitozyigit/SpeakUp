import { calendarDayDifference } from './date.js';

export function calculateXp({ isCorrect, attempts = 1, goalReached = false }) {
  return (isCorrect ? 10 + (attempts === 1 ? 5 : 0) : 0) + (goalReached ? 20 : 0);
}

export function updateStreak(stats = {}, today) {
  const previous = stats.lastActiveDate || null;
  const previousStreak = Number.isInteger(stats.currentStreak) ? stats.currentStreak : 0;
  if (previous === today) {
    return {
      currentStreak: previousStreak || 1,
      longestStreak: Math.max(Number(stats.longestStreak || 0), previousStreak || 1),
      lastActiveDate: today
    };
  }
  const gap = previous ? calendarDayDifference(previous, today) : null;
  const currentStreak = gap === 1 ? previousStreak + 1 : 1;
  return {
    currentStreak: currentStreak,
    longestStreak: Math.max(Number(stats.longestStreak || 0), currentStreak),
    lastActiveDate: today
  };
}

export function awardedBadges({ previous = [], totalXp = 0, completedWords = 0, streak = 0 }) {
  const badges = new Set(previous);
  if (completedWords >= 1) badges.add('first_word');
  if (streak >= 7) badges.add('streak_7');
  if (streak >= 30) badges.add('streak_30');
  if (totalXp >= 100) badges.add('xp_100');
  if (totalXp >= 500) badges.add('xp_500');
  if (completedWords >= 50) badges.add('words_50');
  return Array.from(badges);
}

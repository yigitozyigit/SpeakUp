import test from 'node:test';
import assert from 'node:assert/strict';
import { awardedBadges, calculateXp, updateStreak } from '../server/gamification.js';
import { localDateKey } from '../server/date.js';

test('XP awards base points, first try bonus, and goal bonus on the server', function () {
  assert.equal(calculateXp({ isCorrect: true, attempts: 1 }), 15);
  assert.equal(calculateXp({ isCorrect: true, attempts: 2 }), 10);
  assert.equal(calculateXp({ isCorrect: true, attempts: 1, goalReached: true }), 35);
  assert.equal(calculateXp({ isCorrect: false, attempts: 3, goalReached: true }), 20);
});

test('streak continues once for the next local calendar day and stays stable on the same day', function () {
  const yesterday = updateStreak({ currentStreak: 4, longestStreak: 6, lastActiveDate: '2026-10-28' }, '2026-10-29');
  assert.deepEqual(yesterday, { currentStreak: 5, longestStreak: 6, lastActiveDate: '2026-10-29' });
  const sameDay = updateStreak(yesterday, '2026-10-29');
  assert.equal(sameDay.currentStreak, 5);
});

test('streak resets after a missed local day', function () {
  const result = updateStreak({ currentStreak: 8, longestStreak: 8, lastActiveDate: '2026-10-27' }, '2026-10-29');
  assert.deepEqual(result, { currentStreak: 1, longestStreak: 8, lastActiveDate: '2026-10-29' });
});

test('streak day keys use the learner timezone near a UTC date boundary', function () {
  const justAfterMidnightInIstanbul = new Date('2026-10-28T22:30:00.000Z');
  const today = localDateKey(justAfterMidnightInIstanbul, 'Europe/Istanbul');
  assert.equal(today, '2026-10-29');
  const result = updateStreak({ currentStreak: 2, longestStreak: 2, lastActiveDate: '2026-10-28' }, today);
  assert.equal(result.currentStreak, 3);
});

test('six badge milestones can all be awarded on the server', function () {
  const earned = awardedBadges({ previous: [], totalXp: 500, completedWords: 50, streak: 30 });
  assert.deepEqual(earned.sort(), ['first_word', 'streak_7', 'streak_30', 'xp_100', 'xp_500', 'words_50'].sort());
});

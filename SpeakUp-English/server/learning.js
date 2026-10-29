import { addCalendarDays, localDateKey } from './date.js';
import { awardedBadges, calculateXp, updateStreak } from './gamification.js';
import { chooseWords } from './word-bank.js';
import { t } from '../js/i18n/tr.js';

export class SessionConflictError extends Error {
  constructor() { super('Session changed while the response was being prepared.'); this.name = 'SessionConflictError'; }
}

function profileSettings(profile) {
  const settings = profile && profile.settings;
  if (!settings || !['A1', 'A2', 'B1', 'B2'].includes(settings.level) || ![5, 10, 15].includes(settings.dailyGoal)) return null;
  return settings;
}

function progressFrom(daily = {}, goal = 10) {
  return {
    date: daily.date || null,
    wordsCompleted: Number(daily.wordsCompleted || 0),
    dailyGoal: goal,
    xpEarned: Number(daily.xpEarned || 0),
    goalReached: Boolean(daily.goalReached),
    completedWords: Array.isArray(daily.completedWordNames) ? daily.completedWordNames : []
  };
}

function statsFrom(profile = {}) {
  const stats = profile.stats || {};
  return {
    totalXp: Number(stats.totalXp || 0),
    level: Number(stats.level || (Math.floor(Number(stats.totalXp || 0) / 100) + 1)),
    currentStreak: Number(stats.currentStreak || 0),
    longestStreak: Number(stats.longestStreak || 0),
    completedWords: Number(stats.completedWords || 0)
  };
}

export function finishResponse(profile, daily, goal) {
  return {
    reply: {
      stage: 'feedback',
      message_markdown: t('server.finishMessage'),
      is_correct: true,
      error_category: 'none',
      next_action: 'finish_day'
    },
    progress: progressFrom(daily, goal),
    stats: statsFrom(profile),
    badges: Array.isArray(profile.badges) ? profile.badges : [],
    earnedXp: 0,
    done: true
  };
}

async function persistNewSession(db, sessionRef, candidate, today) {
  return db.runTransaction(async function (transaction) {
    const snapshot = await transaction.get(sessionRef);
    if (snapshot.exists && snapshot.data().date === today) return snapshot.data();
    transaction.set(sessionRef, candidate);
    return candidate;
  });
}

export async function prepareSession({ db, userRef, profile, timezone, now = new Date() }) {
  const settings = profileSettings(profile);
  if (!settings) throw new Error('Onboarding is required.');
  const today = localDateKey(now, timezone);
  const sessionRef = userRef.collection('session').doc('current');
  const dailyRef = userRef.collection('daily').doc(today);
  const [sessionSnapshot, dailySnapshot] = await Promise.all([sessionRef.get(), dailyRef.get()]);
  const daily = dailySnapshot.exists ? dailySnapshot.data() : {};
  const completed = Number(daily.wordsCompleted || 0);
  let state = sessionSnapshot.exists ? sessionSnapshot.data() : null;

  if (!state || state.date !== today) {
    const queue = completed < settings.dailyGoal
      ? await chooseWords({ userRef: userRef, level: settings.level, count: settings.dailyGoal - completed, timezone: timezone, today: today, now: now })
      : [];
    const initial = {
      date: today,
      timezone: timezone,
      queue: queue,
      index: 0,
      stage: completed >= settings.dailyGoal ? 'done' : 'intro',
      attempts: 0,
      practiceExercise: null,
      completedWords: Array.isArray(daily.completedWordNames) ? daily.completedWordNames : [],
      revision: 0,
      done: completed >= settings.dailyGoal,
      lastRequestId: null,
      lastResponse: null
    };
    state = await persistNewSession(db, sessionRef, initial, today);
  } else {
    const queue = Array.isArray(state.queue) ? state.queue : [];
    const index = Math.max(0, Number(state.index || 0));
    const remaining = Math.max(0, queue.length - index);
    const shouldFinish = completed >= settings.dailyGoal;
    const needed = shouldFinish ? 0 : Math.max(0, settings.dailyGoal - completed - remaining);
    let additions = [];
    if (needed > 0) {
      additions = await chooseWords({
        userRef: userRef,
        level: settings.level,
        count: needed,
        timezone: timezone,
        today: today,
        excluded: queue.map(function (word) { return word.id; }),
        now: now
      });
    }
    if (shouldFinish !== Boolean(state.done) || additions.length) {
      const next = Object.assign({}, state, {
        queue: queue.concat(additions),
        done: shouldFinish,
        stage: shouldFinish ? 'done' : (state.done ? 'intro' : state.stage),
        attempts: shouldFinish ? 0 : state.attempts,
        practiceExercise: shouldFinish ? null : state.practiceExercise,
        lastResponse: null,
        revision: Number(state.revision || 0) + 1
      });
      state = await db.runTransaction(async function (transaction) {
        const current = await transaction.get(sessionRef);
        const data = current.exists ? current.data() : null;
        if (!data || data.date !== today) return next;
        if (Number(data.revision || 0) !== Number(state.revision || 0)) return data;
        transaction.set(sessionRef, next);
        return next;
      });
    }
  }

  return { state: state, today: today, sessionRef: sessionRef, dailyRef: dailyRef, settings: settings, daily: daily };
}

function responseEnvelope(reply, state, profile, daily, goal, earnedXp = 0) {
  const response = {
    reply: reply,
    progress: progressFrom(daily, goal),
    stats: statsFrom(profile),
    badges: Array.isArray(profile.badges) ? profile.badges : [],
    earnedXp: earnedXp,
    done: Boolean(state.done)
  };
  const currentWord = state.queue && state.queue[state.index];
  if (reply.stage === 'intro' && currentWord) {
    response.speechText = currentWord.word;
    response.speechKind = 'word';
  }
  if (reply.stage === 'examples' && currentWord) {
    const examples = reply.message_markdown.split(/\r?\n/).map(function (line) {
      const english = line.split(/\s+[—–]\s+/)[0]
        .replace(/^\s*(?:\d+[.)]?|[-*•])\s*/, '')
        .replace(/[\*_`]/g, '')
        .trim();
      return /[a-z]{3}/i.test(english) && !/[çğıöşü]/i.test(english) && english.length >= 6 ? english : '';
    }).filter(Boolean).slice(0, 2);
    if (examples.length) {
      response.speechText = examples.join('. ');
      response.speechKind = 'examples';
    } else {
      response.speechText = currentWord.word;
      response.speechKind = 'word';
    }
  }
  return response;
}

function mergeReply(result, nextAction) {
  return {
    stage: result.stage,
    message_markdown: result.message_markdown,
    is_correct: Boolean(result.is_correct),
    error_category: result.error_category,
    next_action: nextAction
  };
}

export async function applyModelResult({ db, userRef, sessionRef, dailyRef, requestId, expectedRevision, action, result, timezone }) {
  return db.runTransaction(async function (transaction) {
    const initialSessionSnapshot = await transaction.get(sessionRef);
    if (!initialSessionSnapshot.exists) throw new SessionConflictError();
    const state = initialSessionSnapshot.data();
    const [profileSnapshot, dailySnapshot] = await Promise.all([transaction.get(userRef), transaction.get(dailyRef)]);
    const profile = profileSnapshot.exists ? profileSnapshot.data() : {};
    const daily = dailySnapshot.exists ? dailySnapshot.data() : { wordsCompleted: 0, xpEarned: 0, goalReached: false, wordIds: [], completedWordNames: [] };

    if (state.lastRequestId === requestId && state.lastResponse) return state.lastResponse;
    if (Number(state.revision || 0) !== expectedRevision) throw new SessionConflictError();
    const settings = profileSettings(profile);
    if (!settings || state.date !== (dailyRef.id)) throw new SessionConflictError();
    const now = new Date();
    let next = Object.assign({}, state);
    let earnedXp = 0;
    let nextStats = statsFrom(profile);
    let nextDaily = daily;
    let nextAction = 'continue';
    let completedWordCount = nextStats.completedWords;
    let badges = Array.isArray(profile.badges) ? profile.badges : [];

    if (action === 'continue') {
      if (!['intro', 'examples', 'practice'].includes(state.stage) || result.stage !== state.stage) throw new SessionConflictError();
      next.stage = state.stage === 'intro' ? 'examples' : (state.stage === 'examples' ? 'practice' : 'awaiting_answer');
      if (state.stage === 'practice') next.practiceExercise = result.message_markdown;
      const reply = mergeReply(result, 'continue');
      next.revision = Number(state.revision || 0) + 1;
      const response = responseEnvelope(reply, next, profile, daily, settings.dailyGoal, 0);
      next.lastRequestId = requestId;
      next.lastResponse = response;
      transaction.set(sessionRef, next);
      return response;
    }

    if (action !== 'answer' || state.stage !== 'awaiting_answer') throw new SessionConflictError();
    const currentWord = Array.isArray(state.queue) ? state.queue[state.index] : null;
    if (!currentWord || result.stage !== 'feedback') throw new SessionConflictError();
    const wordRef = userRef.collection('words').doc(currentWord.id);
    const wordSnapshot = await transaction.get(wordRef);
    const wordData = wordSnapshot.exists ? wordSnapshot.data() : {};
    const attemptNumber = Number(state.attempts || 0) + 1;
    const correct = Boolean(result.is_correct);
    const completesWord = correct || attemptNumber >= 3;
    const wordsCompleted = Number(daily.wordsCompleted || 0) + (completesWord ? 1 : 0);
    const goalCrossed = completesWord && !Boolean(daily.goalReached) && wordsCompleted >= settings.dailyGoal;
    earnedXp = calculateXp({ isCorrect: correct, attempts: attemptNumber, goalReached: goalCrossed });

    const nextDailyNames = Array.isArray(daily.completedWordNames) ? daily.completedWordNames.slice() : [];
    const nextDailyIds = Array.isArray(daily.wordIds) ? daily.wordIds.slice() : [];
    if (completesWord) {
      if (!nextDailyNames.includes(currentWord.word)) nextDailyNames.push(currentWord.word);
      if (!nextDailyIds.includes(currentWord.id)) nextDailyIds.push(currentWord.id);
      nextDaily = {
        date: state.date,
        wordsCompleted: wordsCompleted,
        wordIds: nextDailyIds,
        completedWordNames: nextDailyNames,
        xpEarned: Number(daily.xpEarned || 0) + earnedXp,
        goalReached: Boolean(daily.goalReached) || goalCrossed,
        updatedAt: now
      };

      const streak = updateStreak(profile.stats || {}, state.date);
      const totalXp = nextStats.totalXp + earnedXp;
      completedWordCount += 1;
      nextStats = {
        totalXp: totalXp,
        level: Math.floor(totalXp / 100) + 1,
        currentStreak: streak.currentStreak,
        longestStreak: streak.longestStreak,
        lastActiveDate: streak.lastActiveDate,
        completedWords: completedWordCount
      };
      badges = awardedBadges({ previous: badges, totalXp: totalXp, completedWords: completedWordCount, streak: streak.currentStreak });
      const done = wordsCompleted >= settings.dailyGoal;
      next.index = Number(state.index || 0) + 1;
      next.done = done;
      next.stage = done ? 'done' : 'intro';
      next.attempts = 0;
      next.practiceExercise = null;
      next.completedWords = nextDailyNames;
      nextAction = correct ? (done ? 'finish_day' : 'continue') : (done ? 'finish_day' : 'next_word');
    } else {
      next.attempts = attemptNumber;
      next.stage = 'awaiting_answer';
      next.practiceExercise = result.message_markdown;
      nextAction = 'retry';
    }

    const newMistakes = Number(wordData.mistakes || 0) + (correct ? 0 : 1);
    transaction.set(wordRef, {
      status: correct ? 'learned' : 'learning',
      attempts: Number(wordData.attempts || 0) + 1,
      lastSeen: now,
      nextReview: addCalendarDays(state.date, correct ? 3 : 1),
      mistakes: newMistakes
    }, { merge: true });

    const updatedProfile = Object.assign({}, profile, { stats: nextStats, badges: badges, timezone: timezone });
    if (completesWord) transaction.set(dailyRef, nextDaily, { merge: true });
    transaction.set(userRef, { stats: nextStats, badges: badges, timezone: timezone }, { merge: true });
    const reply = mergeReply(result, nextAction);
    const response = responseEnvelope(reply, next, updatedProfile, completesWord ? nextDaily : daily, settings.dailyGoal, earnedXp);
    next.revision = Number(state.revision || 0) + 1;
    next.lastRequestId = requestId;
    next.lastResponse = response;
    transaction.set(sessionRef, next);
    return response;
  });
}

export function responseForResume(state, profile, daily, goal) {
  if (state && state.lastResponse) return state.lastResponse;
  if (state && state.done) return finishResponse(profile, daily, goal);
  return null;
}

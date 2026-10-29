import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { localDateKey } from './date.js';

const here = dirname(fileURLToPath(import.meta.url));

export function loadWordPool(level) {
  const allowed = ['A1', 'A2', 'B1', 'B2'];
  const selected = allowed.includes(level) ? level.toLowerCase() : 'a1';
  const location = resolve(here, '..', 'data', 'words-' + selected + '.json');
  const parsed = JSON.parse(readFileSync(location, 'utf8'));
  if (!Array.isArray(parsed) || parsed.length < 100 || parsed.some(function (item) {
    return !item || typeof item.word !== 'string' || typeof item.pos !== 'string' || typeof item.tr !== 'string';
  })) throw new Error('The configured word pool is invalid.');
  return parsed;
}

function idFor(word) {
  return word.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function timestampValue(value) {
  if (value && typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return value;
  return null;
}

function reviewDate(value, timezone) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = timestampValue(value);
  return date ? localDateKey(date, timezone) : null;
}

function stableOrder(uid, date, id) {
  const source = uid + ':' + date + ':' + id;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export async function chooseWords({ userRef, level, count, timezone, today, excluded = [], now = new Date() }) {
  if (count <= 0) return [];
  const pool = loadWordPool(level);
  const knownSnapshot = await userRef.collection('words').get();
  const known = new Map(knownSnapshot.docs.map(function (document) { return [document.id, document.data()]; }));
  const excludedSet = new Set(excluded);
  const candidates = pool.map(function (entry) {
    const id = idFor(entry.word);
    return { id: id, word: entry.word, pos: entry.pos, tr: entry.tr, record: known.get(id) || null };
  }).filter(function (entry) { return !excludedSet.has(entry.id); });

  const due = [];
  const fresh = [];
  const future = [];
  candidates.forEach(function (entry) {
    if (!entry.record) { fresh.push(entry); return; }
    const dueDate = reviewDate(entry.record.nextReview, timezone);
    if (dueDate && dueDate <= today) due.push(entry);
    else future.push(entry);
  });
  due.sort(function (a, b) {
    return String(reviewDate(a.record.nextReview, timezone) || '').localeCompare(String(reviewDate(b.record.nextReview, timezone) || ''));
  });
  fresh.sort(function (a, b) { return stableOrder(userRef.id, today, a.id) - stableOrder(userRef.id, today, b.id); });
  future.sort(function (a, b) {
    const aDate = timestampValue(a.record.lastSeen);
    const bDate = timestampValue(b.record.lastSeen);
    return (aDate ? aDate.getTime() : 0) - (bDate ? bDate.getTime() : 0);
  });

  const selected = due.concat(fresh, future).slice(0, count);
  return selected.map(function (entry) { return { id: entry.id, word: entry.word, pos: entry.pos, tr: entry.tr }; });
}

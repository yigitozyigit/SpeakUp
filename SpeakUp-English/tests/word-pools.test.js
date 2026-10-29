import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWordPool } from '../server/word-bank.js';

for (const level of ['A1', 'A2', 'B1', 'B2']) {
  test(level + ' word pool contains at least 100 valid entries', function () {
    const words = loadWordPool(level);
    assert.ok(words.length >= 100);
    assert.equal(new Set(words.map(function (entry) { return entry.word; })).size, words.length);
    words.forEach(function (entry) {
      assert.equal(typeof entry.word, 'string');
      assert.equal(typeof entry.pos, 'string');
      assert.equal(typeof entry.tr, 'string');
      assert.ok(entry.word.length > 0 && entry.tr.length > 0);
    });
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { AI_RESPONSE_SCHEMA, validateAiResponse } from '../server/schema.js';

const good = {
  stage: 'feedback',
  message_markdown: 'Güzel deneme. Burada geçmiş zaman kullanılır.',
  is_correct: false,
  error_category: 'grammar',
  next_action: 'retry'
};

test('Gemini output validator accepts the complete expected JSON contract', function () {
  assert.equal(validateAiResponse(good, 'feedback'), true);
  assert.deepEqual(AI_RESPONSE_SCHEMA.required, ['stage', 'message_markdown', 'is_correct', 'error_category', 'next_action']);
});

test('Gemini output validator rejects wrong stages, types, categories, actions, and oversized text', function () {
  assert.equal(validateAiResponse({ ...good, stage: 'practice' }, 'feedback'), false);
  assert.equal(validateAiResponse({ ...good, is_correct: 'yes' }, 'feedback'), false);
  assert.equal(validateAiResponse({ ...good, error_category: 'injection' }, 'feedback'), false);
  assert.equal(validateAiResponse({ ...good, next_action: 'award_xp' }, 'feedback'), false);
  assert.equal(validateAiResponse({ ...good, message_markdown: 'x'.repeat(5001) }, 'feedback'), false);
  assert.equal(validateAiResponse({ ...good, is_correct: true, error_category: 'grammar' }, 'feedback'), true);
});

test('non-feedback stages cannot claim correctness or a learner mistake', function () {
  const intro = { ...good, stage: 'intro', is_correct: false, error_category: 'none', next_action: 'continue' };
  assert.equal(validateAiResponse(intro, 'intro'), true);
  assert.equal(validateAiResponse({ ...intro, is_correct: true }, 'intro'), false);
  assert.equal(validateAiResponse({ ...intro, error_category: 'spelling' }, 'intro'), false);
});

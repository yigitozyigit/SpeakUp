export const AI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    stage: { type: 'STRING', enum: ['intro', 'examples', 'practice', 'feedback'] },
    message_markdown: { type: 'STRING' },
    is_correct: { type: 'BOOLEAN' },
    error_category: { type: 'STRING', enum: ['grammar', 'vocabulary', 'word_order', 'spelling', 'none'] },
    next_action: { type: 'STRING', enum: ['continue', 'retry', 'next_word', 'finish_day'] }
  },
  required: ['stage', 'message_markdown', 'is_correct', 'error_category', 'next_action'],
  propertyOrdering: ['stage', 'message_markdown', 'is_correct', 'error_category', 'next_action']
};

const stages = new Set(['intro', 'examples', 'practice', 'feedback']);
const categories = new Set(['grammar', 'vocabulary', 'word_order', 'spelling', 'none']);
const actions = new Set(['continue', 'retry', 'next_word', 'finish_day']);

export function validateAiResponse(value, expectedStage) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (!stages.has(value.stage) || value.stage !== expectedStage) return false;
  if (typeof value.message_markdown !== 'string' || value.message_markdown.trim().length < 1 || value.message_markdown.length > 5000) return false;
  if (typeof value.is_correct !== 'boolean' || !categories.has(value.error_category) || !actions.has(value.next_action)) return false;
  if (expectedStage !== 'feedback' && (value.is_correct || value.error_category !== 'none')) return false;
  return true;
}

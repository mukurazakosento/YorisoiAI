/**
 * Phase 3 のオフライン動作スモーク（Firebase / Gemini 不要）。
 * 使い方: node scripts/smoke-ai-phase3.mjs
 *
 * デモ分岐の条件は src/services/ai/demoFallback.ts と揃える。
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

function isLineTrouble(normalized) {
  return (
    normalized.includes('LINE') ||
    normalized.includes('ライン') ||
    normalized.includes('らいん')
  );
}

function isVaguePhoneTrouble(normalized) {
  const vaguePatterns = [
    'スマホが変',
    'スマホがおかしい',
    '携帯が変',
    'よく分からない',
    'わからない',
    '変になった',
    'おかしくなった',
  ];
  return vaguePatterns.some((pattern) => normalized.includes(pattern));
}

assert.equal(isLineTrouble('LINEがおかしい'), true);
assert.equal(isVaguePhoneTrouble('スマホが変'), true);
assert.equal(isVaguePhoneTrouble('LINEがおかしい'), false);

const require = createRequire(import.meta.url);
const { z } = require('zod');
const schema = z.object({
  status: z.enum(['need_more_info', 'error']),
  choices: z.array(z.string()).optional(),
});

const ok = schema.safeParse({
  status: 'need_more_info',
  choices: ['通知が届かない', 'LINEが開かない'],
});
assert.equal(ok.success, true);

const bad = schema.safeParse({ status: 'not-a-status' });
assert.equal(bad.success, false);

console.log('smoke-ai-phase3: ok');
console.log('- LINEがおかしい → clarifying path expected');
console.log('- スマホが変 → vague follow-up path expected');
console.log('- Zod rejects invalid status without throwing');

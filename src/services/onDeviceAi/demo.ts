import { DEMO_CLARIFY_CHOICES } from '../../data/demoClarifyChoices';
import { classifyIntentStub } from '../session/intent';
import {
  buildDemoSessionScript,
} from '../session/demoSteps';
import type {
  ClarifyChoicesRequest,
  ClarifyChoicesResult,
  GuidanceScriptRequest,
  GuidanceScriptResult,
  IntentRequest,
  IntentResult,
} from './types';

/** 端末内モデル未接続時の意図判定（ヒューリスティック・明示デモ） */
export function demoClassifyIntent(request: IntentRequest): IntentResult {
  return {
    clarity: classifyIntentStub(request),
    mode: 'demo',
    rationale: '端末内AI未接続のため、キーワード判定のデモです。',
  };
}

/** 端末内モデル未接続時の約4選択肢 */
export function demoGenerateClarifyChoices(
  request: ClarifyChoicesRequest,
): ClarifyChoicesResult {
  const choices = DEMO_CLARIFY_CHOICES[request.featureId].slice(0, 4);
  return {
    choices,
    mode: 'demo',
    question: 'もう少し具体的に教えてください。下のどれかに近いですか？',
  };
}

/** 端末内モデル未接続時の案内スクリプト */
export function demoBuildGuidanceScript(
  request: GuidanceScriptRequest,
): GuidanceScriptResult {
  const script = buildDemoSessionScript(request);
  return {
    script: { ...script, isDemo: true },
    mode: 'demo',
  };
}

export const AI_DISCONNECTED_LABEL = 'AI未接続';
export const AI_DEMO_CHOICES_BANNER = 'デモ選択肢（端末内AIは未接続）';
export const AI_LIVE_CHOICES_BANNER = '端末内AIの選択肢';

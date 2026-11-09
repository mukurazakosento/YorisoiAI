/**
 * Gemini から受け取る構造化回答の型。
 * Zod スキーマ（src/services/ai/schema.ts）と揃える。
 */
export type AiStatus =
  | 'need_more_info'
  | 'ready_to_help'
  | 'guiding'
  | 'explained'
  | 'safety_result'
  | 'error';

export type AiRiskLevel = 'dangerous' | 'caution' | 'insufficient_info';

export type AiResponseMode = 'live' | 'demo' | 'offline';

export type AiResponse = {
  status: AiStatus;
  message?: string;
  question?: string;
  choices?: string[];
  displayText?: string;
  voiceText?: string;
  currentStep?: number;
  totalSteps?: number;
  rationale?: string;
  riskLevel?: AiRiskLevel;
  recommendedActions?: string[];
  sources?: { title: string; url: string }[];
  /** live=本番AI / demo=明示デモ / offline=未接続 */
  mode?: AiResponseMode;
};

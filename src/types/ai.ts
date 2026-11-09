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

/** 文章解説の5区画（長い一文にせず区切って表示） */
export type AiExplanation = {
  /** 表示された文章 */
  displayedText: string;
  /** 簡単に言うと */
  plainMeaning: string;
  /** 操作すると何が起こるか */
  whatHappens: string;
  /** 注意すること */
  cautions: string;
  /** 判断するためのポイント */
  judgmentPoints: string;
};

export type AiUrlCheckStatus =
  | 'unsafe'
  | 'unknown'
  | 'error'
  | 'not_configured'
  | 'skipped';

export type AiUrlCheck = {
  url: string;
  status: AiUrlCheckStatus;
  message: string;
};

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
  /** 文章解説の構造化ブロック */
  explanation?: AiExplanation;
  /** SMS/メール内 URL の Web Risk 結果（キー未設定時も正直に返す） */
  urlChecks?: AiUrlCheck[];
  /** live=本番AI / demo=明示デモ / offline=未接続 */
  mode?: AiResponseMode;
};

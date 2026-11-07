/**
 * Gemini から受け取る構造化回答の型（第3段階で本格利用）。
 * 今は画面シェル用に定義のみ置く。
 */
export type AiStatus =
  | 'need_more_info'
  | 'ready_to_help'
  | 'guiding'
  | 'explained'
  | 'safety_result'
  | 'error';

export type AiRiskLevel = 'dangerous' | 'caution' | 'insufficient_info';

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
};

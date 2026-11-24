export type OperationPlanActionKind =
  | 'tap'
  | 'type'
  | 'scroll'
  | 'open_app'
  | 'wait'
  | 'confirm_with_user'
  | 'ask'
  | 'done'
  | 'none';

/**
 * Planner JSON contract for one next step.
 * Actions are advice only — the app never auto-taps / auto-sends.
 */
export type OperationPlan = {
  screenDescription: string;
  stage: string;
  actionKind: OperationPlanActionKind;
  /** ONE next action in short Japanese */
  nextAction: string;
  targetButtonText: string | null;
  /** Approximate normalized center 0–1, or null if unknown */
  approximatePosition: { x: number; y: number } | null;
  /** 上/下/左/右/中央 when known from OCR/UI */
  screenRegion: string | null;
  /** 上へ / 下へ when scrolling to find a label */
  scrollDirection: '上へ' | '下へ' | null;
  /** What to look for after this step (or while scrolling) */
  lookFor: string | null;
  why: string;
  confidence: number;
  displayText: string;
  voiceText: string;
  clarifyingQuestion: string | null;
  expectNextScreen: string;
  /** Requires explicit user confirmation before they send/pay/call/change permission */
  requiresUserConfirm: boolean;
  stepId: string;
};

export const UNSURE_DISPLAY = '画面を判断できませんでした';
export const UNSURE_VOICE =
  '画面を判断できませんでした。もう一度画面を見せるか、やりたいことを短く教えてください。代わりには操作しません。';

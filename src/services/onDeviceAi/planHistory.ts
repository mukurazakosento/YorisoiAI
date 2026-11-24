import type { OperationPlan } from './operationPlanTypes';
import type { ScreenContext } from './screenContext';
import { maskSensitiveText } from './piiMask';

export type PlanHistoryEntry = {
  at: number;
  stage: string;
  stepId: string;
  nextAction: string;
  ocrPreview: string;
  packageName: string;
};

const MAX_ENTRIES = 8;

let history: PlanHistoryEntry[] = [];

export function resetPlanHistory(): void {
  history = [];
}

export function getPlanHistory(): PlanHistoryEntry[] {
  return history.map((e) => ({ ...e }));
}

export function pushPlanHistory(
  ctx: ScreenContext,
  plan: OperationPlan,
): void {
  history = [
    ...history,
    {
      at: Date.now(),
      stage: plan.stage,
      stepId: plan.stepId,
      nextAction: maskSensitiveText(plan.nextAction).slice(0, 60),
      ocrPreview: maskSensitiveText(ctx.ocrText).slice(0, 80),
      packageName: ctx.packageName.slice(0, 60),
    },
  ].slice(-MAX_ENTRIES);
}

/**
 * Detect repeated identical guidance (anti-loop).
 * Same stepId 3+ times with no OCR change → force ask.
 */
export function isGuidanceLooping(
  plan: OperationPlan,
  ocrChanged: boolean,
): boolean {
  if (ocrChanged) return false;
  const recent = history.filter((h) => h.stepId === plan.stepId);
  return recent.length >= 2;
}

export function historyPromptBlock(): string {
  if (!history.length) return '履歴: (なし)';
  return [
    '直近の案内履歴（新しい順ではない・古い→新しい）:',
    ...history.map(
      (h, i) =>
        `${i + 1}. stage=${h.stage} step=${h.stepId} action=${h.nextAction} ocr=${h.ocrPreview}`,
    ),
  ].join('\n');
}

/** Drop PII-heavy fields; keep minimal retention. */
export function prunePlanHistoryForPrivacy(): void {
  history = history.map((h) => ({
    ...h,
    ocrPreview: h.ocrPreview ? '（要約のみ保持）' : '',
  }));
}

import type { FeatureId } from '../../types/navigation';

/** operationSupport: ~20s OCR / guidance cycle (stable screens). */
export const OPS_ASSIST_INTERVAL_MS = 20_000;

/**
 * textExplanation: faster poll so transient permission / terms dialogs are not
 * missed between 20s samples (root cause of “文章説明 popup dead” on device).
 */
export const TEXT_EXPLAIN_ASSIST_INTERVAL_MS = 4_000;

/** Matches native AssistForegroundService coerceIn lower bound. */
export const ASSIST_INTERVAL_MIN_MS = 3_000;

/** Matches native AssistForegroundService coerceIn upper bound. */
export const ASSIST_INTERVAL_MAX_MS = 60_000;

/**
 * Capture interval for Android FGS by feature.
 * Ops stays ~20s; 文章説明 uses ~4s for popup catch.
 */
export function assistIntervalForFeature(featureId: FeatureId): number {
  if (featureId === 'textExplanation') {
    return TEXT_EXPLAIN_ASSIST_INTERVAL_MS;
  }
  return OPS_ASSIST_INTERVAL_MS;
}

export function clampAssistIntervalMs(intervalMs: number): number {
  return Math.min(
    ASSIST_INTERVAL_MAX_MS,
    Math.max(ASSIST_INTERVAL_MIN_MS, Math.round(intervalMs)),
  );
}

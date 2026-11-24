import type { FeatureId } from '../../types/navigation';
import { buildGuidanceFromOcrText, unreadableGuidanceStep } from './guidanceFromOcr';
import {
  detectPopup,
  explainPopup,
  explainScreenText,
  isPopupStable,
  requiredPopupStreak,
} from './popupDetect';
import { assistIntervalForFeature } from './intervals';

export type ResolveGuidanceInput = {
  featureId: FeatureId;
  goalSummary: string;
  ocrText: string;
  /** Optional AccessibilityService dialog text (merged like native FGS). */
  a11yText?: string;
  ocrChanged: boolean;
  intervalMs?: number;
  /** Previous pending fingerprint (mutated across calls by caller). */
  pendingPopupFingerprint?: string | null;
  popupStreak?: number;
  announcedPopupFingerprint?: string | null;
  announcedStepId?: string;
  announcedStageId?: string;
};

/** Mirror of AssistForegroundService.pickBestDialogText */
export function pickBestDialogText(ocrText: string, a11yText: string): string {
  const ocr = ocrText.replace(/\s+/g, ' ').trim();
  const a11y = a11yText.replace(/\s+/g, ' ').trim();
  if (!a11y) return ocr;
  if (!ocr) return a11y;
  const ocrDialog = detectPopup(ocr) != null;
  const a11yDialog = detectPopup(a11y) != null;
  if (a11yDialog && !ocrDialog) return a11y;
  if (a11yDialog && ocrDialog && a11y.length >= ocr.length) return a11y;
  return ocr;
}

export type ResolveGuidanceResult = {
  step: {
    stepId: string;
    stageId: string;
    displayText: string;
    voiceText: string;
    mode: 'demo' | 'live' | 'offline';
  } | null;
  pendingPopupFingerprint: string | null;
  popupStreak: number;
  announcedPopupFingerprint: string | null;
};

/**
 * JS mirror of AssistForegroundService.resolveGuidance (FGS popup-first path).
 * Used by smokes to prove textExplanation popup explain fires without device.
 */
export function resolveAssistGuidance(input: ResolveGuidanceInput): ResolveGuidanceResult {
  const intervalMs = input.intervalMs ?? assistIntervalForFeature(input.featureId);
  let pending = input.pendingPopupFingerprint ?? null;
  let streak = input.popupStreak ?? 0;
  let announcedPopup = input.announcedPopupFingerprint ?? null;
  const normalized = pickBestDialogText(input.ocrText, input.a11yText ?? '');

  if (!normalized) {
    const unread = unreadableGuidanceStep();
    return {
      step: {
        stepId: unread.stepId,
        stageId: unread.stageId ?? 'unreadable',
        displayText: unread.displayText,
        voiceText: unread.voiceText,
        mode: 'demo',
      },
      pendingPopupFingerprint: null,
      popupStreak: 0,
      announcedPopupFingerprint: announcedPopup,
    };
  }

  const detection = detectPopup(normalized);
  if (detection) {
    if (detection.fingerprint === pending) {
      streak += 1;
    } else {
      pending = detection.fingerprint;
      streak = 1;
    }
    const needed = requiredPopupStreak(detection, intervalMs, input.featureId);
    const stable = isPopupStable(pending, detection, streak, needed);
    if (!stable) {
      if (input.featureId === 'textExplanation' && input.ocrChanged) {
        const explained = explainScreenText(normalized);
        return {
          step: { ...explained, mode: 'demo' },
          pendingPopupFingerprint: pending,
          popupStreak: streak,
          announcedPopupFingerprint: announcedPopup,
        };
      }
      return {
        step: null,
        pendingPopupFingerprint: pending,
        popupStreak: streak,
        announcedPopupFingerprint: announcedPopup,
      };
    }
    if (announcedPopup === detection.fingerprint) {
      return {
        step: null,
        pendingPopupFingerprint: pending,
        popupStreak: streak,
        announcedPopupFingerprint: announcedPopup,
      };
    }
    announcedPopup = detection.fingerprint;
    const explained = explainPopup(detection);
    return {
      step: { ...explained, mode: 'demo' },
      pendingPopupFingerprint: pending,
      popupStreak: streak,
      announcedPopupFingerprint: announcedPopup,
    };
  }

  pending = null;
  streak = 0;
  announcedPopup = null;

  if (
    !input.ocrChanged &&
    input.announcedStepId &&
    input.announcedStageId !== 'unreadable'
  ) {
    return {
      step: null,
      pendingPopupFingerprint: pending,
      popupStreak: streak,
      announcedPopupFingerprint: announcedPopup,
    };
  }

  const built = buildGuidanceFromOcrText({
    featureId: input.featureId,
    goalSummary: input.goalSummary,
    ocrText: normalized,
  });
  return {
    step: {
      stepId: built.stepId,
      stageId: built.stageId ?? 'unknown',
      displayText: built.displayText,
      voiceText: built.voiceText,
      mode: 'demo',
    },
    pendingPopupFingerprint: pending,
    popupStreak: streak,
    announcedPopupFingerprint: announcedPopup,
  };
}

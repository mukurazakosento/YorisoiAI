import type { FeatureId } from '../../types/navigation';
import type { SessionScript } from '../../types/session';
import { explainScreenText } from '../androidAssist/popupDetect';
import { getFeatureCapturePath } from './featurePaths';

const MAX_SUMMARY_CHARS = 280;

/**
 * 確認済みフレーム文字だけを案内文脈へ載せる。
 * 画像・生OCR・layoutHints は絶対に混ぜない。
 */
export function buildSummaryWithConfirmedFrame(input: {
  featureId: FeatureId;
  baseSummary: string;
  confirmedText: string;
}): string {
  const path = getFeatureCapturePath(input.featureId);
  const base = input.baseSummary.trim();
  const confirmed = input.confirmedText.trim().replace(/\s+/g, ' ');
  if (!confirmed) {
    return base;
  }
  const clipped =
    confirmed.length > 160 ? `${confirmed.slice(0, 160)}…` : confirmed;
  const merged = `${base} / ${path.confirmedPrefix}: ${clipped}`;
  if (merged.length <= MAX_SUMMARY_CHARS) {
    return merged;
  }
  return merged.slice(0, MAX_SUMMARY_CHARS);
}

/**
 * 確認済み文字を踏まえて案内脚本を組み直す（操作支援の次の一手など）。
 */
export async function rebuildGuidanceFromConfirmedFrame(input: {
  featureId: FeatureId;
  baseSummary: string;
  confirmedText: string;
}): Promise<{ script: SessionScript; summary: string; isDemo: boolean }> {
  const summary = buildSummaryWithConfirmedFrame(input);

  // 文章説明: explain from confirmed OCR (popup detector + grounded summary), not generic demo script.
  if (input.featureId === 'textExplanation') {
    const explained = explainScreenText(input.confirmedText);
    const script: SessionScript = {
      id: `frame-explain-${explained.stepId}`,
      title: '読み取った文章の説明',
      isDemo: true,
      steps: [
        {
          displayText: explained.displayText,
          voiceText: explained.voiceText,
          simplifyDisplayText: explained.displayText,
          simplifyVoiceText: explained.voiceText,
        },
      ],
    };
    return { script, summary, isDemo: true };
  }

  const { buildGuidanceScript } = await import('../onDeviceAi');
  const result = await buildGuidanceScript({
    featureId: input.featureId,
    summary,
  });
  return {
    script: result.script,
    summary,
    isDemo: result.script.isDemo || result.mode !== 'live',
  };
}

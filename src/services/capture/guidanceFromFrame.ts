import type { FeatureId } from '../../types/navigation';
import type { SessionScript } from '../../types/session';
import { explainScreenText } from '../androidAssist/popupDetect';
import {
  inspectSafetyText,
  resolveSafetyInspectMode,
  safetyResultToSessionSteps,
  type SafetyInspectResult,
} from '../security';
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

export type RebuildGuidanceResult = {
  script: SessionScript;
  summary: string;
  isDemo: boolean;
  /** 安全性検査の詳細（電話同意 UI などで利用） */
  safetyResult?: SafetyInspectResult;
};

/**
 * 確認済み文字を踏まえて案内脚本を組み直す（操作支援の次の一手など）。
 */
export async function rebuildGuidanceFromConfirmedFrame(input: {
  featureId: FeatureId;
  baseSummary: string;
  confirmedText: string;
  /** 電話の公開情報検索に同意したときだけ true */
  searchConsent?: boolean;
}): Promise<RebuildGuidanceResult> {
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

  // 安全性: 電話／メールモードに応じた端末内検査（必要なら任意の公開情報検索）
  if (input.featureId === 'safetyCheck') {
    return rebuildSafetyGuidance({
      baseSummary: input.baseSummary,
      summary,
      confirmedText: input.confirmedText,
      searchConsent: input.searchConsent === true,
    });
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

async function rebuildSafetyGuidance(input: {
  baseSummary: string;
  summary: string;
  confirmedText: string;
  searchConsent: boolean;
}): Promise<RebuildGuidanceResult> {
  const mode =
    resolveSafetyInspectMode({
      summary: input.baseSummary,
      text: input.confirmedText,
    }) ?? 'phone';

  let networkResult = null;
  let networkUnavailableReason: string | undefined;

  if (mode === 'phone' && input.searchConsent) {
    const { extractPhoneCandidates, lookupPhoneNumberViaLegacyCloud } =
      await import('../security');
    const phone = extractPhoneCandidates(input.confirmedText)[0];
    if (phone) {
      const lookup = await lookupPhoneNumberViaLegacyCloud({
        phoneNumber: phone.digits,
        searchConsent: true,
      });
      networkResult = lookup.result;
      networkUnavailableReason = lookup.reason;
    }
  } else if (mode === 'phone') {
    networkUnavailableReason =
      '公開情報のネット検索は、番号確認のあと同意したときだけ行います。鍵が無くても端末内の確認はできます。';
  }

  const safetyResult = inspectSafetyText({
    mode,
    text: input.confirmedText,
    searchConsent: input.searchConsent,
    networkResult,
    networkUnavailableReason,
  });

  const steps = safetyResultToSessionSteps(safetyResult);
  const script: SessionScript = {
    id: `safety-inspect-${mode}-${safetyResult.riskLevel ?? 'insufficient_info'}`,
    title: mode === 'phone' ? '電話番号の確認結果' : 'メールの確認結果',
    isDemo: safetyResult.mode !== 'live',
    steps,
  };

  return {
    script,
    summary: input.summary,
    isDemo: script.isDemo,
    safetyResult,
  };
}

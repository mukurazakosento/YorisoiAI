import type { FeatureId } from '../../types/navigation';
import type { SessionScript } from '../../types/session';
import { prepareWebOcrForAi } from './ocrText';

/**
 * Web OCR 文字だけから案内を組み直す。
 * ネイティブの buildSummaryWithConfirmedFrame（160 文字カット）は通さない。
 */
export async function rebuildGuidanceFromWebOcr(input: {
  featureId: FeatureId;
  baseSummary: string;
  rawOcrText: string;
}): Promise<{
  script: SessionScript;
  summary: string;
  fullMaskedText: string;
  isDemo: boolean;
  wasTruncatedForModel: boolean;
}> {
  const prepared = prepareWebOcrForAi(input.rawOcrText);
  const base = input.baseSummary.trim();
  const summary = prepared.aiContextText
    ? `${base} / 画面の文字: ${prepared.aiContextText}`
    : base;

  const { buildGuidanceScript } = await import('../onDeviceAi');
  const result = await buildGuidanceScript({
    featureId: input.featureId,
    summary,
  });

  return {
    script: result.script,
    summary,
    fullMaskedText: prepared.fullMaskedText,
    isDemo: result.script.isDemo || result.mode !== 'live',
    wasTruncatedForModel: prepared.wasTruncatedForModel,
  };
}

import { z } from 'zod';

import type { AiResponse } from '../../types/ai';

export const AiStatusSchema = z.enum([
  'need_more_info',
  'ready_to_help',
  'guiding',
  'explained',
  'safety_result',
  'error',
]);

export const AiRiskLevelSchema = z.enum([
  'dangerous',
  'caution',
  'insufficient_info',
]);

export const AiSourceSchema = z.object({
  title: z.string(),
  url: z.string(),
});

export const AiExplanationSchema = z.object({
  displayedText: z.string(),
  plainMeaning: z.string(),
  whatHappens: z.string(),
  cautions: z.string(),
  judgmentPoints: z.string(),
});

export const AiUrlCheckSchema = z.object({
  url: z.string(),
  status: z.enum([
    'unsafe',
    'unknown',
    'error',
    'not_configured',
    'skipped',
  ]),
  message: z.string(),
});

export const AiResponseSchema = z
  .object({
    status: AiStatusSchema,
    message: z.string().optional(),
    question: z.string().optional(),
    choices: z.array(z.string()).optional(),
    displayText: z.string().optional(),
    voiceText: z.string().optional(),
    currentStep: z.number().optional(),
    totalSteps: z.number().optional(),
    rationale: z.string().optional(),
    riskLevel: AiRiskLevelSchema.optional(),
    recommendedActions: z.array(z.string()).optional(),
    sources: z.array(AiSourceSchema).optional(),
    explanation: AiExplanationSchema.optional(),
    urlChecks: z.array(AiUrlCheckSchema).optional(),
    mode: z.enum(['live', 'demo', 'offline']).optional(),
  })
  .passthrough();

/**
 * 壊れた JSON / 未知の形でもアプリを落とさない。
 * guiding / explained / safety_result の必須寄りのフィールドを整える。
 */
export function validateAiResponse(input: unknown): AiResponse {
  const result = AiResponseSchema.safeParse(input);
  if (result.success) {
    return normalizeAiResponseFields(result.data);
  }

  return {
    status: 'error',
    message:
      'AIの返答の形が正しくありませんでした。もう一度、短い言葉で教えてください。',
    mode: 'offline',
  };
}

export function normalizeAiResponseFields(response: AiResponse): AiResponse {
  let next = normalizeGuidanceFields(response);
  next = normalizeExplanationFields(next);
  next = normalizeSafetyFields(next);
  return next;
}

/**
 * 1ステップ案内用フィールドを安全な形に揃える。
 * 複数手順を画面に出さないよう、displayText は1文相当を想定。
 */
export function normalizeGuidanceFields(response: AiResponse): AiResponse {
  if (response.status !== 'guiding') {
    return response;
  }

  const currentStep = Math.max(
    1,
    Math.floor(
      typeof response.currentStep === 'number' && Number.isFinite(response.currentStep)
        ? response.currentStep
        : 1,
    ),
  );
  const rawTotal =
    typeof response.totalSteps === 'number' && Number.isFinite(response.totalSteps)
      ? response.totalSteps
      : currentStep;
  const totalSteps = Math.max(currentStep, Math.floor(rawTotal));
  const displayText =
    response.displayText?.trim() ||
    response.message?.trim() ||
    '次の操作を一つだけ行ってください。';
  const voiceText = response.voiceText?.trim() || displayText;

  return {
    ...response,
    currentStep,
    totalSteps,
    displayText,
    voiceText,
  };
}

/** 文章解説: explanation が欠けていても表示できるように補完 */
export function normalizeExplanationFields(response: AiResponse): AiResponse {
  if (response.status !== 'explained') {
    return response;
  }

  const explanation = response.explanation;
  if (
    explanation &&
    explanation.displayedText.trim() &&
    explanation.plainMeaning.trim()
  ) {
    return {
      ...response,
      explanation: {
        displayedText: explanation.displayedText.trim(),
        plainMeaning: explanation.plainMeaning.trim(),
        whatHappens:
          explanation.whatHappens.trim() ||
          '表示だけでは、操作後の影響を断定できません。',
        cautions:
          explanation.cautions.trim() ||
          'よく分からないときは、許可や拒否を急がないでください。',
        judgmentPoints:
          explanation.judgmentPoints.trim() ||
          'どのアプリの画面か分かると、より正確に説明できます。',
      },
      displayText:
        response.displayText?.trim() || explanation.plainMeaning.trim(),
      voiceText:
        response.voiceText?.trim() ||
        [
          explanation.plainMeaning,
          explanation.whatHappens,
          explanation.cautions,
        ]
          .filter((part) => part.trim())
          .join(' '),
    };
  }

  // explanation 欠落時は message / displayText から最低限の区画を作る
  const fallbackText =
    response.displayText?.trim() ||
    response.message?.trim() ||
    'この表示の意味を、もう少し詳しく教えてください。';

  return {
    ...response,
    explanation: {
      displayedText: fallbackText,
      plainMeaning: fallbackText,
      whatHappens: '表示だけでは、操作後の影響を断定できません。',
      cautions: 'よく分からないときは、許可や拒否を急がないでください。',
      judgmentPoints: 'どのアプリの画面か分かると、より正確に説明できます。',
    },
    displayText: response.displayText?.trim() || fallbackText,
    voiceText: response.voiceText?.trim() || fallbackText,
  };
}

/**
 * 安全性検査: 「安全です」断定を避け、riskLevel を3段階に揃える。
 * sources は実URLのみ残す（空や明らかに架空のものは落とす）。
 */
export function normalizeSafetyFields(response: AiResponse): AiResponse {
  if (response.status !== 'safety_result') {
    return response;
  }

  const riskLevel = response.riskLevel ?? 'insufficient_info';
  const sources = (response.sources ?? [])
    .map((source) => ({
      title: source.title.trim() || '出典',
      url: source.url.trim(),
    }))
    .filter((source) => isPlausibleHttpUrl(source.url));

  const forbiddenSafeClaim =
    /安全です|絶対に問題ありません|問題ありません|大丈夫です/u;
  let message = response.message?.trim();
  if (message && forbiddenSafeClaim.test(message)) {
    message =
      '公開情報だけでは断定できません。不審な点があれば、返信や個人情報の提供は控え、公式の窓口で確認してください。';
  }

  return {
    ...response,
    riskLevel,
    sources,
    message,
    displayText:
      response.displayText?.trim() ||
      riskLevelLabel(riskLevel),
    recommendedActions: response.recommendedActions?.filter(
      (item) => item.trim().length > 0,
    ),
    urlChecks: response.urlChecks?.map((item) => ({
      url: item.url.trim(),
      status: item.status,
      message: item.message.trim(),
    })),
  };
}

export function riskLevelLabel(
  riskLevel: NonNullable<AiResponse['riskLevel']>,
): string {
  switch (riskLevel) {
    case 'dangerous':
      return '危険な特徴が見つかりました';
    case 'caution':
      return '注意が必要です';
    case 'insufficient_info':
    default:
      return '公開情報では判断できません';
  }
}

function isPlausibleHttpUrl(url: string): boolean {
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseAiResponseText(raw: string): AiResponse {
  try {
    const cleaned = stripCodeFence(raw);
    return validateAiResponse(JSON.parse(cleaned) as unknown);
  } catch {
    return {
      status: 'error',
      message:
        'AIの返答を読めませんでした。通信をもう一度試すか、別の言い方で教えてください。',
      mode: 'offline',
    };
  }
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fence?.[1]?.trim() ?? trimmed;
}

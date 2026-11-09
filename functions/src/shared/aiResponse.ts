import { z } from 'zod';

/** アプリと揃えた構造化回答スキーマ。壊れた JSON で落ちないよう緩く検証する。 */
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

export type AiResponse = z.infer<typeof AiResponseSchema>;

export const ConsultFeatureIdSchema = z.enum([
  'operationSupport',
  'textExplanation',
  'safetyCheck',
]);

export const GuidanceActionSchema = z.enum(['start', 'done', 'simplify']);

export const SafetyActionSchema = z.enum(['phone_search', 'message_analyze']);

export const ConsultRequestSchema = z.object({
  featureId: ConsultFeatureIdSchema,
  text: z.string().default(''),
  choiceLabel: z.string().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string(),
      }),
    )
    .optional(),
  /** 操作支援の1ステップ案内。replay（もう一度聞く）は端末側のみ。 */
  guidanceAction: GuidanceActionSchema.optional(),
  /** 安全性検査アクション */
  safetyAction: SafetyActionSchema.optional(),
  /** 電話番号を公開情報検索へ送ることへの同意 */
  searchConsent: z.boolean().optional(),
});

export type ConsultRequest = z.infer<typeof ConsultRequestSchema>;

/**
 * Gemini が返した文字列を安全に AiResponse へ。失敗時は error ステータス。
 */
export function parseAiResponseJson(raw: string): AiResponse {
  try {
    const cleaned = stripCodeFence(raw);
    const parsed: unknown = JSON.parse(cleaned);
    const result = AiResponseSchema.safeParse(parsed);
    if (result.success) {
      return sanitizeSafetyClaims(result.data);
    }
    return {
      status: 'error',
      message:
        'AIの返答の形が正しくありませんでした。もう一度、短い言葉で教えてください。',
      mode: 'live',
    };
  } catch {
    return {
      status: 'error',
      message:
        'AIの返答を読めませんでした。通信をもう一度試すか、別の言い方で教えてください。',
      mode: 'live',
    };
  }
}

/** 「安全です」断定をサーバー側でも落とす */
export function sanitizeSafetyClaims(response: AiResponse): AiResponse {
  if (response.status !== 'safety_result') {
    return response;
  }

  const forbidden = /安全です|絶対に問題ありません|問題ありません/u;
  let message = response.message;
  if (message && forbidden.test(message)) {
    message =
      '公開情報だけでは断定できません。不審な点があれば、返信や個人情報の提供は控え、公式の窓口で確認してください。';
  }

  const sources = (response.sources ?? []).filter((source) =>
    isPlausibleHttpUrl(source.url),
  );

  return {
    ...response,
    message,
    riskLevel: response.riskLevel ?? 'insufficient_info',
    sources,
  };
}

function isPlausibleHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fence?.[1]?.trim() ?? trimmed;
}

/** Gemini の responseJsonSchema 用（Zod から生成せず明示定義） */
export const AI_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    status: {
      type: 'string',
      enum: [
        'need_more_info',
        'ready_to_help',
        'guiding',
        'explained',
        'safety_result',
        'error',
      ],
    },
    message: { type: 'string' },
    question: { type: 'string' },
    choices: { type: 'array', items: { type: 'string' } },
    displayText: { type: 'string' },
    voiceText: { type: 'string' },
    currentStep: { type: 'number' },
    totalSteps: { type: 'number' },
    rationale: { type: 'string' },
    riskLevel: {
      type: 'string',
      enum: ['dangerous', 'caution', 'insufficient_info'],
    },
    recommendedActions: { type: 'array', items: { type: 'string' } },
    sources: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          url: { type: 'string' },
        },
        required: ['title', 'url'],
      },
    },
    explanation: {
      type: 'object',
      properties: {
        displayedText: { type: 'string' },
        plainMeaning: { type: 'string' },
        whatHappens: { type: 'string' },
        cautions: { type: 'string' },
        judgmentPoints: { type: 'string' },
      },
      required: [
        'displayedText',
        'plainMeaning',
        'whatHappens',
        'cautions',
        'judgmentPoints',
      ],
    },
    urlChecks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          status: {
            type: 'string',
            enum: [
              'unsafe',
              'unknown',
              'error',
              'not_configured',
              'skipped',
            ],
          },
          message: { type: 'string' },
        },
        required: ['url', 'status', 'message'],
      },
    },
  },
  required: ['status'],
} as const;

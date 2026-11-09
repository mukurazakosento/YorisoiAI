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
      return result.data;
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
  },
  required: ['status'],
} as const;

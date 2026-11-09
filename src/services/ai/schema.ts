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

/**
 * 壊れた JSON / 未知の形でもアプリを落とさない。
 */
export function validateAiResponse(input: unknown): AiResponse {
  const result = AiResponseSchema.safeParse(input);
  if (result.success) {
    return result.data;
  }

  return {
    status: 'error',
    message:
      'AIの返答の形が正しくありませんでした。もう一度、短い言葉で教えてください。',
    mode: 'offline',
  };
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

import { GoogleGenAI } from '@google/genai';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

import {
  ConsultRequestSchema,
  parseAiResponseJson,
  AI_RESPONSE_JSON_SCHEMA,
  type AiResponse,
} from '../shared/aiResponse';
import {
  DEFAULT_CHAT_MODEL_ID,
  resolveChatModelId,
} from '../shared/models';
import { buildSystemInstruction, buildUserPrompt } from './prompts';

/** Secret Manager 上の Gemini API キー（アプリには置かない） */
export const geminiApiKey = defineSecret('GEMINI_API_KEY');

/** 通常相談モデル。未設定時は公式の低コストモデルを既定にする */
export const geminiChatModel = defineString('GEMINI_MODEL_DEFAULT', {
  default: DEFAULT_CHAT_MODEL_ID,
  description: 'Gemini model ID for normal consultation chat',
});

/**
 * 相談 Callable（Functions v2）。
 * 画像は受け取らない。テキスト相談と動的選択肢のみ。
 */
export const consultWithAi = onCall(
  {
    secrets: [geminiApiKey],
    region: 'asia-northeast1',
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async (request): Promise<AiResponse> => {
    const parsedRequest = ConsultRequestSchema.safeParse(request.data ?? {});
    if (!parsedRequest.success) {
      throw new HttpsError(
        'invalid-argument',
        '相談内容の形式が正しくありません。',
      );
    }

    const apiKey = geminiApiKey.value();
    if (!apiKey) {
      logger.error('GEMINI_API_KEY secret is empty');
      return {
        status: 'error',
        message:
          'AIの鍵がサーバーに設定されていません。管理者に連絡してください。',
        mode: 'live',
      };
    }

    const modelId = resolveChatModelId(geminiChatModel.value());
    const ai = new GoogleGenAI({ apiKey });

    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: buildUserPrompt(parsedRequest.data),
        config: {
          systemInstruction: buildSystemInstruction(
            parsedRequest.data.featureId,
          ),
          responseMimeType: 'application/json',
          responseJsonSchema: AI_RESPONSE_JSON_SCHEMA,
          temperature: 0.4,
        },
      });

      const rawText = response.text ?? '';
      if (!rawText.trim()) {
        return {
          status: 'error',
          message:
            'AIから返事がありませんでした。もう一度試すか、短い言葉で教えてください。',
          mode: 'live',
        };
      }

      const aiResponse = parseAiResponseJson(rawText);
      return { ...aiResponse, mode: 'live' };
    } catch (error) {
      logger.error('Gemini consult failed', error);
      return {
        status: 'error',
        message:
          '通信できませんでした。インターネットの接続を確認して、もう一度お試しください。',
        mode: 'live',
      };
    }
  },
);

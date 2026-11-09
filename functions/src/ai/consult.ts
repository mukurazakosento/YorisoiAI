import { GoogleGenAI } from '@google/genai';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

import {
  applyGroundingSourcesToSafetyResult,
  extractGroundingSources,
} from '../security/grounding';
import {
  checkUrlsWithWebRisk,
  extractUrlsFromText,
} from '../security/webRisk';
import {
  ConsultRequestSchema,
  parseAiResponseJson,
  sanitizeSafetyClaims,
  AI_RESPONSE_JSON_SCHEMA,
  type AiResponse,
  type ConsultRequest,
} from '../shared/aiResponse';
import {
  DEFAULT_CHAT_MODEL_ID,
  resolveChatModelId,
  resolveGroundingModelId,
} from '../shared/models';
import {
  hasGeminiApiKey,
  responseWhenGeminiKeyMissing,
} from './geminiKey';
import {
  buildPhoneGroundingPrompt,
  buildSystemInstruction,
  buildUserPrompt,
} from './prompts';

/** Secret Manager 上の Gemini API キー（アプリには置かない） */
export const geminiApiKey = defineSecret('GEMINI_API_KEY');

/**
 * Web Risk API キー（任意）。
 * 未設定でもデプロイ可能にするため secrets 配列には必須追加しない。
 * 有効化時: `firebase functions:secrets:set WEBRISK_API_KEY` のうえ、
 * この関数の secrets に webRiskApiKey を足して再デプロイする。
 * それまでは process.env.WEBRISK_API_KEY または未設定として not_configured を返す。
 */
export const webRiskApiKey = defineSecret('WEBRISK_API_KEY');

/** 通常相談モデル。未設定時は公式の低コストモデルを既定にする */
export const geminiChatModel = defineString('GEMINI_MODEL_DEFAULT', {
  default: DEFAULT_CHAT_MODEL_ID,
  description: 'Gemini model ID for normal consultation chat',
});

/** 調査 / Grounding 用モデル */
export const geminiGroundingModel = defineString('GEMINI_MODEL_GROUNDING', {
  default: 'gemini-3.8-flash',
  description: 'Gemini model ID for phone lookup with Google Search Grounding',
});

/**
 * 相談 Callable（Functions v2）。
 * 画像は受け取らない。テキスト相談・動的選択肢・操作支援・文章解説・安全性検査。
 * GEMINI_API_KEY 未設定時は mode=offline（Firebase が生きていても live としない）。
 */
export const consultWithAi = onCall(
  {
    secrets: [geminiApiKey],
    region: 'asia-northeast1',
    timeoutSeconds: 90,
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
    if (!hasGeminiApiKey(apiKey)) {
      logger.error('GEMINI_API_KEY secret is empty');
      return responseWhenGeminiKeyMissing();
    }

    const data = parsedRequest.data;

    // 電話番号調査は同意必須。番号以外を送らない想定。
    if (data.safetyAction === 'phone_search') {
      if (!data.searchConsent) {
        return {
          status: 'need_more_info',
          mode: 'live',
          message:
            '電話番号を公開情報で調べるには、事前の同意が必要です。',
          question: 'この番号をインターネットの公開情報で調べてもよいですか？',
          displayText: '検索への同意が必要です。',
          riskLevel: 'insufficient_info',
        };
      }
      return runPhoneGroundingLookup({
        apiKey: apiKey.trim(),
        phoneNumber: data.text.trim(),
        groundingModel: resolveGroundingModelId(geminiGroundingModel.value()),
      });
    }

    const chatModelId = resolveChatModelId(geminiChatModel.value());
    const ai = new GoogleGenAI({ apiKey: apiKey.trim() });

    try {
      const response = await ai.models.generateContent({
        model: chatModelId,
        contents: buildUserPrompt(data),
        config: {
          systemInstruction: buildSystemInstruction(data.featureId),
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

      let aiResponse = parseAiResponseJson(rawText);
      aiResponse = await attachWebRiskIfNeeded(aiResponse, data);
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

async function runPhoneGroundingLookup(args: {
  apiKey: string;
  phoneNumber: string;
  groundingModel: string;
}): Promise<AiResponse> {
  const phone = args.phoneNumber.replace(/[^\d+]/g, '');
  if (phone.replace(/\D/g, '').length < 10) {
    return {
      status: 'need_more_info',
      mode: 'live',
      message: '電話番号の形式を確認できませんでした。番号を修正してください。',
      displayText: '番号を確認してください。',
      riskLevel: 'insufficient_info',
    };
  }

  const ai = new GoogleGenAI({ apiKey: args.apiKey });

  try {
    // Grounding と responseJsonSchema は併用しない。テキスト JSON をパースし、出典は metadata のみ。
    const response = await ai.models.generateContent({
      model: args.groundingModel,
      contents: buildPhoneGroundingPrompt(phone),
      config: {
        systemInstruction: buildSystemInstruction('safetyCheck'),
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
      },
    });

    const rawText = response.text ?? '';
    if (!rawText.trim()) {
      return {
        status: 'safety_result',
        mode: 'live',
        riskLevel: 'insufficient_info',
        message:
          '公開情報を取得できませんでした。情報が無いことを安全の証拠にはしません。',
        displayText: '公開情報では判断できません',
        recommendedActions: [
          '相手に個人情報を伝えない',
          '公式に掲載された窓口へ確認する',
        ],
        sources: [],
      };
    }

    const parsed = parseAiResponseJson(rawText);
    const groundingSources = extractGroundingSources(response);
    const withSources = applyGroundingSourcesToSafetyResult(
      parsed,
      groundingSources,
    );
    const sanitized = sanitizeSafetyClaims({
      ...withSources,
      status: 'safety_result',
      riskLevel: withSources.riskLevel ?? 'insufficient_info',
    });

    return { ...sanitized, mode: 'live' };
  } catch (error) {
    logger.error('Phone grounding lookup failed', error);
    return {
      status: 'safety_result',
      mode: 'live',
      riskLevel: 'insufficient_info',
      message:
        '公開情報の調査中にエラーが起きました。安全とは判断しません。個人情報は伝えず、公式窓口で確認してください。',
      displayText: '公開情報では判断できません',
      recommendedActions: [
        '相手に個人情報を伝えない',
        '折り返しは着信番号ではなく公式窓口へ',
      ],
      sources: [],
    };
  }
}

function readOptionalWebRiskApiKey(): string | undefined {
  const fromEnv = process.env.WEBRISK_API_KEY;
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.trim();
  }
  try {
    const fromSecret = webRiskApiKey.value();
    if (typeof fromSecret === 'string' && fromSecret.trim().length > 0) {
      return fromSecret.trim();
    }
  } catch {
    // Secret 未バインドは想定内
  }
  return undefined;
}

async function attachWebRiskIfNeeded(
  aiResponse: AiResponse,
  request: ConsultRequest,
): Promise<AiResponse> {
  if (request.featureId !== 'safetyCheck') {
    return aiResponse;
  }

  const fromText = extractUrlsFromText(request.text);
  const existing = aiResponse.urlChecks?.map((item) => item.url) ?? [];
  const urls = [...new Set([...fromText, ...existing])];
  if (urls.length === 0) {
    return aiResponse;
  }

  // Secret 未バインド時は env も空 → not_configured（ライブの成功を装わない）
  const webRiskKey = readOptionalWebRiskApiKey();
  const urlChecks = await checkUrlsWithWebRisk(urls, webRiskKey);

  // Web Risk で unsafe があれば危険側へ寄せる（「安全」にはしない）
  let riskLevel = aiResponse.riskLevel ?? 'insufficient_info';
  if (urlChecks.some((item) => item.status === 'unsafe')) {
    riskLevel = 'dangerous';
  } else if (
    riskLevel === 'insufficient_info' &&
    urlChecks.some(
      (item) =>
        item.status === 'unknown' ||
        item.status === 'not_configured' ||
        item.status === 'error',
    )
  ) {
    riskLevel = 'caution';
  }

  return sanitizeSafetyClaims({
    ...aiResponse,
    status: aiResponse.status === 'error' ? aiResponse.status : 'safety_result',
    riskLevel:
      aiResponse.status === 'safety_result' ||
      request.safetyAction === 'message_analyze'
        ? riskLevel
        : aiResponse.riskLevel,
    urlChecks,
  });
}

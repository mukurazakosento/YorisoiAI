import { httpsCallable } from 'firebase/functions';

import { appConfig } from '../../constants/config';
import type { AiResponse } from '../../types/ai';
import {
  getFirebaseFunctions,
  isFirebaseConfigured,
} from '../firebase';
import { getOnDeviceAiBanner } from '../onDeviceAi';
import {
  resolveConnectionFromMode,
  type AiConnection,
} from './connection';
import { buildDemoConsultationResponse } from './demoFallback';
import { formatGuidanceHistoryText } from './guidanceDemo';
import { validateAiResponse } from './schema';
import type { ConsultRequest, GuidanceAction, SafetyAction } from './types';

export type {
  ConsultHistoryTurn,
  ConsultRequest,
  GuidanceAction,
  SafetyAction,
} from './types';
export type { AiConnection } from './connection';
export type ConsultResult = AiResponse & {
  /** live=Functions経由 / demo=明示デモ / offline=未接続フォールバック */
  connection: AiConnection;
};

/**
 * 旧 Gemini Cloud Functions 相談サービス（任意・非既定）。
 * 最終仕様の相談／支援フローは `services/onDeviceAi` を使う。
 * - legacy フラグOFF / Firebase 未設定 → 「AI未接続」デモ（ライブのふりをしない）
 * - 設定あり → Cloud Functions `consultWithAi` を呼ぶ
 * - 応答は Zod で検証し、壊れた JSON でも落とさない
 */
export async function requestConsultation(
  request: ConsultRequest,
): Promise<ConsultResult> {
  if (!isFirebaseConfigured() || !appConfig.legacyCloudAiEnabled) {
    const demo = buildDemoConsultationResponse(request);
    return {
      ...demo,
      mode: 'demo',
      connection: 'demo',
    };
  }

  const functions = getFirebaseFunctions();
  if (!functions) {
    return {
      status: 'error',
      mode: 'offline',
      connection: 'offline',
      message:
        'AI未接続です。Firebaseの設定を確認するか、下の基本の選択肢をお使いください。',
      choices: undefined,
    };
  }

  try {
    const callable = httpsCallable(functions, 'consultWithAi');
    const result = await callable({
      featureId: request.featureId,
      text: request.text,
      choiceLabel: request.choiceLabel,
      history: request.history,
      guidanceAction: request.guidanceAction,
      safetyAction: request.safetyAction,
      searchConsent: request.searchConsent,
    });

    const validated = validateAiResponse(result.data);
    // Firebase は生きていても Gemini 未設定なら mode=offline → connection も offline
    const mode = validated.mode ?? 'live';
    return {
      ...validated,
      mode,
      connection: resolveConnectionFromMode(mode),
    };
  } catch {
    return {
      status: 'error',
      mode: 'offline',
      connection: 'offline',
      message:
        'AI未接続、または通信できませんでした。インターネットを確認するか、基本の選択肢をお使いください。',
    };
  }
}

export function getAiConnectionBanner(): {
  connected: boolean;
  message: string;
} {
  // 最終仕様: 端末内 AI の状態を優先表示
  const onDevice = getOnDeviceAiBanner();
  if (onDevice.connected) {
    return onDevice;
  }

  if (isFirebaseConfigured() && appConfig.legacyCloudAiEnabled) {
    return {
      connected: false,
      message:
        '端末内AIは未接続です。旧クラウドGemini経路の設定はありますが、最終仕様の既定ではありません。',
    };
  }

  return {
    connected: false,
    message: onDevice.message,
  };
}

export function buildAssistantHistoryText(response: AiResponse): string {
  if (response.status === 'guiding') {
    return formatGuidanceHistoryText(response);
  }
  if (response.status === 'explained' && response.explanation) {
    const e = response.explanation;
    return [
      `【表示】${e.displayedText}`,
      `【簡単に】${e.plainMeaning}`,
      `【操作後】${e.whatHappens}`,
    ].join(' / ');
  }
  if (response.status === 'safety_result') {
    return [
      response.displayText,
      response.message,
      response.riskLevel ? `risk:${response.riskLevel}` : '',
    ]
      .filter(Boolean)
      .join(' / ');
  }
  return (
    response.message ??
    response.displayText ??
    response.question ??
    ''
  );
}

export {
  isAiActuallyConnected,
  resolveConnectionFromMode,
} from './connection';
export { buildDemoConsultationResponse } from './demoFallback';
export { buildDemoExplanationResponse } from './explanationDemo';
export {
  buildDemoGuidanceResponse,
  formatGuidanceHistoryText,
  shouldOfferGuidanceStart,
} from './guidanceDemo';
export { buildDemoSafetyResponse } from './safetyDemo';
export {
  validateAiResponse,
  parseAiResponseText,
  normalizeGuidanceFields,
  normalizeExplanationFields,
  normalizeSafetyFields,
  normalizeAiResponseFields,
  riskLevelLabel,
} from './schema';

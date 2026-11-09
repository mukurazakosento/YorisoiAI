import { httpsCallable } from 'firebase/functions';

import { appConfig } from '../../constants/config';
import type { AiResponse } from '../../types/ai';
import {
  getFirebaseFunctions,
  isFirebaseConfigured,
} from '../firebase';
import { buildDemoConsultationResponse } from './demoFallback';
import { formatGuidanceHistoryText } from './guidanceDemo';
import { validateAiResponse } from './schema';
import type { ConsultRequest, GuidanceAction } from './types';

export type { ConsultHistoryTurn, ConsultRequest, GuidanceAction } from './types';
export type ConsultResult = AiResponse & {
  /** live=Functions経由 / demo=明示デモ / offline=未接続フォールバック */
  connection: 'live' | 'demo' | 'offline';
};

/**
 * AI 相談サービス。
 * - Firebase 未設定 → 「AI未接続」デモ（ライブのふりをしない）
 * - 設定あり → Cloud Functions `consultWithAi` を呼ぶ
 * - 応答は Zod で検証し、壊れた JSON でも落とさない
 * - 操作支援の guidanceAction で1ステップ案内を進める
 */
export async function requestConsultation(
  request: ConsultRequest,
): Promise<ConsultResult> {
  if (!isFirebaseConfigured() || !appConfig.aiConnected) {
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
    });

    const validated = validateAiResponse(result.data);
    return {
      ...validated,
      mode: validated.mode ?? 'live',
      connection: 'live',
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
  if (isFirebaseConfigured() && appConfig.aiConnected) {
    return {
      connected: true,
      message: 'AIに接続する準備ができています。相談内容を送るとサーバー経由で答えます。',
    };
  }

  return {
    connected: false,
    message:
      'AI未接続です。いまはデモ用の案内と基本の選択肢だけが使えます。本物のAIではありません。',
  };
}

export function buildAssistantHistoryText(response: AiResponse): string {
  if (response.status === 'guiding') {
    return formatGuidanceHistoryText(response);
  }
  return (
    response.message ??
    response.displayText ??
    response.question ??
    ''
  );
}

export { buildDemoConsultationResponse } from './demoFallback';
export {
  buildDemoGuidanceResponse,
  formatGuidanceHistoryText,
  shouldOfferGuidanceStart,
} from './guidanceDemo';
export { validateAiResponse, parseAiResponseText, normalizeGuidanceFields } from './schema';

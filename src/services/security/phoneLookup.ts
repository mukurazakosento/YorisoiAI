/**
 * 電話番号の公開情報調査（任意）。
 * - 既定: 呼ばず端末内ヒューリスティックのみ
 * - EXPO_PUBLIC_LEGACY_CLOUD_AI=true かつ Firebase 設定時のみ Cloud Functions
 *   （Gemini Search Grounding）。鍵が無ければ offline / demo を正直に返す。
 * アプリに API キーは置かない。自動発信もしない。
 */

import type { AiResponse } from '../../types/ai';
import { appConfig } from '../../constants/config';
import { isFirebaseConfigured } from '../firebase';
import { buildPhoneSearchPayload } from './phone';

export type PhoneLookupAttempt = {
  attempted: boolean;
  result: AiResponse | null;
  reason: string;
};

/**
 * 同意済み番号だけを、任意の legacy Cloud Functions 経路で調べる。
 * 同意が無い／legacy OFF のときはネットワークに出ない。
 */
export async function lookupPhoneNumberViaLegacyCloud(input: {
  phoneNumber: string;
  searchConsent: boolean;
}): Promise<PhoneLookupAttempt> {
  if (!input.searchConsent) {
    return {
      attempted: false,
      result: null,
      reason: '公開情報検索への同意がまだありません。',
    };
  }

  const payload = buildPhoneSearchPayload(input.phoneNumber);
  if (payload.replace(/\D/g, '').length < 10) {
    return {
      attempted: false,
      result: null,
      reason: '番号の桁が足りないため、検索しませんでした。',
    };
  }

  if (!appConfig.legacyCloudAiEnabled || !isFirebaseConfigured()) {
    return {
      attempted: false,
      result: null,
      reason:
        '公開情報の実検索には EXPO_PUBLIC_LEGACY_CLOUD_AI=true と Firebase、およびサーバー側の GEMINI_API_KEY が必要です。いまは端末内の確認のみです。',
    };
  }

  try {
    const { requestConsultation } = await import('../ai');
    const result = await requestConsultation({
      featureId: 'safetyCheck',
      text: payload,
      safetyAction: 'phone_search',
      searchConsent: true,
      choiceLabel: '知らない電話番号',
    });
    return {
      attempted: true,
      result,
      reason:
        result.mode === 'live'
          ? 'Cloud Functions 経由で公開情報を調べました。'
          : result.mode === 'offline'
            ? 'サーバーに Gemini 鍵が無いか、未接続のため実検索できませんでした。'
            : 'デモ応答です。実検索結果ではありません。',
    };
  } catch {
    return {
      attempted: true,
      result: null,
      reason: '通信エラーのため、公開情報の検索に失敗しました。',
    };
  }
}

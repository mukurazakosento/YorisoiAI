import type { AiResponse } from '../shared/aiResponse';

/** Gemini 未設定時の利用者向け文言（接続済みのふりをしない） */
export const OFFLINE_NO_GEMINI_MESSAGE =
  'AI未接続です。基本の選択肢をご利用ください';

/**
 * Secret / env の Gemini API キーが実利用できるか。
 * 空文字・空白のみは未設定扱い。
 */
export function hasGeminiApiKey(apiKey: string | undefined | null): boolean {
  return typeof apiKey === 'string' && apiKey.trim().length > 0;
}

/**
 * Firebase Functions は生きていても Gemini 鍵が無い場合の応答。
 * mode は必ず offline（live と誤表示しない）。
 */
export function responseWhenGeminiKeyMissing(): AiResponse {
  return {
    status: 'error',
    message: OFFLINE_NO_GEMINI_MESSAGE,
    mode: 'offline',
  };
}

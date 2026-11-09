/**
 * Gemini モデル ID は環境変数 / Firebase params からのみ参照する。
 * コード各所にハードコードしない（マスター指示書 10-1）。
 *
 * 公式確認時点（2026-11）の安定 ID:
 * - 通常相談: gemini-3.5-flash-lite
 * - 調査/Grounding: gemini-3.8-flash
 * 参照: https://aistudio.google.com/docs/models
 */
export const DEFAULT_CHAT_MODEL_ID = 'gemini-3.5-flash-lite';
export const DEFAULT_GROUNDING_MODEL_ID = 'gemini-3.8-flash';

export function resolveChatModelId(
  envValue: string | undefined,
): string {
  const trimmed = envValue?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_CHAT_MODEL_ID;
}

export function resolveGroundingModelId(
  envValue: string | undefined,
): string {
  const trimmed = envValue?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_GROUNDING_MODEL_ID;
}

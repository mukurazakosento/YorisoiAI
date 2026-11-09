import type { AiResponseMode } from '../../types/ai';

export type AiConnection = 'live' | 'demo' | 'offline';

/**
 * Functions / デモ応答の mode からアプリ表示用 connection を決める。
 * Firebase だけ生きていて Gemini が offline のときは live 扱いにしない。
 */
export function resolveConnectionFromMode(
  mode: AiResponseMode | undefined,
): AiConnection {
  if (mode === 'offline') {
    return 'offline';
  }
  if (mode === 'demo') {
    return 'demo';
  }
  return 'live';
}

/**
 * 結果表示・バナー用。実際につながっていないのに「接続済み」と出さない。
 */
export function isAiActuallyConnected(
  connection: AiConnection,
  mode?: AiResponseMode,
): boolean {
  if (connection === 'offline' || connection === 'demo') {
    return false;
  }
  if (mode === 'offline' || mode === 'demo') {
    return false;
  }
  return connection === 'live';
}

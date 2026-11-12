import { isNativeRuntime } from './platformInfo';
import type { OnDeviceEngine } from './types';

/**
 * ネイティブ iOS / Android 向け端末内 Llama 経路のスキャフォールド。
 *
 * 正直な現状:
 * - このリポジトリには llama.cpp / ExecuTorch / MLX のネイティブモジュールは未リンク
 * - Cloud Agent VM ではモデル推論を実行できない
 * - WebLLM はブラウザ（Expo Web）専用であり、ネイティブでは使えない
 *
 * 将来の現実的な配線候補:
 * 1. Expo Module / RN TurboModule で llama.cpp（GGUF）または ExecuTorch を包む
 * 2. モデルファイルはアプリバンドル or 初回ダウンロード（ユーザー同意）で端末内に保持
 * 3. 本ファイルの `createNativeLlamaEngine` が OnDeviceEngine を返すように差し替える
 * 4. 画像バイトはエンジンに渡さない（テキスト JSON のみ）
 *
 * 成功したふりをしない: 現状は常に null（unavailable）。
 */
export const NATIVE_LLAMA_STATUS_DETAIL = [
  'ネイティブ端末内Llamaは未接続です。',
  '将来: llama.cpp または ExecuTorch 等の Expo Module を想定。',
  'WebLLM は iOS/Android ネイティブでは動きません（Expo Web 向け）。',
].join(' ');

export function isNativePlatform(): boolean {
  return isNativeRuntime();
}

/**
 * 将来のネイティブエンジン生成口。
 * 現状は常に null（実装なし）。偽の推論結果は返さない。
 */
export async function createNativeLlamaEngine(_options?: {
  modelId?: string;
}): Promise<OnDeviceEngine | null> {
  return null;
}

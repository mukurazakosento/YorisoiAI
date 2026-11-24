import { ANDROID_NATIVE_MODEL, MODEL_CONSENT_EXPLAIN_JA } from './modelCatalog';
import { getRuntimeOs, isNativeRuntime } from './platformInfo';
import type { OnDeviceEngine, OnDeviceEngineChatMessage } from './types';

/**
 * ネイティブ Android 向け端末内 LLM（MediaPipe GenAI + Gemma 3 1B int4）。
 *
 * 正直な現状:
 * - Android EAS development / preview でモジュールがリンクされ、同意→ダウンロード→
 *   load+probe 成功したときだけ ready / live
 * - iOS / Web / Expo Go / この Cloud Agent VM: ネイティブ推論は不可 → null（AI未接続）
 * - 画像バイトはエンジンに渡さない（テキスト JSON のみ）
 * - WebLLM は Expo Web 専用（本ファイルの対象外）
 */
export const NATIVE_LLAMA_STATUS_DETAIL = [
  `ネイティブ端末内AIは MediaPipe GenAI（${ANDROID_NATIVE_MODEL.displayName}）です。`,
  'Android の EAS ビルドで、同意のうえモデルを入れてプローブ成功したときだけ接続扱いにします。',
  'Cloud Agent VM・Expo Go・iOS・Web ではネイティブ推論できません（AI未接続／デモ）。',
  'WebLLM は iOS/Android ネイティブでは動きません（Expo Web 向け）。',
].join(' ');

export { MODEL_CONSENT_EXPLAIN_JA };

export function isNativePlatform(): boolean {
  return isNativeRuntime();
}

type NativeLlmApi = {
  isNativeOnDeviceLlmLinked: () => boolean;
  getNativeLlmStatus: () => {
    ready: boolean;
    hasConsent: boolean;
    modelPresent: boolean;
    probeVerified: boolean;
    modelId: string;
    engine: string;
    lastError: string;
  };
  loadNativeLlmModel: () => Promise<{
    ready: boolean;
    probe: string;
    modelId: string;
    engine: string;
  }>;
  nativeLlmGenerate: (prompt: string) => Promise<string>;
};

async function tryLoadNativeApi(): Promise<NativeLlmApi | null> {
  if (getRuntimeOs() !== 'android') {
    return null;
  }
  try {
    const mod = await import('yorisoi-on-device-llm');
    return mod;
  } catch {
    return null;
  }
}

function messagesToPrompt(messages: OnDeviceEngineChatMessage[]): string {
  // MediaPipe generate is a single prompt; fold chat roles into one text block.
  return messages
    .map((m) => {
      if (m.role === 'system') return `【システム】\n${m.content}`;
      if (m.role === 'assistant') return `【アシスタント】\n${m.content}`;
      return `【ユーザー】\n${m.content}`;
    })
    .join('\n\n');
}

/**
 * ネイティブエンジン生成口。
 * リンク無し・未同意・未ダウンロード・プローブ失敗 → null（偽の ready にしない）。
 */
export async function createNativeLlamaEngine(options?: {
  modelId?: string;
  /** When true, attempt load+probe if model file already present and consent given. */
  autoLoad?: boolean;
}): Promise<OnDeviceEngine | null> {
  const api = await tryLoadNativeApi();
  if (!api?.isNativeOnDeviceLlmLinked()) {
    return null;
  }

  const status = api.getNativeLlmStatus();
  if (!status.hasConsent) {
    return null;
  }

  let ready = status.ready && status.probeVerified;
  if (!ready && options?.autoLoad !== false && status.modelPresent) {
    try {
      const loaded = await api.loadNativeLlmModel();
      ready = Boolean(loaded.ready && loaded.probe?.trim());
    } catch {
      return null;
    }
  }

  if (!ready) {
    return null;
  }

  const modelId = options?.modelId || status.modelId || ANDROID_NATIVE_MODEL.modelId;
  const backend = 'native-llama' as const;

  return {
    backend,
    modelId,
    isReady: () => {
      try {
        const s = api.getNativeLlmStatus();
        return Boolean(s.ready && s.probeVerified);
      } catch {
        return false;
      }
    },
    chatJson: async (messages) => {
      const prompt = messagesToPrompt(messages);
      if (
        /data:image|imageBase64|screenshotBytes/i.test(prompt)
      ) {
        throw new Error('画像は端末内AIに渡しません。');
      }
      const text = await api.nativeLlmGenerate(prompt);
      if (!text.trim()) {
        throw new Error('推論結果が空です（AI未接続扱い）。');
      }
      return text;
    },
  };
}

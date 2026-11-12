/**
 * Expo Web / ブラウザ向け WebLLM 実装。
 *
 * 正直な制約:
 * - WebGPU が必要。無い環境ではロード失敗 → unavailable（live にしない）
 * - 初回はモデルダウンロードが発生する（数百MB級になり得る）
 * - Cloud Agent / CI では通常ロードしない（フラグOFF既定）
 * - 画像は送らない。テキスト JSON のみ
 */
import type { OnDeviceEngine, OnDeviceEngineChatMessage } from './types';

export const WEBLLM_DEFAULT_MODEL_ID =
  'Llama-3.2-1B-Instruct-q4f16_1-MLC';

export function isWebLlmSupportedPlatform(): boolean {
  return typeof window !== 'undefined';
}

type WebLlmModule = typeof import('@mlc-ai/web-llm');

async function loadWebLlmModule(): Promise<WebLlmModule | null> {
  try {
    return await import('@mlc-ai/web-llm');
  } catch {
    return null;
  }
}

function hasWebGpu(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

export async function createWebLlmEngine(options?: {
  modelId?: string;
  onProgress?: (text: string) => void;
}): Promise<OnDeviceEngine | null> {
  if (!isWebLlmSupportedPlatform()) {
    return null;
  }
  if (!hasWebGpu()) {
    options?.onProgress?.(
      'WebGPU が使えないため WebLLM を起動できません（AI未接続）。',
    );
    return null;
  }

  const webllm = await loadWebLlmModule();
  if (!webllm) {
    options?.onProgress?.(
      'WebLLM パッケージを読み込めませんでした（AI未接続）。',
    );
    return null;
  }

  const modelId = options?.modelId ?? WEBLLM_DEFAULT_MODEL_ID;

  try {
    const engine = await webllm.CreateMLCEngine(modelId, {
      initProgressCallback: (report) => {
        options?.onProgress?.(report.text);
      },
    });

    return {
      backend: 'webllm',
      modelId,
      isReady: () => true,
      async chatJson(messages: OnDeviceEngineChatMessage[]): Promise<string> {
        const completion = await engine.chat.completions.create({
          messages,
          temperature: 0.2,
          max_tokens: 700,
          // JSON っぽい出力を促す（厳密 schema はモデル依存）
          response_format: { type: 'json_object' },
        });
        const content = completion.choices[0]?.message?.content;
        if (typeof content !== 'string' || !content.trim()) {
          throw new Error('WebLLM から空の応答でした');
        }
        return content;
      },
    };
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : 'WebLLM の初期化に失敗しました';
    options?.onProgress?.(`AI未接続: ${detail}`);
    return null;
  }
}

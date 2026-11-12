import { appConfig } from '../../constants/config';
import {
  NATIVE_LLAMA_STATUS_DETAIL,
  createNativeLlamaEngine,
  isNativePlatform,
} from './nativeScaffold';
import { getRuntimeOs, isWebRuntime } from './platformInfo';
import type { OnDeviceAiStatus, OnDeviceEngine } from './types';
import {
  WEBLLM_DEFAULT_MODEL_ID,
  createWebLlmEngine,
  isWebLlmSupportedPlatform,
} from './webllm';

let engine: OnDeviceEngine | null = null;
let initPromise: Promise<OnDeviceAiStatus> | null = null;
let lastStatus: OnDeviceAiStatus = buildUnavailableStatus(
  '端末内AIはまだ初期化していません。未接続時はデモ案内のみです。',
);

function preferredBackend(): OnDeviceAiStatus['preferredBackend'] {
  if (isWebLlmSupportedPlatform() && isWebRuntime()) {
    return 'webllm';
  }
  if (isNativePlatform()) {
    return 'native-llama';
  }
  return 'none';
}

function buildUnavailableStatus(detail: string): OnDeviceAiStatus {
  const preferred = preferredBackend();
  return {
    lifecycle: 'unavailable',
    backend: 'demo',
    ready: false,
    preferredBackend: preferred,
    message: 'AI未接続です。いまはデモ案内のみ使えます。本物の端末内AIではありません。',
    detail,
  };
}

function buildReadyStatus(active: OnDeviceEngine): OnDeviceAiStatus {
  return {
    lifecycle: 'ready',
    backend: active.backend,
    ready: true,
    preferredBackend: preferredBackend(),
    message: `端末内AI（${active.backend} / ${active.modelId}）が使えます。`,
    detail: '画像は送りません。テキスト JSON のみです。',
  };
}

export function getOnDeviceAiStatus(): OnDeviceAiStatus {
  return lastStatus;
}

export function isOnDeviceAiReady(): boolean {
  return Boolean(engine?.isReady() && lastStatus.ready);
}

export function getActiveOnDeviceEngine(): OnDeviceEngine | null {
  return isOnDeviceAiReady() ? engine : null;
}

/**
 * テスト用: エンジンを外して必ずデモに戻す。
 */
export function resetOnDeviceAiForTests(): void {
  engine = null;
  initPromise = null;
  lastStatus = buildUnavailableStatus(
    'テスト用に端末内AIをリセットしました（AI未接続）。',
  );
}

/**
 * テスト／将来の差し替え用にエンジンを直接注入する。
 * ready=true は本物の OnDeviceEngine を渡したときだけ。
 */
export function setOnDeviceEngineForTests(next: OnDeviceEngine | null): void {
  engine = next;
  lastStatus = next?.isReady()
    ? buildReadyStatus(next)
    : buildUnavailableStatus('テスト用エンジンが未準備です（AI未接続）。');
}

/**
 * 端末内エンジンの初期化。
 * - EXPO_PUBLIC_ON_DEVICE_AI=true のときだけロードを試みる（既定は試行しない）
 * - 失敗時は必ず unavailable + デモ。live 扱いにしない
 */
export async function initOnDeviceAi(options?: {
  force?: boolean;
  onProgress?: (text: string) => void;
}): Promise<OnDeviceAiStatus> {
  if (engine?.isReady() && lastStatus.ready && !options?.force) {
    return lastStatus;
  }
  if (initPromise && !options?.force) {
    return initPromise;
  }

  initPromise = (async () => {
    lastStatus = {
      lifecycle: 'loading',
      backend: preferredBackend() === 'webllm' ? 'webllm' : 'none',
      ready: false,
      preferredBackend: preferredBackend(),
      message: '端末内AIを準備しています…',
      detail: '準備が終わるまでデモ扱いです（live にはしません）。',
    };

    if (!appConfig.onDeviceAiEnabled && !options?.force) {
      lastStatus = buildUnavailableStatus(
        [
          'EXPO_PUBLIC_ON_DEVICE_AI が有効でないためロードしません。',
          getRuntimeOs() === 'web'
            ? `Web ではフラグONかつ WebGPU があると WebLLM（既定 ${WEBLLM_DEFAULT_MODEL_ID}）を試せます。`
            : NATIVE_LLAMA_STATUS_DETAIL,
        ].join(' '),
      );
      engine = null;
      return lastStatus;
    }

    if (isWebRuntime() && isWebLlmSupportedPlatform()) {
      const webEngine = await createWebLlmEngine({
        modelId: appConfig.aiModelKeys.default,
        onProgress: options?.onProgress,
      });
      if (webEngine?.isReady()) {
        engine = webEngine;
        lastStatus = buildReadyStatus(webEngine);
        return lastStatus;
      }
      lastStatus = buildUnavailableStatus(
        'WebLLM をロードできませんでした。WebGPU・ネット・モデル取得を確認してください（AI未接続）。',
      );
      engine = null;
      return lastStatus;
    }

    if (isNativePlatform()) {
      const nativeEngine = await createNativeLlamaEngine({
        modelId: appConfig.aiModelKeys.default,
      });
      if (nativeEngine?.isReady()) {
        engine = nativeEngine;
        lastStatus = buildReadyStatus(nativeEngine);
        return lastStatus;
      }
      lastStatus = buildUnavailableStatus(NATIVE_LLAMA_STATUS_DETAIL);
      engine = null;
      return lastStatus;
    }

    lastStatus = buildUnavailableStatus(
      'この実行環境向けの端末内AIバックエンドがありません（AI未接続）。',
    );
    engine = null;
    return lastStatus;
  })();

  try {
    return await initPromise;
  } finally {
    // 完了後もキャッシュ。force 再試行は別呼び出し。
  }
}

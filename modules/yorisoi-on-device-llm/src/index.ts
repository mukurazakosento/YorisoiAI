import { Platform } from 'react-native';

import type {
  DownloadProgressEvent,
  NativeLlmStatus,
} from './YorisoiOnDeviceLlm.types';
import { getNativeOnDeviceLlmModule } from './YorisoiOnDeviceLlmModule';

export type { DownloadProgressEvent, NativeLlmStatus } from './YorisoiOnDeviceLlm.types';

export const NATIVE_LLM_MODEL_ID = 'gemma-3-1b-it-int4';
export const NATIVE_LLM_ENGINE = 'mediapipe-genai';
export const NATIVE_LLM_APPROX_BYTES = 555 * 1024 * 1024;
export const NATIVE_LLM_LICENSE = 'Gemma Terms of Use';
export const NATIVE_LLM_LICENSE_URL = 'https://ai.google.dev/gemma/terms';

export class OnDeviceLlmUnavailableError extends Error {
  readonly code = 'ON_DEVICE_LLM_UNAVAILABLE';

  constructor(message: string) {
    super(message);
    this.name = 'OnDeviceLlmUnavailableError';
  }
}

export function isNativeOnDeviceLlmLinked(): boolean {
  if (Platform.OS !== 'android') {
    return false;
  }
  const native = getNativeOnDeviceLlmModule();
  if (!native) {
    return false;
  }
  try {
    return native.isSupported();
  } catch {
    return false;
  }
}

function emptyStatus(detail = ''): NativeLlmStatus {
  return {
    engine: NATIVE_LLM_ENGINE,
    modelId: NATIVE_LLM_MODEL_ID,
    displayName: 'Gemma 3 1B Instruct (int4)',
    license: NATIVE_LLM_LICENSE,
    licenseUrl: NATIVE_LLM_LICENSE_URL,
    approxBytes: NATIVE_LLM_APPROX_BYTES,
    hasConsent: false,
    modelPresent: false,
    modelPath: '',
    ready: false,
    downloading: false,
    storageOk: false,
    freeBytes: 0,
    lastError: detail,
    probeVerified: false,
  };
}

export function getNativeLlmStatus(): NativeLlmStatus {
  const native = getNativeOnDeviceLlmModule();
  if (!native) {
    return emptyStatus(
      Platform.OS === 'android'
        ? 'ネイティブLLMモジュール未リンク（EAS development / preview が必要）。'
        : 'Android以外ではネイティブLLMは使えません。',
    );
  }
  try {
    return native.getStatus();
  } catch (e) {
    return emptyStatus(e instanceof Error ? e.message : 'status failed');
  }
}

export function setNativeLlmDownloadConsent(accepted: boolean): boolean {
  const native = getNativeOnDeviceLlmModule();
  if (!native) {
    return false;
  }
  const result = native.setDownloadConsent(accepted);
  return Boolean(result?.ok);
}

export async function startNativeLlmDownload(options?: {
  url?: string;
}): Promise<{ path: string; modelId: string }> {
  const native = getNativeOnDeviceLlmModule();
  if (!native) {
    throw new OnDeviceLlmUnavailableError(
      '端末内AIモジュールがありません。EASのAndroidビルドが必要です。',
    );
  }
  const result = await native.startDownload(options);
  return { path: result.path, modelId: result.modelId };
}

export function cancelNativeLlmDownload(): void {
  getNativeOnDeviceLlmModule()?.cancelDownload();
}

export function deleteNativeLlmModel(): void {
  getNativeOnDeviceLlmModule()?.deleteModel();
}

export async function loadNativeLlmModel(): Promise<{
  ready: boolean;
  probe: string;
  modelId: string;
  engine: string;
}> {
  const native = getNativeOnDeviceLlmModule();
  if (!native) {
    throw new OnDeviceLlmUnavailableError(
      '端末内AIモジュールがありません（AI未接続）。',
    );
  }
  const result = await native.loadModel();
  return {
    ready: result.ready,
    probe: result.probe,
    modelId: result.modelId,
    engine: result.engine,
  };
}

export function unloadNativeLlmModel(): void {
  getNativeOnDeviceLlmModule()?.unloadModel();
}

export async function nativeLlmGenerate(prompt: string): Promise<string> {
  const native = getNativeOnDeviceLlmModule();
  if (!native) {
    throw new OnDeviceLlmUnavailableError('端末内AIは未接続です。');
  }
  const result = await native.generate(prompt);
  return result.text;
}

export function subscribeNativeLlmDownloadProgress(
  listener: (event: DownloadProgressEvent) => void,
): () => void {
  const native = getNativeOnDeviceLlmModule();
  if (!native) {
    return () => undefined;
  }
  const sub = native.addListener('onDownloadProgress', listener);
  return () => sub.remove();
}

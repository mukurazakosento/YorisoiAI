/**
 * ネイティブ／既定解決用スタブ。
 * Expo Web では Metro が同名の `webllm.web.ts` を優先する。
 *
 * ネイティブで WebLLM を「動いている」ようには見せない。
 */
import type { OnDeviceEngine } from './types';

export const WEBLLM_DEFAULT_MODEL_ID =
  'Llama-3.2-1B-Instruct-q4f16_1-MLC';

export function isWebLlmSupportedPlatform(): boolean {
  return false;
}

export async function createWebLlmEngine(_options?: {
  modelId?: string;
  onProgress?: (text: string) => void;
}): Promise<OnDeviceEngine | null> {
  return null;
}

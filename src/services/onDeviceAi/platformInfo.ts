/**
 * Platform 判定。Node スモークでは react-native が無い／不完全なことがあるため
 * 安全にフォールバックする（推論成功を装わない）。
 */
export type RuntimeOs = 'ios' | 'android' | 'web' | 'unknown';

export function getRuntimeOs(): RuntimeOs {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('react-native') as { Platform?: { OS?: string } };
    const os = rn.Platform?.OS;
    if (os === 'ios' || os === 'android' || os === 'web') {
      return os;
    }
  } catch {
    // Node スモーク等
  }

  if (typeof window !== 'undefined') {
    return 'web';
  }
  return 'unknown';
}

export function isWebRuntime(): boolean {
  return getRuntimeOs() === 'web';
}

export function isNativeRuntime(): boolean {
  const os = getRuntimeOs();
  return os === 'ios' || os === 'android';
}

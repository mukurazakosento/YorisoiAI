import { deleteAsync } from 'expo-file-system/legacy';

/**
 * OCR 用の一時画像を端末内から削除する。
 * 失敗しても例外は投げない（個人情報保護のためのベストエフォート）。
 */
export async function deleteTempImageUri(uri: string | null | undefined): Promise<void> {
  if (!uri || typeof uri !== 'string') {
    return;
  }

  // フォトライブラリ本体は消さない（ImagePicker / キャッシュ上の一時ファイルのみ）
  const isCacheLike =
    uri.includes('/Caches/') ||
    uri.includes('/cache/') ||
    uri.includes('ImagePicker') ||
    uri.includes('/tmp/') ||
    uri.includes('/TemporaryItems/') ||
    uri.includes('/Library/Caches/');

  if (!uri.startsWith('file:') && !uri.startsWith('/')) {
    return;
  }
  if (!isCacheLike) {
    return;
  }

  try {
    await deleteAsync(uri, { idempotent: true });
  } catch {
    // 削除できなくても画像は外部へ送っていない
  }
}

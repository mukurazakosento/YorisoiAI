/**
 * Firebase クライアント接続の境界。
 * APIキーはアプリに埋め込まず、後続段階で安全な設定方法を使う。
 */
export type FirebaseStatus = {
  configured: boolean;
  message: string;
};

export function getFirebaseStatus(): FirebaseStatus {
  return {
    configured: false,
    message:
      'Firebase はまだ設定していません。AIや検査機能をつなぐときに用意します。',
  };
}

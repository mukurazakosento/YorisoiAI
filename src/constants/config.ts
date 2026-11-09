/**
 * アプリ側の公開設定。APIキーや秘密情報はここに書かない。
 * Gemini の実通信は Firebase Cloud Functions 経由で行う（第3段階以降）。
 */
export const appConfig = {
  appName: 'よりそいAI',
  appVersion: '0.1.0',
  /** サーバー側で参照するモデルIDの論理名（実キーは Secret Manager） */
  aiModelKeys: {
    default: 'gemini-default',
    grounding: 'gemini-grounding',
  },
  /** 第3段階まで AI は未接続。UI では明示する。 */
  aiConnected: false,
} as const;

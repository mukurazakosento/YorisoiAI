/**
 * アプリ側の公開設定。Gemini APIキーや秘密情報はここに書かない。
 * 実通信は Firebase Cloud Functions + Secret Manager 経由。
 *
 * モデル ID の「論理名」のみ。実際のモデル文字列はサーバー env で管理する。
 * 公式確認時点の推奨実 ID（サーバー側）:
 * - 通常: gemini-3.5-flash-lite
 * - 調査: gemini-3.8-flash
 */
function readPublicEnv(name: string): string {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : '';
}

const firebaseApiKey = readPublicEnv('EXPO_PUBLIC_FIREBASE_API_KEY');
const firebaseAuthDomain = readPublicEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN');
const firebaseProjectId = readPublicEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID');
const firebaseAppId = readPublicEnv('EXPO_PUBLIC_FIREBASE_APP_ID');
const functionsRegion =
  readPublicEnv('EXPO_PUBLIC_FIREBASE_FUNCTIONS_REGION') || 'asia-northeast1';

const firebaseConfigured = Boolean(
  firebaseApiKey && firebaseAuthDomain && firebaseProjectId && firebaseAppId,
);

/**
 * EXPO_PUBLIC_AI_CONNECTED=true かつ Firebase 公開設定があるときだけ live 呼び出しを試みる。
 * 未設定時は必ずデモ / AI未接続表示。
 */
const aiConnectedFlag =
  readPublicEnv('EXPO_PUBLIC_AI_CONNECTED').toLowerCase() === 'true';

export const appConfig = {
  appName: 'よりそいAI',
  appVersion: '0.6.0',
  aiModelKeys: {
    default: 'gemini-default',
    grounding: 'gemini-grounding',
  },
  firebase: {
    apiKey: firebaseApiKey,
    authDomain: firebaseAuthDomain,
    projectId: firebaseProjectId,
    appId: firebaseAppId,
    functionsRegion,
    configured: firebaseConfigured,
  },
  aiConnected: firebaseConfigured && aiConnectedFlag,
} as const;

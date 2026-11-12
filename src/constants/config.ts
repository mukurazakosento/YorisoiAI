/**
 * アプリ側の公開設定。APIキーや秘密情報はここに書かない。
 *
 * 最終仕様の AI 目標は端末内 Llama / WebLLM。
 * 旧 Gemini Cloud Functions 経路は任意の後方互換として残し、必須にはしない。
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
  appVersion: '0.9.0-phase-b',
  aiModelKeys: {
    default: 'on-device-llama',
    grounding: 'optional-cloud-grounding',
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

/**
 * アプリ側の公開設定。APIキーや秘密情報はここに書かない。
 *
 * 最終仕様の AI 既定経路は端末内 Llama / WebLLM。
 * 旧 Gemini Cloud Functions は EXPO_PUBLIC_LEGACY_CLOUD_AI=true のときだけ任意利用。
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
 * 端末内 AI ロードを試みるフラグ。
 * true でも WebGPU / ネイティブモジュールが無ければ AI未接続のまま（live にしない）。
 */
const onDeviceAiEnabled =
  readPublicEnv('EXPO_PUBLIC_ON_DEVICE_AI').toLowerCase() === 'true';

/**
 * 旧 Gemini Callable を試すときだけ true。
 * 最終仕様では必須にしない。既定 false。
 */
const legacyCloudAiFlag =
  readPublicEnv('EXPO_PUBLIC_LEGACY_CLOUD_AI').toLowerCase() === 'true';

/** 後方互換: 旧 EXPO_PUBLIC_AI_CONNECTED も legacy フラグとして認める */
const legacyAiConnectedFlag =
  readPublicEnv('EXPO_PUBLIC_AI_CONNECTED').toLowerCase() === 'true';

const legacyCloudAiEnabled =
  firebaseConfigured && (legacyCloudAiFlag || legacyAiConnectedFlag);

const onDeviceModelId =
  readPublicEnv('EXPO_PUBLIC_ON_DEVICE_MODEL_ID') ||
  'Llama-3.2-1B-Instruct-q4f16_1-MLC';

export const appConfig = {
  appName: 'よりそいAI',
  appVersion: '0.10.0-phase-c',
  aiModelKeys: {
    /** WebLLM / 将来ネイティブで使うモデル ID（秘密ではない） */
    default: onDeviceModelId,
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
  /** 端末内 AI のロード試行（成功したとは限らない） */
  onDeviceAiEnabled,
  /**
   * @deprecated 最終仕様では端末内 AI を見る。旧クラウド接続フラグの別名。
   * true でも Gemini 未設定なら live にしない（Functions 側 mode:offline）。
   */
  aiConnected: legacyCloudAiEnabled,
  /** 旧 Gemini Functions を明示的に許可するか */
  legacyCloudAiEnabled,
} as const;

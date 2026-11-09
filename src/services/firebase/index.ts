import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getFunctions, type Functions } from 'firebase/functions';

import { appConfig } from '../../constants/config';

export type FirebaseStatus = {
  configured: boolean;
  message: string;
};

let cachedApp: FirebaseApp | null = null;
let cachedFunctions: Functions | null = null;

/**
 * クライアント公開設定のみで Firebase を初期化する。
 * APIキー（Gemini 等）はここには置かない。
 */
export function getFirebaseStatus(): FirebaseStatus {
  if (!appConfig.firebase.configured) {
    return {
      configured: false,
      message:
        'Firebase が未設定です。AI相談は「AI未接続」のデモ案内になります。',
    };
  }

  return {
    configured: true,
    message: 'Firebase の公開設定を読み込みました。',
  };
}

export function isFirebaseConfigured(): boolean {
  return appConfig.firebase.configured;
}

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) {
    return null;
  }

  if (cachedApp) {
    return cachedApp;
  }

  cachedApp =
    getApps()[0] ??
    initializeApp({
      apiKey: appConfig.firebase.apiKey,
      authDomain: appConfig.firebase.authDomain,
      projectId: appConfig.firebase.projectId,
      appId: appConfig.firebase.appId,
    });

  return cachedApp;
}

export function getFirebaseFunctions(): Functions | null {
  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  if (cachedFunctions) {
    return cachedFunctions;
  }

  cachedFunctions = getFunctions(app, appConfig.firebase.functionsRegion);
  return cachedFunctions;
}

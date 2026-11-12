import type { FeatureId } from '../../types/navigation';
import type { FeatureCapturePath } from './types';

const PATHS: Record<FeatureId, FeatureCapturePath> = {
  operationSupport: {
    featureId: 'operationSupport',
    hint: '操作の画面をスクショし、読み取った文字で次の一手を合わせます。',
    readButtonLabel: '画面を読み取る',
    confirmedPrefix: '画面の文字',
  },
  safetyCheck: {
    featureId: 'safetyCheck',
    hint: '電話・メールを開いたあと、見えている文字を確認してから調べます。',
    readButtonLabel: '画面の文字を調べる',
    confirmedPrefix: '確認した画面の文字',
  },
  textExplanation: {
    featureId: 'textExplanation',
    hint: '文章を書くか、ポップアップの画面を読み取って説明します。',
    readButtonLabel: 'ポップアップを読み取る',
    confirmedPrefix: '説明したい文章',
  },
};

export function getFeatureCapturePath(featureId: FeatureId): FeatureCapturePath {
  return PATHS[featureId];
}

/**
 * 安全性チェック: 先に電話／メールを開かせてから文字を調べる。
 * 「開いた」と利用者が示してから読み取りを勧める。
 */
export function shouldPreferOpenAppBeforeOcr(featureId: FeatureId): boolean {
  return featureId === 'safetyCheck';
}

/**
 * 文章説明: 手動入力でもキャプチャでもよい。
 */
export function allowsManualTextWithoutCapture(featureId: FeatureId): boolean {
  return featureId === 'textExplanation';
}

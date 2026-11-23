import type { FeatureId } from '../types/navigation';

export type FeatureDefinition = {
  id: FeatureId;
  title: string;
  description: string;
};

/**
 * 全機能定義（コード・ナビ・スモーク用）。
 * ホーム表示は HOME_FEATURES（最終仕様どおり3機能）。
 */
export const FEATURES: FeatureDefinition[] = [
  {
    id: 'operationSupport',
    title: '操作支援',
    description: '次の操作を一つずつ案内します。',
  },
  {
    id: 'textExplanation',
    title: '文章説明',
    description: '画面の文章の意味を分かりやすく伝えます。',
  },
  {
    id: 'safetyCheck',
    title: '安全性チェック',
    description: '電話・メールなどの注意点を一緒に確認します。',
  },
];

/** ホームに出す機能（操作支援＋文章説明＋安全性チェック）。 */
export const HOME_FEATURES: FeatureDefinition[] = FEATURES;

export function getFeatureById(id: FeatureId): FeatureDefinition {
  const feature = FEATURES.find((item) => item.id === id);
  if (!feature) {
    throw new Error(`未知の機能IDです: ${id}`);
  }
  return feature;
}

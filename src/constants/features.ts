import type { FeatureId } from '../types/navigation';

export type FeatureDefinition = {
  id: FeatureId;
  title: string;
  description: string;
};

/** ホーム画面の3機能。文言は最終製品仕様に合わせる。 */
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

export function getFeatureById(id: FeatureId): FeatureDefinition {
  const feature = FEATURES.find((item) => item.id === id);
  if (!feature) {
    throw new Error(`未知の機能IDです: ${id}`);
  }
  return feature;
}

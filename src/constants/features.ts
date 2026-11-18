import type { FeatureId } from '../types/navigation';

export type FeatureDefinition = {
  id: FeatureId;
  title: string;
  description: string;
};

/** ホーム画面の3機能（大ボタン・ノンスクロール）。 */
export const FEATURES: FeatureDefinition[] = [
  {
    id: 'operationSupport',
    title: '操作支援',
    description: '次の操作を一つずつ案内します。',
  },
  {
    id: 'textExplanation',
    title: '文章解説',
    description: '画面の文章の意味を分かりやすく伝えます。',
  },
  {
    id: 'safetyCheck',
    title: '危険性通知',
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

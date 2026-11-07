import type { FeatureId } from '../types/navigation';

export type FeatureDefinition = {
  id: FeatureId;
  title: string;
  description: string;
};

/** ホーム画面の3機能。順序と文言はマスター指示書に合わせる。 */
export const FEATURES: FeatureDefinition[] = [
  {
    id: 'operationSupport',
    title: '操作支援',
    description: 'スマートフォンの操作方法を一つずつ案内します。',
  },
  {
    id: 'textExplanation',
    title: '文章解説',
    description: '画面に表示された文章や専門用語の意味を分かりやすく説明します。',
  },
  {
    id: 'safetyCheck',
    title: '安全性検査',
    description: '電話番号やメール、SMSなどの危険性を確認します。',
  },
];

export function getFeatureById(id: FeatureId): FeatureDefinition {
  const feature = FEATURES.find((item) => item.id === id);
  if (!feature) {
    throw new Error(`未知の機能IDです: ${id}`);
  }
  return feature;
}

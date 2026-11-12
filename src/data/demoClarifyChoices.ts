import type { ConsultationChoice } from '../types/consultation';
import type { FeatureId } from '../types/navigation';

/**
 * 意図が不明なときの AI 選択肢デモ。
 * 本物の端末内 Llama ではないため、画面で「デモ」と明示する。
 */
export const DEMO_CLARIFY_CHOICES: Record<FeatureId, ConsultationChoice[]> = {
  operationSupport: [
    { id: 'demo-op-1', label: 'LINEの通知を直したい' },
    { id: 'demo-op-2', label: 'Wi-Fiにつなぎたい' },
    { id: 'demo-op-3', label: 'アプリの入れ方を知りたい' },
    { id: 'demo-op-4', label: 'また別の言い方で書く' },
  ],
  textExplanation: [
    { id: 'demo-tx-1', label: '「許可しますか？」の意味' },
    { id: 'demo-tx-2', label: '「インストールしますか？」の意味' },
    { id: 'demo-tx-3', label: '警告やエラーの意味' },
    { id: 'demo-tx-4', label: 'また別の言い方で書く' },
  ],
  safetyCheck: [
    { id: 'demo-sf-1', label: '知らない番号の電話' },
    { id: 'demo-sf-2', label: 'SMSの内容を確認したい' },
    { id: 'demo-sf-3', label: 'メールやリンクが怪しい' },
    { id: 'demo-sf-4', label: 'また別の言い方で書く' },
  ],
};

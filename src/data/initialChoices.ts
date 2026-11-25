import type { ConsultationChoice } from '../types/consultation';
import type { FeatureId } from '../types/navigation';

/**
 * 旧・相談開始の固定4択。UI簡素化後は最初の画面では使わない。
 * 曖昧時の確認は `demoClarifyChoices` / 端末内 AI 生成を使う。
 * 互換・参照用に残す。
 */
export const INITIAL_CHOICES: Record<FeatureId, ConsultationChoice[]> = {
  operationSupport: [
    { id: 'op-line', label: 'LINEの使い方が分からない' },
    { id: 'op-wifi', label: 'Wi-Fiにつなぎたい' },
    { id: 'op-uninstall', label: 'アプリを消したい' },
    { id: 'op-other', label: 'その他の操作' },
  ],
  textExplanation: [
    { id: 'tx-permit', label: '許可しますか？と出た' },
    { id: 'tx-install', label: 'インストールしますか？と出た' },
    { id: 'tx-word', label: '専門用語の意味を知りたい' },
    { id: 'tx-other', label: 'その他の文章' },
  ],
  safetyCheck: [
    { id: 'sf-phone', label: '知らない番号から電話があった' },
    { id: 'sf-sms', label: 'このSMSは大丈夫？' },
    { id: 'sf-mail', label: 'このメールは大丈夫？' },
    { id: 'sf-other', label: 'その他の確認' },
  ],
};

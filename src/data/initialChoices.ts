import type { ConsultationChoice } from '../types/consultation';
import type { FeatureId } from '../types/navigation';

/**
 * AI 未接続時でも使える初期の固定選択肢。
 * 第3段階以降は AI が動的生成する選択肢に置き換わる。
 */
export const INITIAL_CHOICES: Record<FeatureId, ConsultationChoice[]> = {
  operationSupport: [
    { id: 'op-line', label: 'LINEの使い方が分からない' },
    { id: 'op-wifi', label: 'Wi-Fiにつなぎたい' },
    { id: 'op-install', label: 'アプリを入れたい・消したい' },
    { id: 'op-notify', label: '通知の設定を変えたい' },
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
    { id: 'sf-url', label: 'このURLを押してもいい？' },
    { id: 'sf-other', label: 'その他の確認' },
  ],
};

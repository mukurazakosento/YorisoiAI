import type { FeatureId } from '../../types/navigation';

export type ConsultHistoryTurn = {
  role: 'user' | 'assistant';
  text: string;
};

/** 操作案内中の利用者アクション（もう一度聞くは端末側のみ） */
export type GuidanceAction = 'start' | 'done' | 'simplify';

/**
 * 安全性検査のサーバー向けアクション。
 * phone_search は利用者が番号確認＋検索同意したあとのみ送る。
 */
export type SafetyAction = 'phone_search' | 'message_analyze';

export type ConsultRequest = {
  featureId: FeatureId;
  text: string;
  choiceLabel?: string;
  history?: ConsultHistoryTurn[];
  /** 操作支援の1ステップ案内アクション */
  guidanceAction?: GuidanceAction;
  /** 安全性検査の調査種別 */
  safetyAction?: SafetyAction;
  /**
   * 電話番号を Google 検索（Grounding）へ送ることへの同意。
   * true のときだけ phone_search を実行する。
   */
  searchConsent?: boolean;
};

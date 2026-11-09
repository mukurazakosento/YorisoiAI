import type { FeatureId } from '../../types/navigation';

export type ConsultHistoryTurn = {
  role: 'user' | 'assistant';
  text: string;
};

/** 操作案内中の利用者アクション（もう一度聞くは端末側のみ） */
export type GuidanceAction = 'start' | 'done' | 'simplify';

export type ConsultRequest = {
  featureId: FeatureId;
  text: string;
  choiceLabel?: string;
  history?: ConsultHistoryTurn[];
  /** 操作支援の1ステップ案内アクション */
  guidanceAction?: GuidanceAction;
};

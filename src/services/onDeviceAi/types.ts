import type { ConsultationChoice } from '../../types/consultation';
import type { FeatureId } from '../../types/navigation';
import type { IntentClarity, SessionScript } from '../../types/session';

/**
 * 端末内 AI の接続状態。
 * - ready: 実際に推論エンジンがロード済み（このときだけ live 扱い可）
 * - loading: 初期化中
 * - unavailable: 未接続（デモ / AI未接続。live 禁止）
 */
export type OnDeviceAiLifecycle = 'ready' | 'loading' | 'unavailable';

/** どの実装経路か（表示・診断用。ready でなくても名前は出せる） */
export type OnDeviceAiBackend =
  | 'webllm'
  | 'native-llama'
  | 'demo'
  | 'none';

export type OnDeviceAiStatus = {
  lifecycle: OnDeviceAiLifecycle;
  backend: OnDeviceAiBackend;
  /** 利用者向け短文。未接続時は必ず AI未接続 / デモ を含む */
  message: string;
  /** true のときだけ mode:live / isDemo:false を許可 */
  ready: boolean;
  /** プラットフォーム上の候補（実際に動いているとは限らない） */
  preferredBackend: OnDeviceAiBackend;
  detail?: string;
};

export type OnDeviceAiMode = 'live' | 'demo' | 'offline';

export type IntentRequest = {
  featureId: FeatureId;
  text: string;
  choiceLabel?: string;
};

export type IntentResult = {
  clarity: IntentClarity;
  mode: OnDeviceAiMode;
  /** モデルまたはヒューリスティックの短い説明（UI 必須ではない） */
  rationale?: string;
};

export type ClarifyChoicesRequest = {
  featureId: FeatureId;
  text: string;
  choiceLabel?: string;
  clarifyRound: number;
};

export type ClarifyChoicesResult = {
  choices: ConsultationChoice[];
  mode: OnDeviceAiMode;
  question: string;
};

export type GuidanceScriptRequest = {
  featureId: FeatureId;
  summary: string;
};

export type GuidanceScriptResult = {
  script: SessionScript;
  mode: OnDeviceAiMode;
};

export type OnDeviceEngineChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

/**
 * 端末内エンジンの共通インターフェース。
 * WebLLM / 将来の llama.cpp・ExecuTorch がこれを満たす。
 */
export type OnDeviceEngine = {
  readonly backend: Exclude<OnDeviceAiBackend, 'demo' | 'none'>;
  readonly modelId: string;
  isReady(): boolean;
  chatJson(messages: OnDeviceEngineChatMessage[]): Promise<string>;
};

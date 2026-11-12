import type { FeatureId } from '../../types/navigation';

const FEATURE_LABEL: Record<FeatureId, string> = {
  operationSupport: '操作支援',
  textExplanation: '文章説明',
  safetyCheck: '安全性チェック',
};

export function buildIntentSystemPrompt(): string {
  return [
    'あなたは高齢者向けスマホ支援アプリ「よりそいAI」の意図判定です。',
    '日本語のみ。画像や画面映像は扱わない。',
    'JSONだけを返す。前置きやコードフェンスは禁止。',
    '形式: {"clarity":"clear"|"unclear","rationale":"短い理由"}',
    'clear: 何をしたいか具体的で支援を開始できる。',
    'unclear: 曖昧・短すぎ・「その他」「よく分からない」など。',
  ].join('\n');
}

export function buildIntentUserPrompt(input: {
  featureId: FeatureId;
  text: string;
  choiceLabel?: string;
}): string {
  return [
    `機能: ${FEATURE_LABEL[input.featureId]}`,
    `入力文: ${input.text || '(なし)'}`,
    `選んだ選択肢: ${input.choiceLabel ?? '(なし)'}`,
  ].join('\n');
}

export function buildChoicesSystemPrompt(): string {
  return [
    'あなたは高齢者向けスマホ支援の質問アシスタントです。',
    '要求がまだ曖昧なとき、分かりやすい選択肢をちょうど4つ作る。',
    '日本語のみ。JSONだけ。画像は扱わない。',
    '形式: {"question":"短い質問","choices":["選択肢1","選択肢2","選択肢3","選択肢4"]}',
    '最後の1つは「また別の言い方で書く」にする。',
    '断定的な「安全です」は使わない。',
  ].join('\n');
}

export function buildChoicesUserPrompt(input: {
  featureId: FeatureId;
  text: string;
  choiceLabel?: string;
  clarifyRound: number;
}): string {
  return [
    `機能: ${FEATURE_LABEL[input.featureId]}`,
    `これまでの文: ${input.text || '(なし)'}`,
    `直前の選択: ${input.choiceLabel ?? '(なし)'}`,
    `確認回数: ${input.clarifyRound}`,
  ].join('\n');
}

export function buildGuidanceSystemPrompt(): string {
  return [
    'あなたは高齢者向けスマホ支援の案内アシスタントです。',
    '利用者が自分で操作する。アプリが他アプリを自動操作しない。',
    '一手ずつ進める短い手順を3〜5個作る。',
    '各手順は displayText（画面・短文）と voiceText（音声・やや詳しい）を持つ。',
    'simplifyDisplayText / simplifyVoiceText も必須（やさしい言い換え）。',
    '日本語のみ。JSONだけ。画像は扱わない。',
    '安全性チェックでは「安全です」と断定しない。',
    '形式: {"title":"短い題","steps":[{"displayText":"...","voiceText":"...","simplifyDisplayText":"...","simplifyVoiceText":"..."}]}',
  ].join('\n');
}

export function buildGuidanceUserPrompt(input: {
  featureId: FeatureId;
  summary: string;
}): string {
  return [
    `機能: ${FEATURE_LABEL[input.featureId]}`,
    `相談内容: ${input.summary}`,
  ].join('\n');
}

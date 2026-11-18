import type { FeatureId } from '../../types/navigation';
import type { IntentClarity } from '../../types/session';

const VAGUE_CHOICE_MARKERS = ['その他', 'よく分からない', 'わからない', '不明'];

const CLEAR_KEYWORDS: Record<FeatureId, string[]> = {
  operationSupport: [
    'line',
    'ライン',
    'wifi',
    'wi-fi',
    'ワイファイ',
    'アプリ',
    '通知',
    '設定',
    'カメラ',
    '写真',
  ],
  textExplanation: [
    '許可',
    'インストール',
    'ポップアップ',
    '警告',
    'エラー',
    '同意',
    '意味',
  ],
  safetyCheck: [
    '電話',
    '番号',
    'sms',
    'メール',
    'url',
    'リンク',
    '詐欺',
    '不審',
  ],
};

/**
 * 端末内モデル未接続時の意図判定ヒューリスティック。
 * `onDeviceAi.classifyIntent` がエンジン未準備のときに使う。曖昧なら unclear。
 */
export function classifyIntentStub(input: {
  featureId: FeatureId;
  text: string;
  choiceLabel?: string;
  history?: { question: string; answer: string }[];
}): IntentClarity {
  const text = input.text.trim();
  const choice = input.choiceLabel?.trim() ?? '';
  const historyAnswers = (input.history ?? [])
    .map((entry) => entry.answer.trim())
    .filter(Boolean);
  const combined = [text, choice, ...historyAnswers].join(' ').trim();

  if (choice) {
    if (VAGUE_CHOICE_MARKERS.some((marker) => choice.includes(marker))) {
      return 'unclear';
    }
    // 具体的な固定選択肢は要求が特定できているとみなす
    return 'clear';
  }

  if (combined.length < 4) {
    return 'unclear';
  }

  const lower = combined.toLowerCase();
  const keywords = CLEAR_KEYWORDS[input.featureId];
  if (keywords.some((keyword) => lower.includes(keyword.toLowerCase()))) {
    return 'clear';
  }

  // 履歴が2往復以上ある、または十分長い文なら支援開始可
  if (historyAnswers.length >= 2 || combined.length >= 18) {
    return 'clear';
  }

  return 'unclear';
}

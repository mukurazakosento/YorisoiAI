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
}): IntentClarity {
  const text = input.text.trim();
  const choice = input.choiceLabel?.trim() ?? '';

  if (choice) {
    if (VAGUE_CHOICE_MARKERS.some((marker) => choice.includes(marker))) {
      return 'unclear';
    }
    // 具体的な固定選択肢は要求が特定できているとみなす
    return 'clear';
  }

  if (text.length < 4) {
    return 'unclear';
  }

  const lower = text.toLowerCase();
  const keywords = CLEAR_KEYWORDS[input.featureId];
  if (keywords.some((keyword) => lower.includes(keyword.toLowerCase()))) {
    return 'clear';
  }

  // ある程度長い文でもキーワードが無ければ確認ループへ
  if (text.length >= 18) {
    return 'clear';
  }

  return 'unclear';
}

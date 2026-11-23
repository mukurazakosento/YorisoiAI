/**
 * 安全性チェックの電話／メールモード判定。
 * 相談サマリーや選択肢から、画面検出の対象を決める。
 */

export type SafetyInspectMode = 'phone' | 'email';

const PHONE_MARKERS = [
  '電話',
  '番号',
  '着信',
  '通話',
  'phone',
  'dial',
];

const EMAIL_MARKERS = [
  'メール',
  'mail',
  'sms',
  'メッセージ',
  '文言',
  'リンク',
];

/**
 * 相談サマリー／選択肢から検査モードを決める。
 * 電話とメールの両方に触れていれば、より具体的な方を優先。
 */
export function resolveSafetyInspectMode(input: {
  summary?: string;
  choiceLabel?: string;
  text?: string;
}): SafetyInspectMode | null {
  const blob = `${input.choiceLabel ?? ''} ${input.summary ?? ''} ${input.text ?? ''}`
    .replace(/\s+/g, '')
    .toLowerCase();

  if (!blob) {
    return null;
  }

  const phoneHit = PHONE_MARKERS.some((m) => blob.includes(m.toLowerCase()));
  const emailHit = EMAIL_MARKERS.some((m) => blob.includes(m.toLowerCase()));

  if (phoneHit && !emailHit) {
    return 'phone';
  }
  if (emailHit && !phoneHit) {
    return 'email';
  }
  if (phoneHit && emailHit) {
    // 「電話番号」は電話、「メール」単独はメール
    if (blob.includes('電話番号') || blob.includes('着信')) {
      return 'phone';
    }
    if (blob.includes('メール') || blob.includes('sms')) {
      return 'email';
    }
    return 'phone';
  }

  return null;
}

export function safetyModeSummary(mode: SafetyInspectMode): string {
  return mode === 'phone'
    ? '電話番号を確認したい'
    : 'メールの内容を確認したい';
}

export function safetyModeOpenAppLabel(mode: SafetyInspectMode): string {
  return mode === 'phone' ? '電話' : 'メール';
}

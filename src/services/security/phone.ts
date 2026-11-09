/**
 * 端末側の電話番号抽出・正規化。
 * 画像は扱わない。確認済みテキストから番号候補だけを取り出す。
 */

/** 日本の一般的な番号パターン（ハイフン有無・国際表記の簡易対応） */
const PHONE_CANDIDATE_RE =
  /(?:\+?81[-\s]?)?(?:0\d{1,4}|\(0\d{1,4}\))[-\s]?\d{1,4}[-\s]?\d{3,4}|\+81\d{9,11}|0\d{9,10}/g;

export type PhoneCandidate = {
  /** 原文に近い表示用 */
  display: string;
  /** 検索送信用（数字と先頭+のみ） */
  digits: string;
};

/**
 * 確認済みテキストから電話番号らしい文字列を抽出する。
 * 複数ある場合はすべて返す（利用者が選ぶ／直す）。
 */
export function extractPhoneCandidates(text: string): PhoneCandidate[] {
  const raw = text ?? '';
  if (!raw.trim()) {
    return [];
  }

  const matches = raw.match(PHONE_CANDIDATE_RE) ?? [];
  const seen = new Set<string>();
  const results: PhoneCandidate[] = [];

  for (const match of matches) {
    const display = match.trim();
    const digits = normalizePhoneDigits(display);
    if (digits.length < 10 || digits.length > 13) {
      continue;
    }
    if (seen.has(digits)) {
      continue;
    }
    seen.add(digits);
    results.push({ display, digits });
  }

  return results;
}

/** 検索に送る番号文字列（個人名・履歴の余分な文は含めない） */
export function normalizePhoneDigits(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('+')) {
    return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  }
  return trimmed.replace(/\D/g, '');
}

/**
 * 調査に使う番号だけを送るための本文。
 * 同意後に AI / Grounding へ渡す。氏名や他文は付けない。
 */
export function buildPhoneSearchPayload(phoneNumber: string): string {
  const digits = normalizePhoneDigits(phoneNumber);
  return digits;
}

export function looksLikePhoneInquiry(text: string, choiceLabel?: string): boolean {
  const combined = `${choiceLabel ?? ''} ${text}`.replace(/\s+/g, '');
  if (extractPhoneCandidates(combined).length > 0) {
    return true;
  }
  return (
    combined.includes('電話') ||
    combined.includes('番号') ||
    combined.includes('着信') ||
    combined.includes('知らない番号')
  );
}

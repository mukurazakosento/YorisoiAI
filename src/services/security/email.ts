/**
 * 端末側のメールアドレス抽出。
 * 画像は扱わない。確認済みテキストから候補だけを取り出す。
 */

const EMAIL_RE =
  /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

export type EmailCandidate = {
  /** 原文に近い表示用 */
  display: string;
  /** 小文字化した照合用 */
  normalized: string;
};

/**
 * 確認済みテキストからメールアドレスらしい文字列を抽出する。
 */
export function extractEmailCandidates(text: string): EmailCandidate[] {
  const raw = text ?? '';
  if (!raw.trim()) {
    return [];
  }

  const matches = raw.match(EMAIL_RE) ?? [];
  const seen = new Set<string>();
  const results: EmailCandidate[] = [];

  for (const match of matches) {
    const display = match.trim().replace(/[.,;:!?）)]+$/u, '');
    const normalized = display.toLowerCase();
    if (normalized.length < 6 || !normalized.includes('@')) {
      continue;
    }
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    results.push({ display, normalized });
  }

  return results;
}

export function looksLikeEmailInquiry(
  text: string,
  choiceLabel?: string,
): boolean {
  const combined = `${choiceLabel ?? ''} ${text}`.replace(/\s+/g, '');
  return (
    combined.includes('メール') ||
    combined.includes('mail') ||
    combined.includes('Mail') ||
    extractEmailCandidates(combined).length > 0
  );
}

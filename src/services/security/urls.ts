/**
 * メッセージ文面から URL を抽出する（端末側の下準備）。
 * 実際の Web Risk 照合はサーバー側のみ。
 */

const URL_RE =
  /https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+/gi;

export function extractUrls(text: string): string[] {
  const raw = text ?? '';
  if (!raw.trim()) {
    return [];
  }

  const matches = raw.match(URL_RE) ?? [];
  const seen = new Set<string>();
  const results: string[] = [];

  for (const match of matches) {
    let url = match.trim().replace(/[.,;:!?）)]+$/u, '');
    if (url.startsWith('www.')) {
      url = `https://${url}`;
    }
    if (!/^https?:\/\//i.test(url)) {
      continue;
    }
    if (seen.has(url)) {
      continue;
    }
    seen.add(url);
    results.push(url);
  }

  return results;
}

export function looksLikeMessageInquiry(
  text: string,
  choiceLabel?: string,
): boolean {
  const combined = `${choiceLabel ?? ''} ${text}`.replace(/\s+/g, '');
  return (
    combined.includes('SMS') ||
    combined.includes('メール') ||
    combined.includes('メッセージ') ||
    combined.includes('URL') ||
    combined.includes('リンク') ||
    extractUrls(combined).length > 0
  );
}

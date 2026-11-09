/**
 * Google Web Risk Lookup（URL のみ）。電話番号検査には使わない。
 * API キーは Secret Manager。未設定時は正直に not_configured を返す。
 */

export type WebRiskCheckStatus =
  | 'unsafe'
  | 'unknown'
  | 'error'
  | 'not_configured'
  | 'skipped';

export type WebRiskCheckResult = {
  url: string;
  status: WebRiskCheckStatus;
  message: string;
};

const THREAT_TYPES = [
  'MALWARE',
  'SOCIAL_ENGINEERING',
  'UNWANTED_SOFTWARE',
] as const;

export function hasWebRiskApiKey(
  apiKey: string | undefined | null,
): boolean {
  return typeof apiKey === 'string' && apiKey.trim().length > 0;
}

/**
 * URL 一覧を Web Risk で照合する。
 * キー未設定でも構造は返し、利用者が「照合できていない」と分かるようにする。
 */
export async function checkUrlsWithWebRisk(
  urls: string[],
  apiKey: string | undefined | null,
): Promise<WebRiskCheckResult[]> {
  const unique = dedupeUrls(urls).slice(0, 5);
  if (unique.length === 0) {
    return [];
  }

  if (!hasWebRiskApiKey(apiKey)) {
    return unique.map((url) => ({
      url,
      status: 'not_configured' as const,
      message:
        'Web Risk の鍵がサーバーに設定されていないため、リンク照合はできません。不審なリンクは開かないでください。',
    }));
  }

  const key = apiKey!.trim();
  const results: WebRiskCheckResult[] = [];

  for (const url of unique) {
    results.push(await lookupOneUrl(url, key));
  }

  return results;
}

async function lookupOneUrl(
  url: string,
  apiKey: string,
): Promise<WebRiskCheckResult> {
  try {
    const endpoint = new URL(
      'https://webrisk.googleapis.com/v1/uris:search',
    );
    endpoint.searchParams.set('key', apiKey);
    for (const threat of THREAT_TYPES) {
      endpoint.searchParams.append('threatTypes', threat);
    }
    endpoint.searchParams.set('uri', url);

    const response = await fetch(endpoint.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return {
        url,
        status: 'error',
        message: `リンク照合に失敗しました（HTTP ${response.status}）。リンクは開かないでください。`,
      };
    }

    const body = (await response.json()) as {
      threat?: { threatTypes?: string[] };
    };

    if (body.threat?.threatTypes && body.threat.threatTypes.length > 0) {
      return {
        url,
        status: 'unsafe',
        message:
          'このリンクは危険な可能性があると報告されています。開かないでください。',
      };
    }

    return {
      url,
      status: 'unknown',
      message:
        'Web Risk の一覧には載っていませんでしたが、それだけで安全とは言いません。不審なら開かないでください。',
    };
  } catch {
    return {
      url,
      status: 'error',
      message:
        'リンク照合中に通信エラーが起きました。リンクは開かないでください。',
    };
  }
}

export function extractUrlsFromText(text: string): string[] {
  const matches =
    text.match(/https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+/gi) ?? [];
  return dedupeUrls(
    matches.map((match) => {
      let url = match.trim().replace(/[.,;:!?）)]+$/u, '');
      if (url.startsWith('www.')) {
        url = `https://${url}`;
      }
      return url;
    }),
  );
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const url of urls) {
    if (!/^https?:\/\//i.test(url)) {
      continue;
    }
    if (seen.has(url)) {
      continue;
    }
    seen.add(url);
    out.push(url);
  }
  return out;
}

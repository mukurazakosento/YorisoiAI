/**
 * Gemini Google Search Grounding から実在の出典だけを取り出す。
 * モデルが書いた URL は使わず、groundingMetadata の web チャンクのみ採用する。
 */

export type GroundingSource = {
  title: string;
  url: string;
};

type GroundingChunkLike = {
  web?: {
    uri?: string;
    title?: string;
  };
};

type GroundingMetadataLike = {
  groundingChunks?: GroundingChunkLike[];
};

type CandidateLike = {
  groundingMetadata?: GroundingMetadataLike;
};

type GenerateContentResponseLike = {
  candidates?: CandidateLike[];
};

export function extractGroundingSources(
  response: GenerateContentResponseLike | null | undefined,
): GroundingSource[] {
  const chunks =
    response?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const sources: GroundingSource[] = [];

  for (const chunk of chunks) {
    const url = chunk.web?.uri?.trim();
    if (!url || !isPlausibleHttpUrl(url) || seen.has(url)) {
      continue;
    }
    seen.add(url);
    sources.push({
      title: chunk.web?.title?.trim() || '公開情報',
      url,
    });
  }

  return sources;
}

/**
 * モデル JSON 内の sources は捨て、Grounding 由来だけを残す。
 * 情報ゼロなら insufficient_info（安全断定禁止）。
 */
export function applyGroundingSourcesToSafetyResult<
  T extends {
    status?: string;
    riskLevel?: string;
    sources?: GroundingSource[];
    message?: string;
    displayText?: string;
  },
>(aiJson: T, groundingSources: GroundingSource[]): T {
  if (aiJson.status !== 'safety_result') {
    return { ...aiJson, sources: groundingSources };
  }

  const next = {
    ...aiJson,
    sources: groundingSources,
  };

  if (groundingSources.length === 0) {
    return {
      ...next,
      riskLevel: 'insufficient_info',
      displayText: '公開情報では判断できません',
      message:
        '確認できる公開情報が見つかりませんでした。情報が無いことを安全の証拠にはしません。',
    };
  }

  return next;
}

function isPlausibleHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

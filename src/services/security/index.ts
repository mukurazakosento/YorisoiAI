/**
 * 安全性検査の端末側境界。
 * 公開情報調査・Web Risk の実処理は Cloud Functions（サーバー鍵）のみ。
 */
export {
  buildPhoneSearchPayload,
  extractPhoneCandidates,
  looksLikePhoneInquiry,
  normalizePhoneDigits,
  type PhoneCandidate,
} from './phone';
export {
  extractUrls,
  looksLikeMessageInquiry,
} from './urls';

export type PhoneLookupResult = {
  riskLevel: 'dangerous' | 'caution' | 'insufficient_info';
  summary: string;
  sources: { title: string; url: string }[];
};

export type UrlRiskStatus =
  | 'unsafe'
  | 'unknown'
  | 'error'
  | 'not_configured'
  | 'skipped';

/**
 * クライアントからの直呼びはしない（鍵をアプリに置かない）。
 * 互換のため型だけ残し、実装は Functions 経由。
 */
export async function lookupPhoneNumber(
  _phoneNumber: string,
): Promise<PhoneLookupResult> {
  throw new Error(
    '電話番号の公開情報調査は Cloud Functions（consultWithAi + Search Grounding）経由で行います。アプリから直接呼びません。',
  );
}

export async function checkUrlRisk(_url: string): Promise<{
  status: UrlRiskStatus;
  message: string;
}> {
  throw new Error(
    'URL検査（Web Risk）は Cloud Functions 経由です。アプリに API キーは置きません。',
  );
}

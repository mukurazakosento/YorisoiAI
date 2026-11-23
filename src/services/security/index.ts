/**
 * 安全性検査の端末側境界。
 * 既定は端末内ヒューリスティック。公開情報調査・Web Risk の実処理は
 * 任意の Cloud Functions（サーバー鍵）のみ。アプリに API キーは置かない。
 */
export {
  buildPhoneSearchPayload,
  extractPhoneCandidates,
  looksLikePhoneInquiry,
  normalizePhoneDigits,
  type PhoneCandidate,
} from './phone';
export {
  extractEmailCandidates,
  looksLikeEmailInquiry,
  type EmailCandidate,
} from './email';
export {
  extractUrls,
  looksLikeMessageInquiry,
} from './urls';
export {
  detectScamPatterns,
  scamPatternLabels,
  type ScamPatternHit,
} from './scamPatterns';
export {
  classifyJapanesePhoneNumber,
  type PhoneHeuristicResult,
  type PhoneNumberKind,
} from './phoneHeuristics';
export {
  resolveSafetyInspectMode,
  safetyModeOpenAppLabel,
  safetyModeSummary,
  type SafetyInspectMode,
} from './safetyMode';
export {
  inspectSafetyText,
  safetyResultToSessionSteps,
  type SafetyInspectInput,
  type SafetyInspectResult,
} from './inspectSafety';
export {
  lookupPhoneNumberViaLegacyCloud,
  type PhoneLookupAttempt,
} from './phoneLookup';

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
 * 互換のため型だけ残し、実装は任意の Functions 経由。
 */
export async function lookupPhoneNumber(
  _phoneNumber: string,
): Promise<PhoneLookupResult> {
  throw new Error(
    '電話番号の公開情報調査は、同意後に lookupPhoneNumberViaLegacyCloud（任意の Cloud Functions）経由で行います。アプリからキー付きで直接呼びません。',
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

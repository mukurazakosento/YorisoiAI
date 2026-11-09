/**
 * 安全性検査まわりの境界（電話番号調査・Web Risk など）。
 * 実処理はサーバー側。第6段階で接続する。
 */
export type PhoneLookupResult = {
  riskLevel: 'dangerous' | 'caution' | 'insufficient_info';
  summary: string;
  sources: { title: string; url: string }[];
};

export async function lookupPhoneNumber(
  _phoneNumber: string,
): Promise<PhoneLookupResult> {
  throw new Error('電話番号の公開情報調査は第6段階で実装します。');
}

export async function checkUrlRisk(_url: string): Promise<{
  status: 'unsafe' | 'unknown' | 'error';
  message: string;
}> {
  throw new Error('URL検査（Web Risk）は第6段階で実装します。');
}

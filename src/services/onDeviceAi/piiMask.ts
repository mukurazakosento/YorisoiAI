/**
 * Mask passwords / OTP / cards / contact PII before AI prompts and public copy.
 */
const PASSWORD =
  /(パスワード|パスコード|暗証番号|合言葉|password|passcode|passwd)\s*[:：=]?\s*\S+/gi;
const OTP =
  /(認証コード|確認コード|ワンタイム|セキュリティコード|OTP|コード)\s*[:：=]?\s*\d{4,8}/gi;
const CARD = /\b(?:\d[ -]*?){13,19}\b/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE =
  /(?:\+?81[-\s]?\d{1,4}|0\d{1,4})[-\s]?\d{1,4}[-\s]?\d{3,4}\b/g;

export function maskSensitiveText(text: string): string {
  let t = text;
  t = t.replace(PASSWORD, 'パスワード（伏せます）');
  t = t.replace(OTP, '認証コード（伏せます）');
  t = t.replace(CARD, '番号（伏せます）');
  t = t.replace(EMAIL, 'メール（伏せます）');
  t = t.replace(PHONE, '電話番号（伏せます）');
  return t;
}

export function containsSensitiveText(text: string): boolean {
  return (
    PASSWORD.test(text) ||
    OTP.test(text) ||
    CARD.test(text) ||
    EMAIL.test(text) ||
    PHONE.test(text)
  );
}

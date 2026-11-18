/**
 * Web OCR テキストの保持・正規化・機微マスク・AI 文脈組み立て。
 * 生 OCR は短く切らない。モデル上限のために切る場合は省略を明示する。
 * 画像は扱わない（文字のみ）。
 */

/** AI に渡す文字数の上限（これを超える部分は省略マーク付きで落とす） */
export const WEB_AI_CONTEXT_MAX_CHARS = 2400;

export type WebOcrPrepared = {
  /** マスク後の全文（UI・比較用。160 で切らない） */
  fullMaskedText: string;
  /** AI に渡す文脈（必要なら省略マーク付き） */
  aiContextText: string;
  omittedChars: number;
  wasTruncatedForModel: boolean;
};

/**
 * 比較用に空白を正規化する。
 */
export function normalizeOcrText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * パスワード・認証コードらしき箇所をマスク（端末内処理用）。
 * 完全な秘匿は保証しないが、案内文脈への生露出を抑える。
 */
export function maskSensitiveOcrText(text: string): string {
  let out = text;
  // 「パスワード」「パスコード」近傍の短いトークン
  out = out.replace(
    /(パスワード|パスコード|pass(?:word)?|PIN)\s*[:：=\s]?\s*([^\s、。]{4,64})/gi,
    '$1: ****',
  );
  // 認証コード / OTP / 確認コード（4〜8桁）
  out = out.replace(
    /(認証コード|確認コード|ワンタイム|OTP|security\s*code)\s*[:：=\s]?\s*(\d{4,8})/gi,
    '$1: ****',
  );
  // 「コード: 123456」系
  out = out.replace(
    /(コード|code)\s*[:：=\s]\s*(\d{4,8})/gi,
    '$1: ****',
  );
  return out;
}

/**
 * 生 OCR → マスク全文＋（必要なら）省略明示付き AI 文脈。
 * 160 文字でのハードカットはしない。
 */
export function prepareWebOcrForAi(rawOcrText: string): WebOcrPrepared {
  const fullMaskedText = maskSensitiveOcrText(normalizeOcrText(rawOcrText));
  if (!fullMaskedText) {
    return {
      fullMaskedText: '',
      aiContextText: '',
      omittedChars: 0,
      wasTruncatedForModel: false,
    };
  }

  if (fullMaskedText.length <= WEB_AI_CONTEXT_MAX_CHARS) {
    return {
      fullMaskedText,
      aiContextText: fullMaskedText,
      omittedChars: 0,
      wasTruncatedForModel: false,
    };
  }

  const kept = fullMaskedText.slice(0, WEB_AI_CONTEXT_MAX_CHARS);
  const omittedChars = fullMaskedText.length - kept.length;
  const aiContextText = `${kept}\n…（以下 ${omittedChars} 文字はモデル上限のため省略。全文は画面の読取表示を参照）`;
  return {
    fullMaskedText,
    aiContextText,
    omittedChars,
    wasTruncatedForModel: true,
  };
}

/**
 * 前後の OCR が実質同じ画面か（スパム防止）。
 */
export function isMaterialOcrChange(
  previousNormalized: string,
  nextNormalized: string,
): boolean {
  const prev = previousNormalized.trim();
  const next = nextNormalized.trim();
  if (!next) {
    return false;
  }
  if (!prev) {
    return true;
  }
  if (prev === next) {
    return false;
  }
  // ごく短いゆらぎ（句読点だけ等）は無視
  const compactPrev = prev.replace(/[、。・\s]/g, '');
  const compactNext = next.replace(/[、。・\s]/g, '');
  if (compactPrev === compactNext) {
    return false;
  }
  // 共通部分がほとんど同じなら非マテリアル
  if (
    compactPrev.length >= 40 &&
    compactNext.length >= 40 &&
    (compactNext.includes(compactPrev) || compactPrev.includes(compactNext))
  ) {
    const longer = Math.max(compactPrev.length, compactNext.length);
    const shorter = Math.min(compactPrev.length, compactNext.length);
    if (shorter / longer >= 0.92) {
      return false;
    }
  }
  return true;
}

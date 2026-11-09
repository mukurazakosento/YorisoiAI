/**
 * 相談画面へ渡すテキストの組み立て（アプリ本体が使う実パス）。
 *
 * Hard rules:
 * - AI へ送るのは利用者が最終確定した文字列だけ
 * - 生の OCR 全文・layoutHints・未確認テキストは送らない
 * - 画像 URI / Base64 / スクショバイトは絶対に含めない
 */

export type OcrInputState = {
  /** 相談入力欄の現在値（送信の唯一の本文ソース） */
  inputText: string;
  /** 直近の OCR 確認で自動投入した文字列。なければ null */
  ocrAutofillText: string | null;
  /** その自動投入直前の入力欄（キャンセル時に戻す用） */
  inputBeforeOcrAutofill: string;
};

export function createEmptyOcrInputState(
  inputText = '',
): OcrInputState {
  return {
    inputText,
    ocrAutofillText: null,
    inputBeforeOcrAutofill: '',
  };
}

/**
 * OCR 確認画面で利用者が確定・編集したテキストを入力欄へ反映する。
 * raw OCR / layoutHints は保持しない（AI 送信対象外）。
 */
export function applyOcrConfirmation(
  state: OcrInputState,
  finalizedText: string,
): OcrInputState {
  const finalized = finalizedText.trim();
  if (!finalized) {
    return state;
  }

  // 前回の OCR 自動投入分を一旦外し、利用者独自の文だけを土台にする
  const withoutPreviousAutofill = state.ocrAutofillText
    ? removeAutofillSegment(
        state.inputText,
        state.ocrAutofillText,
        state.inputBeforeOcrAutofill,
      )
    : state.inputText;

  const beforeSnapshot = withoutPreviousAutofill;
  const userSeparate = withoutPreviousAutofill.trim();

  let nextInput: string;
  if (!userSeparate) {
    nextInput = finalized;
  } else if (userSeparate === finalized) {
    nextInput = finalized;
  } else {
    // 利用者が別に書いた文は残し、確認済み OCR 文を一度だけ足す
    nextInput = `${userSeparate}\n\n${finalized}`;
  }

  return {
    inputText: nextInput,
    ocrAutofillText: finalized,
    inputBeforeOcrAutofill: beforeSnapshot,
  };
}

/**
 * 「読み取りをやめる」/ 取り消し：OCR で自動投入した文だけ消す。
 * 利用者が別に書いた文や、確認後に自分で直した内容は可能な範囲で残す。
 */
export function clearOcrAutofill(state: OcrInputState): OcrInputState {
  if (!state.ocrAutofillText) {
    return {
      inputText: state.inputText,
      ocrAutofillText: null,
      inputBeforeOcrAutofill: '',
    };
  }

  const cleared = removeAutofillSegment(
    state.inputText,
    state.ocrAutofillText,
    state.inputBeforeOcrAutofill,
  );

  return {
    inputText: cleared,
    ocrAutofillText: null,
    inputBeforeOcrAutofill: '',
  };
}

/**
 * 相談送信時の本文。入力欄の最終文字列のみ。
 * layoutHints・生 OCR・画像参照は決して混ぜない。
 */
export function assembleConsultationSendText(inputText: string): string {
  return inputText.trim();
}

/** AI / Functions に渡してよいテキストか（画像痕跡が無いか）を検査する。 */
export function consultationPayloadLooksSafe(text: string): boolean {
  if (!text) {
    return true;
  }
  if (/data:image\//i.test(text)) {
    return false;
  }
  if (/base64,/i.test(text)) {
    return false;
  }
  if (/file:\/\//i.test(text)) {
    return false;
  }
  if (/content:\/\//i.test(text)) {
    return false;
  }
  if (/ph:\/\//i.test(text)) {
    return false;
  }
  return true;
}

function removeAutofillSegment(
  input: string,
  autofill: string,
  inputBeforeAutofill: string,
): string {
  if (!autofill) {
    return input;
  }

  // 確認直後のまま → OCR 投入前の文へ戻す
  if (input === autofill) {
    return inputBeforeAutofill;
  }

  // 「利用者文 + OCR文」の形なら OCR 文だけ落とす
  const combined = `${inputBeforeAutofill.trim()}\n\n${autofill}`;
  if (inputBeforeAutofill.trim() && input === combined) {
    return inputBeforeAutofill;
  }

  if (input.includes(autofill)) {
    const without = input
      .split(autofill)
      .join('')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    // 利用者が OCR 文だけ消して独自文を残している場合はそのまま
    if (without.length > 0) {
      return without;
    }
    return inputBeforeAutofill;
  }

  // 確認後に利用者が大きく書き換えて autofill 断片が残っていない → 現状を尊重
  return input;
}

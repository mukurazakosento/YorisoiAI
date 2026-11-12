/**
 * Phase 4 OCR スモーク — アプリ本体と同じ consultationText 組み立てを直接検証する。
 * 使い方: npm run smoke:ocr
 * （package.json 経由で tsx を import し、.ts 実モジュールを読む）
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

// --- Source guardrails ---
const aiIndex = read('src/services/ai/index.ts');
assert.doesNotMatch(
  aiIndex,
  /base64|imageUri|screenshot|FormData|storage\.ref/i,
  'AI service must not reference image upload paths',
);

const consultFn = read('functions/src/ai/consult.ts');
assert.match(consultFn, /画像は受け取らない/);
assert.doesNotMatch(consultFn, /imageBase64|screenshotBytes/);

const ocrIndex = read('src/services/ocr/index.ts');
assert.match(ocrIndex, /画像バイナリは Gemini・Firebase/);
assert.match(ocrIndex, /deleteTempImageUri/);
assert.match(ocrIndex, /recognizeJapaneseText|yorisoi-mlkit-ocr/);
assert.match(ocrIndex, /assembleConsultationSendText/);

// 最終仕様: OCR は支援セッションの利用者開始フレーム経路へ配線
const supportSession = read('src/screens/SupportSessionScreen.tsx');
assert.match(supportSession, /SessionCapturePanel|requestUserFrame|startCaptureSession/);
assert.match(supportSession, /rebuildGuidanceFromConfirmedFrame|confirmFrameText/);
assert.doesNotMatch(supportSession, /buildLayoutHints\(/);
assert.doesNotMatch(supportSession, /imageBase64|screenshotBytes/);
assert.doesNotMatch(supportSession, /\bScrollView\b/);

const captureSession = read('src/services/capture/session.ts');
assert.match(captureSession, /pickAndRecognizeScreenshot|pickFrameViaOcr/);
assert.match(captureSession, /confirmFrameText/);
assert.doesNotMatch(captureSession, /layoutHints/);

const panel = read('src/components/ScreenshotOcrPanel.tsx');
assert.doesNotMatch(panel, /buildLayoutHints\(/);
assert.match(panel, /onConfirmed\(\{ text \}\)/);

const sessionCapturePanel = read('src/components/SessionCapturePanel.tsx');
assert.match(sessionCapturePanel, /この文字で進む/);
assert.doesNotMatch(sessionCapturePanel, /\bScrollView\b/);

const swift = read('modules/yorisoi-mlkit-ocr/ios/YorisoiMlkitOcrModule.swift');
assert.match(swift, /JapaneseTextRecognizerOptions/);
assert.match(swift, /MLKitTextRecognitionJapanese/);
assert.doesNotMatch(swift, /URLSession\.shared\.upload|FirebaseStorage/);

const androidStub = read(
  'modules/yorisoi-mlkit-ocr/android/src/main/java/expo/modules/yorisoimlkitocr/YorisoiMlkitOcrModule.kt',
);
assert.match(androidStub, /OCR_ANDROID_NOT_READY|これから用意/);

// --- Import the REAL assembly module（確認済みテキストのみ） ---
const consultationTextUrl = pathToFileURL(
  path.join(root, 'src/services/ocr/consultationText.ts'),
).href;
const {
  applyOcrConfirmation,
  assembleConsultationSendText,
  clearOcrAutofill,
  consultationPayloadLooksSafe,
  createEmptyOcrInputState,
} = await import(consultationTextUrl);

/**
 * 相談画面と同じ送信組み立て。
 * AI に渡す text はこれだけ（choiceLabel は別フィールド）。
 */
function buildAiTextPayload(inputText) {
  return assembleConsultationSendText(inputText);
}

// 1) 確認画面で削除した文字は AI payload に残らない
{
  const editedOnConfirm = '通知を許可しますか？\nアカウントを削除';
  let state = createEmptyOcrInputState();
  state = applyOcrConfirmation(state, editedOnConfirm);
  const payload = buildAiTextPayload(state.inputText);
  assert.equal(payload, editedOnConfirm);
  assert.doesNotMatch(payload, /削除されるべき秘密の行/);
  assert.ok(consultationPayloadLooksSafe(payload));
}

// 2) 確認後に相談欄を編集 → 編集後の内容だけ送る（古い OCR 文が残らない）
{
  let state = createEmptyOcrInputState();
  state = applyOcrConfirmation(state, '許可しますか？\n余計な行');
  state = {
    ...state,
    inputText: '許可しますか？\n自分で直した文',
  };
  const payload = buildAiTextPayload(state.inputText);
  assert.equal(payload, '許可しますか？\n自分で直した文');
  assert.doesNotMatch(payload, /余計な行/);
  assert.equal(assembleConsultationSendText(state.inputText), payload);
}

// 3) 読み取りキャンセル：OCR 由来テキストは送られない／利用者独自文は残る
{
  let state = createEmptyOcrInputState('LINEがおかしい');
  state = applyOcrConfirmation(state, '通知を許可しますか？');
  assert.match(state.inputText, /LINEがおかしい/);
  assert.match(state.inputText, /通知を許可しますか？/);

  state = clearOcrAutofill(state);
  const payload = buildAiTextPayload(state.inputText);
  assert.equal(payload, 'LINEがおかしい');
  assert.doesNotMatch(payload, /通知を許可しますか？/);
}

// 3b) 入力が空の状態で OCR → キャンセル：OCR 文は消える
{
  let state = createEmptyOcrInputState();
  state = applyOcrConfirmation(state, '画面の文字');
  state = clearOcrAutofill(state);
  assert.equal(buildAiTextPayload(state.inputText), '');
}

// 4) 画像 URI / Base64 が payload に混ざらない
{
  let state = createEmptyOcrInputState();
  state = applyOcrConfirmation(state, 'こんにちは');
  const payload = buildAiTextPayload(state.inputText);
  assert.ok(consultationPayloadLooksSafe(payload));
  assert.doesNotMatch(payload, /file:\/\/|data:image|base64,|content:\/\/|ph:\/\//i);

  assert.equal(
    consultationPayloadLooksSafe('x file:///tmp/shot.png'),
    false,
  );
  assert.equal(
    consultationPayloadLooksSafe('data:image/png;base64,AAAA'),
    false,
  );
}

// 5) 組み立て結果は利用者の最終確認内容と一致する
{
  const finalText = '写真へのアクセスを許可しますか？';
  let state = createEmptyOcrInputState();
  state = applyOcrConfirmation(state, finalText);
  assert.equal(buildAiTextPayload(state.inputText), finalText);
  assert.equal(assembleConsultationSendText.length, 1);
}

// Package wiring
const pkg = require('../package.json');
assert.equal(pkg.dependencies['yorisoi-mlkit-ocr'], 'file:./modules/yorisoi-mlkit-ocr');
assert.ok(pkg.dependencies['expo-image-picker']);
assert.ok(pkg.dependencies['expo-dev-client']);

const appJson = JSON.parse(read('app.json'));
assert.ok(
  appJson.expo.plugins.some(
    (p) =>
      p === 'expo-dev-client' ||
      (Array.isArray(p) && p[0] === 'expo-image-picker'),
  ),
);

console.log('smoke-ocr-phase4: ok');
console.log('- Real consultationText path: deleted confirm-screen text absent');
console.log('- Post-confirm edits: only edited content sent');
console.log('- Cancel OCR: OCR-derived text cleared; user text kept');
console.log('- No image URI/Base64 in payload');
console.log('- Assembled send text matches user-finalized content');

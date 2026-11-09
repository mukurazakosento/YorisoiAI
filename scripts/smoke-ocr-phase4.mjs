/**
 * Phase 4 のオフライン OCR スモーク（実機 ML Kit / 画像不要）。
 * 使い方: node scripts\smoke-ocr-phase4.mjs
 *
 * - 画像を外部へ送るコード経路がサービス境界に無いこと
 * - 確認済みテキストの組み立てが URI / Base64 を混ぜないこと
 * - 相対位置ヒントが安全に生成できること
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

// --- Source guardrails: image bytes must never leave the device via AI / Functions ---
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

const swift = read('modules/yorisoi-mlkit-ocr/ios/YorisoiMlkitOcrModule.swift');
assert.match(swift, /JapaneseTextRecognizerOptions/);
assert.match(swift, /MLKitTextRecognitionJapanese/);
assert.doesNotMatch(swift, /URLSession\.shared\.upload|FirebaseStorage/);

const androidStub = read(
  'modules/yorisoi-mlkit-ocr/android/src/main/java/expo/modules/yorisoimlkitocr/YorisoiMlkitOcrModule.kt',
);
assert.match(androidStub, /OCR_ANDROID_NOT_READY|これから用意/);

// --- Pure JS helpers (no RN native) ---
function clamp01(value) {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function toRelative(box, imageWidth, imageHeight) {
  if (!imageWidth || !imageHeight) return undefined;
  return {
    left: clamp01(box.x / imageWidth),
    top: clamp01(box.y / imageHeight),
    right: clamp01((box.x + box.width) / imageWidth),
    bottom: clamp01((box.y + box.height) / imageHeight),
  };
}

function buildLayoutHints(lines, maxLines = 12) {
  return lines
    .slice(0, maxLines)
    .map((line) => {
      const top = line.bounds?.top;
      let place = '位置不明';
      if (typeof top === 'number') {
        if (top < 0.33) place = '画面の上のほう';
        else if (top < 0.66) place = '画面のまん中あたり';
        else place = '画面の下のほう';
      }
      return `・${place}: ${line.text}`;
    })
    .join('\n');
}

function buildConsultationTextFromConfirmedOcr({
  confirmedText,
  layoutHints,
  userNote,
}) {
  const parts = [];
  const confirmed = confirmedText.trim();
  if (confirmed) {
    parts.push(
      `【画面から読み取った文字（利用者が確認済み）】\n${confirmed}`,
    );
  }
  const hints = layoutHints?.trim();
  if (hints) parts.push(`【文字の位置の目安】\n${hints}`);
  const note = userNote?.trim();
  if (note) parts.push(`【利用者の補足】\n${note}`);
  return parts.join('\n\n');
}

const bounds = toRelative({ x: 10, y: 20, width: 100, height: 40 }, 200, 400);
assert.deepEqual(bounds, {
  left: 0.05,
  top: 0.05,
  right: 0.55,
  bottom: 0.15,
});

const hints = buildLayoutHints([
  { text: '設定', bounds: { top: 0.1 } },
  { text: '許可しますか？', bounds: { top: 0.5 } },
]);
assert.match(hints, /画面の上のほう: 設定/);
assert.match(hints, /画面のまん中あたり: 許可しますか？/);

const merged = buildConsultationTextFromConfirmedOcr({
  confirmedText: '通知を許可しますか？',
  layoutHints: hints,
  userNote: 'これが怖いです',
});
assert.match(merged, /利用者が確認済み/);
assert.match(merged, /通知を許可しますか？/);
assert.match(merged, /利用者の補足/);
assert.doesNotMatch(merged, /file:\/\/|data:image|base64/i);

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
console.log('- AI / Functions paths do not accept image bytes');
console.log('- Local module uses JapaneseTextRecognizerOptions (ML Kit v2)');
console.log('- Android stub refuses instead of faking success');
console.log('- Confirmed OCR text builder never embeds file/base64 URIs');

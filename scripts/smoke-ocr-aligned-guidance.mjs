/**
 * OCR-aligned guidance + 20s interval + ASAP notify + textExplanation popup.
 * 使い方: npm run smoke:ocr-aligned-guidance
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const pkg = JSON.parse(read('package.json'));
assert.match(pkg.scripts['smoke:ocr-aligned-guidance'], /smoke-ocr-aligned-guidance/);

// --- Interval: ops ~20s default; textExplanation may use ~4s (min clamp 3s) ---
const service = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistForegroundService.kt',
);
assert.match(service, /DEFAULT_INTERVAL_MS = 20000/);
assert.match(service, /coerceIn\(3000L,\s*60000L\)/);
assert.match(service, /requiredStreak|AssistPopupDetector\.requiredStreak/);
assert.match(service, /AssistNotifyCopy\.fromGuidance/);
assert.match(service, /updateForeground\(safeNotify\)/);
assert.match(service, /AssistNotifier\.showGuidance/);
assert.match(service, /tts\?\.speakLatest\(safeVoice\)/);
assert.match(service, /AssistSecretRedactor\.forPublicText/);
assert.match(service, /speakLatest\(safeVoice\)/);
assert.match(service, /featureId == "textExplanation"/);

const moduleKt = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/YorisoiAndroidAssistModule.kt',
);
assert.match(moduleKt, /20000L/);

const session = read('src/services/androidAssist/session.ts');
assert.match(session, /assistIntervalForFeature|clampAssistIntervalMs/);

const support = read('src/screens/SupportSessionScreen.tsx');
assert.match(support, /assistIntervalForFeature\(featureId\)/);

// --- ASAP notify ---
const notifier = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistNotifier.kt',
);
assert.match(notifier, /manager\.cancel\(GUIDANCE_ID\)/);
assert.match(notifier, /PRIORITY_HIGH/);
assert.match(notifier, /setOnlyAlertOnce\(false\)/);
assert.match(notifier, /VISIBILITY_PRIVATE/);
assert.doesNotMatch(notifier, /VISIBILITY_PUBLIC/);
assert.match(notifier, /AssistSecretRedactor\.forPublicText/);

// --- Popup streak for long interval ---
const detector = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistPopupDetector.kt',
);
assert.match(detector, /fun requiredStreak/);
assert.match(detector, /15_000L|15000/);

// app.json untouched in this feature's intent
assert.equal(
  fs.existsSync(path.join(root, 'app.json')),
  true,
);

const assistUrl = pathToFileURL(
  path.join(root, 'src/services/androidAssist/index.ts'),
).href;
const {
  buildGuidanceFromOcrText,
  detectPopup,
  isPopupStable,
  requiredPopupStreak,
  assistIntervalForFeature,
  OPS_ASSIST_INTERVAL_MS,
  TEXT_EXPLAIN_ASSIST_INTERVAL_MS,
  resolveAssistGuidance,
  containsSensitive,
  redactSecretsForVoice,
} = await import(assistUrl);

assert.equal(assistIntervalForFeature('operationSupport'), OPS_ASSIST_INTERVAL_MS);
assert.equal(OPS_ASSIST_INTERVAL_MS, 20_000);
assert.equal(assistIntervalForFeature('textExplanation'), TEXT_EXPLAIN_ASSIST_INTERVAL_MS);
assert.ok(TEXT_EXPLAIN_ASSIST_INTERVAL_MS < 10_000);
assert.ok(TEXT_EXPLAIN_ASSIST_INTERVAL_MS >= 3_000);

// --- Ops guidance quotes OCR (not generic ignore) ---
const album = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'LINEで孫に写真を送りたい',
  ocrText: 'アルバム 最近の項目',
});
assert.equal(album.stepId, 'line-pick-photo');
assert.match(album.displayText, /最近の項目|アルバム/);
assert.equal(album.mode, 'demo');

const send = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'LINEで孫に写真を送りたい',
  ocrText: '送信 キャンセル',
});
assert.equal(send.stepId, 'line-confirm-send');
assert.match(send.displayText, /送信/);

const oddScreen = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'LINEで孫に写真を送りたい',
  ocrText: '設定 通知 オン',
});
// Must not say generic “open LINE” while Settings is on screen
assert.doesNotMatch(oddScreen.displayText, /まず LINE|緑のLINE/);
assert.match(oddScreen.displayText, /設定|通知/);

// --- textExplanation popup path (same detector as ops) ---
const camOcr =
  '「カメラ」へのアクセスをアプリに許可しますか？ 許可しない 一度だけ 許可';
const textPopup = buildGuidanceFromOcrText({
  featureId: 'textExplanation',
  goalSummary: 'この画面を説明して',
  ocrText: camOcr,
});
assert.match(textPopup.stageId, /popup/i);
assert.match(textPopup.displayText, /カメラ/);
assert.match(textPopup.voiceText, /代わりに押しません/);

const det = detectPopup(camOcr);
assert.ok(det);
assert.equal(requiredPopupStreak(det, 20000), 1);
assert.equal(requiredPopupStreak(det, 4000, 'textExplanation'), 1);
assert.equal(isPopupStable(det.fingerprint, det, 1, 1), true);

// --- FGS-mirrored resolve: textExplanation popup fires on first sample ---
const resolved = resolveAssistGuidance({
  featureId: 'textExplanation',
  goalSummary: 'ポップアップを説明して',
  ocrText: camOcr,
  ocrChanged: true,
  intervalMs: TEXT_EXPLAIN_ASSIST_INTERVAL_MS,
});
assert.ok(resolved.step);
assert.match(resolved.step.stageId, /popup/i);
assert.match(resolved.step.displayText, /カメラ/);
assert.match(resolved.step.voiceText, /代わりに押しません/);

// Soft body (no しますか) still detected for textExplanation
const soft = 'デバイスの写真や動画、音楽へのアクセスを許可';
assert.ok(detectPopup(soft));
const softResolved = resolveAssistGuidance({
  featureId: 'textExplanation',
  goalSummary: '説明して',
  ocrText: soft,
  ocrChanged: true,
  intervalMs: TEXT_EXPLAIN_ASSIST_INTERVAL_MS,
});
assert.ok(softResolved.step);
assert.match(softResolved.step.stageId, /popup|explain/i);

// Secrets still redacted on popup voice path
const secretOcr =
  'カメラへのアクセスを許可しますか？ パスワード: secret99 許可しない 許可する';
assert.equal(containsSensitive(secretOcr), true);
const secretGuid = buildGuidanceFromOcrText({
  featureId: 'textExplanation',
  goalSummary: '説明',
  ocrText: secretOcr,
});
assert.doesNotMatch(redactSecretsForVoice(secretGuid.voiceText), /secret99/);

// Ops interval unchanged at 20s path
const opsTick = resolveAssistGuidance({
  featureId: 'operationSupport',
  goalSummary: 'LINEで孫に写真を送りたい',
  ocrText: 'アルバム 最近の項目',
  ocrChanged: true,
  intervalMs: OPS_ASSIST_INTERVAL_MS,
});
assert.equal(opsTick.step?.stepId, 'line-pick-photo');

console.log('smoke-ocr-aligned-guidance: OK');

/**
 * Popup auto-detect + explain smoke (MediaProjection FGS path).
 * 使い方: npm run smoke:popup-auto-assist
 *
 * Asserts detector/explainer/redact/home hide/FGS wiring. No device / Kotlin compile.
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
assert.match(pkg.scripts['smoke:popup-auto-assist'], /smoke-popup-auto-assist/);

// --- This feature must not rewrite app.json (leave EAS / permissions alone) ---
const appJson = JSON.parse(read('app.json'));
assert.ok(
  Array.isArray(appJson.expo?.android?.permissions) &&
    appJson.expo.android.permissions.includes(
      'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
    ),
);
assert.ok(
  appJson.expo.plugins.some(
    (p) =>
      p === './modules/yorisoi-android-assist/app.plugin.js' ||
      (Array.isArray(p) && p[0] === './modules/yorisoi-android-assist/app.plugin.js'),
  ),
);

const detector = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistPopupDetector.kt',
);
assert.match(detector, /PERMISSION_CAMERA/);
assert.match(detector, /fingerprint/);
assert.match(detector, /isStable/);
assert.match(detector, /textExplanation/);
assert.match(detector, /softPermissionBody|permissionButtonCluster|今回のみ/);
assert.doesNotMatch(detector, /import .*AccessibilityService|dispatchGesture|performGlobalAction/);

const explainer = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistPopupExplainer.kt',
);
assert.match(explainer, /代わりに押しません/);
assert.match(explainer, /explainScreenText/);
assert.match(explainer, /AssistSecretRedactor/);

const redactor = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistSecretRedactor.kt',
);
assert.match(redactor, /forVoice/);
assert.match(redactor, /パスワード|認証コード/);

const service = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistForegroundService.kt',
);
assert.match(service, /AssistPopupDetector/);
assert.match(service, /AssistPopupExplainer/);
assert.match(service, /pendingPopupFingerprint|popupStreak/);
assert.match(service, /resolveGuidance/);
assert.match(service, /speakLatest/);
assert.doesNotMatch(service, /AccessibilityService|dispatchGesture|performGlobalAction/);

const rules = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistGuidanceRules.kt',
);
assert.match(rules, /AssistPopupExplainer\.explainScreenText/);
assert.match(rules, /AssistPopupDetector\.detect/);

const home = read('src/screens/HomeScreen.tsx');
assert.match(home, /HOME_FEATURES\.map/);
assert.match(home, /import \{ HOME_FEATURES \}/);
assert.doesNotMatch(home, /import \{ FEATURES \}/);
assert.doesNotMatch(home, /(?<!HOME_)FEATURES\.map/);

const features = read('src/constants/features.ts');
assert.match(features, /HOME_FEATURES/);
assert.match(features, /safetyCheck/);
assert.match(features, /id: 'safetyCheck'/);

const assistUrl = pathToFileURL(
  path.join(root, 'src/services/androidAssist/index.ts'),
).href;
const {
  buildGuidanceFromOcrText,
  detectPopup,
  explainPopup,
  explainScreenText,
  isPopupStable,
  redactSecretsForVoice,
  containsSensitive,
  resolveAssistGuidance,
  assistIntervalForFeature,
  TEXT_EXPLAIN_ASSIST_INTERVAL_MS,
  OPS_ASSIST_INTERVAL_MS,
} = await import(assistUrl);

const featuresUrl = pathToFileURL(
  path.join(root, 'src/constants/features.ts'),
).href;
const { FEATURES, HOME_FEATURES } = await import(featuresUrl);
assert.equal(FEATURES.length, 3);
assert.equal(HOME_FEATURES.length, 2);
assert.deepEqual(
  HOME_FEATURES.map((f) => f.id),
  ['operationSupport', 'textExplanation'],
);
assert.ok(FEATURES.some((f) => f.id === 'safetyCheck'));

// --- Camera permission dialog ---
const camOcr =
  '「カメラ」へのアクセスをアプリに許可しますか？ 許可しない 一度だけ アプリの使用中のみ 許可';
const cam = detectPopup(camOcr);
assert.ok(cam);
assert.equal(cam.kind, 'PERMISSION_CAMERA');
assert.ok(cam.buttons.includes('許可しない') || cam.buttons.includes('許可'));
assert.equal(isPopupStable(null, cam, 1), false);
assert.equal(isPopupStable(cam.fingerprint, cam, 1), false); // default needed=2
assert.equal(isPopupStable(cam.fingerprint, cam, 2), true);
assert.equal(isPopupStable(cam.fingerprint, cam, 1, 1), true); // ~20s interval path

const camExplain = explainPopup(cam);
assert.equal(camExplain.mode, 'demo');
assert.match(camExplain.displayText, /カメラ/);
assert.match(camExplain.voiceText, /代わりに押しません/);
assert.match(camExplain.stageId, /popup-permission_camera/i);

// --- Photos ---
const photos = detectPopup(
  '写真へのアクセスを許可しますか？ 許可しない 許可する',
);
assert.ok(photos);
assert.equal(photos.kind, 'PERMISSION_PHOTOS');

// --- Terms ---
const terms = detectPopup('利用規約に同意しますか？ 同意する 同意しない');
assert.ok(terms);
assert.equal(terms.kind, 'TERMS');

// --- Not a dialog ---
assert.equal(detectPopup('トーク アルバム 送信'), null);

// --- Secrets ---
assert.equal(containsSensitive('パスワード: secret123'), true);
assert.match(redactSecretsForVoice('パスワード: secret123'), /伏せます/);
assert.doesNotMatch(redactSecretsForVoice('パスワード: secret123'), /secret123/);

// --- textExplanation grounded ---
const textGuid = buildGuidanceFromOcrText({
  featureId: 'textExplanation',
  goalSummary: 'この文を説明して',
  ocrText: camOcr,
});
assert.equal(textGuid.mode, 'demo');
assert.match(textGuid.stageId, /popup/i);
assert.match(textGuid.displayText, /カメラ|ボタン/);

const plainExplain = explainScreenText('設定 Wi‑Fi 接続済み');
assert.equal(plainExplain.mode, 'demo');
assert.match(plainExplain.displayText, /設定|Wi/);
assert.match(plainExplain.voiceText, /代わりには操作しません|画面の文字/);

// --- operationSupport: popup interrupts LINE stages ---
const opPopup = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'LINEで孫に写真を送りたい',
  ocrText: camOcr,
});
assert.match(opPopup.stageId, /popup/i);
assert.match(opPopup.displayText, /カメラ/);

// --- operationSupport: no popup → stage guidance still works ---
const linePick = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'LINEで孫に写真を送りたい',
  ocrText: 'アルバム 最近の項目',
});
assert.equal(linePick.stepId, 'line-pick-photo');

// --- safety still coded ---
const safety = buildGuidanceFromOcrText({
  featureId: 'safetyCheck',
  goalSummary: 'この電話は安全？',
  ocrText: '0120-XXX 今すぐ振込',
});
assert.equal(safety.stageId, 'safety');
assert.match(safety.voiceText, /決めつけない/);

// --- Broader Japanese dialog cues ---
assert.ok(detectPopup('新しいバージョンが利用可能です 更新 後で'));
assert.ok(detectPopup('デバイスの写真や動画、音楽へのアクセスを許可'));
assert.ok(detectPopup('許可しない アプリの使用中のみ 今回のみ'));

// --- textExplanation FGS path: popup → explanation on first sample ---
assert.equal(assistIntervalForFeature('textExplanation'), TEXT_EXPLAIN_ASSIST_INTERVAL_MS);
assert.equal(assistIntervalForFeature('operationSupport'), OPS_ASSIST_INTERVAL_MS);
const popupFire = resolveAssistGuidance({
  featureId: 'textExplanation',
  goalSummary: 'この確認を説明して',
  ocrText: camOcr,
  ocrChanged: true,
  intervalMs: TEXT_EXPLAIN_ASSIST_INTERVAL_MS,
});
assert.ok(popupFire.step);
assert.match(popupFire.step.stageId, /popup/i);
assert.match(popupFire.step.voiceText, /代わりに押しません/);

// Normal non-dialog still gets OCR summary for textExplanation
const plain = resolveAssistGuidance({
  featureId: 'textExplanation',
  goalSummary: '説明して',
  ocrText: '設定 Wi‑Fi 接続済み',
  ocrChanged: true,
  intervalMs: TEXT_EXPLAIN_ASSIST_INTERVAL_MS,
});
assert.ok(plain.step);
assert.match(plain.step.displayText, /設定|Wi/);

console.log('smoke-popup-auto-assist: OK');

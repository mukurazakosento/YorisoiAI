/**
 * Final-spec Phase D スモーク — 画面収録境界・端末内 OCR 配線・OS 制限の正直さ。
 * 使い方: npm run smoke:capture
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

// --- Source honesty: no fake live capture / no silent spy ---
const supportSession = read('src/screens/SupportSessionScreen.tsx');
assert.doesNotMatch(supportSession, /\bScrollView\b/);
assert.match(supportSession, /startCaptureSession/);
assert.match(supportSession, /requestUserFrame|SessionCapturePanel/);
assert.match(supportSession, /rebuildGuidanceFromConfirmedFrame/);
assert.match(supportSession, /confirmFrameText|onConfirmDraft/);
assert.match(supportSession, /stopCaptureSession/);
assert.doesNotMatch(supportSession, /画面収録：準備中/);
assert.doesNotMatch(supportSession, /定期OCR：準備中/);
assert.doesNotMatch(supportSession, /imageBase64|screenshotBytes/);
assert.doesNotMatch(supportSession, /silent.?capture|autoDetectPopup|スパイ/i);

const capturePanel = read('src/components/SessionCapturePanel.tsx');
assert.doesNotMatch(capturePanel, /\bScrollView\b/);
assert.match(capturePanel, /recordingLabel/);
assert.match(capturePanel, /periodicOcrLabel/);
assert.match(capturePanel, /この文字で進む/);

const captureIndex = read('src/services/capture/index.ts');
assert.match(captureIndex, /画像・映像は外部へ送らない/);
assert.match(captureIndex, /サイレント/);

const broadcast = read('src/services/capture/broadcast.ts');
assert.match(broadcast, /isBroadcastUploadLinked/);
assert.match(broadcast, /return false/);
assert.match(broadcast, /Broadcast Upload/);

const limits = read('src/services/capture/limits.ts');
assert.match(limits, /サイレントスパイ不可|無言で常時録画/);
assert.match(limits, /ポップアップ/);
assert.match(limits, /Expo Go \/ Web/);

const availabilitySrc = read('src/services/capture/availability.ts');
assert.match(availabilitySrc, /manual_screenshot_ocr/);
assert.match(availabilitySrc, /broadcast_upload/);
assert.match(availabilitySrc, /unavailable/);

const featurePaths = read('src/services/capture/featurePaths.ts');
assert.match(featurePaths, /operationSupport/);
assert.match(featurePaths, /textExplanation/);
assert.match(featurePaths, /safetyCheck/);
assert.match(featurePaths, /画面を読み取る/);
assert.match(featurePaths, /画面の文字を調べる/);
assert.match(featurePaths, /ポップアップを読み取る/);

const ocrIndex = read('src/services/ocr/index.ts');
assert.match(ocrIndex, /recognizeTextFromImageUri|pickAndRecognizeScreenshot/);
assert.match(ocrIndex, /deleteTempImageUri/);

const packageJson = JSON.parse(read('package.json'));
assert.equal(packageJson.version, '0.11.0');
assert.match(packageJson.scripts['smoke:capture'], /smoke-capture-phase-d/);

const readme = read('README.md');
assert.match(readme, /Phase D|画面収録/);
assert.match(readme, /Broadcast Upload|Broadcast/);
assert.match(readme, /Expo Go/);
assert.match(readme, /development build/);
assert.match(readme, /できない|制限/);
assert.doesNotMatch(readme, /Expo Go でライブ画面収録が使えます/);

const agents = read('AGENTS.md');
assert.match(agents, /capture|画面収録/);
assert.match(agents, /smoke:capture/);

const config = read('src/constants/config.ts');
assert.match(config, /0\.11\.0-phase-d/);

// --- Runtime: capability honesty + confirmed-text-only summary ---
const captureUrl = pathToFileURL(
  path.join(root, 'src/services/capture/index.ts'),
).href;
const {
  assertCaptureHonesty,
  buildSummaryWithConfirmedFrame,
  CAPTURE_OS_LIMITS,
  getCaptureAvailability,
  getFeatureCapturePath,
  isBroadcastUploadLinked,
  resetCaptureSessionForTests,
  startCaptureSession,
  stopCaptureSession,
  confirmFrameText,
  getConfirmedFrameText,
  updateFrameDraft,
  getCaptureSessionState,
} = await import(captureUrl);

assert.equal(isBroadcastUploadLinked(), false);
assert.ok(CAPTURE_OS_LIMITS.cannot.length >= 3);
assert.ok(CAPTURE_OS_LIMITS.can.length >= 2);

resetCaptureSessionForTests();
const availability = getCaptureAvailability();
assert.equal(assertCaptureHonesty(availability), true);
assert.equal(availability.broadcastUploadLinked, false);
assert.equal(availability.periodicAutoFramesAvailable, false);

// Node / smoke 環境では OCR ネイティブ無し → unavailable が正しい
assert.equal(availability.capability, 'unavailable');
assert.equal(availability.manualFrameAvailable, false);
assert.match(availability.recordingLabel, /不可|要development|制限/);
assert.match(availability.periodicOcrLabel, /不可|要development|未対応/);

const opPath = getFeatureCapturePath('operationSupport');
assert.match(opPath.readButtonLabel, /画面を読み取る/);
const safetyPath = getFeatureCapturePath('safetyCheck');
assert.match(safetyPath.readButtonLabel, /調べる/);
const explainPath = getFeatureCapturePath('textExplanation');
assert.match(explainPath.readButtonLabel, /ポップアップ/);

const summary = buildSummaryWithConfirmedFrame({
  featureId: 'operationSupport',
  baseSummary: 'LINEの通知',
  confirmedText: '通知がオフになっています',
});
assert.match(summary, /LINE/);
assert.match(summary, /画面の文字/);
assert.match(summary, /通知がオフ/);
assert.doesNotMatch(summary, /file:\/\/|data:image|base64/i);

// セッション API: 未接続環境でも開始でき、確認済み文字だけ保持できる形
resetCaptureSessionForTests();
const started = startCaptureSession('safetyCheck');
assert.equal(started.featureId, 'safetyCheck');
assert.ok(
  started.phase === 'unavailable' || started.phase === 'active',
  `unexpected phase ${started.phase}`,
);

// ドラフト確認経路（ネイティブ無しでも state API を検証）
if (started.phase === 'active') {
  updateFrameDraft('0120-xxx-xxxx');
  const confirmed = confirmFrameText();
  assert.ok(confirmed);
  assert.equal(getConfirmedFrameText(), '0120-xxx-xxxx');
  assert.equal(confirmed.text, '0120-xxx-xxxx');
  assert.equal('imageUri' in confirmed, false);
} else {
  // unavailable: confirm は featureId があっても draft なしなら null
  const confirmed = confirmFrameText('テスト');
  // featureId はセット済みなので確認できる実装でもよいが、phase unavailable では draft 経由
  assert.ok(confirmed === null || confirmed.text === 'テスト');
}

stopCaptureSession();
const stopped = getCaptureSessionState();
assert.ok(stopped.phase === 'stopped' || stopped.phase === 'unavailable');
assert.equal(getConfirmedFrameText(), null);

console.log('smoke-capture-phase-d: OK');

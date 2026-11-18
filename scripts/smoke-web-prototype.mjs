/**
 * Web 試作スモーク — getDisplayMedia / Tesseract / アキネーター / 正直な制限。
 * 使い方: npm run smoke:web
 *
 * ブラウザ実機の getDisplayMedia・OCR はここでは実行しない。
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

const features = read('src/constants/features.ts');
assert.match(features, /操作支援/);
assert.match(features, /文章解説/);
assert.match(features, /危険性通知/);

const home = read('src/screens/HomeScreen.tsx');
assert.doesNotMatch(home, /\bScrollView\b/);
assert.match(home, /FeatureButton/);

const aiChoice = read('src/screens/AiChoiceScreen.tsx');
assert.doesNotMatch(aiChoice, /\bScrollView\b/);
assert.match(aiChoice, /classifyIntent/);
assert.match(aiChoice, /generateClarifyChoices/);
assert.match(aiChoice, /clarifyHistory/);
assert.match(aiChoice, /自分の言葉で答える/);
assert.match(aiChoice, /SupportSession/);

const support = read('src/screens/SupportSessionScreen.tsx');
assert.doesNotMatch(support, /\bScrollView\b/);
assert.match(support, /WebCapturePanel/);
assert.match(support, /startWebDisplayShare/);
assert.match(support, /できました/);
assert.match(support, /分かりません/);
assert.match(support, /もう一度聞く/);
assert.match(support, /AI未接続/);
assert.doesNotMatch(support, /imageBase64|screenshotBytes/);

const webIndex = read('src/services/webCapture/index.ts');
assert.match(webIndex, /getDisplayMedia/);
assert.match(webIndex, /Tesseract/);
assert.match(webIndex, /外部送信しない|画像は保持/);
assert.match(webIndex, /ネイティブ capture/);

const webSession = read('src/services/webCapture/session.ts');
assert.match(webSession, /getDisplayMedia/);
assert.match(webSession, /WEB_FRAME_INTERVAL_MS/);
assert.match(webSession, /5000/);
assert.match(webSession, /visibilitychange/);
assert.match(webSession, /背面では動きません/);
assert.doesNotMatch(webSession, /upload|FormData|firebase\.storage/i);

const tesseractWeb = read('src/services/webCapture/tesseractOcr.web.ts');
assert.match(tesseractWeb, /tesseract\.js/);
assert.match(tesseractWeb, /jpn/);
assert.match(tesseractWeb, /外部へ送らない/);

const notifications = read('src/services/notifications/index.ts');
assert.match(notifications, /Notification\.requestPermission|ensureWebNotificationPermission/);
assert.match(notifications, /Platform\.OS === 'web'/);

const speech = read('src/services/speech/index.ts');
assert.match(speech, /SpeechSynthesis|speechSynthesis/);

const packageJson = JSON.parse(read('package.json'));
assert.equal(packageJson.version, '0.12.0');
assert.ok(packageJson.dependencies['tesseract.js']);
assert.match(packageJson.scripts['smoke:web'], /smoke-web-prototype/);

const readme = read('README.md');
assert.match(readme, /getDisplayMedia|画面共有/);
assert.match(readme, /Tesseract/);
assert.match(readme, /npm run web|expo start --web/);
assert.match(readme, /制限|不可/);
assert.match(readme, /APIキーをフロントに置かない/);

const agents = read('AGENTS.md');
assert.match(agents, /webCapture|getDisplayMedia|Tesseract/);

// --- Runtime: Node では Web 共有不可が正直 ---
const webUrl = pathToFileURL(
  path.join(root, 'src/services/webCapture/index.ts'),
).href;
const {
  getWebCaptureAvailability,
  probeWebCaptureSupport,
  resetWebCaptureSessionForTests,
  getWebCaptureSessionState,
  WEB_FRAME_INTERVAL_MS,
} = await import(webUrl);

assert.equal(WEB_FRAME_INTERVAL_MS, 5000);
assert.equal(probeWebCaptureSupport(), 'unsupported');
const availability = getWebCaptureAvailability();
assert.equal(availability.supported, false);
assert.equal(availability.canStartShare, false);
assert.match(availability.recordingLabel, /不可/);

resetWebCaptureSessionForTests();
const state = getWebCaptureSessionState();
assert.equal(state.sharing, false);
assert.ok(state.phase === 'unavailable' || state.phase === 'idle');

// ネイティブ capture 経路は Web でも別サービスとして残る（偽らない）
const captureUrl = pathToFileURL(
  path.join(root, 'src/services/capture/index.ts'),
).href;
const { getCaptureAvailability } = await import(captureUrl);
const nativeCap = getCaptureAvailability();
assert.equal(nativeCap.manualFrameAvailable, false);
assert.equal(nativeCap.capability, 'unavailable');

console.log('smoke-web-prototype: OK');

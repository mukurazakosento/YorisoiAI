/**
 * Final-spec Phase B スモーク — 支援セッション状態機械・デモ脚本・通知／音声配線。
 * 使い方: npm run smoke:session
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

// --- Source: no ScrollView import/usage in session shell / Screen ---
const screenBase = read('src/components/Screen.tsx');
assert.doesNotMatch(screenBase, /from ['"]react-native['"].*ScrollView|ScrollView,/);
assert.match(screenBase, /ノンスクロール/);

const supportSession = read('src/screens/SupportSessionScreen.tsx');
assert.doesNotMatch(supportSession, /\bScrollView\b/);
assert.match(supportSession, /starting/);
assert.match(supportSession, /guiding/);
assert.match(supportSession, /offer_end/);
assert.match(supportSession, /ここをタップで支援を終了/);
assert.match(supportSession, /デモ/);
assert.match(supportSession, /startCaptureSession|SessionCapturePanel/);
assert.doesNotMatch(supportSession, /画面収録：準備中/);
assert.doesNotMatch(supportSession, /定期OCR：準備中/);
assert.match(supportSession, /speak\(/);
assert.match(supportSession, /stopSpeaking/);
assert.match(supportSession, /presentInstructionNotification/);
assert.match(supportSession, /presentEndSupportNotification/);
assert.match(supportSession, /addEndSupportResponseListener/);
assert.match(supportSession, /settings\.voiceEnabled/);
assert.match(supportSession, /displayText/);
assert.match(supportSession, /voiceText/);
assert.match(supportSession, /できました/);
assert.match(supportSession, /分かりません/);
assert.doesNotMatch(supportSession, /imageBase64|screenshotBytes/);

const endSupport = read('src/screens/EndSupportScreen.tsx');
assert.match(endSupport, /解決した/);
assert.match(endSupport, /解決しなかった/);
assert.match(endSupport, /Consultation/);

const notifications = read('src/services/notifications/index.ts');
assert.match(notifications, /expo-notifications/);
assert.match(notifications, /scheduleNotificationAsync/);
assert.match(notifications, /end_support/);
assert.match(notifications, /requestPermissionsAsync/);
assert.match(notifications, /画面の文字/);

const demoStepsSrc = read('src/services/session/demoSteps.ts');
assert.match(demoStepsSrc, /operationSupport/);
assert.match(demoStepsSrc, /textExplanation/);
assert.match(demoStepsSrc, /safetyCheck/);
assert.match(demoStepsSrc, /END_SUPPORT_DISPLAY/);
// 断定的な「安全です」は使わず、否定で明示する
assert.match(demoStepsSrc, /「安全です」とは言/);

const onDeviceSrc = read('src/services/onDeviceAi/index.ts');
assert.match(onDeviceSrc, /isOnDeviceAiReady/);
assert.match(onDeviceSrc, /buildGuidanceScript/);

const sessionTypes = read('src/types/session.ts');
assert.match(sessionTypes, /SupportSessionPhase/);
assert.match(sessionTypes, /'starting' \| 'guiding' \| 'offer_end'/);

const appTsx = read('App.tsx');
assert.match(appTsx, /configureNotificationHandler/);

const appJson = read('app.json');
assert.match(appJson, /expo-notifications/);

const packageJson = JSON.parse(read('package.json'));
assert.ok(packageJson.dependencies['expo-notifications']);
assert.match(packageJson.scripts['smoke:session'], /smoke-session-phase-b/);

const readme = read('README.md');
assert.match(readme, /Phase B|支援セッション|Phase D/);
assert.match(readme, /通知/);
assert.match(readme, /Expo Speech|音声/);
assert.match(readme, /画面収録|OCR|Broadcast/);

// --- Runtime: demo scripts for 3 features ---
const demoUrl = pathToFileURL(
  path.join(root, 'src/services/session/demoSteps.ts'),
).href;
const {
  buildDemoSessionScript,
  END_SUPPORT_DISPLAY,
  END_SUPPORT_VOICE,
} = await import(demoUrl);

const onDeviceUrl = pathToFileURL(
  path.join(root, 'src/services/onDeviceAi/status.ts'),
).href;
const { isOnDeviceAiReady, resetOnDeviceAiForTests } = await import(onDeviceUrl);
resetOnDeviceAiForTests();
assert.equal(isOnDeviceAiReady(), false);
assert.equal(END_SUPPORT_DISPLAY, 'ここをタップで支援を終了');
assert.ok(END_SUPPORT_VOICE.length > END_SUPPORT_DISPLAY.length);

const op = buildDemoSessionScript({
  featureId: 'operationSupport',
  summary: 'LINEの使い方が分からない',
});
assert.equal(op.isDemo, true);
assert.ok(op.steps.length >= 2);
for (const step of op.steps) {
  assert.ok(step.displayText);
  assert.ok(step.voiceText);
  assert.ok(step.voiceText.length >= step.displayText.length);
  assert.ok(step.simplifyDisplayText);
  assert.ok(step.simplifyVoiceText);
}

const wifi = buildDemoSessionScript({
  featureId: 'operationSupport',
  summary: 'Wi-Fiにつなぎたい',
});
assert.notEqual(wifi.id, op.id);

const explain = buildDemoSessionScript({
  featureId: 'textExplanation',
  summary: '許可しますか？と出た',
});
assert.equal(explain.isDemo, true);
assert.ok(explain.steps.length >= 2);
assert.match(explain.steps.map((s) => s.displayText).join(' '), /許可/);

const safety = buildDemoSessionScript({
  featureId: 'safetyCheck',
  summary: '知らない番号から電話があった',
});
assert.equal(safety.isDemo, true);
assert.ok(safety.steps.length >= 2);
const safetyBlob = safety.steps.map((s) => `${s.displayText} ${s.voiceText}`).join(' ');
assert.match(safetyBlob, /電話/);
assert.match(safetyBlob, /「安全です」とは言/);

// State machine shape: start → guiding steps → offer end
assert.ok(['starting', 'guiding', 'offer_end'].every((p) =>
  supportSession.includes(`'${p}'`) || supportSession.includes(p),
));

const expoNotificationsPkg = require(
  path.join(root, 'node_modules/expo-notifications/package.json'),
);
assert.equal(expoNotificationsPkg.name, 'expo-notifications');

console.log('smoke-session-phase-b: OK');

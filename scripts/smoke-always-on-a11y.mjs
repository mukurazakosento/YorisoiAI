/**
 * Always-on AccessibilityService popup explain smoke.
 * 使い方: npm run smoke:always-on-a11y
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

const pkg = JSON.parse(read('package.json'));
assert.match(pkg.scripts['smoke:always-on-a11y'], /smoke-always-on-a11y/);

const a11y = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistDialogAccessibilityService.kt',
);
assert.match(a11y, /Always-on|always-on|AssistNotifier\.showGuidance/i);
// No runtime gate on sessionActive (KDoc may mention the old gate by name).
assert.doesNotMatch(a11y, /!AssistDialogTextHolder\.sessionActive|if\s*\(\s*event\s*==\s*null\s*\|\|\s*!.*sessionActive/);
assert.doesNotMatch(a11y, /dispatchGesture|performGlobalAction|ACTION_CLICK/);
assert.match(a11y, /isExplainWorthyDialog/);
assert.match(a11y, /AssistSecretRedactor|forPublicText|forVoice/);

const holder = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistDialogTextHolder.kt',
);
assert.doesNotMatch(holder, /fun publish\([^)]*\)[^{]*\{[^}]*!sessionActive/s);

const manifest = read(
  'modules/yorisoi-android-assist/android/src/main/AndroidManifest.xml',
);
assert.match(
  manifest,
  /AssistDialogAccessibilityService[\s\S]*android:exported="true"/,
);

const plugin = read('modules/yorisoi-android-assist/app.plugin.js');
assert.match(plugin, /android:exported': 'true'/);

// app.json must stay untouched by this feature intent (file exists; we don't rewrite it)
assert.equal(fs.existsSync(path.join(root, 'app.json')), true);

const assistUrl = pathToFileURL(
  path.join(root, 'src/services/androidAssist/index.ts'),
).href;
const {
  detectPopup,
  resolveAssistGuidance,
  TEXT_EXPLAIN_ASSIST_INTERVAL_MS,
  OPS_ASSIST_INTERVAL_MS,
} = await import(assistUrl);

assert.equal(OPS_ASSIST_INTERVAL_MS, 20_000);

const locationFull =
  'マップにこのデバイスの位置情報へのアクセスを許可しますか？ 正確な位置情報 おおよその位置情報 アプリの使用中のみ 今回のみ 許可しない';
const loc = detectPopup(locationFull);
assert.ok(loc);
assert.equal(loc.kind, 'PERMISSION_LOCATION');

const explained = resolveAssistGuidance({
  featureId: 'textExplanation',
  goalSummary: '位置情報',
  ocrText: '',
  a11yText: locationFull,
  ocrChanged: true,
  intervalMs: TEXT_EXPLAIN_ASSIST_INTERVAL_MS,
});
assert.ok(explained.step);
assert.match(explained.step.stageId, /popup-permission_location/i);
assert.match(explained.step.voiceText, /代わりに押しません/);

// Non-dialog must not fire
assert.equal(detectPopup('トーク アルバム 送信'), null);
assert.equal(detectPopup('ホーム 設定 電話'), null);

console.log('smoke-always-on-a11y: OK');

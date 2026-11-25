/**
 * Android MediaProjection 背面支援スモーク。
 * 使い方: npm run smoke:android-assist
 *
 * 実機／Kotlin コンパイルは検証しない。ソースと JS 境界の正直さを断言する。
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
assert.equal(pkg.dependencies['yorisoi-android-assist'], 'file:./modules/yorisoi-android-assist');
assert.match(pkg.scripts['smoke:android-assist'], /smoke-android-assist/);
assert.match(pkg.version, /^0\.1[4-9]\./);

const appJson = JSON.parse(read('app.json'));
assert.ok(
  appJson.expo.plugins.some(
    (p) =>
      p === './modules/yorisoi-android-assist/app.plugin.js' ||
      (Array.isArray(p) && p[0] === './modules/yorisoi-android-assist/app.plugin.js'),
  ),
);
assert.ok(
  appJson.expo.android.permissions.includes(
    'android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION',
  ),
);

const expoMod = JSON.parse(
  read('modules/yorisoi-android-assist/expo-module.config.json'),
);
assert.deepEqual(expoMod.platforms, ['android']);

const service = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistForegroundService.kt',
);
assert.match(service, /MediaProjection/);
assert.match(service, /VirtualDisplay/);
assert.match(service, /FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION|mediaProjection/);
assert.match(service, /DEFAULT_INTERVAL_MS = 20000/);
assert.match(service, /AssistOcrHelper/);
assert.match(service, /AssistProjectionHolder\.clearAll/);
assert.doesNotMatch(service, /BOOT_COMPLETED|RECEIVE_BOOT/);
// Optional session-scoped Accessibility text OK; never auto-tap.
assert.doesNotMatch(service, /dispatchGesture|performGlobalAction|ACTION_CLICK/);

const ocrHelper = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistOcrHelper.kt',
);
assert.match(ocrHelper, /JapaneseTextRecognizerOptions/);
assert.match(ocrHelper, /text-recognition|TextRecognition|Japanese/);

const gradle = read('modules/yorisoi-android-assist/android/build.gradle');
assert.match(gradle, /text-recognition-japanese:16\.0\.1/);

const holder = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistProjectionHolder.kt',
);
assert.match(holder, /clearAll/);
assert.match(holder, /takePendingPermission/);
assert.match(holder, /no token reuse|再利用|clearAll/i);

const moduleKt = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/YorisoiAndroidAssistModule.kt',
);
assert.match(moduleKt, /requestPermission/);
assert.match(moduleKt, /startAssist/);
assert.match(moduleKt, /stopAssist/);
assert.match(moduleKt, /OnActivityResult/);

const plugin = read('modules/yorisoi-android-assist/app.plugin.js');
assert.match(plugin, /FOREGROUND_SERVICE_MEDIA_PROJECTION/);
assert.match(plugin, /AssistForegroundService/);
assert.doesNotMatch(plugin, /BOOT_COMPLETED/);

const guidanceNative = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistGuidanceRules.kt',
);
assert.match(guidanceNative, /mode: String = "demo"/);
assert.match(guidanceNative, /孫|写真|LINE|line/i);
assert.match(guidanceNative, /looksLikeLinePhotoGoal\(goal\)/);
assert.match(guidanceNative, /shouldAnnounce/);

const notifier = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistNotifier.kt',
);
assert.match(notifier, /getForegroundService|getService/);
assert.match(notifier, /addAction/);

const consent = read('src/screens/AndroidAssistConsentScreen.tsx');
assert.doesNotMatch(consent, /\bScrollView\b/);
assert.match(consent, /画面共有|背面/);
assert.match(consent, /デモ|AI未接続|端末内AI/);
// 通常フローは中間同意画面を挟まず SupportSession へ直接
const navigateSupport = read('src/utils/navigateToSupport.ts');
assert.doesNotMatch(navigateSupport, /AndroidAssistConsent/);
assert.match(navigateSupport, /backgroundAssist:\s*assist\.available/);

const support = read('src/screens/SupportSessionScreen.tsx');
assert.doesNotMatch(support, /\bScrollView\b/);
assert.match(support, /startAndroidAssistSession|backgroundAssist/);
assert.match(support, /stopAndroidAssistSession/);
assert.match(support, /デモ/);
assert.match(support, /次にすること/);
assert.match(support, /footer/);
assert.match(support, /speakLatest/);

const screenComp = read('src/components/Screen.tsx');
assert.match(screenComp, /footer/);
assert.match(screenComp, /bottom/);

const nativeScaffold = read('src/services/onDeviceAi/nativeScaffold.ts');
assert.match(nativeScaffold, /return null/);
assert.match(nativeScaffold, /未接続/);

const demo = read('src/services/onDeviceAi/demo.ts');
assert.match(demo, /mode: 'demo'/);

// Runtime: Node では Android ネイティブ無し → unavailable が正しい
const assistUrl = pathToFileURL(
  path.join(root, 'src/services/androidAssist/index.ts'),
).href;
const {
  applyOcrTextForTests,
  getAndroidAssistAvailability,
  getAndroidAssistSessionState,
  resetAndroidAssistSessionForTests,
  buildGuidanceFromOcrText,
} = await import(assistUrl);

resetAndroidAssistSessionForTests();
const availability = getAndroidAssistAvailability();
assert.equal(availability.available, false);
assert.ok(
  availability.reason === 'not-android' ||
    availability.reason === 'expo-go-or-missing-native' ||
    availability.reason === 'web',
);
assert.match(availability.label, /Android|EAS|不可|Web/);

const lineGuidance = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'LINEで孫に写真を送りたい',
  ocrText: 'トーク アルバム',
});
assert.equal(lineGuidance.mode, 'demo');
assert.match(lineGuidance.displayText, /写真|選|トーク/);
assert.doesNotMatch(lineGuidance.displayText, /AI稼働|live AI/i);

const wifiNotLine = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'Wi-Fiにつなぎたい',
  ocrText: 'ネットワーク',
});
assert.match(wifiNotLine.stepId, /^wifi-/);
assert.doesNotMatch(wifiNotLine.displayText, /LINE|孫/);

resetAndroidAssistSessionForTests();
const state = getAndroidAssistSessionState();
assert.ok(state.phase === 'unavailable' || state.phase === 'idle');

// applyOcr without featureId → null
assert.equal(applyOcrTextForTests('テスト'), null);

const captureUrl = pathToFileURL(
  path.join(root, 'src/services/capture/index.ts'),
).href;
const { getCaptureAvailability, assertCaptureHonesty } = await import(captureUrl);
const cap = getCaptureAvailability();
assert.equal(cap.androidMediaProjectionLinked, false);
assert.equal(assertCaptureHonesty(cap), true);
assert.equal(cap.periodicAutoFramesAvailable, false);

const readme = read('README.md');
assert.match(readme, /MediaProjection|背面支援/);
assert.match(readme, /smoke:android-assist/);
assert.doesNotMatch(readme, /Expo Go で背面支援が使えます/);

const agents = read('AGENTS.md');
assert.match(agents, /androidAssist|MediaProjection|背面/);

console.log('smoke-android-assist: OK');

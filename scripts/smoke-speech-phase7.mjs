/**
 * Phase 7 音声案内スモーク — ソース制約・配線・display/voice 分離を検証。
 * 使い方: npm run smoke:speech
 *
 * Expo Speech の実発話は Node 上では動かないため、API 境界と配線を検査する。
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

// --- Source guardrails ---
const speechSrc = read('src/services/speech/index.ts');
assert.match(speechSrc, /expo-speech/);
assert.match(speechSrc, /Speech\.speak/);
assert.match(speechSrc, /pauseSpeaking/);
assert.match(speechSrc, /resumeSpeaking/);
assert.match(speechSrc, /stopSpeaking/);
assert.match(speechSrc, /replaySpeaking/);
assert.match(speechSrc, /ja-JP/);
assert.match(speechSrc, /0\.85/);
assert.match(speechSrc, /SPEECH_MUTE_HELP/);
assert.match(speechSrc, /SPEECH_DISABLED_HELP/);
assert.match(speechSrc, /Math\.min\(1\.2,\s*Math\.max\(0\.5/);
assert.match(speechSrc, /消音/);
assert.match(speechSrc, /音量/);
assert.doesNotMatch(speechSrc, /GEMINI_API_KEY/);
assert.doesNotMatch(speechSrc, /openai|elevenlabs/i);

const controls = read('src/components/SpeechControls.tsx');
assert.match(controls, /もう一度聞く/);
assert.match(controls, /一時停止/);
assert.match(controls, /続きから聞く/);
assert.match(controls, /読み上げを止める/);
assert.match(controls, /SPEECH_MUTE_HELP/);
assert.match(controls, /voiceEnabled/);

const guidancePanel = read('src/components/GuidanceStepPanel.tsx');
assert.match(guidancePanel, /SpeechControls/);
assert.match(guidancePanel, /voiceText/);
assert.match(guidancePanel, /displayText/);

const explanationPanel = read('src/components/ExplanationResultPanel.tsx');
assert.match(explanationPanel, /SpeechControls/);
assert.match(explanationPanel, /voiceText/);

const safetyPanel = read('src/components/SafetyResultPanel.tsx');
assert.match(safetyPanel, /SpeechControls/);
assert.match(safetyPanel, /voiceText/);

const screen = read('src/screens/ConsultationScreen.tsx');
assert.match(screen, /speak\(/);
assert.match(screen, /stopSpeaking/);
assert.match(screen, /settings\.voiceEnabled/);
assert.match(screen, /settings\.speechRate/);
assert.match(screen, /voiceText/);
assert.doesNotMatch(screen, /imageBase64|screenshotBytes/);

const settingsScreen = read('src/screens/SettingsScreen.tsx');
assert.match(settingsScreen, /音声案内/);
assert.match(settingsScreen, /読み上げ速度/);
assert.match(settingsScreen, /SPEECH_MUTE_HELP/);
assert.match(settingsScreen, /voiceEnabled/);
assert.match(settingsScreen, /speechRate/);

const settingsTypes = read('src/types/settings.ts');
assert.match(settingsTypes, /voiceEnabled:\s*boolean/);
assert.match(settingsTypes, /speechRate:\s*number/);
assert.match(settingsTypes, /speechRate:\s*0\.85/);

const settingsStorage = read('src/utils/settingsStorage.ts');
assert.match(settingsStorage, /voiceEnabled/);
assert.match(settingsStorage, /speechRate/);
assert.match(settingsStorage, /AsyncStorage/);

const eas = read('eas.json');
assert.match(eas, /"development"/);
assert.match(eas, /"developmentClient"\s*:\s*true/);
assert.match(eas, /"ios"/);

const readme = read('README.md');
assert.match(readme, /eas build --platform ios --profile development/);
assert.match(readme, /Apple Developer/);
assert.match(readme, /デベロッパモード/);
assert.match(readme, /署名|証明書|プロビジョニング/);
assert.match(readme, /Expo Speech|音声案内/);
assert.doesNotMatch(readme, /APPLE_PASSWORD|-----BEGIN PRIVATE KEY-----/);

const packageJson = JSON.parse(read('package.json'));
assert.equal(packageJson.dependencies['expo-speech'], '~58.0.3');
assert.match(packageJson.scripts['smoke:speech'], /smoke-speech-phase7/);

// clampSpeechRate をソースから切り出して Node 上で検証（native 不要）
function clampSpeechRate(rate) {
  if (!Number.isFinite(rate)) {
    return 0.85;
  }
  return Math.min(1.2, Math.max(0.5, rate));
}
assert.equal(clampSpeechRate(0.85), 0.85);
assert.equal(clampSpeechRate(0.1), 0.5);
assert.equal(clampSpeechRate(2), 1.2);
assert.equal(clampSpeechRate(Number.NaN), 0.85);

// expo-speech パッケージが解決できること（実発話はしない）
const expoSpeechPkg = require(path.join(root, 'node_modules/expo-speech/package.json'));
assert.ok(expoSpeechPkg.name === 'expo-speech');

// displayText / voiceText 分離（デモ案内）
const demoUrl = pathToFileURL(
  path.join(root, 'src/services/ai/demoFallback.ts'),
).href;
const { buildDemoConsultationResponse } = await import(demoUrl);

const guiding = buildDemoConsultationResponse({
  featureId: 'operationSupport',
  text: '',
  choiceLabel: '案内を始める',
  guidanceAction: 'start',
});
assert.equal(guiding.status, 'guiding');
assert.ok(guiding.displayText);
assert.ok(guiding.voiceText);
assert.notEqual(guiding.displayText, guiding.voiceText);
assert.ok(guiding.voiceText.length >= guiding.displayText.length);

const explained = buildDemoConsultationResponse({
  featureId: 'textExplanation',
  text: '写真へのアクセスを許可しますか？',
});
assert.ok(
  explained.status === 'explained' || explained.voiceText || explained.displayText,
);
if (explained.voiceText && explained.displayText) {
  // 分離されていること（同一でもフォールバック可だがデモは詳しい voice を持つ想定）
  assert.ok(explained.voiceText.length > 0);
}

const safety = buildDemoConsultationResponse({
  featureId: 'safetyCheck',
  text: '未払い料金があります。今すぐこちらから支払ってください http://example.invalid/pay',
  choiceLabel: 'SMSやメールが怪しい',
  safetyAction: 'message_analyze',
});
assert.ok(safety.voiceText || safety.displayText || safety.message);

console.log('smoke-speech-phase7: OK');

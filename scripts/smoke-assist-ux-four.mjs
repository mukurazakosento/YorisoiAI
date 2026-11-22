/**
 * Four UX fixes smoke (TTS queue, footer, stage guidance, minimal UI).
 * 使い方: npm run smoke:assist-ux-four
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

// 1. TTS serial + latest-only
const tts = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistTtsHelper.kt',
);
assert.match(tts, /UtteranceProgressListener/);
assert.match(tts, /pendingText/);
assert.match(tts, /speakLatest/);
assert.doesNotMatch(tts, /QUEUE_ADD/);

const speech = read('src/services/speech/index.ts');
assert.match(speech, /export async function speakLatest/);
assert.match(speech, /pendingLatest/);

const fgs = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistForegroundService.kt',
);
assert.match(fgs, /speakLatest/);
assert.match(fgs, /unreadableStep|announcedStageId/);

// 2. Footer / safe area
const screen = read('src/components/Screen.tsx');
assert.match(screen, /footer/);
assert.match(screen, /'bottom'|\"bottom\"/);
assert.match(screen, /SafeAreaView/);

// 3. Stage-aware + honesty
const {
  buildGuidanceFromOcrText,
  shouldAnnounceGuidanceStep,
} = await import(
  pathToFileURL(path.join(root, 'src/services/androidAssist/index.ts')).href
);
const stages = [
  ['ホーム 友だち', 'line-friends'],
  ['トーク メッセージ', 'line-chat'],
  ['アルバム 最近の項目', 'line-album'],
  ['送信', 'line-pre-send'],
];
for (const [ocr, stage] of stages) {
  const g = buildGuidanceFromOcrText({
    featureId: 'operationSupport',
    goalSummary: 'LINEで孫に写真を送りたい',
    ocrText: ocr,
  });
  assert.equal(g.stageId, stage, `ocr=${ocr}`);
  assert.equal(g.mode, 'demo');
}
const unread = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'Wi-Fiにつなぎたい',
  ocrText: '',
});
assert.equal(unread.stepId, 'ocr-unreadable');
assert.equal(
  shouldAnnounceGuidanceStep(
    'ocr-unreadable',
    'wifi-pick',
    'unreadable',
    'wifi-list',
  ),
  true,
);

const llama = read('src/services/onDeviceAi/nativeScaffold.ts');
assert.match(llama, /return null/);

// 4. Minimal SupportSession UI
const support = read('src/screens/SupportSessionScreen.tsx');
assert.doesNotMatch(support, /\bScrollView\b/);
assert.match(support, /次にすること/);
assert.match(support, /footer/);
assert.match(support, /label=\"できた\"|label='できた'/);
assert.match(support, /numberOfLines=\{2\}/);
assert.doesNotMatch(support, /背面支援中（/);

console.log('smoke-assist-ux-four: OK');

/**
 * Guidance routing / completion / dedupe smoke (post-#15 fixes).
 * 使い方: npm run smoke:android-assist-guidance
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

const rules = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistGuidanceRules.kt',
);
assert.match(rules, /looksLikeLinePhotoGoal\(goal\)/);
assert.match(rules, /askClarifyStep|ask-clarify/);
assert.match(rules, /looksLikeWifiGoal/);
assert.match(rules, /hasClearSentConfirmation/);
assert.match(rules, /shouldAnnounce/);
assert.doesNotMatch(
  rules,
  /featureId == "operationSupport" \|\| looksLikeLinePhotoGoal/,
);
assert.doesNotMatch(rules, /line-done/);

const service = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistForegroundService.kt',
);
assert.match(service, /shouldAnnounce|announcedStepId/);
assert.match(service, /ACTION_PAUSE/);
assert.match(service, /ACTION_RESUME/);
assert.match(service, /ACTION_STOP/);

const notifier = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistNotifier.kt',
);
assert.match(notifier, /addAction/);
assert.match(notifier, /getForegroundService/);
assert.match(notifier, /一時停止|再開/);
assert.match(notifier, /終了/);
assert.match(notifier, /ACTION_PAUSE/);
assert.match(notifier, /ACTION_RESUME/);
assert.match(notifier, /ACTION_STOP/);

const nativeScaffold = read('src/services/onDeviceAi/nativeScaffold.ts');
assert.match(nativeScaffold, /return null/);

const assistUrl = pathToFileURL(
  path.join(root, 'src/services/androidAssist/index.ts'),
).href;
const {
  buildGuidanceFromOcrText,
  hasClearSentConfirmation,
  looksLikeLinePhotoGoal,
  shouldAnnounceGuidanceStep,
} = await import(assistUrl);

// --- LINE photo scenario ---
assert.equal(
  looksLikeLinePhotoGoal('LINEで孫に写真を送りたい'),
  true,
);
const linePick = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'LINEで孫に写真を送りたい',
  ocrText: 'アルバム 最近の項目',
});
assert.equal(linePick.mode, 'demo');
assert.equal(linePick.stepId, 'line-pick-photo');

const lineConfirm = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'LINEで孫に写真を送りたい',
  ocrText: '送信 キャンセル',
});
assert.equal(lineConfirm.stepId, 'line-confirm-send');
assert.doesNotMatch(lineConfirm.displayText, /送れました/);

// --- Wi‑Fi ≠ LINE ---
assert.equal(looksLikeLinePhotoGoal('Wi-Fiにつなぎたい'), false);
const wifi = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'Wi-Fiにつなぎたい',
  ocrText: 'Wi-Fi ネットワーク一覧',
});
assert.match(wifi.stepId, /^wifi-/);
assert.doesNotMatch(wifi.displayText, /LINE|孫|写真を送/);

// LINE OCR noise while goal is Wi‑Fi must not invent LINE photo steps
const wifiWithLineOcr = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'Wi-Fiの設定',
  ocrText: 'LINE トーク アルバム 送信',
});
assert.match(wifiWithLineOcr.stepId, /^wifi-/);
assert.doesNotMatch(wifiWithLineOcr.displayText, /孫/);

// --- other ops not misrouted ---
const lineNotifyOnly = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'LINEの通知が来ない',
  ocrText: '設定 通知',
});
assert.ok(
  lineNotifyOnly.stepId === 'ask-clarify' ||
    lineNotifyOnly.stepId.startsWith('settings-'),
);
assert.doesNotMatch(lineNotifyOnly.displayText, /孫に写真|写真を付け/);

const phone = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: '知らない電話番号を確認したい',
  ocrText: '着信履歴',
});
assert.match(phone.stepId, /^phone-/);
assert.doesNotMatch(phone.displayText, /LINE/);

const unclear = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'うまくいかない',
  ocrText: 'ホーム',
});
assert.equal(unclear.stepId, 'ask-clarify');
assert.doesNotMatch(unclear.displayText, /LINEで孫/);

// --- unconfirmed send ≠ complete ---
assert.equal(hasClearSentConfirmation('送信'), false);
assert.equal(hasClearSentConfirmation('既読'), false);
assert.equal(hasClearSentConfirmation('取り消し'), false);
assert.equal(hasClearSentConfirmation('送信 既読'), false);
assert.equal(
  hasClearSentConfirmation('トーク 太郎さん 写真を送信しました'),
  true,
);

const bareSend = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'LINEで孫に写真を送りたい',
  ocrText: '送信 既読',
});
assert.equal(bareSend.stepId, 'line-confirm-send');
assert.doesNotMatch(bareSend.displayText, /^送れました/);

const clearSent = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'LINEで孫に写真を送りたい',
  ocrText: '孫 トーク 写真を送信しました',
});
assert.equal(clearSent.stepId, 'line-ask-done');
assert.equal(clearSent.stageId, 'line-ask-done');
assert.match(clearSent.displayText, /確認/);
assert.doesNotMatch(clearSent.voiceText, /送れました。ほかに/);

// --- stages: friends → chat → album ---
const friends = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'LINEで孫に写真を送りたい',
  ocrText: 'ホーム 友だち',
});
assert.equal(friends.stageId, 'line-friends');
const chat = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'LINEで孫に写真を送りたい',
  ocrText: 'トーク メッセージ',
});
assert.equal(chat.stageId, 'line-chat');
assert.equal(linePick.stageId, 'line-album');
assert.equal(lineConfirm.stageId, 'line-pre-send');

// --- unreadable ---
const unread = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'LINEで孫に写真を送りたい',
  ocrText: '   ',
});
assert.equal(unread.stepId, 'ocr-unreadable');
assert.match(unread.displayText, /うまく読み取れませんでした/);

// --- OCR noise: same stepId → no re-announce ---
assert.equal(shouldAnnounceGuidanceStep(null, 'line-pick-photo'), true);
assert.equal(
  shouldAnnounceGuidanceStep('line-pick-photo', 'line-pick-photo'),
  false,
);
assert.equal(
  shouldAnnounceGuidanceStep('line-pick-photo', 'line-confirm-send'),
  true,
);
assert.equal(shouldAnnounceGuidanceStep('wifi-open', ''), false);
// stage change re-announces even if stepId somehow same key space
assert.equal(
  shouldAnnounceGuidanceStep(
    'line-in-talk',
    'line-in-talk',
    'line-chat',
    'line-album',
  ),
  true,
);
// recovery from unreadable
assert.equal(
  shouldAnnounceGuidanceStep(
    'ocr-unreadable',
    'line-pick-photo',
    'unreadable',
    'line-album',
  ),
  true,
);

const a = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'LINEで孫に写真を送りたい',
  ocrText: 'アルバム A',
});
const b = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'LINEで孫に写真を送りたい',
  ocrText: 'アルバム B 別の写真',
});
assert.equal(a.stepId, b.stepId);
assert.equal(a.stageId, b.stageId);
assert.equal(
  shouldAnnounceGuidanceStep(a.stepId, b.stepId, a.stageId, b.stageId),
  false,
);

const tts = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistTtsHelper.kt',
);
assert.match(tts, /UtteranceProgressListener/);
assert.match(tts, /speakLatest|pendingText/);
assert.match(tts, /onDone/);

console.log('smoke-android-assist-guidance: OK');

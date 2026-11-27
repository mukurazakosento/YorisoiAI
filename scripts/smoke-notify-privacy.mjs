/**
 * Notify / lock-screen privacy + minimal ≤17 instruction notify smoke.
 * 使い方: npm run smoke:notify-privacy
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
assert.match(pkg.scripts['smoke:notify-privacy'], /smoke-notify-privacy/);

const notifier = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistNotifier.kt',
);
assert.match(notifier, /VISIBILITY_PRIVATE/);
assert.doesNotMatch(notifier, /VISIBILITY_PUBLIC/);
assert.match(notifier, /AssistSecretRedactor\.forPublicText/);
assert.match(notifier, /MAX_INSTRUCTION_CHARS\s*=\s*17/);
assert.match(notifier, /fun truncateForNotify/);
assert.match(notifier, /truncateForNotify\(AssistSecretRedactor\.forPublicText/);
assert.match(notifier, /val safeTitle = truncateForNotify\(title\)/);
assert.match(notifier, /take\(maxChars\s*-\s*1\)\s*\+\s*"…"/);

const notifyCopy = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistNotifyCopy.kt',
);
assert.match(notifyCopy, /object AssistNotifyCopy/);
assert.match(notifyCopy, /fun fromGuidance/);
assert.match(notifyCopy, /ホームへ/);
assert.match(notifyCopy, /長押し/);
assert.match(notifyCopy, /「削除」をタップ|をタップ/);
assert.match(notifyCopy, /詐欺の恐れ/);
assert.match(notifyCopy, /カメラ許可？/);

const service = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistForegroundService.kt',
);
assert.match(service, /AssistSecretRedactor\.forPublicText/);
assert.match(service, /AssistSecretRedactor\.forVoice/);
assert.match(service, /AssistNotifyCopy\.fromGuidance/);
assert.match(service, /showGuidance\(this,\s*"よりそいAI",\s*safeNotify/);
assert.match(service, /updateForeground\(safeNotify\)/);
assert.match(service, /DEFAULT_INTERVAL_MS = 20000/);
// TTS still uses full voice, not notify short text.
assert.match(service, /tts\?\.speakLatest\(safeVoice\)/);

const a11y = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistDialogAccessibilityService.kt',
);
assert.match(a11y, /AssistNotifyCopy\.fromGuidance/);
assert.match(a11y, /showGuidance\(this,\s*"よりそいAI",\s*safeNotify\)/);
assert.match(a11y, /speakLatest\(safeVoice\)/);

const redactor = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistSecretRedactor.kt',
);
assert.match(redactor, /forPublicText/);
assert.match(redactor, /forVoice/);
assert.match(redactor, /phone|電話/);
assert.match(redactor, /email|メール/);
assert.match(redactor, /password|パスワード/i);
assert.match(redactor, /otp|認証コード/i);
assert.match(redactor, /card|番号/i);

const explainer = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistPopupExplainer.kt',
);
assert.match(explainer, /forPublicText/);
assert.match(explainer, /notifyText = notifyForPopup/);
assert.match(explainer, /カメラ許可？/);
assert.match(explainer, /画面を確認/);

const uninstallKt = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistUninstallGuidance.kt',
);
assert.match(uninstallKt, /notifyText = "ホームへ"/);
assert.match(uninstallKt, /notifyText = "長押し"/);
assert.match(uninstallKt, /notifyText = "「削除」をタップ"/);

const safetyKt = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistSafetyInspector.kt',
);
assert.match(safetyKt, /notifyText = "メールを開く"/);
assert.match(safetyKt, /notifyText = "番号を出す"/);
assert.match(safetyKt, /notifyText = "番号を確認"/);
assert.match(safetyKt, /notifyText = "詐欺の恐れ"/);

const assistUrl = pathToFileURL(
  path.join(root, 'src/services/androidAssist/index.ts'),
).href;
const {
  containsSensitive,
  redactSecretsForPublicText,
  redactSecretsForVoice,
  explainScreenText,
} = await import(assistUrl);

assert.equal(containsSensitive('パスワード: secret99'), true);
assert.equal(containsSensitive('user@example.com'), true);
assert.equal(containsSensitive('090-1234-5678'), true);
assert.equal(containsSensitive('認証コード 123456'), true);

const masked = redactSecretsForPublicText(
  'パスワード: secret99 メール user@example.com 電話 090-1234-5678 カード 4111111111111111',
);
assert.doesNotMatch(masked, /secret99/);
assert.doesNotMatch(masked, /user@example\.com/);
assert.doesNotMatch(masked, /090-1234-5678/);
assert.doesNotMatch(masked, /4111111111111111/);
assert.match(masked, /伏せます/);

assert.equal(
  redactSecretsForVoice('パスワード: abc'),
  redactSecretsForPublicText('パスワード: abc'),
);

const sensitiveExplain = explainScreenText('パスワード: hunter2 を入力');
assert.equal(sensitiveExplain.stageId, 'explain-sensitive');
assert.doesNotMatch(sensitiveExplain.displayText, /hunter2/);
assert.doesNotMatch(sensitiveExplain.voiceText, /hunter2/);

const notifyUrl = pathToFileURL(
  path.join(root, 'src/services/notifications/minimalNotifyInstruction.ts'),
).href;
const {
  MAX_INSTRUCTION_NOTIFY_CHARS,
  truncateInstructionNotifyText,
  resolveMinimalNotifyInstruction,
  MINIMAL_NOTIFY_SAMPLES,
  tapNotify,
  scrollNotify,
} = await import(notifyUrl);

assert.equal(MAX_INSTRUCTION_NOTIFY_CHARS, 17);
assert.equal(truncateInstructionNotifyText('短い案内'), '短い案内');
assert.equal(truncateInstructionNotifyText('あ'.repeat(17)), 'あ'.repeat(17));
// Safety-net truncate still ≤17 (legacy), but presentInstruction uses resolve.
const longOps =
  '「設定」を探して押してください。画面の文字が変わったら次へ進みます。';
assert.ok(truncateInstructionNotifyText(longOps).length <= 17);

const samples = Object.values(MINIMAL_NOTIFY_SAMPLES);
for (const sample of samples) {
  assert.ok(
    sample.length <= 17,
    `sample too long: ${sample} (${sample.length})`,
  );
}
assert.equal(MINIMAL_NOTIFY_SAMPLES.goHome, 'ホームへ');
assert.equal(MINIMAL_NOTIFY_SAMPLES.longPress, '長押し');
assert.equal(MINIMAL_NOTIFY_SAMPLES.tapDelete, '「削除」をタップ');
assert.equal(MINIMAL_NOTIFY_SAMPLES.confirm, '「削除」をタップ');
assert.equal(MINIMAL_NOTIFY_SAMPLES.scamRisk, '詐欺の恐れ');
assert.equal(MINIMAL_NOTIFY_SAMPLES.cameraPerm, 'カメラ許可？');

// Ops / safety / text-explain: resolve to usable short action essentials (not gibberish cut).
assert.equal(
  resolveMinimalNotifyInstruction(
    'ホーム画面から、消したいアプリのある画面まで行ってください。',
  ),
  'ホームへ',
);
assert.equal(
  resolveMinimalNotifyInstruction(
    '消したいアプリを長押しして、メニューが出るまで待ってください。',
  ),
  '長押し',
);
assert.equal(
  resolveMinimalNotifyInstruction(
    'メニューから「削除」を選ぶと、アプリをスマートフォンから取り除けます。',
  ),
  '「削除」をタップ',
);
assert.equal(
  resolveMinimalNotifyInstruction(
    '画面の下あたりの「通知」を押してください。',
  ),
  '「通知」をタップ',
);
assert.equal(
  resolveMinimalNotifyInstruction(
    '画面を下へゆっくりスワイプして、「Wi-Fi」を探してください。',
  ),
  '「Wi-Fi」を探す',
);
assert.equal(
  resolveMinimalNotifyInstruction(
    '電話アプリで番号を出してください。見つかったら通知でお伝えします。',
  ),
  '番号を出す',
);
assert.equal(
  resolveMinimalNotifyInstruction(
    '番号「090-1234-5678」は携帯電話の形です。公開情報では判断できません',
  ),
  '番号を確認',
);
assert.equal(
  resolveMinimalNotifyInstruction('詐欺の可能性が高いメールです'),
  '詐欺の恐れ',
);
assert.equal(
  resolveMinimalNotifyInstruction(
    'カメラを使ってよいか聞いている画面です。 ボタンは「許可する」「許可しない」などです。知らないアプリなら急がなくて大丈夫です。',
  ),
  'カメラ許可？',
);
assert.equal(
  resolveMinimalNotifyInstruction(
    '画面には「カメラへのアクセスを許可しますか？」とあります。',
  ),
  '画面を確認',
);
assert.equal(
  resolveMinimalNotifyInstruction('秘密の文字があるので詳しく読み上げません。'),
  '秘密あり',
);
assert.equal(
  resolveMinimalNotifyInstruction('x', {
    notifyText: 'ホームへ',
    stageId: 'uninstall-go-home',
  }),
  'ホームへ',
);
assert.equal(tapNotify('削除'), '「削除」をタップ');
assert.equal(scrollNotify('通知'), '「通知」を探す');
assert.ok(tapNotify('ネットワークとインターネット').length <= 17);
assert.match(tapNotify('ネットワークとインターネット'), /をタップ$/);

for (const body of [
  resolveMinimalNotifyInstruction(longOps),
  resolveMinimalNotifyInstruction(
    'この番号は緊急・公的な短い番号の形に見えます。断定はしません。',
  ),
  resolveMinimalNotifyInstruction(
    '画面には「カメラへのアクセスを許可しますか？」と出ています。許可するか選んでください。',
  ),
  ...samples,
]) {
  assert.ok(body.length <= 17, `notify body >17: ${body}`);
  assert.doesNotMatch(body, /…$/, `ellipsis gibberish: ${body}`);
}

const notifyIndex = read('src/services/notifications/index.ts');
assert.match(notifyIndex, /resolveMinimalNotifyInstruction\(displayText/);
assert.match(notifyIndex, /title:\s*truncateInstructionNotifyText\('よりそいAI'\)/);
assert.doesNotMatch(
  notifyIndex,
  /const text = truncateInstructionNotifyText\(displayText\)/,
);

const uninstallJs = read('src/services/androidAssist/uninstallGuidance.ts');
assert.match(uninstallJs, /notifyText: 'ホームへ'/);
assert.match(uninstallJs, /notifyText: '長押し'/);
assert.match(uninstallJs, /notifyText: '「削除」をタップ'/);
// TTS stays fuller pre-#35/#36 baseline (88d07c7) — not the short notify line.
assert.match(
  uninstallJs,
  /UNINSTALL_CONSEQUENCE_VOICE[\s\S]{0,80}写真やメモ/,
);
assert.doesNotMatch(uninstallJs, /voiceText:\s*'「削除」をタップ'/);
assert.doesNotMatch(uninstallJs, /voiceText:\s*'長押し'/);

console.log('smoke-notify-privacy: OK');
console.log(
  'minimal samples:',
  samples.slice(0, 8).join(' / '),
  '…',
);

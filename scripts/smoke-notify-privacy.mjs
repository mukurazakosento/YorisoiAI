/**
 * Notify / lock-screen privacy + secret redaction smoke (PR #19 follow-up).
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
// Instruction notify title/body must stay ≤17 Japanese chars (ellipsis when cut).
assert.match(notifier, /take\(maxChars\s*-\s*1\)\s*\+\s*"…"/);

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

const service = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistForegroundService.kt',
);
assert.match(service, /AssistSecretRedactor\.forPublicText/);
assert.match(service, /AssistSecretRedactor\.forVoice/);
assert.match(service, /DEFAULT_INTERVAL_MS = 20000/);

const explainer = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistPopupExplainer.kt',
);
assert.match(explainer, /forPublicText/);

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
  path.join(root, 'src/services/notifications/truncateInstruction.ts'),
).href;
const {
  MAX_INSTRUCTION_NOTIFY_CHARS,
  truncateInstructionNotifyText,
} = await import(notifyUrl);

assert.equal(MAX_INSTRUCTION_NOTIFY_CHARS, 17);
assert.equal(truncateInstructionNotifyText('短い案内'), '短い案内');
assert.equal(truncateInstructionNotifyText('あ'.repeat(17)), 'あ'.repeat(17));
const longOps = '「設定」を探して押してください。画面の文字が変わったら次へ進みます。';
const truncatedOps = truncateInstructionNotifyText(longOps);
assert.ok(truncatedOps.length <= 17);
assert.equal(truncatedOps, `${longOps.slice(0, 16)}…`);
const longSafety =
  'この番号は緊急・公的な短い番号の形に見えます。断定はしません。';
assert.ok(truncateInstructionNotifyText(longSafety).length <= 17);
const longExplain =
  '画面には「カメラへのアクセスを許可しますか？」と出ています。許可するか選んでください。';
assert.ok(truncateInstructionNotifyText(longExplain).length <= 17);

const notifyIndex = read('src/services/notifications/index.ts');
assert.match(notifyIndex, /truncateInstructionNotifyText\(displayText\)/);
assert.match(notifyIndex, /title:\s*truncateInstructionNotifyText\('よりそいAI'\)/);

console.log('smoke-notify-privacy: OK');

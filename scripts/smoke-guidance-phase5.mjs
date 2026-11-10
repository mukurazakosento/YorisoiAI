/**
 * Phase 5 操作支援スモーク — デモ案内の1ステップ進行と Zod を検証。
 * 使い方: npm run smoke:guidance
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

// --- Source guardrails ---
const screen = read('src/screens/ConsultationScreen.tsx');
assert.match(screen, /GuidanceStepPanel/);
assert.match(screen, /できました|onDone/);
assert.match(screen, /分かりません|onSimplify/);
assert.match(screen, /assembleConsultationSendText/);
assert.match(screen, /guidanceAction/);
assert.doesNotMatch(screen, /layoutHints/);
assert.doesNotMatch(screen, /imageBase64|screenshotBytes/);

const panel = read('src/components/GuidanceStepPanel.tsx');
assert.match(panel, /displayText/);
assert.match(panel, /currentStep/);
assert.match(panel, /できました/);
assert.match(panel, /SpeechControls/);
assert.match(panel, /分かりません/);

const aiIndex = read('src/services/ai/index.ts');
assert.match(aiIndex, /guidanceAction/);
assert.match(aiIndex, /resolveConnectionFromMode/);
assert.doesNotMatch(aiIndex, /base64|imageUri|screenshot/i);

const consultFn = read('functions/src/ai/consult.ts');
assert.match(consultFn, /hasGeminiApiKey/);
assert.match(consultFn, /responseWhenGeminiKeyMissing\(\)/);
assert.doesNotMatch(
  consultFn,
  /AIの鍵がサーバーに設定されていません[\s\S]*mode:\s*'live'/,
);

const geminiKeySrc = read('functions/src/ai/geminiKey.ts');
assert.match(geminiKeySrc, /mode:\s*'offline'/);
assert.match(
  geminiKeySrc,
  /AI未接続です。基本の選択肢をご利用ください/,
);
assert.doesNotMatch(geminiKeySrc, /mode:\s*'live'/);

const prompts = read('functions/src/ai/prompts.ts');
assert.match(prompts, /guiding/);
assert.match(prompts, /guidanceAction/);
assert.match(prompts, /一度に複数の操作を説明しない|一度に一つの操作/);

const shared = read('functions/src/shared/aiResponse.ts');
assert.match(shared, /GuidanceActionSchema/);
assert.match(shared, /start.*done.*simplify/s);

const speech = read('src/services/speech/index.ts');
assert.match(speech, /expo-speech/);
assert.match(speech, /Speech\.speak/);

// --- Import real demo / schema modules ---
const demoUrl = pathToFileURL(
  path.join(root, 'src/services/ai/demoFallback.ts'),
).href;
const guidanceUrl = pathToFileURL(
  path.join(root, 'src/services/ai/guidanceDemo.ts'),
).href;
const schemaUrl = pathToFileURL(
  path.join(root, 'src/services/ai/schema.ts'),
).href;
const consultationTextUrl = pathToFileURL(
  path.join(root, 'src/services/ocr/consultationText.ts'),
).href;

const { buildDemoConsultationResponse } = await import(demoUrl);
const { formatGuidanceHistoryText } = await import(guidanceUrl);
const { validateAiResponse, normalizeGuidanceFields } = await import(schemaUrl);
const { assembleConsultationSendText, consultationPayloadLooksSafe } =
  await import(consultationTextUrl);

// 1) LINE 曖昧 → 絞り込み（案内はまだ）
const clarify = buildDemoConsultationResponse({
  featureId: 'operationSupport',
  text: 'LINEがおかしい',
});
assert.equal(clarify.status, 'need_more_info');
assert.ok(clarify.choices?.includes('通知が届かない'));

// 2) 具体化 → guiding で1手だけ
const step1 = buildDemoConsultationResponse({
  featureId: 'operationSupport',
  text: '',
  choiceLabel: '通知が届かない',
  history: [
    { role: 'user', text: 'LINEがおかしい' },
    { role: 'assistant', text: 'LINEの困りごとを選んでください。' },
  ],
});
assert.equal(step1.status, 'guiding');
assert.equal(step1.mode, 'demo');
assert.equal(step1.currentStep, 1);
assert.ok((step1.totalSteps ?? 0) >= 2);
assert.ok(step1.displayText && step1.displayText.length > 0);
assert.ok(step1.voiceText && step1.voiceText.length >= step1.displayText.length);
assert.ok(!step1.displayText.includes('次に'));
assert.match(step1.message ?? '', /デモ|AI未接続/);

const historyAfter1 = [
  { role: 'user', text: '通知が届かない' },
  { role: 'assistant', text: formatGuidanceHistoryText(step1) },
];
assert.match(historyAfter1[1].text, /\[step:1\//);

// 3) できました → 次の一手（複数手順を同時に出さない）
const step2 = buildDemoConsultationResponse({
  featureId: 'operationSupport',
  text: '',
  choiceLabel: 'できました',
  history: historyAfter1,
  guidanceAction: 'done',
});
assert.equal(step2.status, 'guiding');
assert.equal(step2.currentStep, 2);
assert.notEqual(step2.displayText, step1.displayText);

// 4) 分かりません → 同じ step、やさしい言い方
const historyAfter2 = [
  ...historyAfter1,
  { role: 'user', text: 'できました' },
  { role: 'assistant', text: formatGuidanceHistoryText(step2) },
];
const simplified = buildDemoConsultationResponse({
  featureId: 'operationSupport',
  text: '',
  choiceLabel: '分かりません',
  history: historyAfter2,
  guidanceAction: 'simplify',
});
assert.equal(simplified.status, 'guiding');
assert.equal(simplified.currentStep, 2);
assert.ok(simplified.displayText);
assert.match(simplified.message ?? '', /やさしく|デモ/);

// 5) 最後まで done → 完了（guiding ではない）
let hist = historyAfter2;
let last = step2;
while (last.status === 'guiding') {
  hist = [
    ...hist,
    { role: 'user', text: 'できました' },
    { role: 'assistant', text: formatGuidanceHistoryText(last) },
  ];
  last = buildDemoConsultationResponse({
    featureId: 'operationSupport',
    text: '',
    choiceLabel: 'できました',
    history: hist,
    guidanceAction: 'done',
  });
  if (last.status !== 'guiding') {
    break;
  }
  // 無限ループ防止 / 手順の整合
  assert.ok((last.currentStep ?? 0) >= 1);
  assert.ok((last.currentStep ?? 0) <= (last.totalSteps ?? 0));
  assert.ok((last.currentStep ?? 0) <= 20);
}
assert.equal(last.status, 'ready_to_help');
assert.match(last.displayText ?? '', /終わり|おつかれ/);

// 6) Wi-Fi 初期選択肢 → 自動で案内開始
const wifi = buildDemoConsultationResponse({
  featureId: 'operationSupport',
  text: '',
  choiceLabel: 'Wi-Fiにつなぎたい',
});
assert.equal(wifi.status, 'guiding');
assert.equal(wifi.currentStep, 1);

// 7) Zod / normalize
const validated = validateAiResponse({
  status: 'guiding',
  displayText: '設定を開いてください。',
  // voiceText / steps 欠落でも落とさない
});
assert.equal(validated.status, 'guiding');
assert.equal(validated.currentStep, 1);
assert.equal(validated.totalSteps, 1);
assert.ok(validated.voiceText);

const normalized = normalizeGuidanceFields({
  status: 'guiding',
  currentStep: 0,
  totalSteps: -1,
  message: 'fallback',
});
assert.equal(normalized.currentStep, 1);
assert.equal(normalized.totalSteps, 1);
assert.equal(normalized.displayText, 'fallback');

const bad = validateAiResponse({ status: 'not-real' });
assert.equal(bad.status, 'error');

// 8) 確認済み OCR テキストのみが文脈になりうる（画像痕跡なし）
const ocrContext = assembleConsultationSendText('通知\n許可');
assert.equal(ocrContext, '通知\n許可');
assert.equal(consultationPayloadLooksSafe(ocrContext), true);
assert.equal(
  consultationPayloadLooksSafe('data:image/png;base64,AAAA'),
  false,
);

// 9) Gemini 鍵あり / なし・Firebase ありでも Gemini なしは offline
const geminiKeyUrl = pathToFileURL(
  path.join(root, 'functions/src/ai/geminiKey.ts'),
).href;
const connectionUrl = pathToFileURL(
  path.join(root, 'src/services/ai/connection.ts'),
).href;
const {
  hasGeminiApiKey,
  responseWhenGeminiKeyMissing,
  OFFLINE_NO_GEMINI_MESSAGE,
} = await import(geminiKeyUrl);
const { resolveConnectionFromMode, isAiActuallyConnected } =
  await import(connectionUrl);

assert.equal(hasGeminiApiKey('AIzaSy-demo-key'), true, 'Gemini key set');
assert.equal(hasGeminiApiKey(''), false, 'Gemini key unset (empty)');
assert.equal(hasGeminiApiKey('   '), false, 'Gemini key unset (whitespace)');
assert.equal(hasGeminiApiKey(undefined), false, 'Gemini key unset (undefined)');
assert.equal(hasGeminiApiKey(null), false, 'Gemini key unset (null)');

const missingKey = responseWhenGeminiKeyMissing();
assert.equal(missingKey.mode, 'offline');
assert.equal(missingKey.status, 'error');
assert.equal(missingKey.message, OFFLINE_NO_GEMINI_MESSAGE);
assert.equal(missingKey.message, 'AI未接続です。基本の選択肢をご利用ください');
assert.notEqual(missingKey.mode, 'live');

// Firebase 接続済み相当（callable 成功）でも mode=offline → connection offline
assert.equal(resolveConnectionFromMode('offline'), 'offline');
assert.equal(resolveConnectionFromMode('live'), 'live');
assert.equal(resolveConnectionFromMode('demo'), 'demo');
assert.equal(resolveConnectionFromMode(undefined), 'live');
assert.equal(isAiActuallyConnected('offline', 'offline'), false);
assert.equal(isAiActuallyConnected('live', 'offline'), false);
assert.equal(isAiActuallyConnected('live', 'live'), true);

// デモ案内メッセージは従来どおり明示デモ（offline 鍵欠落と混同しない）
const demoMsg = buildDemoConsultationResponse({
  featureId: 'operationSupport',
  text: 'LINEがおかしい',
});
assert.equal(demoMsg.mode, 'demo');
assert.match(demoMsg.message ?? '', /デモ|AI未接続/);
assert.equal(resolveConnectionFromMode(demoMsg.mode), 'demo');
assert.equal(isAiActuallyConnected('demo', 'demo'), false);

console.log('smoke-guidance-phase5: ok');
console.log('- LINE曖昧 → 絞り込み');
console.log('- 通知が届かない → guiding step1（display/voice 分離）');
console.log('- できました → step2 / 分かりません → 同 step 簡易化');
console.log('- 完了まで進めば ready_to_help');
console.log('- Zod normalize + OCR 文脈ガード');
console.log('- Gemini key set/unset + Firebase+Gemini欠落は offline');
console.log('- Offline / demo messaging（live 誤表示なし）');

/**
 * Phase 6 文章解説・安全性検査スモーク。
 * 使い方: npm run smoke:safety
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
assert.match(screen, /ExplanationResultPanel/);
assert.match(screen, /SafetyResultPanel/);
assert.match(screen, /SafetyPhoneConsentPanel/);
assert.match(screen, /searchConsent:\s*true/);
assert.match(screen, /buildPhoneSearchPayload/);
assert.match(screen, /assembleConsultationSendText/);
assert.doesNotMatch(screen, /layoutHints/);
assert.doesNotMatch(screen, /imageBase64|screenshotBytes|GEMINI_API_KEY|WEBRISK/);

const explanationPanel = read('src/components/ExplanationResultPanel.tsx');
assert.match(explanationPanel, /表示された文章/);
assert.match(explanationPanel, /簡単に言うと/);
assert.match(explanationPanel, /操作すると何が起こるか/);
assert.match(explanationPanel, /注意すること/);
assert.match(explanationPanel, /判断するためのポイント/);

const safetyPanel = read('src/components/SafetyResultPanel.tsx');
assert.match(safetyPanel, /riskLevelLabel/);
assert.match(safetyPanel, /sources/);
assert.match(safetyPanel, /安全の証拠にはしません/);
assert.doesNotMatch(safetyPanel, /これは安全です|絶対に問題ありません/);

const schemaSrc = read('src/services/ai/schema.ts');
assert.match(schemaSrc, /危険な特徴が見つかりました/);
assert.match(schemaSrc, /注意が必要です/);
assert.match(schemaSrc, /公開情報では判断できません/);

const phoneConsent = read('src/components/SafetyPhoneConsentPanel.tsx');
assert.match(phoneConsent, /同意して、この番号を公開情報で調べる/);
assert.match(phoneConsent, /番号だけ/);

const securityIndex = read('src/services/security/index.ts');
assert.match(securityIndex, /extractPhoneCandidates/);
assert.match(securityIndex, /Cloud Functions/);

const consultFn = read('functions/src/ai/consult.ts');
assert.match(consultFn, /googleSearch/);
assert.match(consultFn, /runPhoneGroundingLookup|buildPhoneGroundingPrompt/);
assert.match(consultFn, /checkUrlsWithWebRisk|attachWebRiskIfNeeded/);
assert.match(consultFn, /hasGeminiApiKey/);
assert.match(consultFn, /responseWhenGeminiKeyMissing/);
assert.doesNotMatch(consultFn, /mode:\s*'live'[\s\S]{0,40}GEMINI_API_KEY secret is empty/);

const grounding = read('functions/src/security/grounding.ts');
assert.match(grounding, /extractGroundingSources/);
assert.match(grounding, /groundingChunks/);
assert.match(grounding, /insufficient_info/);

const webRisk = read('functions/src/security/webRisk.ts');
assert.match(webRisk, /not_configured/);
assert.match(webRisk, /webrisk\.googleapis\.com/);
assert.match(webRisk, /電話番号検査には使わない|URL のみ/);

const prompts = read('functions/src/ai/prompts.ts');
assert.match(prompts, /explanation/);
assert.match(prompts, /judgmentPoints/);
assert.match(prompts, /安全です/);
assert.match(prompts, /phone_search/);

const shared = read('functions/src/shared/aiResponse.ts');
assert.match(shared, /SafetyActionSchema/);
assert.match(shared, /AiExplanationSchema/);
assert.match(shared, /searchConsent/);

// --- Import real modules ---
const explanationUrl = pathToFileURL(
  path.join(root, 'src/services/ai/explanationDemo.ts'),
).href;
const safetyUrl = pathToFileURL(
  path.join(root, 'src/services/ai/safetyDemo.ts'),
).href;
const demoUrl = pathToFileURL(
  path.join(root, 'src/services/ai/demoFallback.ts'),
).href;
const schemaUrl = pathToFileURL(
  path.join(root, 'src/services/ai/schema.ts'),
).href;
const phoneUrl = pathToFileURL(
  path.join(root, 'src/services/security/phone.ts'),
).href;
const urlsUrl = pathToFileURL(
  path.join(root, 'src/services/security/urls.ts'),
).href;
const consultationTextUrl = pathToFileURL(
  path.join(root, 'src/services/ocr/consultationText.ts'),
).href;
const connectionUrl = pathToFileURL(
  path.join(root, 'src/services/ai/connection.ts'),
).href;
const groundingUrl = pathToFileURL(
  path.join(root, 'functions/src/security/grounding.ts'),
).href;
const webRiskUrl = pathToFileURL(
  path.join(root, 'functions/src/security/webRisk.ts'),
).href;
const geminiKeyUrl = pathToFileURL(
  path.join(root, 'functions/src/ai/geminiKey.ts'),
).href;

const { buildDemoExplanationResponse } = await import(explanationUrl);
const { buildDemoSafetyResponse } = await import(safetyUrl);
const { buildDemoConsultationResponse } = await import(demoUrl);
const {
  validateAiResponse,
  normalizeExplanationFields,
  normalizeSafetyFields,
  riskLevelLabel,
} = await import(schemaUrl);
const { extractPhoneCandidates, buildPhoneSearchPayload } =
  await import(phoneUrl);
const { extractUrls } = await import(urlsUrl);
const { assembleConsultationSendText, consultationPayloadLooksSafe } =
  await import(consultationTextUrl);
const { resolveConnectionFromMode } = await import(connectionUrl);
const { extractGroundingSources, applyGroundingSourcesToSafetyResult } =
  await import(groundingUrl);
const { checkUrlsWithWebRisk, hasWebRiskApiKey } = await import(webRiskUrl);
const { responseWhenGeminiKeyMissing, hasGeminiApiKey } =
  await import(geminiKeyUrl);

// 1) 写真アクセス許可の解説（5区画）
const photo = buildDemoExplanationResponse({
  text: '写真へのアクセスを許可しますか？',
});
assert.equal(photo.status, 'explained');
assert.equal(photo.mode, 'demo');
assert.ok(photo.explanation);
assert.match(photo.explanation.plainMeaning, /写真/);
assert.match(photo.explanation.whatHappens, /許可/);
assert.match(photo.explanation.cautions, /./);
assert.match(photo.explanation.judgmentPoints, /./);
assert.ok(!/許可してください|拒否してください/.test(JSON.stringify(photo)));

// 2) 文脈不足の許可確認 → 追加質問（勧めない）
const vaguePermit = buildDemoExplanationResponse({
  choiceLabel: '許可しますか？と出た',
  text: '',
});
assert.equal(vaguePermit.status, 'need_more_info');

const genericPermit = buildDemoExplanationResponse({
  text: 'アクセスを許可しますか？',
});
assert.ok(
  genericPermit.status === 'need_more_info' ||
    (genericPermit.status === 'explained' && genericPermit.question),
);

// 3) お金・アカウントは慎重
const money = buildDemoExplanationResponse({
  text: 'アカウントを削除しますか？パスワードを入力',
});
assert.equal(money.status, 'need_more_info');
assert.match(money.message ?? '', /勧めません|慎重/);

// 4) 専門用語
const wifi = buildDemoExplanationResponse({ text: 'Wi-Fi の意味は？' });
assert.equal(wifi.status, 'explained');
assert.equal(wifi.explanation?.displayedText, 'Wi-Fi');

// 5) 電話番号抽出
const phones = extractPhoneCandidates('着信 090-1234-5678 太郎');
assert.equal(phones.length, 1);
assert.equal(buildPhoneSearchPayload(phones[0].display), '09012345678');
assert.ok(!buildPhoneSearchPayload(phones[0].display).includes('太郎'));

// 6) 電話調査は同意必須（デモ）
const phoneNeedConsent = buildDemoSafetyResponse({
  choiceLabel: '知らない電話番号',
  text: '090-1111-2222',
});
assert.equal(phoneNeedConsent.status, 'need_more_info');
assert.match(phoneNeedConsent.message ?? '', /同意/);

const phoneDemo = buildDemoSafetyResponse({
  text: '09011112222',
  safetyAction: 'phone_search',
  searchConsent: true,
});
assert.equal(phoneDemo.status, 'safety_result');
assert.equal(phoneDemo.riskLevel, 'insufficient_info');
assert.equal(phoneDemo.mode, 'demo');
assert.deepEqual(phoneDemo.sources, []);
assert.doesNotMatch(phoneDemo.message ?? '', /安全です/);
assert.equal(riskLevelLabel(phoneDemo.riskLevel), '公開情報では判断できません');

// 7) 詐欺 SMS デモ
const scam = buildDemoSafetyResponse({
  text: '至急！未払い料金があります。http://bit.ly/evil で認証コードを入力',
  safetyAction: 'message_analyze',
});
assert.equal(scam.status, 'safety_result');
assert.equal(scam.riskLevel, 'dangerous');
assert.ok((scam.urlChecks?.length ?? 0) >= 1);
assert.equal(scam.urlChecks[0].status, 'not_configured');
assert.doesNotMatch(scam.message ?? '', /(?<!と[はも]言いません。*)安全です(?!」とは言いません)/);
assert.doesNotMatch(scam.displayText ?? '', /^安全/);
assert.match(scam.message ?? '', /とは言いません/);

// 8) URL 抽出
assert.deepEqual(extractUrls('見て https://example.com/a です'), [
  'https://example.com/a',
]);

// 9) Grounding 出典は metadata のみ（捏造しない）
assert.deepEqual(
  extractGroundingSources({
    candidates: [
      {
        groundingMetadata: {
          groundingChunks: [
            { web: { title: '公式', uri: 'https://example.gov/info' } },
            { web: { title: '偽', uri: 'not-a-url' } },
          ],
        },
      },
    ],
  }),
  [{ title: '公式', url: 'https://example.gov/info' }],
);

const noInfo = applyGroundingSourcesToSafetyResult(
  {
    status: 'safety_result',
    riskLevel: 'dangerous',
    message: '危険かも',
    sources: [{ title: '捏造', url: 'https://fake.example/made-up' }],
  },
  [],
);
assert.equal(noInfo.riskLevel, 'insufficient_info');
assert.deepEqual(noInfo.sources, []);
assert.match(noInfo.message ?? '', /安全の証拠にはしません|見つかりません/);

// 10) Web Risk 未設定は正直
assert.equal(hasWebRiskApiKey(''), false);
const wr = await checkUrlsWithWebRisk(['https://example.com'], '');
assert.equal(wr[0].status, 'not_configured');

// 11) Gemini 未設定 → offline
assert.equal(hasGeminiApiKey('  '), false);
const offline = responseWhenGeminiKeyMissing();
assert.equal(offline.mode, 'offline');
assert.equal(resolveConnectionFromMode(offline.mode), 'offline');

// 12) Zod / normalize
const explained = normalizeExplanationFields({
  status: 'explained',
  message: '説明',
});
assert.ok(explained.explanation?.plainMeaning);

const safetyNorm = normalizeSafetyFields({
  status: 'safety_result',
  message: 'これは安全です。絶対に問題ありません',
  sources: [
    { title: 'ok', url: 'https://example.com' },
    { title: 'bad', url: 'javascript:alert(1)' },
  ],
});
assert.equal(safetyNorm.riskLevel, 'insufficient_info');
assert.equal(safetyNorm.sources?.length, 1);
assert.doesNotMatch(safetyNorm.message ?? '', /安全です/);

const validated = validateAiResponse({
  status: 'safety_result',
  riskLevel: 'caution',
  displayText: '注意が必要です',
  sources: [],
});
assert.equal(validated.status, 'safety_result');

// 13) デモ統合入口
const viaDemo = buildDemoConsultationResponse({
  featureId: 'textExplanation',
  text: '通知を許可しますか？',
});
assert.ok(
  viaDemo.status === 'explained' || viaDemo.status === 'need_more_info',
);

const viaSafety = buildDemoConsultationResponse({
  featureId: 'safetyCheck',
  text: 'このSMSは大丈夫？ 今すぐ振込してください',
  choiceLabel: 'このSMSは大丈夫？',
});
assert.equal(viaSafety.status, 'safety_result');
assert.ok(
  viaSafety.riskLevel === 'dangerous' || viaSafety.riskLevel === 'caution',
);

// 14) OCR 送信パスは確認済みテキストのみ
const sendText = assembleConsultationSendText('許可しますか？');
assert.equal(sendText, '許可しますか？');
assert.equal(consultationPayloadLooksSafe(sendText), true);

console.log('smoke-safety-phase6: OK');

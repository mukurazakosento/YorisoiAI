/**
 * On-device operation planner smoke (heuristics + mock live engine).
 * 使い方: npm run smoke:operation-planner
 *
 * Does NOT download Gemma / run MediaPipe in this VM.
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

// --- Source contracts ---
const nativeScaffold = read('src/services/onDeviceAi/nativeScaffold.ts');
assert.match(nativeScaffold, /mediapipe|MediaPipe|yorisoi-on-device-llm/i);
assert.match(nativeScaffold, /probe|プローブ/);
assert.doesNotMatch(nativeScaffold, /偽の推論結果は返さない:\s*現状は常に null/);

// R8 Missing-class fix: pin javalite, bump tasks-genai past 0.10.27 gencode, no dontwarn hack
const onDeviceLlmGradle = read(
  'modules/yorisoi-on-device-llm/android/build.gradle',
);
assert.match(
  onDeviceLlmGradle,
  /com\.google\.protobuf:protobuf-javalite:4\.26\.1/,
);
assert.match(
  onDeviceLlmGradle,
  /force\s+['"]com\.google\.protobuf:protobuf-javalite:4\.26\.1['"]/,
);
assert.match(
  onDeviceLlmGradle,
  /com\.google\.mediapipe:tasks-genai:0\.10\.(2[89]|3[0-9])/,
);
assert.doesNotMatch(onDeviceLlmGradle, /tasks-genai:0\.10\.27/);
// Strip // comments before checking for R8 warn-ignore hacks / full protobuf-java coords
const onDeviceLlmGradleCode = onDeviceLlmGradle
  .split('\n')
  .map((line) => line.replace(/\/\/.*$/, ''))
  .join('\n');
assert.doesNotMatch(onDeviceLlmGradleCode, /-dontwarn\b/);
assert.doesNotMatch(
  onDeviceLlmGradleCode,
  /com\.google\.protobuf:protobuf-java[^l]/,
);

const llmModule = read(
  'modules/yorisoi-on-device-llm/android/src/main/java/expo/modules/yorisoiondevicellm/OnDeviceLlmEngine.kt',
);
assert.match(llmModule, /LlmInference/);
assert.match(llmModule, /loadAndProbe/);
assert.match(llmModule, /probeOk/);
assert.doesNotMatch(llmModule, /imageBase64|screenshotBytes/);
// MediaPipe GenAI API: generateResponse(inputText), not generate(...)
assert.match(llmModule, /created\.generateResponse\(/);
assert.match(llmModule, /eng\.generateResponse\(/);
assert.doesNotMatch(llmModule, /created\.generate\(/);
assert.doesNotMatch(llmModule, /eng\.generate\(/);
// Wrapper keeps 1-arg generate(prompt) for AssistLlmBridge reflection
assert.match(llmModule, /fun generate\(prompt: String\): Result<String>/);
assert.doesNotMatch(llmModule, /fun generate\(prompt: String,\s*maxTokens/);

const downloader = read(
  'modules/yorisoi-on-device-llm/android/src/main/java/expo/modules/yorisoiondevicellm/LlmModelDownloader.kt',
);
assert.match(downloader, /Range/);
assert.match(downloader, /enoughStorage|usableSpace/);
assert.match(downloader, /cancel/);

const bridge = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistLlmBridge.kt',
);
assert.match(bridge, /OnDeviceLlmEngine/);
assert.match(bridge, /isReady/);
assert.match(bridge, /getMethod\("generate",\s*String::class\.java\)/);

const nativePlanner = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistOperationPlanner.kt',
);
assert.match(nativePlanner, /AssistLlmBridge/);
assert.match(nativePlanner, /antiLoop|anti-loop/);
assert.match(nativePlanner, /画面を判断できませんでした/);
assert.match(nativePlanner, /requiresUserConfirm|SENSITIVE/);
assert.match(nativePlanner, /AssistConcreteGuidance|scrollTexts|直したい設定/);

const concreteKt = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistConcreteGuidance.kt',
);
assert.match(concreteKt, /isVague/);
assert.match(concreteKt, /scrollTexts/);
assert.match(concreteKt, /tapTexts/);
assert.doesNotMatch(
  read(
    'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistGuidanceRules.kt',
  ),
  /直したい項目を一つ開いてください/,
);

const fgs = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistForegroundService.kt',
);
assert.match(fgs, /AssistOperationPlanner/);
assert.match(fgs, /operationSupport/);

const rules = read(
  'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistGuidanceRules.kt',
);
assert.match(rules, /looksLikeEmailGoal|emailStep/);
assert.match(rules, /looksLikeBrowserGoal|browserStep/);
assert.match(rules, /looksLikeShoppingGoal|shoppingStep/);
assert.match(rules, /looksLikePhotoPickerGoal|photoPickerStep/);
assert.match(rules, /looksLikeInstallGoal|installStep/);

// Avoid a11y/popup conflict files being rewritten for this feature
assert.ok(
  fs.existsSync(
    path.join(
      root,
      'modules/yorisoi-android-assist/android/src/main/java/expo/modules/yorisoiandroidassist/AssistDialogAccessibilityService.kt',
    ),
  ),
);

const pkg = JSON.parse(read('package.json'));
assert.ok(pkg.dependencies['yorisoi-on-device-llm']);
assert.match(pkg.scripts['smoke:operation-planner'], /smoke-operation-planner/);

// --- Runtime: PII / parse / planner ---
const {
  maskSensitiveText,
  parseAndGroundOperationPlan,
  unsurePlan,
  buildScreenContext,
  planOperationSupport,
  resetPlanHistory,
  resetOnDeviceAiForTests,
  setOnDeviceEngineForTests,
  isOnDeviceAiReady,
} = await import(
  pathToFileURL(path.join(root, 'src/services/onDeviceAi/index.ts')).href
);

const {
  buildGuidanceFromOcrText,
} = await import(
  pathToFileURL(path.join(root, 'src/services/androidAssist/index.ts')).href
);

resetOnDeviceAiForTests();
resetPlanHistory();
assert.equal(isOnDeviceAiReady(), false);

// LINE photo
const line = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'LINEで孫に写真を送りたい',
  ocrText: 'アルバム 最近の項目',
});
assert.equal(line.stepId, 'line-pick-photo');
assert.equal(line.mode, 'demo');

// Wi-Fi ≠ LINE
const wifi = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'Wi-Fiにつなぎたい',
  ocrText: 'ネットワーク一覧 Wi-Fi',
});
assert.match(wifi.stepId, /wifi/);
assert.doesNotMatch(wifi.stepId, /line/);

// Notification settings — concrete label, not 「直したい項目」
const notify = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: '通知設定を変えたい',
  ocrText: '設定 通知 オン オフ',
});
assert.match(notify.stepId, /settings-notify/);
assert.match(notify.displayText, /通知|オン|オフ/);
assert.doesNotMatch(notify.displayText, /直したい項目|適切な項目/);
assert.match(notify.displayText, /上|下|左|右|中央|押して/);

const {
  isVagueGuidanceText,
  rejectOrRewriteVagueGuidance,
  formatScrollInstruction,
} = await import(
  pathToFileURL(path.join(root, 'src/services/androidAssist/concreteGuidance.ts')).href
);
assert.equal(isVagueGuidanceText('直したい項目を一つ開いてください。'), true);
assert.equal(isVagueGuidanceText('画面の下あたりの「通知」を押してください。'), false);
const rewritten = rejectOrRewriteVagueGuidance({
  displayText: '直したい設定を開いてください。',
  voiceText: '設定で直したい項目を選んでください。',
  ocrText: '通知 アプリ 電池',
  goalSummary: '通知',
});
assert.equal(rewritten.rewritten, true);
assert.doesNotMatch(rewritten.displayText, /直したい/);
assert.match(rewritten.displayText, /「通知」|スワイプ/);
const scroll = formatScrollInstruction('Wi-Fi', '下へ');
assert.match(scroll.displayText, /下へ/);
assert.match(scroll.displayText, /Wi-Fi/);

// Email / browser / shopping / picker / install
assert.match(
  buildGuidanceFromOcrText({
    featureId: 'operationSupport',
    goalSummary: 'メールを送りたい',
    ocrText: '送信 キャンセル',
  }).stepId,
  /email/,
);
assert.match(
  buildGuidanceFromOcrText({
    featureId: 'operationSupport',
    goalSummary: 'ブラウザで調べたい',
    ocrText: '検索 Google',
  }).stepId,
  /browser/,
);
assert.match(
  buildGuidanceFromOcrText({
    featureId: 'operationSupport',
    goalSummary: '買い物で購入したい',
    ocrText: '購入 支払い',
  }).stepId,
  /shop/,
);
assert.match(
  buildGuidanceFromOcrText({
    featureId: 'operationSupport',
    goalSummary: '写真を選びたい',
    ocrText: 'アルバム 最近の項目',
  }).stepId,
  /picker/,
);
assert.match(
  buildGuidanceFromOcrText({
    featureId: 'operationSupport',
    goalSummary: 'アプリをインストールしたい',
    ocrText: 'インストール 入手',
  }).stepId,
  /install/,
);

// Unknown app / vague → clarify or ocr-grounded
const unknown = buildGuidanceFromOcrText({
  featureId: 'operationSupport',
  goalSummary: 'よく分からない',
  ocrText: 'なにか変な画面 XYZ',
});
assert.ok(
  unknown.stepId === 'ask-clarify' || unknown.stepId.startsWith('ocr-'),
);

// Partial OCR
const partial = await planOperationSupport({
  goalSummary: 'LINEで写真',
  ocrText: '',
  a11yText: '',
  featureId: 'operationSupport',
});
assert.equal(partial.mode, 'demo');
assert.ok(partial.plan.stepId.includes('unreadable') || partial.plan.actionKind === 'ask' || partial.plan.displayText.includes('読み取れ'));

// PII mask
const masked = maskSensitiveText('パスワード: secret123 カード 4111 1111 1111 1111');
assert.doesNotMatch(masked, /secret123/);
assert.match(masked, /伏せます/);

// Hallucinated button rejected
const ctx = buildScreenContext({
  goalSummary: '設定',
  ocrText: 'Wi-Fi ネットワーク',
});
const grounded = parseAndGroundOperationPlan(
  JSON.stringify({
    screenDescription: '設定',
    stage: 'wifi',
    actionKind: 'tap',
    nextAction: '宇宙ボタンを押す',
    targetButtonText: '宇宙起動',
    confidence: 0.9,
    displayText: '宇宙起動を押す',
    voiceText: '宇宙',
    clarifyingQuestion: null,
    expectNextScreen: 'x',
    requiresUserConfirm: false,
    stepId: 'bad',
  }),
  ctx,
);
assert.ok(
  grounded.actionKind === 'scroll' ||
    grounded.stepId.includes('unsure') ||
    grounded.stepId.includes('scroll') ||
    grounded.displayText.includes('判断できません') ||
    grounded.displayText.includes('スワイプ') ||
    (grounded.clarifyingQuestion && grounded.clarifyingQuestion.includes('宇宙')),
);
assert.doesNotMatch(grounded.displayText, /宇宙起動を押す/);

// AI-off → demo
resetOnDeviceAiForTests();
const demoPlan = await planOperationSupport({
  goalSummary: 'Wi-Fiにつなぎたい',
  ocrText: 'ネットワーク一覧 Wi-Fi',
  featureId: 'operationSupport',
  ocrChanged: true,
});
assert.equal(demoPlan.mode, 'demo');
assert.equal(demoPlan.usedEngine, false);

// AI-on mock → live uses inference JSON
setOnDeviceEngineForTests({
  backend: 'native-llama',
  modelId: 'gemma-3-1b-it-int4',
  isReady: () => true,
  chatJson: async () =>
    JSON.stringify({
      screenDescription: 'Wi-Fi一覧',
      stage: 'wifi-list',
      actionKind: 'tap',
      nextAction: 'Wi-Fi名を選ぶ',
      targetButtonText: 'Wi-Fi',
      approximatePosition: { x: 0.5, y: 0.4 },
      why: 'OCRにWi-Fiあり',
      confidence: 0.82,
      displayText: '画面の「Wi-Fi」から名前を選んでください。',
      voiceText: '画面にWi-Fiとあります。一覧から名前を一つ選んでください。',
      clarifyingQuestion: null,
      expectNextScreen: 'パスワード画面',
      requiresUserConfirm: false,
      stepId: 'wifi-pick-live',
    }),
});
assert.equal(isOnDeviceAiReady(), true);
resetPlanHistory();
const livePlan = await planOperationSupport({
  goalSummary: 'Wi-Fiにつなぎたい',
  ocrText: 'ネットワーク一覧 Wi-Fi',
  featureId: 'operationSupport',
  ocrChanged: true,
});
assert.equal(livePlan.mode, 'live');
assert.equal(livePlan.usedEngine, true);
assert.equal(livePlan.plan.stepId, 'wifi-pick-live');
assert.match(livePlan.plan.displayText, /Wi-Fi/);

// Anti-loop: same step without OCR change
const again = await planOperationSupport({
  goalSummary: 'Wi-Fiにつなぎたい',
  ocrText: 'ネットワーク一覧 Wi-Fi',
  featureId: 'operationSupport',
  ocrChanged: false,
});
const third = await planOperationSupport({
  goalSummary: 'Wi-Fiにつなぎたい',
  ocrText: 'ネットワーク一覧 Wi-Fi',
  featureId: 'operationSupport',
  ocrChanged: false,
});
assert.ok(
  third.plan.stepId.includes('anti-loop') ||
    third.plan.displayText.includes('同じ案内') ||
    again.plan.stepId === 'wifi-pick-live',
);

// Sensitive confirm
const pay = parseAndGroundOperationPlan(
  JSON.stringify({
    screenDescription: '購入',
    stage: 'shop-pay',
    actionKind: 'tap',
    nextAction: '購入する',
    targetButtonText: '購入',
    confidence: 0.9,
    displayText: '購入を押してください',
    voiceText: '購入',
    requiresUserConfirm: true,
    stepId: 'pay',
    expectNextScreen: '完了',
  }),
  buildScreenContext({ goalSummary: '買い物', ocrText: '購入 支払い' }),
);
assert.equal(pay.requiresUserConfirm, true);
assert.equal(pay.actionKind, 'confirm_with_user');

// Vague LLM output rewritten; missing target → scroll
const vagueLive = parseAndGroundOperationPlan(
  JSON.stringify({
    screenDescription: '設定',
    stage: 'settings',
    actionKind: 'tap',
    nextAction: '直したい項目を開く',
    targetButtonText: null,
    confidence: 0.8,
    displayText: '直したい設定を開いてください。',
    voiceText: '適切な項目を選んでください。',
    stepId: 'vague',
    expectNextScreen: '次',
  }),
  buildScreenContext({
    goalSummary: '通知設定',
    ocrText: '通知 アプリ 電池',
  }),
);
assert.doesNotMatch(vagueLive.displayText, /直したい設定|適切な項目/);
assert.match(vagueLive.displayText, /「|スワイプ|ですか/);

const missingTarget = parseAndGroundOperationPlan(
  JSON.stringify({
    screenDescription: '設定',
    stage: 'settings',
    actionKind: 'tap',
    nextAction: '通知を開く',
    targetButtonText: '通知',
    confidence: 0.85,
    displayText: '通知を押してください',
    voiceText: '通知',
    stepId: 'miss',
    expectNextScreen: '通知画面',
  }),
  buildScreenContext({
    goalSummary: '通知',
    ocrText: 'ネットワークとインターネット アプリ 電池',
  }),
);
assert.equal(missingTarget.actionKind, 'scroll');
assert.match(missingTarget.displayText, /下へ|スワイプ/);
assert.match(missingTarget.displayText, /通知/);

resetOnDeviceAiForTests();
assert.equal(unsurePlan().displayText.includes('判断できません'), true);

console.log('smoke-operation-planner: OK');

/**
 * Final-spec Phase C スモーク — 端末内 Llama / WebLLM 経路。
 * 使い方: npm run smoke:on-device
 *
 * この VM / CI ではモデル推論を実行しない前提。
 * 「未接続ならデモ」「ready のときだけ live」を検証する。
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

// --- Source contracts ---
const onDeviceIndex = read('src/services/onDeviceAi/index.ts');
assert.match(onDeviceIndex, /classifyIntent/);
assert.match(onDeviceIndex, /generateClarifyChoices/);
assert.match(onDeviceIndex, /buildGuidanceScript/);
assert.match(onDeviceIndex, /AI_DISCONNECTED_LABEL/);
assert.doesNotMatch(onDeviceIndex, /GEMINI_API_KEY|apiKey\s*:/);

const onDeviceDemo = read('src/services/onDeviceAi/demo.ts');
assert.match(onDeviceDemo, /AI未接続/);
assert.match(onDeviceDemo, /デモ選択肢（端末内AIは未接続）/);

const onDeviceStatus = read('src/services/onDeviceAi/status.ts');
assert.match(onDeviceStatus, /AI未接続/);
assert.match(onDeviceStatus, /live 扱い?にしない/);

const webllmWeb = read('src/services/onDeviceAi/webllm.web.ts');
assert.match(webllmWeb, /@mlc-ai\/web-llm/);
assert.match(webllmWeb, /CreateMLCEngine/);
assert.match(webllmWeb, /WebGPU/);
assert.match(webllmWeb, /AI未接続/);
assert.doesNotMatch(webllmWeb, /imageBase64|screenshot/);

const webllmNativeStub = read('src/services/onDeviceAi/webllm.ts');
assert.match(webllmNativeStub, /return null/);
assert.match(webllmNativeStub, /ネイティブ/);

const nativeScaffold = read('src/services/onDeviceAi/nativeScaffold.ts');
assert.match(nativeScaffold, /llama\.cpp|ExecuTorch/);
assert.match(nativeScaffold, /return null/);
assert.match(nativeScaffold, /偽/);

const consultation = read('src/screens/ConsultationScreen.tsx');
assert.match(consultation, /classifyIntent/);
assert.match(consultation, /onDeviceAi/);
assert.match(consultation, /AI未接続/);
assert.doesNotMatch(consultation, /requestConsultation/);
assert.doesNotMatch(consultation, /\bScrollView\b/);

const aiChoice = read('src/screens/AiChoiceScreen.tsx');
assert.match(aiChoice, /generateClarifyChoices/);
assert.match(aiChoice, /clarifyChoicesBanner/);
assert.match(aiChoice, /デモ選択肢/);
assert.doesNotMatch(aiChoice, /\bScrollView\b/);

const supportSession = read('src/screens/SupportSessionScreen.tsx');
assert.match(supportSession, /buildGuidanceScript/);
assert.match(supportSession, /isOnDeviceAiReady/);
assert.match(supportSession, /デモ/);
assert.doesNotMatch(supportSession, /imageBase64|screenshotBytes/);

const config = read('src/constants/config.ts');
assert.match(config, /onDeviceAiEnabled/);
assert.match(config, /legacyCloudAiEnabled/);
assert.match(config, /EXPO_PUBLIC_ON_DEVICE_AI/);
assert.match(config, /Llama-3\.2-1B-Instruct/);

const appTsx = read('App.tsx');
assert.match(appTsx, /initOnDeviceAi/);

const agents = read('AGENTS.md');
assert.match(agents, /WebLLM/);
assert.match(agents, /smoke:on-device/);
assert.match(agents, /Phase C/);

const readme = read('README.md');
assert.match(readme, /Phase C|端末内 AI/);
assert.match(readme, /WebLLM/);
assert.match(readme, /EXPO_PUBLIC_ON_DEVICE_AI/);
assert.match(readme, /AI未接続/);

const packageJson = JSON.parse(read('package.json'));
assert.ok(packageJson.dependencies['@mlc-ai/web-llm']);
assert.match(packageJson.scripts['smoke:on-device'], /smoke-on-device-ai-phase-c/);
assert.match(packageJson.version, /^0\.1[0-9]\./);

// 画像を AI に送る経路が onDeviceAi に無いこと
for (const file of [
  'src/services/onDeviceAi/index.ts',
  'src/services/onDeviceAi/prompts.ts',
  'src/services/onDeviceAi/webllm.web.ts',
]) {
  const src = read(file);
  assert.doesNotMatch(src, /imageBase64|screenshotBytes|FormData/);
}

// --- Runtime: parse + demo path (no model download) ---
const parseUrl = pathToFileURL(
  path.join(root, 'src/services/onDeviceAi/parse.ts'),
).href;
const { parseIntentJson, parseChoicesJson, parseGuidanceJson } =
  await import(parseUrl);

const intent = parseIntentJson('{"clarity":"clear","rationale":"具体的"}');
assert.equal(intent.clarity, 'clear');

const unclear = parseIntentJson('{"clarity":"unclear"}');
assert.equal(unclear.clarity, 'unclear');

const choices = parseChoicesJson(
  '{"question":"どれですか？","choices":["A","B","C"]}',
);
assert.equal(choices.choices.length, 4);
assert.match(choices.choices[3].label, /別の言い方/);

const guidance = parseGuidanceJson(
  JSON.stringify({
    title: 'テスト案内',
    steps: [
      {
        displayText: '設定を開く',
        voiceText: '設定アプリを開いてください。',
        simplifyDisplayText: '設定',
        simplifyVoiceText: '設定を開きます。',
      },
      {
        displayText: '通知を押す',
        voiceText: '通知の項目を押してください。',
      },
    ],
  }),
  { summary: 'LINE', scriptId: 'test-script' },
);
assert.equal(guidance.isDemo, false);
assert.equal(guidance.steps.length, 2);
assert.ok(guidance.steps[1].voiceText.includes('通知'));

const demoUrl = pathToFileURL(
  path.join(root, 'src/services/onDeviceAi/demo.ts'),
).href;
const {
  demoClassifyIntent,
  demoGenerateClarifyChoices,
  demoBuildGuidanceScript,
  AI_DISCONNECTED_LABEL,
} = await import(demoUrl);

assert.equal(AI_DISCONNECTED_LABEL, 'AI未接続');

const demoIntent = demoClassifyIntent({
  featureId: 'operationSupport',
  text: 'よく分からない',
  choiceLabel: 'その他',
});
assert.equal(demoIntent.mode, 'demo');
assert.equal(demoIntent.clarity, 'unclear');

const clearIntent = demoClassifyIntent({
  featureId: 'operationSupport',
  text: '',
  choiceLabel: 'LINEの通知が来ない',
});
assert.equal(clearIntent.clarity, 'clear');
assert.equal(clearIntent.mode, 'demo');

const demoChoices = demoGenerateClarifyChoices({
  featureId: 'safetyCheck',
  text: '変な電話',
  clarifyRound: 1,
});
assert.equal(demoChoices.mode, 'demo');
assert.equal(demoChoices.choices.length, 4);

const demoScript = demoBuildGuidanceScript({
  featureId: 'safetyCheck',
  summary: '知らない番号から電話があった',
});
assert.equal(demoScript.mode, 'demo');
assert.equal(demoScript.script.isDemo, true);
const safetyBlob = demoScript.script.steps
  .map((s) => `${s.displayText} ${s.voiceText}`)
  .join(' ');
assert.match(safetyBlob, /「安全です」とは言/);

// status module uses react-native Platform — import via tsx path used by npm script
const statusUrl = pathToFileURL(
  path.join(root, 'src/services/onDeviceAi/status.ts'),
).href;
const {
  getOnDeviceAiStatus,
  isOnDeviceAiReady,
  initOnDeviceAi,
  resetOnDeviceAiForTests,
  setOnDeviceEngineForTests,
} = await import(statusUrl);

resetOnDeviceAiForTests();
assert.equal(isOnDeviceAiReady(), false);
const status = getOnDeviceAiStatus();
assert.equal(status.ready, false);
assert.match(status.message, /AI未接続/);
assert.notEqual(status.lifecycle, 'ready');

const afterInit = await initOnDeviceAi();
assert.equal(afterInit.ready, false);
assert.equal(isOnDeviceAiReady(), false);
assert.match(afterInit.message, /AI未接続|デモ/);

// Inject a fake ready engine → live path allowed; then clear
setOnDeviceEngineForTests({
  backend: 'webllm',
  modelId: 'test-model',
  isReady: () => true,
  chatJson: async () =>
    JSON.stringify({
      clarity: 'clear',
      rationale: 'test',
    }),
});
assert.equal(isOnDeviceAiReady(), true);
assert.equal(getOnDeviceAiStatus().ready, true);

const serviceUrl = pathToFileURL(
  path.join(root, 'src/services/onDeviceAi/index.ts'),
).href;
const { classifyIntent, peekOnDeviceMode, clarifyChoicesBanner } =
  await import(serviceUrl);

assert.equal(peekOnDeviceMode(), 'live');
assert.match(clarifyChoicesBanner('live'), /端末内AI/);

const liveIntent = await classifyIntent({
  featureId: 'operationSupport',
  text: 'LINEの通知',
});
assert.equal(liveIntent.mode, 'live');
assert.equal(liveIntent.clarity, 'clear');

resetOnDeviceAiForTests();
assert.equal(isOnDeviceAiReady(), false);
assert.equal(peekOnDeviceMode(), 'demo');
assert.match(clarifyChoicesBanner('demo'), /デモ選択肢/);
assert.match(clarifyChoicesBanner('offline'), /デモ選択肢/);

// Legacy cloud must not be the default gate in config
assert.equal(
  JSON.parse(read('package.json')).dependencies.firebase != null,
  true,
);
const envExample = read('.env.example');
assert.match(envExample, /EXPO_PUBLIC_ON_DEVICE_AI/);
assert.match(envExample, /EXPO_PUBLIC_LEGACY_CLOUD_AI/);

console.log('smoke-on-device-ai-phase-c: OK');

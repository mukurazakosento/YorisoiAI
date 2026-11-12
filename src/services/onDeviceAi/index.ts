import {
  AI_DEMO_CHOICES_BANNER,
  AI_DISCONNECTED_LABEL,
  AI_LIVE_CHOICES_BANNER,
  demoBuildGuidanceScript,
  demoClassifyIntent,
  demoGenerateClarifyChoices,
} from './demo';
import {
  parseChoicesJson,
  parseGuidanceJson,
  parseIntentJson,
} from './parse';
import {
  buildChoicesSystemPrompt,
  buildChoicesUserPrompt,
  buildGuidanceSystemPrompt,
  buildGuidanceUserPrompt,
  buildIntentSystemPrompt,
  buildIntentUserPrompt,
} from './prompts';
import {
  getActiveOnDeviceEngine,
  getOnDeviceAiStatus,
  initOnDeviceAi,
  isOnDeviceAiReady,
  resetOnDeviceAiForTests,
  setOnDeviceEngineForTests,
} from './status';
import type {
  ClarifyChoicesRequest,
  ClarifyChoicesResult,
  GuidanceScriptRequest,
  GuidanceScriptResult,
  IntentRequest,
  IntentResult,
  OnDeviceAiMode,
} from './types';

export type {
  ClarifyChoicesRequest,
  ClarifyChoicesResult,
  GuidanceScriptRequest,
  GuidanceScriptResult,
  IntentRequest,
  IntentResult,
  OnDeviceAiBackend,
  OnDeviceAiLifecycle,
  OnDeviceAiMode,
  OnDeviceAiStatus,
  OnDeviceEngine,
} from './types';

export {
  AI_DEMO_CHOICES_BANNER,
  AI_DISCONNECTED_LABEL,
  AI_LIVE_CHOICES_BANNER,
  getOnDeviceAiStatus,
  initOnDeviceAi,
  isOnDeviceAiReady,
  resetOnDeviceAiForTests,
  setOnDeviceEngineForTests,
};

function modeFromReady(): OnDeviceAiMode {
  return isOnDeviceAiReady() ? 'live' : 'demo';
}

/**
 * 意図分類。モデル未準備ならデモヒューリスティック。
 * 失敗時も live にはしない。
 */
export async function classifyIntent(
  request: IntentRequest,
): Promise<IntentResult> {
  const engine = getActiveOnDeviceEngine();
  if (!engine) {
    return demoClassifyIntent(request);
  }

  try {
    const raw = await engine.chatJson([
      { role: 'system', content: buildIntentSystemPrompt() },
      { role: 'user', content: buildIntentUserPrompt(request) },
    ]);
    const parsed = parseIntentJson(raw);
    return {
      clarity: parsed.clarity,
      rationale: parsed.rationale,
      mode: 'live',
    };
  } catch {
    return {
      ...demoClassifyIntent(request),
      mode: 'offline',
      rationale: `${AI_DISCONNECTED_LABEL}: 意図判定に失敗したためデモ判定を使います。`,
    };
  }
}

/**
 * 不明時の動的〜4選択肢。未接続時はデモ固定。
 */
export async function generateClarifyChoices(
  request: ClarifyChoicesRequest,
): Promise<ClarifyChoicesResult> {
  const engine = getActiveOnDeviceEngine();
  if (!engine) {
    return demoGenerateClarifyChoices(request);
  }

  try {
    const raw = await engine.chatJson([
      { role: 'system', content: buildChoicesSystemPrompt() },
      { role: 'user', content: buildChoicesUserPrompt(request) },
    ]);
    const parsed = parseChoicesJson(raw);
    return {
      choices: parsed.choices,
      question: parsed.question,
      mode: 'live',
    };
  } catch {
    return {
      ...demoGenerateClarifyChoices(request),
      mode: 'offline',
      question: `${AI_DISCONNECTED_LABEL}のためデモ選択肢です。もう少し具体的に教えてください。`,
    };
  }
}

/**
 * 支援セッション用の displayText/voiceText 手順 JSON。
 * 未接続・失敗時は既存デモ脚本（isDemo:true）。
 */
export async function buildGuidanceScript(
  request: GuidanceScriptRequest,
): Promise<GuidanceScriptResult> {
  const engine = getActiveOnDeviceEngine();
  if (!engine) {
    return demoBuildGuidanceScript(request);
  }

  try {
    const raw = await engine.chatJson([
      { role: 'system', content: buildGuidanceSystemPrompt() },
      { role: 'user', content: buildGuidanceUserPrompt(request) },
    ]);
    const script = parseGuidanceJson(raw, {
      summary: request.summary,
      scriptId: `on-device-${request.featureId}-${Date.now()}`,
    });

    // 安全性: モデルが「安全です」と断定したらデモへ倒す
    if (request.featureId === 'safetyCheck') {
      const blob = script.steps
        .map((s) => `${s.displayText} ${s.voiceText}`)
        .join(' ');
      if (/安全です/.test(blob) && !/「安全です」とは言/.test(blob)) {
        return {
          ...demoBuildGuidanceScript(request),
          mode: 'offline',
        };
      }
    }

    return {
      script: { ...script, isDemo: false },
      mode: 'live',
    };
  } catch {
    return {
      ...demoBuildGuidanceScript(request),
      mode: 'offline',
    };
  }
}

/** バナー文言（選択肢画面用） */
export function clarifyChoicesBanner(mode?: OnDeviceAiMode): string {
  if (mode === 'live' && isOnDeviceAiReady()) {
    return AI_LIVE_CHOICES_BANNER;
  }
  if (mode == null && isOnDeviceAiReady()) {
    return AI_LIVE_CHOICES_BANNER;
  }
  return AI_DEMO_CHOICES_BANNER;
}

/** 設定・ホーム向けの短い接続説明 */
export function getOnDeviceAiBanner(): {
  connected: boolean;
  message: string;
} {
  const status = getOnDeviceAiStatus();
  return {
    connected: status.ready,
    message: status.message,
  };
}

/** デバッグ／スモーク用: 現在のモード推定 */
export function peekOnDeviceMode(): OnDeviceAiMode {
  return modeFromReady();
}

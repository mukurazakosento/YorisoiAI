import { buildGuidanceFromOcrText } from '../androidAssist/guidanceFromOcr';
import {
  getActiveOnDeviceEngine,
  isOnDeviceAiReady,
} from './status';
import {
  historyPromptBlock,
  isGuidanceLooping,
  pushPlanHistory,
  prunePlanHistoryForPrivacy,
} from './planHistory';
import { parseAndGroundOperationPlan, unsurePlan } from './parseOperationPlan';
import type { OperationPlan } from './operationPlanTypes';
import {
  buildScreenContext,
  screenContextToPromptBlock,
  type ScreenContextInput,
} from './screenContext';
import { maskSensitiveText } from './piiMask';

export type PlanOperationInput = ScreenContextInput & {
  featureId?: 'operationSupport' | 'textExplanation' | 'safetyCheck';
  ocrChanged?: boolean;
};

export type PlanOperationResult = {
  plan: OperationPlan;
  mode: 'live' | 'demo' | 'offline';
  usedEngine: boolean;
};

export function buildOperationPlannerSystemPrompt(): string {
  return [
    'あなたは高齢者向けスマホ支援「よりそいAI」の操作計画です。',
    '利用者が自分で操作する。自動タップ・自動送信・自動発信・自動購入・自動許可は禁止。',
    '画面の OCR / UI 根拠にあるボタンや文字だけを指示す。無いボタンを作らない。',
    '一度に次の一手だけ。日本語。JSONのみ。画像は扱わない。',
    'displayText/voiceText は具体的に: 「ラベル」を引用し、位置（上/下/左/右/中央、何番目）を言う。',
    '禁止: 「直したい設定を開いて」「適切な項目を選んで」「設定を開いて」など曖昧な委任。',
    '対象が画面に無いとき actionKind=scroll。scrollDirection は既定「下へ」。lookFor に探す文字。',
    '自信が無いときは actionKind=ask で Yes/No か二択（見えるラベル名付き）を聞く。',
    '送信・購入・発信・許可変更は requiresUserConfirm=true と confirm_with_user。',
    '形式:',
    '{"screenDescription":"","stage":"","actionKind":"tap|type|scroll|open_app|wait|confirm_with_user|ask|done|none","nextAction":"","targetButtonText":null,"approximatePosition":{"x":0.5,"y":0.5},"screenRegion":"上|下|左|右|中央|null","scrollDirection":"下へ|上へ|null","lookFor":null,"why":"","confidence":0.0,"displayText":"","voiceText":"","clarifyingQuestion":null,"expectNextScreen":"","requiresUserConfirm":false,"stepId":""}',
  ].join('\n');
}

export function buildOperationPlannerUserPrompt(
  input: PlanOperationInput,
): string {
  const ctx = buildScreenContext(input);
  return [
    screenContextToPromptBlock(ctx),
    historyPromptBlock(),
    '上記から次の一手の JSON だけを返してください。',
  ].join('\n\n');
}

function heuristicPlan(input: PlanOperationInput): OperationPlan {
  const guidance = buildGuidanceFromOcrText({
    featureId: input.featureId ?? 'operationSupport',
    goalSummary: input.goalSummary,
    ocrText: input.ocrText || input.a11yText || '',
  });
  const sensitive =
    /送信|送る|購入|注文|発信|許可する|許可しない/.test(
      `${guidance.displayText}${guidance.voiceText}`,
    );
  const scroll = /スワイプ|下へ|上へ/.test(guidance.displayText);
  const ask =
    guidance.stepId.includes('ask') ||
    guidance.stageId === 'clarify' ||
    /ですか|どちら/.test(guidance.displayText);
  return {
    screenDescription: maskSensitiveText(guidance.ocrTextPreview || '画面'),
    stage: guidance.stageId || 'demo',
    actionKind: sensitive
      ? 'confirm_with_user'
      : scroll
        ? 'scroll'
        : ask
          ? 'ask'
          : 'tap',
    nextAction: guidance.displayText,
    targetButtonText: null,
    approximatePosition: null,
    screenRegion: null,
    scrollDirection: scroll
      ? /上へ/.test(guidance.displayText)
        ? '上へ'
        : '下へ'
      : null,
    lookFor: null,
    why: 'デモ／ヒューリスティック案内（端末内AI未接続または未使用）',
    confidence: 0.55,
    displayText: guidance.displayText,
    voiceText: guidance.voiceText,
    clarifyingQuestion:
      guidance.stepId.includes('ask') || guidance.stageId === 'clarify'
        ? guidance.displayText
        : null,
    expectNextScreen: '利用者操作後の次画面',
    requiresUserConfirm: sensitive,
    stepId: guidance.stepId,
  };
}

/**
 * Plan one next operation-support step.
 * LIVE only when on-device engine is ready and JSON grounds in evidence.
 */
export async function planOperationSupport(
  input: PlanOperationInput,
): Promise<PlanOperationResult> {
  const ctx = buildScreenContext(input);
  const engine = getActiveOnDeviceEngine();

  if (!engine || !isOnDeviceAiReady()) {
    const plan = heuristicPlan(input);
    if (isGuidanceLooping(plan, input.ocrChanged !== false)) {
      const ask = unsurePlan('anti-loop');
      ask.displayText = '同じ案内の繰り返しを止めます。次に押す場所を一つ教えてください。';
      ask.voiceText =
        '同じ案内が続いています。次に押す場所を一つだけ教えてください。代わりには押しません。';
      pushPlanHistory(ctx, ask);
      return { plan: ask, mode: 'demo', usedEngine: false };
    }
    pushPlanHistory(ctx, plan);
    prunePlanHistoryForPrivacy();
    return { plan, mode: 'demo', usedEngine: false };
  }

  try {
    const raw = await engine.chatJson([
      { role: 'system', content: buildOperationPlannerSystemPrompt() },
      { role: 'user', content: buildOperationPlannerUserPrompt(input) },
    ]);
    let plan = parseAndGroundOperationPlan(raw, ctx);
    if (isGuidanceLooping(plan, Boolean(input.ocrChanged))) {
      plan = {
        ...unsurePlan('anti-loop'),
        displayText: '画面が変わっていないようです。別の場所を試すか、状況を教えてください。',
        voiceText:
          '画面が変わっていないようです。別のボタンを探すか、いま見える文字を教えてください。',
      };
    }
    pushPlanHistory(ctx, plan);
    prunePlanHistoryForPrivacy();
    return { plan, mode: 'live', usedEngine: true };
  } catch {
    const plan = heuristicPlan(input);
    pushPlanHistory(ctx, plan);
    return { plan, mode: 'offline', usedEngine: false };
  }
}

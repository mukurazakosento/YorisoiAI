import type {
  OperationPlan,
  OperationPlanActionKind,
} from './operationPlanTypes';
import { UNSURE_DISPLAY, UNSURE_VOICE } from './operationPlanTypes';
import { maskSensitiveText } from './piiMask';
import type { ScreenContext } from './screenContext';

const ACTION_KINDS: OperationPlanActionKind[] = [
  'tap',
  'type',
  'scroll',
  'open_app',
  'wait',
  'confirm_with_user',
  'ask',
  'done',
  'none',
];

const SENSITIVE_ACTION_RE =
  /送信|送る|発信|電話をかける|購入|注文|決済|支払い|許可する|許可しない|削除|アンインストール|共有/;

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : trimmed;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('JSON object not found');
  }
  return JSON.parse(body.slice(start, end + 1));
}

function asString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v.trim() : fallback;
}

function asNumber(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function normalizeActionKind(v: unknown): OperationPlanActionKind {
  const s = asString(v).toLowerCase();
  return (ACTION_KINDS.find((k) => k === s) ?? 'ask') as OperationPlanActionKind;
}

function labelGrounded(
  target: string | null,
  evidence: string[],
  ocrBlob: string,
): boolean {
  if (!target) return true;
  const t = target.replace(/\s+/g, '');
  if (!t) return true;
  if (ocrBlob.replace(/\s+/g, '').includes(t)) return true;
  return evidence.some((e) => {
    const ee = e.replace(/\s+/g, '');
    return ee.includes(t) || t.includes(ee);
  });
}

export function unsurePlan(stage = 'unsure'): OperationPlan {
  return {
    screenDescription: UNSURE_DISPLAY,
    stage,
    actionKind: 'ask',
    nextAction: '状況を教えてもらう',
    targetButtonText: null,
    approximatePosition: null,
    why: '根拠となるボタンや文字を確認できない',
    confidence: 0.2,
    displayText: UNSURE_DISPLAY,
    voiceText: UNSURE_VOICE,
    clarifyingQuestion: 'いま画面に何と書いてありますか？',
    expectNextScreen: '利用者の説明待ち',
    requiresUserConfirm: false,
    stepId: `unsure-${stage}`,
  };
}

/**
 * Parse model JSON and ground actions in OCR/UI evidence.
 * Hallucinated button targets → unsure / ask.
 */
export function parseAndGroundOperationPlan(
  raw: string,
  ctx: ScreenContext,
): OperationPlan {
  let parsed: Record<string, unknown>;
  try {
    parsed = extractJsonObject(raw) as Record<string, unknown>;
  } catch {
    return unsurePlan('parse-failed');
  }

  const targetRaw = asString(parsed.targetButtonText || parsed.target_button_text);
  const target = targetRaw ? maskSensitiveText(targetRaw).slice(0, 40) : null;
  const evidenceBlob = [
    ctx.ocrText,
    ctx.a11yText,
    ...ctx.evidenceLabels,
    ...ctx.dialogButtons,
    ...ctx.uiElements.map((e) => e.label),
  ].join(' ');

  const actionKind = normalizeActionKind(parsed.actionKind || parsed.action_kind);
  const confidence = Math.min(
    1,
    Math.max(0, asNumber(parsed.confidence, 0.4)),
  );

  if (
    (actionKind === 'tap' || actionKind === 'type') &&
    target &&
    !labelGrounded(target, ctx.evidenceLabels, evidenceBlob)
  ) {
    return {
      ...unsurePlan('ungrounded-target'),
      screenDescription: maskSensitiveText(
        asString(parsed.screenDescription || parsed.screen_description, '画面'),
      ).slice(0, 80),
      clarifyingQuestion: target
        ? `「${target}」は画面に見当たりません。どれを押しますか？`
        : '次に押す場所を一つ教えてください。',
    };
  }

  if (confidence < 0.35 && actionKind !== 'ask' && actionKind !== 'done') {
    return {
      ...unsurePlan('low-confidence'),
      clarifyingQuestion:
        asString(parsed.clarifyingQuestion || parsed.clarifying_question) ||
        'やりたいことに近いボタンはどれですか？',
    };
  }

  let pos: { x: number; y: number } | null = null;
  const approx = parsed.approximatePosition || parsed.approximate_position;
  if (approx && typeof approx === 'object') {
    const o = approx as Record<string, unknown>;
    const x = asNumber(o.x, NaN);
    const y = asNumber(o.y, NaN);
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      pos = { x, y };
    }
  }
  // Prefer UI element position when target matches.
  if (target) {
    const hit = ctx.uiElements.find((e) => e.label.includes(target) || target.includes(e.label));
    if (hit?.x != null && hit?.y != null) {
      pos = { x: hit.x, y: hit.y };
    }
  }

  const displayText = maskSensitiveText(
    asString(parsed.displayText || parsed.display_text) ||
      asString(parsed.nextAction || parsed.next_action) ||
      UNSURE_DISPLAY,
  ).slice(0, 120);
  const voiceText = maskSensitiveText(
    asString(parsed.voiceText || parsed.voice_text) || displayText,
  ).slice(0, 240);
  const nextAction = maskSensitiveText(
    asString(parsed.nextAction || parsed.next_action) || displayText,
  ).slice(0, 80);
  const stage = asString(parsed.stage, 'unknown').slice(0, 40) || 'unknown';

  const requiresUserConfirm =
    parsed.requiresUserConfirm === true ||
    parsed.requires_user_confirm === true ||
    SENSITIVE_ACTION_RE.test(`${nextAction}${target ?? ''}${displayText}`);

  // Never instruct the app to auto-perform sensitive actions.
  const safeKind =
    requiresUserConfirm && actionKind === 'tap' ? 'confirm_with_user' : actionKind;

  const stepId =
    asString(parsed.stepId || parsed.step_id) ||
    `${stage}-${safeKind}-${(target || nextAction).slice(0, 12)}`;

  return {
    screenDescription: maskSensitiveText(
      asString(parsed.screenDescription || parsed.screen_description, '画面'),
    ).slice(0, 100),
    stage,
    actionKind: safeKind,
    nextAction,
    targetButtonText: target,
    approximatePosition: pos,
    why: maskSensitiveText(asString(parsed.why, '')).slice(0, 120),
    confidence,
    displayText,
    voiceText,
    clarifyingQuestion: (() => {
      const q = asString(
        parsed.clarifyingQuestion || parsed.clarifying_question,
      );
      return q ? maskSensitiveText(q).slice(0, 100) : null;
    })(),
    expectNextScreen: maskSensitiveText(
      asString(parsed.expectNextScreen || parsed.expect_next_screen, ''),
    ).slice(0, 80),
    requiresUserConfirm,
    stepId: stepId.replace(/\s+/g, '-').slice(0, 64),
  };
}

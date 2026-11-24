import {
  formatScrollInstruction,
  formatTapInstruction,
  isVagueGuidanceText,
  rejectOrRewriteVagueGuidance,
  estimateRegionFromOcr,
} from '../androidAssist/concreteGuidance';
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
    screenRegion: null,
    scrollDirection: null,
    lookFor: null,
    why: '根拠となるボタンや文字を確認できない',
    confidence: 0.2,
    displayText: UNSURE_DISPLAY,
    voiceText: UNSURE_VOICE,
    clarifyingQuestion: 'いま画面の上・中央・下のどこに文字がありますか？',
    expectNextScreen: '利用者の説明待ち',
    requiresUserConfirm: false,
    stepId: `unsure-${stage}`,
  };
}

/**
 * Parse model JSON and ground actions in OCR/UI evidence.
 * Hallucinated / vague outputs → rewrite or ask.
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
  const lookForRaw = asString(parsed.lookFor || parsed.look_for);
  const lookFor = lookForRaw ? maskSensitiveText(lookForRaw).slice(0, 40) : null;
  const evidenceBlob = [
    ctx.ocrText,
    ctx.a11yText,
    ...ctx.evidenceLabels,
    ...ctx.dialogButtons,
    ...ctx.uiElements.map((e) => e.label),
  ].join(' ');

  let actionKind = normalizeActionKind(parsed.actionKind || parsed.action_kind);
  const confidence = Math.min(
    1,
    Math.max(0, asNumber(parsed.confidence, 0.4)),
  );

  // Target named but not on screen → scroll (default 下へ), not hallucinated tap
  if (
    target &&
    (actionKind === 'tap' || actionKind === 'type') &&
    !labelGrounded(target, ctx.evidenceLabels, evidenceBlob)
  ) {
    const scroll = formatScrollInstruction(target, '下へ');
    return {
      ...unsurePlan('scroll-for-target'),
      stage: asString(parsed.stage, 'scroll'),
      actionKind: 'scroll',
      nextAction: scroll.displayText,
      targetButtonText: target,
      screenRegion: null,
      scrollDirection: '下へ',
      lookFor: target,
      confidence: Math.min(confidence, 0.7),
      displayText: scroll.displayText,
      voiceText: scroll.voiceText,
      clarifyingQuestion: null,
      expectNextScreen: `「${target}」が見える画面`,
      requiresUserConfirm: false,
      stepId: `scroll-for-${target.slice(0, 12)}`.replace(/\s+/g, '-'),
      why: '対象ラベルが画面に無いためスクロール案内',
    };
  }

  if (confidence < 0.35 && actionKind !== 'ask' && actionKind !== 'done') {
    return {
      ...unsurePlan('low-confidence'),
      clarifyingQuestion:
        asString(parsed.clarifyingQuestion || parsed.clarifying_question) ||
        (ctx.evidenceLabels[0] && ctx.evidenceLabels[1]
          ? `「${ctx.evidenceLabels[0]}」と「${ctx.evidenceLabels[1]}」のどちらですか？`
          : '画面の上・中央・下のどこに押す文字がありますか？'),
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
  if (target) {
    const hit = ctx.uiElements.find(
      (e) => e.label.includes(target) || target.includes(e.label),
    );
    if (hit?.x != null && hit?.y != null) {
      pos = { x: hit.x, y: hit.y };
    }
  }

  let screenRegion = asString(parsed.screenRegion || parsed.screen_region) || null;
  if (!screenRegion && target && ctx.ocrText.includes(target)) {
    screenRegion = estimateRegionFromOcr(ctx.ocrText, target).region;
  }
  if (!screenRegion && pos) {
    screenRegion =
      pos.y < 0.33 ? '上' : pos.y > 0.66 ? '下' : pos.x < 0.33 ? '左' : pos.x > 0.66 ? '右' : '中央';
  }

  let scrollDirection = asString(
    parsed.scrollDirection || parsed.scroll_direction,
  ) as '上へ' | '下へ' | '';
  if (scrollDirection !== '上へ' && scrollDirection !== '下へ') {
    scrollDirection = '';
  }

  let displayText = maskSensitiveText(
    asString(parsed.displayText || parsed.display_text) ||
      asString(parsed.nextAction || parsed.next_action) ||
      UNSURE_DISPLAY,
  ).slice(0, 120);
  let voiceText = maskSensitiveText(
    asString(parsed.voiceText || parsed.voice_text) || displayText,
  ).slice(0, 240);
  let nextAction = maskSensitiveText(
    asString(parsed.nextAction || parsed.next_action) || displayText,
  ).slice(0, 80);
  const stage = asString(parsed.stage, 'unknown').slice(0, 40) || 'unknown';

  // Concrete rewrite for vague LLM copy
  if (isVagueGuidanceText(`${displayText}\n${voiceText}`)) {
    if (actionKind === 'scroll' || scrollDirection) {
      const scroll = formatScrollInstruction(
        lookFor || target || '目的の項目',
        (scrollDirection || '下へ') as '上へ' | '下へ',
      );
      displayText = scroll.displayText;
      voiceText = scroll.voiceText;
      nextAction = scroll.displayText;
      actionKind = 'scroll';
      scrollDirection = scrollDirection || '下へ';
    } else if (target && labelGrounded(target, ctx.evidenceLabels, evidenceBlob)) {
      const region =
        (screenRegion as '上' | '下' | '左' | '右' | '中央') ||
        estimateRegionFromOcr(ctx.ocrText, target).region;
      const tap = formatTapInstruction(
        { label: target, region, ordinal: null },
        lookFor ?? undefined,
      );
      displayText = tap.displayText;
      voiceText = tap.voiceText;
      nextAction = tap.displayText;
      screenRegion = region;
      actionKind = actionKind === 'confirm_with_user' ? 'confirm_with_user' : 'tap';
    } else {
      const fixed = rejectOrRewriteVagueGuidance({
        displayText,
        voiceText,
        ocrText: evidenceBlob,
        preferredLabels: ctx.evidenceLabels,
        scrollTargetLabel: lookFor || target || undefined,
        goalSummary: ctx.goalSummary,
      });
      displayText = fixed.displayText;
      voiceText = fixed.voiceText;
      nextAction = fixed.displayText;
      if (fixed.actionKind === 'scroll') {
        actionKind = 'scroll';
        scrollDirection = '下へ';
      } else if (fixed.actionKind === 'ask') {
        actionKind = 'ask';
      } else if (fixed.actionKind === 'tap') {
        actionKind = 'tap';
      }
    }
  } else if (actionKind === 'tap' && target && screenRegion && !displayText.includes(target)) {
    // Ensure quoted label + region even when not flagged vague
    const tap = formatTapInstruction(
      {
        label: target,
        region: screenRegion as '上' | '下' | '左' | '右' | '中央',
        ordinal: null,
      },
      lookFor ?? undefined,
    );
    displayText = tap.displayText;
    voiceText = tap.voiceText;
  }

  const requiresUserConfirm =
    parsed.requiresUserConfirm === true ||
    parsed.requires_user_confirm === true ||
    SENSITIVE_ACTION_RE.test(`${nextAction}${target ?? ''}${displayText}`);

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
    screenRegion,
    scrollDirection: scrollDirection || null,
    lookFor,
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

import type { ConsultationChoice } from '../../types/consultation';
import type { IntentClarity, SessionInstructionStep, SessionScript } from '../../types/session';

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export function extractJsonObject(raw: string): unknown {
  const text = stripCodeFence(raw);
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error('JSONオブジェクトを取り出せませんでした');
  }
}

export function parseIntentJson(raw: string): {
  clarity: IntentClarity;
  rationale?: string;
} {
  const data = extractJsonObject(raw) as {
    clarity?: string;
    rationale?: string;
  };
  const clarity = data.clarity === 'clear' ? 'clear' : 'unclear';
  const rationale =
    typeof data.rationale === 'string' && data.rationale.trim()
      ? data.rationale.trim()
      : undefined;
  return { clarity, rationale };
}

export function parseChoicesJson(raw: string): {
  question: string;
  choices: ConsultationChoice[];
} {
  const data = extractJsonObject(raw) as {
    question?: string;
    choices?: unknown;
  };
  const labels = Array.isArray(data.choices)
    ? data.choices
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
    : [];

  while (labels.length < 4) {
    if (labels.length === 3) {
      labels.push('また別の言い方で書く');
    } else {
      labels.push(`もう少し具体的な相談 ${labels.length + 1}`);
    }
  }

  const sliced = labels.slice(0, 4);
  if (!sliced.some((label) => label.includes('別の言い方'))) {
    sliced[3] = 'また別の言い方で書く';
  }

  const question =
    typeof data.question === 'string' && data.question.trim()
      ? data.question.trim()
      : 'もう少し具体的に教えてください。下のどれかに近いですか？';

  const choices: ConsultationChoice[] = sliced.map((label, index) => ({
    id: `ai-choice-${index + 1}`,
    label,
  }));

  return { question, choices };
}

function normalizeStep(raw: unknown): SessionInstructionStep | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const step = raw as Record<string, unknown>;
  const displayText =
    typeof step.displayText === 'string' ? step.displayText.trim() : '';
  if (!displayText) {
    return null;
  }
  const voiceText =
    typeof step.voiceText === 'string' && step.voiceText.trim()
      ? step.voiceText.trim()
      : displayText;
  const simplifyDisplayText =
    typeof step.simplifyDisplayText === 'string' &&
    step.simplifyDisplayText.trim()
      ? step.simplifyDisplayText.trim()
      : displayText;
  const simplifyVoiceText =
    typeof step.simplifyVoiceText === 'string' && step.simplifyVoiceText.trim()
      ? step.simplifyVoiceText.trim()
      : voiceText;

  return {
    displayText,
    voiceText,
    simplifyDisplayText,
    simplifyVoiceText,
  };
}

export function parseGuidanceJson(
  raw: string,
  input: { summary: string; scriptId: string },
): SessionScript {
  const data = extractJsonObject(raw) as {
    title?: string;
    steps?: unknown;
  };
  const steps = Array.isArray(data.steps)
    ? data.steps.map(normalizeStep).filter((s): s is SessionInstructionStep => s != null)
    : [];

  if (steps.length === 0) {
    throw new Error('案内ステップが空です');
  }

  const title =
    typeof data.title === 'string' && data.title.trim()
      ? data.title.trim()
      : input.summary.slice(0, 24) || '支援の案内';

  return {
    id: input.scriptId,
    title,
    isDemo: false,
    steps,
  };
}

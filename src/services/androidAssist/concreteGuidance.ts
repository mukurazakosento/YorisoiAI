/**
 * Make operation-support copy concrete: quote visible labels, say where on
 * screen, scroll direction when needed. Reject vague "open the setting you want".
 */

export type ScreenRegion = '上' | '下' | '左' | '右' | '中央';

export type ScrollDirection = '上へ' | '下へ';

export type ConcreteTapHint = {
  label: string;
  region: ScreenRegion;
  /** 1-based index among visible candidate labels, if known */
  ordinal: number | null;
};

const VAGUE_PHRASE_RE =
  /直したい項目|直したい設定|適切な項目|好きな項目|任意の項目|必要な項目|設定を開いて(?:ください)?(?!.*「)|アプリを開いて(?:ください)?(?!.*「)|やりたい画面まで|見たい商品まで|確認したい番号が出るところまで|一つ開いてください(?!.*「)|項目を選んで(?:ください)?(?!.*「)|項目を一つ/;

/** Allowed when we truly have no OCR label — must be a specific question. */
const SPECIFIC_ASK_OK_RE =
  /ですか|どれ|どちら|ありますか|見えますか|「[^」]+」/;

export function isVagueGuidanceText(text: string): boolean {
  const t = text.replace(/\s+/g, '');
  if (!t) return true;
  if (VAGUE_PHRASE_RE.test(t)) return true;
  // "設定を開いて" without quoting a label
  if (/設定を開/.test(t) && !/「[^」]+」/.test(text)) return true;
  if (/アプリを開/.test(t) && !/「[^」]+」/.test(text) && !/電話アプリ|メールアプリ|ブラウザ|Play/.test(t)) {
    // bare アプリを開いて is vague; named apps OK if we also say next tap
    if (!/を押し|を選|スワイプ|下へ|上へ/.test(t)) return true;
  }
  return false;
}

export function estimateRegionFromOcr(
  raw: string,
  label: string,
): { region: ScreenRegion; ordinal: number | null } {
  const lines = raw
    .split(/[\n\r]+|(?<=[。．])\s+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const blob = raw.replace(/\s+/g, ' ').trim();
  // Prefer line index when multi-line OCR
  if (lines.length >= 2) {
    const idx = lines.findIndex((l) => l.includes(label));
    if (idx >= 0) {
      const frac = lines.length <= 1 ? 0.5 : idx / (lines.length - 1);
      const region: ScreenRegion =
        frac < 0.33 ? '上' : frac > 0.66 ? '下' : '中央';
      return { region, ordinal: idx + 1 };
    }
  }
  // Single blob: character offset
  const at = blob.indexOf(label);
  if (at < 0) {
    return { region: '中央', ordinal: null };
  }
  const frac = blob.length <= 1 ? 0.5 : at / (blob.length - 1);
  // Common JP dialog: 許可しない left, 許可する right
  if (label === '許可しない' || label === 'キャンセル') {
    return { region: '左', ordinal: null };
  }
  if (label === '許可する' || label === '同意する' || label === '送信' || label === '送る') {
    // 送信 often bottom-right on chat composers
    if (label === '送信' || label === '送る') {
      return { region: '下', ordinal: null };
    }
    return { region: '右', ordinal: null };
  }
  const region: ScreenRegion = frac < 0.33 ? '上' : frac > 0.66 ? '下' : '中央';
  return { region, ordinal: null };
}

export function formatTapInstruction(hint: ConcreteTapHint, nextLookFor?: string): {
  displayText: string;
  voiceText: string;
} {
  const where =
    hint.ordinal != null
      ? `画面の${hint.region}あたり（上から${hint.ordinal}番目付近）の`
      : `画面の${hint.region}あたりの`;
  const displayText = `${where}「${hint.label}」を押してください。`.slice(0, 120);
  const look =
    nextLookFor != null && nextLookFor.trim()
      ? `次に「${nextLookFor.trim()}」が出るか見てください。`
      : '一度に一つです。代わりには押しません。';
  const voiceText =
    `${where}「${hint.label}」を一つ押してください。${look}`.slice(0, 240);
  return { displayText, voiceText };
}

export function formatScrollInstruction(
  lookFor: string,
  direction: ScrollDirection = '下へ',
): { displayText: string; voiceText: string } {
  const label = lookFor.trim() || '目的の項目';
  const displayText =
    `画面を${direction}ゆっくりスワイプして、「${label}」を探してください。`.slice(
      0,
      120,
    );
  const voiceText =
    `指で画面を${direction}、少しだけスワイプしてください。「${label}」が見えたら教えてください。一度に少しずつです。`.slice(
      0,
      240,
    );
  return { displayText, voiceText };
}

export function formatSpecificChoiceQuestion(
  visibleLabels: string[],
  goalBit?: string,
): { displayText: string; voiceText: string } {
  const a = visibleLabels[0];
  const b = visibleLabels[1];
  if (a && b) {
    const displayText = `次は「${a}」と「${b}」のどちらを押しますか？`.slice(0, 120);
    const voiceText =
      `画面に「${a}」と「${b}」が見えます。${goalBit ? `「${goalBit}」なら、` : ''}どちらを一つ押しますか？`.slice(
        0,
        240,
      );
    return { displayText, voiceText };
  }
  if (a) {
    const displayText = `画面の「${a}」を押しますか？`.slice(0, 120);
    const voiceText =
      `いま「${a}」と見えます。これを押してよいですか？ いいえなら、見える文字を教えてください。`.slice(
        0,
        240,
      );
    return { displayText, voiceText };
  }
  const displayText = '画面の上・中央・下のどれに文字がありますか？';
  const voiceText =
    '画面をうまく特定できません。上・中央・下のどこに文字が見えますか？一つ教えてください。';
  return { displayText, voiceText };
}

/**
 * Prefer a concrete tap on a visible label; else scroll to find a named goal
 * label; else a specific yes/no/choice question (never vague "open settings").
 */
export function buildConcreteOpsStep(input: {
  ocrText: string;
  preferredLabels: string[];
  /** Label to seek via scroll when not on screen */
  scrollTargetLabel?: string;
  goalSummary?: string;
  stepId: string;
  stageId: string;
  nextLookFor?: string;
}): {
  stepId: string;
  stageId: string;
  displayText: string;
  voiceText: string;
  actionKind: 'tap' | 'scroll' | 'ask';
  targetLabel: string | null;
  region: ScreenRegion | null;
  scrollDirection: ScrollDirection | null;
} {
  const raw = input.ocrText.replace(/\s+/g, ' ').trim();
  for (const label of input.preferredLabels) {
    if (raw.includes(label)) {
      const { region, ordinal } = estimateRegionFromOcr(raw, label);
      const tap = formatTapInstruction(
        { label, region, ordinal },
        input.nextLookFor,
      );
      return {
        stepId: input.stepId,
        stageId: input.stageId,
        displayText: tap.displayText,
        voiceText: tap.voiceText,
        actionKind: 'tap',
        targetLabel: label,
        region,
        scrollDirection: null,
      };
    }
  }

  const scrollFor = input.scrollTargetLabel?.trim();
  if (scrollFor) {
    const scroll = formatScrollInstruction(scrollFor, '下へ');
    return {
      stepId: `${input.stepId}-scroll`,
      stageId: input.stageId,
      displayText: scroll.displayText,
      voiceText: scroll.voiceText,
      actionKind: 'scroll',
      targetLabel: scrollFor,
      region: null,
      scrollDirection: '下へ',
    };
  }

  const visible = input.preferredLabels.filter((l) => raw.includes(l)).slice(0, 2);
  // Also try any quoted-looking short tokens from OCR (2–12 chars) as choices
  const extras = extractShortCandidates(raw).slice(0, 2);
  const choices = (visible.length ? visible : extras).slice(0, 2);
  const ask = formatSpecificChoiceQuestion(
    choices,
    input.goalSummary?.trim().slice(0, 16),
  );
  return {
    stepId: `${input.stepId}-ask`,
    stageId: 'clarify',
    displayText: ask.displayText,
    voiceText: ask.voiceText,
    actionKind: 'ask',
    targetLabel: choices[0] ?? null,
    region: null,
    scrollDirection: null,
  };
}

function extractShortCandidates(raw: string): string[] {
  const parts = raw.split(/[\s　・|/｜,，、]+/).map((p) => p.trim());
  const out: string[] = [];
  for (const p of parts) {
    if (p.length >= 2 && p.length <= 12 && !/^[\d.]+$/.test(p)) {
      out.push(p);
    }
    if (out.length >= 4) break;
  }
  return out;
}

/**
 * Rewrite vague display/voice using OCR evidence, or force a specific question.
 */
export function rejectOrRewriteVagueGuidance(input: {
  displayText: string;
  voiceText: string;
  ocrText: string;
  preferredLabels?: string[];
  scrollTargetLabel?: string;
  goalSummary?: string;
}): {
  displayText: string;
  voiceText: string;
  rewritten: boolean;
  actionKind: 'tap' | 'scroll' | 'ask' | 'keep';
} {
  const blob = `${input.displayText}\n${input.voiceText}`;
  if (!isVagueGuidanceText(blob)) {
    // Still require ask-type vague free text to be a specific question
    if (
      /教えてください|選んでください/.test(blob) &&
      !SPECIFIC_ASK_OK_RE.test(blob) &&
      !/「[^」]+」/.test(blob)
    ) {
      // fall through to rewrite
    } else {
      return {
        displayText: input.displayText,
        voiceText: input.voiceText,
        rewritten: false,
        actionKind: 'keep',
      };
    }
  }

  const preferred =
    input.preferredLabels && input.preferredLabels.length > 0
      ? input.preferredLabels
      : [
          '通知',
          'Wi-Fi',
          'Wi‑Fi',
          'ネットワークとインターネット',
          'アプリ',
          '電池',
          'ディスプレイ',
          '音',
          'セキュリティ',
          '許可する',
          '許可しない',
          '送信',
          'アルバム',
          'トーク',
          '設定',
        ];

  const concrete = buildConcreteOpsStep({
    ocrText: input.ocrText,
    preferredLabels: preferred,
    scrollTargetLabel: input.scrollTargetLabel,
    goalSummary: input.goalSummary,
    stepId: 'concrete',
    stageId: 'concrete',
  });

  return {
    displayText: concrete.displayText,
    voiceText: concrete.voiceText,
    rewritten: true,
    actionKind: concrete.actionKind,
  };
}

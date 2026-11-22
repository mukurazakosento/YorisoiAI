import type { FeatureId } from '../../types/navigation';
import { detectPopup, explainPopup, explainScreenText } from './popupDetect';
import type { AndroidAssistGuidance } from './types';

type StepCore = Omit<AndroidAssistGuidance, 'at' | 'ocrTextPreview' | 'mode'>;

/**
 * Stage-aware JS guidance (mirrors native AssistGuidanceRules).
 * Instructions quote current OCR labels. Always mode demo.
 */
export function buildGuidanceFromOcrText(input: {
  featureId: FeatureId;
  goalSummary: string;
  ocrText: string;
}): AndroidAssistGuidance {
  const goal = normalize(input.goalSummary);
  const ocrRaw = input.ocrText.trim().replace(/\s+/g, ' ');
  const o = normalize(ocrRaw);

  const base = (step: StepCore): AndroidAssistGuidance => ({
    ...step,
    mode: 'demo',
    ocrTextPreview: ocrRaw.length > 120 ? `${ocrRaw.slice(0, 120)}…` : ocrRaw,
    at: Date.now(),
  });

  if (!ocrRaw || !o) {
    return base(unreadableStep());
  }

  if (input.featureId === 'safetyCheck') {
    const snippet = clipQuote(ocrRaw, 24);
    return base({
      stepId: 'safety-review',
      stageId: 'safety',
      displayText: `画面の「${snippet}」など、番号や文言をよく見てください。`,
      voiceText: `画面には「${snippet}」などとあります。番号や文言をゆっくり確認してください。安全だと決めつけないでください。`,
    });
  }

  if (input.featureId === 'textExplanation') {
    const explained = explainScreenText(ocrRaw);
    return base({
      stepId: explained.stepId,
      stageId: explained.stageId,
      displayText: explained.displayText,
      voiceText: explained.voiceText,
    });
  }

  const popup = detectPopup(ocrRaw);
  if (popup) {
    const explained = explainPopup(popup);
    return base({
      stepId: explained.stepId,
      stageId: explained.stageId,
      displayText: explained.displayText,
      voiceText: explained.voiceText,
    });
  }

  if (looksLikeLinePhotoGoal(goal)) {
    return base(linePhotoStep(o, ocrRaw));
  }
  if (looksLikeWifiGoal(goal)) {
    return base(wifiStep(o, ocrRaw));
  }
  if (looksLikePhoneGoal(goal)) {
    return base(phoneStep(o, ocrRaw));
  }
  if (looksLikeSettingsGoal(goal)) {
    return base(settingsStep(o, ocrRaw));
  }

  return base(ocrGroundedFallback(ocrRaw, input.goalSummary));
}

export function unreadableGuidanceStep(): StepCore {
  return unreadableStep();
}

function unreadableStep(): StepCore {
  return {
    stepId: 'ocr-unreadable',
    stageId: 'unreadable',
    displayText: '画面をうまく読み取れませんでした。',
    voiceText:
      '画面をうまく読み取れませんでした。明るいところで、もう少し待つか、アプリに戻ってください。',
  };
}

/**
 * Dedupe by stepId; re-announce on stage change or after unreadable recovery.
 */
export function shouldAnnounceGuidanceStep(
  previousStepId: string | null | undefined,
  nextStepId: string,
  previousStageId?: string | null,
  nextStageId?: string | null,
): boolean {
  if (!nextStepId.trim()) {
    return false;
  }
  if (previousStageId === 'unreadable' && nextStageId && nextStageId !== 'unreadable') {
    return true;
  }
  if (previousStageId && nextStageId && previousStageId !== nextStageId) {
    return true;
  }
  return previousStepId !== nextStepId;
}

export function looksLikeLinePhotoGoal(goalNormalizedOrRaw: string): boolean {
  const g = normalize(goalNormalizedOrRaw);
  const line = g.includes('line') || g.includes('ライン') || g.includes('らいん');
  const photo = g.includes('写真') || g.includes('画像') || g.includes('アルバム');
  const sendOrGrandchild = g.includes('送') || g.includes('孫');
  return line && photo && sendOrGrandchild;
}

export function hasClearSentConfirmation(ocrNormalizedOrRaw: string): boolean {
  const o = normalize(ocrNormalizedOrRaw);
  const strongSent =
    o.includes('送信しました') ||
    o.includes('送信済み') ||
    o.includes('メッセージを送信') ||
    o.includes('写真を送信');
  if (!strongSent) {
    return false;
  }
  const recipientHint =
    o.includes('孫') ||
    o.includes('トーク') ||
    o.includes('さん') ||
    o.includes('チャット');
  return recipientHint;
}

function looksLikeWifiGoal(g: string): boolean {
  return (
    g.includes('wifi') ||
    g.includes('wi-fi') ||
    g.includes('ワイファイ') ||
    g.includes('無線lan') ||
    g.includes('無線')
  );
}

function looksLikePhoneGoal(g: string): boolean {
  return g.includes('電話') || g.includes('着信') || g.includes('発信') || g.includes('番号');
}

function looksLikeSettingsGoal(g: string): boolean {
  return (
    g.includes('設定') ||
    g.includes('通知') ||
    g.includes('アプリを入れ') ||
    g.includes('インストール') ||
    g.includes('アンインストール')
  );
}

function clipQuote(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function firstMatch(raw: string, labels: string[]): string | null {
  for (const label of labels) {
    if (raw.includes(label)) return label;
  }
  return null;
}

function firstUiLabel(raw: string): string | null {
  return firstMatch(raw, [
    '許可しない',
    '許可する',
    '送信',
    '送る',
    'アルバム',
    'ギャラリー',
    '写真',
    'カメラ',
    '設定',
    'Wi-Fi',
    'Wi‑Fi',
    '通知',
    '友だち',
    'トーク',
    'ホーム',
    'キャンセル',
    '同意する',
    '次へ',
    '閉じる',
    '選択',
    '添付',
  ]);
}

function withSeen(
  stepId: string,
  stageId: string,
  display: string,
  voice: string,
  raw: string,
  labels: string[],
): StepCore {
  const seen = firstMatch(raw, labels);
  if (!seen) {
    return { stepId, stageId, displayText: display, voiceText: voice };
  }
  return {
    stepId,
    stageId,
    displayText: `画面に「${seen}」とあります。${display}`.slice(0, 120),
    voiceText: `いまの画面には「${seen}」と見えます。${voice}`,
  };
}

function ocrGroundedOr(raw: string, generic: StepCore): StepCore {
  const label = firstUiLabel(raw);
  if (!label) return generic;
  const snippet = clipQuote(raw, 28);
  return {
    stepId: `${generic.stepId}-ocr`,
    stageId: generic.stageId,
    displayText: `画面の「${label}」を押してください。`,
    voiceText: `画面には「${snippet}」とあります。次は「${label}」を押してください。${generic.voiceText}`,
  };
}

function ocrGroundedFallback(raw: string, goalSummary: string): StepCore {
  const snippet = clipQuote(raw, 28);
  const label = firstUiLabel(raw);
  const goalBit = goalSummary.trim().slice(0, 20);
  if (label) {
    return {
      stepId: 'ocr-tap-label',
      stageId: 'ocr-grounded',
      displayText: `画面の「${label}」を押してください。`,
      voiceText: `いまの画面には「${snippet}」とあります。次は「${label}」を一つ押してください。よりそいAIは代わりに押しません。`,
    };
  }
  return {
    stepId: 'ask-clarify',
    stageId: 'clarify',
    displayText: `画面に「${snippet}」とあります。やりたいことを一つ教えてください。`,
    voiceText: `いまの画面には「${snippet}」と見えます。${
      goalBit ? `「${goalBit}」について、` : ''
    }次に押す場所を一つだけ教えてください。決めつけません。`,
  };
}

function wifiStep(o: string, raw: string): StepCore {
  if (o.includes('接続済み') || o.includes('接続されています')) {
    return withSeen(
      'wifi-connected',
      'wifi-connected',
      'つながっているようです。終わってよければ終了してください。',
      'Wi-Fiにつながっているようです。ほかにやることがなければ、終了してください。',
      raw,
      ['接続済み', '接続されています', 'Wi-Fi', 'Wi‑Fi'],
    );
  }
  if (
    o.includes('パスワード') ||
    (o.includes('入力') && (o.includes('wifi') || o.includes('wi-fi') || o.includes('ワイファイ')))
  ) {
    return withSeen(
      'wifi-password',
      'wifi-password',
      '「パスワード」欄に控えた文字を入力してください。',
      '画面のパスワード欄に、控えたWi-Fiのパスワードを入力してください。代わりには入力しません。',
      raw,
      ['パスワード', '入力'],
    );
  }
  if (
    o.includes('wi-fi') ||
    o.includes('wifi') ||
    o.includes('ワイファイ') ||
    o.includes('ネットワーク')
  ) {
    return withSeen(
      'wifi-pick',
      'wifi-list',
      '一覧から使いたいWi-Fiの名前を選んでください。',
      '画面の一覧から、使いたいWi-Fiの名前を一つ選んでください。',
      raw,
      ['ネットワーク', 'Wi-Fi', 'Wi‑Fi', 'ワイファイ'],
    );
  }
  if (o.includes('設定')) {
    return withSeen(
      'wifi-open-from-settings',
      'wifi-settings',
      '設定の中の「Wi-Fi」を押してください。',
      'いま設定画面です。Wi-Fiの項目を押してください。',
      raw,
      ['Wi-Fi', 'Wi‑Fi', '設定'],
    );
  }
  return ocrGroundedOr(raw, {
    stepId: 'wifi-open',
    stageId: 'wifi-start',
    displayText: '設定アプリを開き、「Wi-Fi」を選んでください。',
    voiceText: '設定アプリを開き、Wi-Fiを選んでください。',
  });
}

function phoneStep(o: string, raw: string): StepCore {
  if (o.includes('通話') || o.includes('着信中')) {
    return withSeen(
      'phone-review',
      'phone-active',
      '画面の番号をよく見てから選んでください。',
      '画面の番号をよく見てください。知らない番号なら、急がなくて大丈夫です。',
      raw,
      ['通話', '着信中', '発信'],
    );
  }
  if (o.includes('履歴') || o.includes('着信') || o.includes('発信')) {
    return withSeen(
      'phone-log',
      'phone-log',
      '履歴から確認したい番号を一つ選んでください。',
      '履歴の一覧から、確認したい番号を一つ選んでください。',
      raw,
      ['履歴', '着信', '発信'],
    );
  }
  return ocrGroundedOr(raw, {
    stepId: 'phone-open',
    stageId: 'phone-start',
    displayText: '電話アプリを開いてください。',
    voiceText: '電話アプリを開き、確認したい番号が出るところまで進めてください。',
  });
}

function settingsStep(o: string, raw: string): StepCore {
  if (o.includes('通知') && (o.includes('オン') || o.includes('オフ') || o.includes('許可'))) {
    return withSeen(
      'settings-notify-toggle',
      'settings-notify',
      '通知のオン・オフを、必要な方へ合わせてください。',
      '画面の通知スイッチを、必要な方へ一つ合わせてください。',
      raw,
      ['通知', 'オン', 'オフ', '許可'],
    );
  }
  if (o.includes('通知')) {
    return withSeen(
      'settings-notify',
      'settings-notify-list',
      '一覧の「通知」を開いてください。',
      '画面の一覧から「通知」を開いてください。',
      raw,
      ['通知'],
    );
  }
  return ocrGroundedOr(raw, {
    stepId: 'settings-open',
    stageId: 'settings-home',
    displayText: '直したい項目を一つ開いてください。',
    voiceText: '設定で、直したい項目を一つだけ開いてください。',
  });
}

function linePhotoStep(o: string, raw: string): StepCore {
  if (hasClearSentConfirmation(o)) {
    return withSeen(
      'line-ask-done',
      'line-ask-done',
      '送れたか、相手の名前と一緒に確認してください。',
      '写真が送れたか、相手の名前と一緒に確認してください。分からなければアプリに戻ってください。',
      raw,
      ['送信しました', '送信済み', 'トーク', '孫'],
    );
  }
  if (o.includes('送信') || o.includes('送る')) {
    const label = firstMatch(raw, ['送信', '送る']) ?? '送信';
    return {
      stepId: 'line-confirm-send',
      stageId: 'line-pre-send',
      displayText: `写真と相手を確かめてから「${label}」を押してください。`,
      voiceText: `画面に「${label}」があります。写真と相手を確かめてから、それを押してください。代わりには押しません。`,
    };
  }
  if (o.includes('既読') || o.includes('取り消')) {
    return withSeen(
      'line-confirm-send',
      'line-pre-send',
      '送れても自動では終わりません。画面を確かめてください。',
      '送信や既読だけでは送れたとは決めつけません。画面を確かめてください。',
      raw,
      ['既読', '取り消', '送信'],
    );
  }
  if (
    o.includes('アルバム') ||
    o.includes('ギャラリー') ||
    o.includes('画像を選択') ||
    o.includes('最近の項目') ||
    o.includes('すべての写真') ||
    o.includes('写真を選択')
  ) {
    const label =
      firstMatch(raw, [
        '最近の項目',
        'すべての写真',
        'アルバム',
        'ギャラリー',
        '画像を選択',
        '写真を選択',
      ]) ?? '写真';
    return {
      stepId: 'line-pick-photo',
      stageId: 'line-album',
      displayText: `「${label}」から送りたい写真を一つ選んでください。`,
      voiceText: `画面に「${label}」とあります。送りたい写真を一つだけ選んでください。`,
    };
  }
  if (
    o.includes('カメラ') &&
    (o.includes('アルバム') || o.includes('画像') || o.includes('写真') || o.includes('ライブラリ'))
  ) {
    const label = firstMatch(raw, ['アルバム', '画像', 'ライブラリ', '写真']) ?? 'アルバム';
    return {
      stepId: 'line-choose-album',
      stageId: 'line-album-choice',
      displayText: `カメラではなく「${label}」を選んでください。`,
      voiceText: `画面に「${label}」があります。カメラではなく、それを選んでください。`,
    };
  }
  if (
    o.includes('添付') ||
    o.includes('プラス') ||
    (o.includes('写真') && (o.includes('選択') || o.includes('送信')))
  ) {
    const label = firstMatch(raw, ['写真', '添付', '＋', '+', 'アルバム']) ?? '写真';
    return {
      stepId: 'line-open-attach',
      stageId: 'line-chat',
      displayText: `トーク画面の「${label}」やプラスを押してください。`,
      voiceText: `トーク画面に「${label}」などと見えます。写真やプラスのボタンを押してください。`,
    };
  }
  if (
    o.includes('トークルーム') ||
    o.includes('トーク') ||
    (o.includes('メッセージ') && !o.includes('ホーム'))
  ) {
    return {
      stepId: 'line-in-talk',
      stageId: 'line-chat',
      displayText: 'トーク画面です。下の写真やプラスを押してください。',
      voiceText: 'いまトーク画面の文字が見えます。下の写真やプラスを探して押してください。',
    };
  }
  if (
    o.includes('チャット一覧') ||
    o.includes('友だち') ||
    o.includes('トーク一覧') ||
    (o.includes('ホーム') && !o.includes('トークルーム'))
  ) {
    const label = firstMatch(raw, ['友だち', 'チャット一覧', 'トーク一覧', 'ホーム']) ?? '友だち';
    return {
      stepId: 'line-pick-friend',
      stageId: 'line-friends',
      displayText: `「${label}」から孫の名前のトークを開いてください。`,
      voiceText: `画面に「${label}」とあります。孫の名前を選んでトークを開いてください。`,
    };
  }
  if (o.includes('line') || o.includes('ライン')) {
    return withSeen(
      'line-open',
      'line-home',
      'LINEのホームです。友だちやトーク一覧へ進んでください。',
      'いまLINEの画面です。友だちやトーク一覧から孫の名前へ進んでください。',
      raw,
      ['LINE', 'ライン', 'ホーム'],
    );
  }
  return ocrGroundedOr(raw, {
    stepId: 'line-start',
    stageId: 'line-start',
    displayText: 'LINEを開き、孫のトークへ進みます。',
    voiceText: 'LINEを開き、孫のトークを選んでください。一度に一つです。',
  });
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '');
}

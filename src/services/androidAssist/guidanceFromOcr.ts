import type { FeatureId } from '../../types/navigation';
import {
  inspectSafetyText,
  resolveSafetyInspectMode,
} from '../security';
import {
  buildConcreteOpsStep,
  estimateRegionFromOcr,
  formatScrollInstruction,
  formatTapInstruction,
  rejectOrRewriteVagueGuidance,
} from './concreteGuidance';
import { detectPopup, explainPopup, explainScreenText } from './popupDetect';
import type { AndroidAssistGuidance } from './types';

type StepCore = Omit<AndroidAssistGuidance, 'at' | 'ocrTextPreview' | 'mode'>;

function finalizeConcrete(step: StepCore, ocrRaw: string, goalSummary?: string): StepCore {
  const fixed = rejectOrRewriteVagueGuidance({
    displayText: step.displayText,
    voiceText: step.voiceText,
    ocrText: ocrRaw,
    goalSummary,
  });
  if (!fixed.rewritten) {
    return step;
  }
  return {
    ...step,
    stepId: fixed.actionKind === 'scroll' ? `${step.stepId}-scroll` : step.stepId,
    displayText: fixed.displayText,
    voiceText: fixed.voiceText,
  };
}

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
    // Background path (JS mirror of native AssistSafetyInspector): detect and
    // advise without asking the user to reopen YorisoiAI.
    const mode =
      resolveSafetyInspectMode({ summary: input.goalSummary }) ?? 'phone';
    const result = inspectSafetyText({
      mode,
      text: ocrRaw,
      searchConsent: false,
    });
    if (
      result.status === 'safety_result' &&
      (result.detectedPhones.length > 0 ||
        result.detectedEmails.length > 0 ||
        result.riskLevel === 'dangerous' ||
        result.riskLevel === 'caution')
    ) {
      const fp =
        result.detectedPhones[0]?.digits ||
        result.detectedEmails[0] ||
        `${result.riskLevel}-${clipQuote(ocrRaw, 12)}`;
      return base({
        stepId: `safety-hit-${fp}`,
        stageId: 'safety-result',
        displayText:
          result.displayText?.trim() ||
          '確認結果をお伝えします（安全とは言いません）',
        voiceText:
          result.voiceText?.trim() ||
          result.message?.trim() ||
          '確認結果です。安全とは言い切れません。',
      });
    }
    return base({
      stepId: mode === 'email' ? 'safety-waiting-email' : 'safety-waiting-phone',
      stageId: 'safety-wait',
      displayText:
        mode === 'email'
          ? 'メールやメッセージを開いてください。見つかったら通知でお伝えします。'
          : '電話アプリで番号を出してください。見つかったら通知でお伝えします。',
      voiceText:
        mode === 'email'
          ? 'メールやメッセージを開いてください。怪しい文が見つかったら通知と音声でお伝えします。アプリに戻らなくて大丈夫です。自動では送りません。'
          : '電話アプリを開いて番号を出してください。見つかったら通知と音声でお伝えします。アプリに戻らなくて大丈夫です。自動ではかけません。',
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
    return base(finalizeConcrete(linePhotoStep(o, ocrRaw), ocrRaw, input.goalSummary));
  }
  if (looksLikeWifiGoal(goal)) {
    return base(finalizeConcrete(wifiStep(o, ocrRaw), ocrRaw, input.goalSummary));
  }
  if (looksLikePhoneGoal(goal)) {
    return base(finalizeConcrete(phoneStep(o, ocrRaw), ocrRaw, input.goalSummary));
  }
  if (looksLikeEmailGoal(goal)) {
    return base(finalizeConcrete(emailStep(o, ocrRaw), ocrRaw, input.goalSummary));
  }
  if (looksLikeBrowserGoal(goal)) {
    return base(finalizeConcrete(browserStep(o, ocrRaw), ocrRaw, input.goalSummary));
  }
  if (looksLikeShoppingGoal(goal)) {
    return base(finalizeConcrete(shoppingStep(o, ocrRaw), ocrRaw, input.goalSummary));
  }
  if (looksLikePhotoPickerGoal(goal)) {
    return base(finalizeConcrete(photoPickerStep(o, ocrRaw), ocrRaw, input.goalSummary));
  }
  if (looksLikeInstallGoal(goal)) {
    return base(finalizeConcrete(installStep(o, ocrRaw), ocrRaw, input.goalSummary));
  }
  if (looksLikeSettingsGoal(goal)) {
    return base(finalizeConcrete(settingsStep(o, ocrRaw, goal), ocrRaw, input.goalSummary));
  }

  return base(finalizeConcrete(ocrGroundedFallback(ocrRaw, input.goalSummary), ocrRaw, input.goalSummary));
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
  return g.includes('設定') || g.includes('通知');
}

function looksLikeEmailGoal(g: string): boolean {
  return g.includes('メール') || g.includes('gmail') || g.includes('メールを送');
}

function looksLikeBrowserGoal(g: string): boolean {
  return (
    g.includes('ブラウザ') ||
    g.includes('chrome') ||
    g.includes('ネットで') ||
    g.includes('ウェブ') ||
    g.includes('ホームページ')
  );
}

function looksLikeShoppingGoal(g: string): boolean {
  return (
    g.includes('買い物') ||
    g.includes('購入') ||
    g.includes('注文') ||
    g.includes('カート') ||
    g.includes('アマゾン') ||
    g.includes('楽天')
  );
}

function looksLikePhotoPickerGoal(g: string): boolean {
  const media = g.includes('写真') || g.includes('画像') || g.includes('ファイル');
  const pick =
    g.includes('選') ||
    g.includes('ピッカー') ||
    g.includes('添付') ||
    g.includes('ギャラリー');
  return media && pick;
}

function looksLikeInstallGoal(g: string): boolean {
  return (
    g.includes('アプリを入れ') ||
    g.includes('インストール') ||
    g.includes('アンインストール') ||
    g.includes('playストア') ||
    g.includes('ストアで')
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
    'インストール',
    '購入',
    '注文',
    'カート',
    '検索',
    '履歴',
    'ファイル',
  ]);
}

function emailStep(o: string, raw: string): StepCore {
  if (o.includes('送信') || o.includes('送る')) {
    return withSeen(
      'email-confirm-send',
      'email-pre-send',
      '宛先と内容を確かめてから「送信」を押してください。',
      '宛先と本文を確かめてから送信を押してください。代わりには送りません。',
      raw,
      ['送信', '送る'],
    );
  }
  if (o.includes('作成') || o.includes('新規') || o.includes('書き込み')) {
    return withSeen(
      'email-compose',
      'email-compose',
      '宛先と用件を入れてください。',
      'メール作成画面です。宛先と用件を入れてください。代わりには入力しません。',
      raw,
      ['作成', '新規', '宛先'],
    );
  }
  if (o.includes('受信') || o.includes('受信トレイ') || o.includes('inbox')) {
    return withSeen(
      'email-inbox',
      'email-inbox',
      '開きたいメールを一つ選んでください。',
      '受信トレイから、開きたいメールを一つ選んでください。',
      raw,
      ['受信', '受信トレイ'],
    );
  }
  return ocrGroundedOr(raw, {
    stepId: 'email-open',
    stageId: 'email-start',
    displayText: 'メールアプリを開いてください。',
    voiceText: 'メールアプリを開き、やりたい画面まで進めてください。',
  });
}

function browserStep(o: string, raw: string): StepCore {
  if (o.includes('検索') || o.includes('google') || o.includes('アドレス')) {
    return withSeen(
      'browser-search',
      'browser-search',
      '調べたい言葉を入れて検索してください。',
      '検索欄に調べたい言葉を入れてください。代わりには入力しません。',
      raw,
      ['検索', 'Google'],
    );
  }
  return ocrGroundedOr(raw, {
    stepId: 'browser-open',
    stageId: 'browser-start',
    displayText: 'ブラウザを開いてください。',
    voiceText: 'ブラウザを開き、調べたいページへ進めてください。',
  });
}

function shoppingStep(o: string, raw: string): StepCore {
  if (o.includes('購入') || o.includes('注文を確定') || o.includes('支払い')) {
    return withSeen(
      'shop-confirm-pay',
      'shop-pay',
      '金額と届け先を確かめてから、ご自身で進めてください。',
      '購入や支払いは、内容を確かめてからご自身で押してください。代わりには買いません。',
      raw,
      ['購入', '注文を確定', '支払い'],
    );
  }
  if (o.includes('カート') || o.includes('かご')) {
    return withSeen(
      'shop-cart',
      'shop-cart',
      'カートの中身を確かめてください。',
      'カートの商品を確かめてください。購入は急がなくて大丈夫です。',
      raw,
      ['カート', 'かご'],
    );
  }
  return ocrGroundedOr(raw, {
    stepId: 'shop-open',
    stageId: 'shop-start',
    displayText: '買い物アプリを開いてください。',
    voiceText:
      '買い物アプリを開き、見たい商品まで進めてください。購入はご自身で確認してから。',
  });
}

function photoPickerStep(o: string, raw: string): StepCore {
  if (
    o.includes('アルバム') ||
    o.includes('ギャラリー') ||
    o.includes('最近の項目') ||
    o.includes('ファイル') ||
    o.includes('ドキュメント')
  ) {
    return withSeen(
      'picker-choose',
      'picker-grid',
      '送りたい写真やファイルを一つ選んでください。',
      '一覧から、使いたい写真やファイルを一つだけ選んでください。',
      raw,
      ['アルバム', 'ギャラリー', '最近の項目', 'ファイル', 'ドキュメント'],
    );
  }
  if (o.includes('許可')) {
    return withSeen(
      'picker-permission',
      'picker-permission',
      '写真へのアクセスを、必要な方だけ選んでください。',
      '写真やファイルへの許可画面です。必要な方を、ご自身で選んでください。代わりには押しません。',
      raw,
      ['許可する', '許可しない', '写真'],
    );
  }
  return ocrGroundedOr(raw, {
    stepId: 'picker-open',
    stageId: 'picker-start',
    displayText: '写真やファイルを選ぶ画面を開いてください。',
    voiceText: '写真やファイルを選ぶ画面を開いて、一つ選んでください。',
  });
}

function installStep(o: string, raw: string): StepCore {
  if (o.includes('アンインストール') || o.includes('削除')) {
    return withSeen(
      'install-uninstall',
      'install-uninstall',
      '消してよいアプリか確かめてから進めてください。',
      'アンインストールは取り消せないことがあります。確かめてから、ご自身で進めてください。',
      raw,
      ['アンインストール', '削除'],
    );
  }
  if (o.includes('インストール') || o.includes('入手') || o.includes('更新')) {
    return withSeen(
      'install-confirm',
      'install-confirm',
      'アプリ名を確かめてから「インストール」を押してください。',
      'アプリの名前を確かめてから、インストールを押してください。代わりには押しません。',
      raw,
      ['インストール', '入手', '更新'],
    );
  }
  return ocrGroundedOr(raw, {
    stepId: 'install-open',
    stageId: 'install-start',
    displayText: 'Playストアを開いてください。',
    voiceText: 'Playストアを開き、入れたいアプリを探してください。',
  });
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
  const { region, ordinal } = estimateRegionFromOcr(raw, seen);
  const where =
    ordinal != null
      ? `画面の${region}（上から${ordinal}番目付近）の「${seen}」`
      : `画面の${region}あたりの「${seen}」`;
  return {
    stepId,
    stageId,
    displayText: `${where}です。${display}`.slice(0, 120),
    voiceText: `いま${where}と見えます。${voice}`,
  };
}

function ocrGroundedOr(raw: string, generic: StepCore): StepCore {
  const label = firstUiLabel(raw);
  if (!label) {
    return finalizeConcrete(generic, raw);
  }
  const { region, ordinal } = estimateRegionFromOcr(raw, label);
  const tap = formatTapInstruction({ label, region, ordinal });
  return {
    stepId: `${generic.stepId}-ocr`,
    stageId: generic.stageId,
    displayText: tap.displayText,
    voiceText: tap.voiceText,
  };
}

function ocrGroundedFallback(raw: string, goalSummary: string): StepCore {
  const concrete = buildConcreteOpsStep({
    ocrText: raw,
    preferredLabels: [
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
      '友だち',
      '設定',
      '検索',
      '履歴',
    ],
    scrollTargetLabel: undefined,
    goalSummary,
    stepId: 'ocr-tap-label',
    stageId: 'ocr-grounded',
  });
  return {
    stepId: concrete.stepId,
    stageId: concrete.stageId,
    displayText: concrete.displayText,
    voiceText: concrete.voiceText,
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
  if (o.includes('設定') || o.includes('ネットワークとインターネット')) {
    if (raw.includes('Wi-Fi') || raw.includes('Wi‑Fi') || o.includes('wifi')) {
      const label = firstMatch(raw, ['Wi-Fi', 'Wi‑Fi', 'ネットワークとインターネット']) ?? 'Wi-Fi';
      const { region, ordinal } = estimateRegionFromOcr(raw, label);
      const tap = formatTapInstruction({ label, region, ordinal }, '接続');
      return {
        stepId: 'wifi-open-from-settings',
        stageId: 'wifi-settings',
        displayText: tap.displayText,
        voiceText: tap.voiceText,
      };
    }
    const scroll = formatScrollInstruction('Wi-Fi', '下へ');
    return {
      stepId: 'wifi-scroll-for-label',
      stageId: 'wifi-settings',
      displayText: scroll.displayText,
      voiceText: scroll.voiceText,
    };
  }
  const home = buildConcreteOpsStep({
    ocrText: raw,
    preferredLabels: ['設定', 'Settings'],
    scrollTargetLabel: '設定',
    goalSummary: 'Wi-Fi',
    stepId: 'wifi-open',
    stageId: 'wifi-start',
    nextLookFor: 'Wi-Fi',
  });
  return {
    stepId: home.stepId,
    stageId: home.stageId,
    displayText: home.displayText,
    voiceText: home.voiceText,
  };
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

function settingsStep(o: string, raw: string, goalNormalized: string): StepCore {
  const wantsNotify =
    goalNormalized.includes('通知') || o.includes('通知');
  if (o.includes('通知') && (o.includes('オン') || o.includes('オフ') || o.includes('許可'))) {
    const label =
      firstMatch(raw, ['通知', 'オン', 'オフ', '許可']) ?? '通知';
    const { region, ordinal } = estimateRegionFromOcr(raw, label);
    const tap = formatTapInstruction(
      { label, region, ordinal },
      'オンまたはオフ',
    );
    return {
      stepId: 'settings-notify-toggle',
      stageId: 'settings-notify',
      displayText: tap.displayText,
      voiceText: `${tap.voiceText} オンとオフのどちらにするか、ご自身で決めてください。`,
    };
  }
  if (wantsNotify) {
    if (raw.includes('通知')) {
      const { region, ordinal } = estimateRegionFromOcr(raw, '通知');
      const tap = formatTapInstruction({ label: '通知', region, ordinal });
      return {
        stepId: 'settings-notify',
        stageId: 'settings-notify-list',
        displayText: tap.displayText,
        voiceText: tap.voiceText,
      };
    }
    const scroll = formatScrollInstruction('通知', '下へ');
    return {
      stepId: 'settings-notify-scroll',
      stageId: 'settings-home',
      displayText: scroll.displayText,
      voiceText: scroll.voiceText,
    };
  }

  // Goal-aware preferred labels from common Android settings
  const preferred = [
    'ネットワークとインターネット',
    '通知',
    'Wi-Fi',
    'Wi‑Fi',
    'アプリ',
    '電池',
    'ディスプレイ',
    '音',
    'セキュリティ',
    'システム',
    '設定',
  ];
  const goalHint = [
    goalNormalized.includes('wifi') || goalNormalized.includes('ワイファイ')
      ? 'Wi-Fi'
      : null,
    goalNormalized.includes('通知') ? '通知' : null,
    goalNormalized.includes('音') ? '音' : null,
    goalNormalized.includes('画面') || goalNormalized.includes('明る')
      ? 'ディスプレイ'
      : null,
    goalNormalized.includes('アプリ') ? 'アプリ' : null,
  ].filter(Boolean) as string[];

  const concrete = buildConcreteOpsStep({
    ocrText: raw,
    preferredLabels: [...goalHint, ...preferred],
    scrollTargetLabel: goalHint[0] ?? '通知',
    goalSummary: goalNormalized,
    stepId: 'settings-open',
    stageId: 'settings-home',
  });
  return {
    stepId: concrete.stepId,
    stageId: concrete.stageId,
    displayText: concrete.displayText,
    voiceText: concrete.voiceText,
  };
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

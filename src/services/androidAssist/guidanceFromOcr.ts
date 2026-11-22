import type { FeatureId } from '../../types/navigation';
import type { AndroidAssistGuidance } from './types';

type StepCore = Omit<AndroidAssistGuidance, 'at' | 'ocrTextPreview' | 'mode'>;

/**
 * Stage-aware JS guidance (mirrors native AssistGuidanceRules).
 * Always mode demo — never live AI while Llama is disconnected.
 */
export function buildGuidanceFromOcrText(input: {
  featureId: FeatureId;
  goalSummary: string;
  ocrText: string;
}): AndroidAssistGuidance {
  const goal = normalize(input.goalSummary);
  const ocrRaw = input.ocrText.trim();
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
    return base({
      stepId: 'safety-review',
      stageId: 'safety',
      displayText: '番号や文言をよく見てください。',
      voiceText:
        '画面の番号や文言をゆっくり確認してください。安全だと決めつけないでください。',
    });
  }

  if (input.featureId === 'textExplanation') {
    return base({
      stepId: 'explain-read',
      stageId: 'explain',
      displayText: '画面の文を読みました。分からなければ「分かりません」。',
      voiceText:
        'いまの画面の文字を読みました。難しいときはアプリに戻って「分かりません」を押してください。',
    });
  }

  if (looksLikeLinePhotoGoal(goal)) {
    return base(linePhotoStep(o));
  }
  if (looksLikeWifiGoal(goal)) {
    return base(wifiStep(o));
  }
  if (looksLikePhoneGoal(goal)) {
    return base(phoneStep(o));
  }
  if (looksLikeSettingsGoal(goal)) {
    return base(settingsStep(o));
  }

  return base({
    stepId: 'ask-clarify',
    stageId: 'clarify',
    displayText: 'やりたいことを一つ教えてください。',
    voiceText:
      'いまの画面で、何をしたいか一つだけ教えてください。LINEの写真送信だとは決めつけません。',
  });
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

function wifiStep(o: string): StepCore {
  if (o.includes('接続済み') || o.includes('接続されています')) {
    return {
      stepId: 'wifi-connected',
      stageId: 'wifi-connected',
      displayText: 'つながっているようです。終わってよければ終了してください。',
      voiceText:
        'Wi-Fiにつながっているようです。ほかにやることがなければ、終了してください。',
    };
  }
  if (o.includes('パスワード') || o.includes('入力')) {
    return {
      stepId: 'wifi-password',
      stageId: 'wifi-password',
      displayText: 'パスワードを入力してください。',
      voiceText: '控えたWi-Fiのパスワードを入力してください。よりそいAIは代わりに入力しません。',
    };
  }
  if (
    o.includes('wi-fi') ||
    o.includes('wifi') ||
    o.includes('ワイファイ') ||
    o.includes('ネットワーク')
  ) {
    return {
      stepId: 'wifi-pick',
      stageId: 'wifi-list',
      displayText: '使いたいWi-Fiの名前を選んでください。',
      voiceText: '一覧から、使いたいWi-Fiの名前を一つ選んでください。',
    };
  }
  if (o.includes('設定')) {
    return {
      stepId: 'wifi-open-from-settings',
      stageId: 'wifi-settings',
      displayText: '「Wi-Fi」を開いてください。',
      voiceText: '設定の中のWi-Fiを押してください。',
    };
  }
  return {
    stepId: 'wifi-open',
    stageId: 'wifi-start',
    displayText: '設定からWi-Fiを開いてください。',
    voiceText: '設定アプリを開き、Wi-Fiを選んでください。',
  };
}

function phoneStep(o: string): StepCore {
  if (o.includes('通話') || o.includes('発信') || o.includes('着信中')) {
    return {
      stepId: 'phone-review',
      stageId: 'phone-active',
      displayText: '番号をよく見てから選んでください。',
      voiceText:
        '画面の番号をよく見てください。知らない番号なら、急がなくて大丈夫です。',
    };
  }
  if (o.includes('履歴') || o.includes('着信') || o.includes('発信')) {
    return {
      stepId: 'phone-log',
      stageId: 'phone-log',
      displayText: '確認したい番号を選んでください。',
      voiceText: '履歴から、確認したい番号を一つ選んでください。',
    };
  }
  return {
    stepId: 'phone-open',
    stageId: 'phone-start',
    displayText: '電話アプリを開いてください。',
    voiceText: '電話アプリを開き、確認したい番号が出るところまで進めてください。',
  };
}

function settingsStep(o: string): StepCore {
  if (o.includes('通知') && (o.includes('オン') || o.includes('オフ') || o.includes('許可'))) {
    return {
      stepId: 'settings-notify-toggle',
      stageId: 'settings-notify',
      displayText: '通知のスイッチを合わせてください。',
      voiceText: '通知のオン・オフを、必要な方へ合わせてください。一度に一つです。',
    };
  }
  if (o.includes('通知')) {
    return {
      stepId: 'settings-notify',
      stageId: 'settings-notify-list',
      displayText: '「通知」を開いてください。',
      voiceText: '一覧から通知を開いてください。',
    };
  }
  return {
    stepId: 'settings-open',
    stageId: 'settings-home',
    displayText: '直したい項目を一つ開いてください。',
    voiceText: '設定で、直したい項目を一つだけ開いてください。',
  };
}

function linePhotoStep(o: string): StepCore {
  if (hasClearSentConfirmation(o)) {
    return {
      stepId: 'line-ask-done',
      stageId: 'line-ask-done',
      displayText: '送れたか確認してください。',
      voiceText:
        '写真が送れたか、相手の名前と一緒に確認してください。分からなければアプリに戻ってください。',
    };
  }
  if (o.includes('送信') || o.includes('送る')) {
    return {
      stepId: 'line-confirm-send',
      stageId: 'line-pre-send',
      displayText: '確かめてから「送信」を押してください。',
      voiceText:
        '写真と相手を確かめてから、送信を押してください。代わりには押しません。',
    };
  }
  if (o.includes('既読') || o.includes('取り消')) {
    return {
      stepId: 'line-confirm-send',
      stageId: 'line-pre-send',
      displayText: '送れても自動では終わりません。確かめてください。',
      voiceText:
        '送信や既読だけでは送れたとは決めつけません。画面を確かめてください。',
    };
  }
  if (
    o.includes('アルバム') ||
    o.includes('ギャラリー') ||
    o.includes('画像を選択') ||
    o.includes('最近の項目') ||
    o.includes('すべての写真')
  ) {
    return {
      stepId: 'line-pick-photo',
      stageId: 'line-album',
      displayText: '送りたい写真を一つ選んでください。',
      voiceText: '送りたい写真を一つだけ選んでください。',
    };
  }
  if (o.includes('カメラ') && (o.includes('アルバム') || o.includes('画像') || o.includes('写真'))) {
    return {
      stepId: 'line-choose-album',
      stageId: 'line-album-choice',
      displayText: '「アルバム」や「画像」を選んでください。',
      voiceText: 'カメラではなく、アルバムや画像を選んでください。',
    };
  }
  if (o.includes('添付') || (o.includes('写真') && o.includes('選択'))) {
    return {
      stepId: 'line-open-attach',
      stageId: 'line-chat',
      displayText: '写真ボタン（＋など）を押してください。',
      voiceText: 'トーク画面の、写真やプラスのボタンを押してください。',
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
      displayText: '写真ボタンを探して押してください。',
      voiceText:
        '孫とのトーク画面です。下の写真やプラスを探して押してください。',
    };
  }
  if (
    o.includes('チャット一覧') ||
    o.includes('友だち') ||
    (o.includes('ホーム') && !o.includes('トークルーム'))
  ) {
    return {
      stepId: 'line-pick-friend',
      stageId: 'line-friends',
      displayText: '孫の名前のトークを開いてください。',
      voiceText: '友だち一覧から、孫の名前を選んでください。',
    };
  }
  if (o.includes('line') || o.includes('ライン')) {
    return {
      stepId: 'line-open',
      stageId: 'line-home',
      displayText: 'まず LINE を開いてください。',
      voiceText: '緑のLINEアプリを開いてください。',
    };
  }
  return {
    stepId: 'line-start',
    stageId: 'line-start',
    displayText: 'LINEを開き、孫のトークへ進みます。',
    voiceText: 'LINEを開き、孫のトークを選んでください。一度に一つです。',
  };
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '');
}

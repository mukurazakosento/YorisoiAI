import type { FeatureId } from '../../types/navigation';
import type { AndroidAssistGuidance } from './types';

type StepCore = Omit<AndroidAssistGuidance, 'at' | 'ocrTextPreview' | 'mode'>;

/**
 * JS-side structured guidance from OCR deltas (mirrors native AssistGuidanceRules).
 * Always mode demo/offline — never label as live AI while Llama is disconnected.
 *
 * LINE photo steps only when the goal clearly asks to send a LINE photo.
 * Same stepId must not re-announce (see shouldAnnounceGuidanceStep).
 */
export function buildGuidanceFromOcrText(input: {
  featureId: FeatureId;
  goalSummary: string;
  ocrText: string;
}): AndroidAssistGuidance {
  const goal = normalize(input.goalSummary);
  const o = normalize(input.ocrText);
  const ocrRaw = input.ocrText.trim();

  const base = (step: StepCore): AndroidAssistGuidance => ({
    ...step,
    mode: 'demo',
    ocrTextPreview: ocrRaw.length > 120 ? `${ocrRaw.slice(0, 120)}…` : ocrRaw,
    at: Date.now(),
  });

  if (input.featureId === 'safetyCheck') {
    return base({
      stepId: 'safety-review',
      displayText: '画面の番号や文言をよく見てください。断定はしません。',
      voiceText:
        '画面に出ている番号や文言を、ゆっくり確認してください。安全だと決めつけず、分からなければ終了して相談してください。',
    });
  }

  if (input.featureId === 'textExplanation') {
    return base({
      stepId: 'explain-read',
      displayText: '画面の文を読み取りました。意味が分からなければ「分かりません」。',
      voiceText:
        'いまの画面の文字を読み取りました。難しい言葉があれば、アプリに戻って「分かりません」を押してください。',
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
    displayText: 'いまの画面で、やりたいことを一つ教えてください。',
    voiceText:
      'いまの画面で、何をしたいか一つだけ教えてください。分からなければアプリに戻って文字で書いてください。LINEの写真送信だとは決めつけません。',
  });
}

/** Same stepId → do not re-notify / re-speak. */
export function shouldAnnounceGuidanceStep(
  previousStepId: string | null | undefined,
  nextStepId: string,
): boolean {
  if (!nextStepId.trim()) {
    return false;
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
      displayText: 'つながっているようです。ほかにやることがなければ終了できます。',
      voiceText:
        'Wi-Fiにつながっているようです。ほかにやることがなければ、通知から支援を終了してください。',
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
      displayText: '使いたいWi-Fiの名前を選んでください。',
      voiceText:
        '一覧から、使いたいWi-Fiの名前を一つ選んでください。パスワードを聞かれたら、控えたものを入力します。',
    };
  }
  return {
    stepId: 'wifi-open',
    displayText: '設定からWi-Fiを開いてください。',
    voiceText:
      '設定アプリを開き、Wi-Fiを選んでください。よりそいAIは代わりに押しません。',
  };
}

function phoneStep(o: string): StepCore {
  if (o.includes('通話') || o.includes('発信') || o.includes('着信')) {
    return {
      stepId: 'phone-review',
      displayText: '番号をよく見てから、かけるか切るか選んでください。',
      voiceText:
        '画面の番号をよく見てください。知らない番号なら、急いでかけなくて大丈夫です。',
    };
  }
  return {
    stepId: 'phone-open',
    displayText: '電話アプリで、確認したい番号の画面を開いてください。',
    voiceText: '電話アプリを開き、確認したい番号が出るところまで進めてください。',
  };
}

function settingsStep(o: string): StepCore {
  if (o.includes('通知')) {
    return {
      stepId: 'settings-notify',
      displayText: '通知のスイッチを、必要な方へ合わせてください。',
      voiceText:
        '通知の項目を開き、オンやオフを必要な方へ合わせてください。一度に一つです。',
    };
  }
  return {
    stepId: 'settings-open',
    displayText: '設定で、直したい項目を一つ開いてください。',
    voiceText:
      '設定アプリで、直したい項目を一つだけ開いてください。分からなければアプリに戻って聞いてください。',
  };
}

function linePhotoStep(o: string): StepCore {
  if (hasClearSentConfirmation(o)) {
    return {
      stepId: 'line-ask-done',
      displayText: '送れたか確認してください。分からなければアプリに戻ります。',
      voiceText:
        '写真が送れたか、相手の名前と一緒に確認してください。はっきり分からなければ、送れましたとは決めつけず、アプリに戻って「できました」か「分かりません」を押してください。',
    };
  }
  if (
    o.includes('送信') ||
    o.includes('送る') ||
    o.includes('既読') ||
    o.includes('取り消')
  ) {
    return {
      stepId: 'line-confirm-send',
      displayText:
        '内容を確かめてから「送信」を押してください。送れても自動では終わりません。',
      voiceText:
        '写真と相手の名前を確かめてから、送信を押してください。送信や既読の文字だけでは、送れたとは決めつけません。よりそいAIは代わりに押しません。',
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
      displayText: '送りたい写真を一つ選んでください。',
      voiceText: '送りたい写真を一つだけ選んでください。選んだら次の案内を待ちます。',
    };
  }
  if (o.includes('カメラ') && (o.includes('アルバム') || o.includes('画像') || o.includes('写真'))) {
    return {
      stepId: 'line-choose-album',
      displayText: '「アルバム」や「画像」を選んでください。',
      voiceText:
        'カメラではなく、アルバムや画像を選んでください。孫に送る写真は、すでに撮ったものを使うことが多いです。',
    };
  }
  if (
    o.includes('添付') ||
    o.includes('アルバム') ||
    o.includes('ギャラリー') ||
    (o.includes('写真') && o.includes('選択'))
  ) {
    return {
      stepId: 'line-open-attach',
      displayText: '写真を付けるボタン（＋など）を押してください。',
      voiceText:
        'トーク画面の、写真を付けるボタンやプラスを押してください。よりそいAIは代わりに押しません。',
    };
  }
  if (
    o.includes('トーク') ||
    o.includes('トークルーム') ||
    (o.includes('メッセージ') && !o.includes('ホーム'))
  ) {
    return {
      stepId: 'line-in-talk',
      displayText: '孫とのトークを開いたまま、写真ボタンを探してください。',
      voiceText:
        '孫とのトーク画面です。下のほうにある写真やプラスのボタンを探して押してください。',
    };
  }
  if (o.includes('ホーム') || o.includes('友だち') || o.includes('チャット一覧')) {
    return {
      stepId: 'line-pick-friend',
      displayText: '孫の名前のトークを開いてください。',
      voiceText: '友だち一覧から、孫の名前を選んでトークを開いてください。',
    };
  }
  if (o.includes('line') || o.includes('ライン')) {
    return {
      stepId: 'line-open',
      displayText: 'まず LINE を開き、孫のトークを選んでください。',
      voiceText:
        '緑のLINEアプリを開き、孫の名前のトークを選んでください。開けたらそのままで大丈夫です。',
    };
  }
  return {
    stepId: 'line-start',
    displayText: 'LINEを開き、孫のトークから写真を送ります。',
    voiceText:
      'LINEを開き、孫のトークを選んでから写真を一つ付けてください。一度に一つです。勝手には送りません。',
  };
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '');
}

import type { FeatureId } from '../../types/navigation';
import type { AndroidAssistGuidance } from './types';

/**
 * JS-side structured guidance from OCR deltas (mirrors native AssistGuidanceRules).
 * Always mode demo/offline — never label as live AI while Llama is disconnected.
 */
export function buildGuidanceFromOcrText(input: {
  featureId: FeatureId;
  goalSummary: string;
  ocrText: string;
}): AndroidAssistGuidance {
  const goal = input.goalSummary.trim();
  const ocr = input.ocrText.trim();
  const n = `${goal} ${ocr}`.toLowerCase().replace(/\s+/g, '');
  const o = ocr.replace(/\s+/g, '');

  const base = (step: Omit<AndroidAssistGuidance, 'at' | 'ocrTextPreview' | 'mode'>): AndroidAssistGuidance => ({
    ...step,
    mode: 'demo',
    ocrTextPreview: ocr.length > 120 ? `${ocr.slice(0, 120)}…` : ocr,
    at: Date.now(),
  });

  if (input.featureId === 'operationSupport' || looksLikeLinePhotoGoal(n)) {
    return base(linePhotoStep(o, n));
  }

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

  return base({
    stepId: 'generic-one',
    displayText: '近いボタンを、一つだけ押してください。',
    voiceText:
      '画面の中で、やりたいことにいちばん近いボタンを一つだけ押してください。勝手には操作しません。',
  });
}

function looksLikeLinePhotoGoal(n: string): boolean {
  const line = n.includes('line') || n.includes('ライン') || n.includes('らいん');
  const photo = n.includes('写真') || n.includes('画像') || n.includes('アルバム');
  const send = n.includes('送') || n.includes('孫') || n.includes('トーク');
  return line && (photo || send);
}

function linePhotoStep(
  o: string,
  goal: string,
): Omit<AndroidAssistGuidance, 'at' | 'ocrTextPreview' | 'mode'> {
  if (o.includes('送信') && (o.includes('取り消') || o.includes('完了') || o.includes('既読'))) {
    return {
      stepId: 'line-done',
      displayText: '送れました。ほかにやることがなければ支援を終了できます。',
      voiceText:
        '写真が送れたようです。ほかにやることがなければ、通知かアプリから支援を終了してください。',
    };
  }
  if (o.includes('送信') || o.includes('送る')) {
    return {
      stepId: 'line-confirm-send',
      displayText: '内容を確かめてから「送信」を押してください。',
      voiceText:
        '写真と相手の名前を確かめてから、送信を押してください。よりそいAIは代わりに押しません。',
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
    o.includes('+') ||
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
  if (o.includes('トーク') || o.includes('トークルーム') || (o.includes('メッセージ') && !o.includes('ホーム'))) {
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
  if (o.includes('LINE') || o.includes('ライン') || goal.includes('line') || goal.includes('ライン')) {
    return {
      stepId: 'line-open',
      displayText: 'まず LINE を開き、孫のトークを選んでください。',
      voiceText:
        '緑のLINEアプリを開き、孫の名前のトークを選んでください。開けたらそのままで大丈夫です。',
    };
  }
  return {
    stepId: 'line-generic',
    displayText: 'LINEで孫のトークを開き、写真を付けて送ります。',
    voiceText:
      'LINEで孫のトークを開き、写真を一つ選んでから送信してください。一度に一つです。勝手には送りません。',
  };
}

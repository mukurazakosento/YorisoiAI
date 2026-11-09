import type { AiResponse } from '../../types/ai';
import type { FeatureId } from '../../types/navigation';
import {
  buildDemoGuidanceResponse,
  type GuidanceDemoInput,
} from './guidanceDemo';
import type { ConsultHistoryTurn, GuidanceAction } from './types';

export type DemoConsultInput = {
  featureId: FeatureId;
  text: string;
  choiceLabel?: string;
  history?: ConsultHistoryTurn[];
  guidanceAction?: GuidanceAction;
};

const DEMO_PREFIX = '【デモ・AI未接続】';

/**
 * Firebase / Gemini 未設定時の明示デモ応答。
 * ライブ AI のふりをせず、ラベル付きのフォールバック選択肢を返す。
 * 操作支援で問題が特定できたら 1 ステップ案内へ進む。
 */
export function buildDemoConsultationResponse(
  input: DemoConsultInput,
): AiResponse {
  const guidanceInput: GuidanceDemoInput = {
    featureId: input.featureId,
    text: input.text,
    choiceLabel: input.choiceLabel,
    history: input.history,
    guidanceAction: input.guidanceAction,
  };

  // 案内中のアクション、または具体問題の自動開始
  const guidance = buildDemoGuidanceResponse(guidanceInput);
  if (guidance) {
    return guidance;
  }

  const combined = `${input.choiceLabel ?? ''} ${input.text}`.trim();
  const normalized = combined.replace(/\s+/g, '');

  if (isVaguePhoneTrouble(normalized)) {
    return {
      status: 'need_more_info',
      mode: 'demo',
      message: `${DEMO_PREFIX} いまはAIにつながっていません。デモ用の案内です。もう少し具体的に教えてください。`,
      question: 'いま、いちばん困っていることはどれですか？',
      choices: [
        '動かない・固まる',
        '画面の文字が読めない',
        'アプリの使い方が分からない',
        '知らない連絡が来た',
        'その他',
      ],
      displayText: '困っていることを一つ選んでください。',
      voiceText:
        'スマートフォンのどこが変なのか、もう少し教えてください。下の中から近いものを選んでも大丈夫です。',
    };
  }

  if (isLineTrouble(normalized) && !isConcreteLineIssue(normalized)) {
    return {
      status: 'need_more_info',
      mode: 'demo',
      message: `${DEMO_PREFIX} LINEのどの部分で困っているか、まだはっきりしません。`,
      question: 'LINEのどんなことで困っていますか？',
      choices: [
        '通知が届かない',
        '通知が多すぎる',
        'LINEが開かない',
        'メッセージが送れない',
        'その他の問題',
      ],
      displayText: 'LINEの困りごとを選んでください。',
      voiceText:
        'LINEで困っている内容を、下の選択肢から選んでください。近いものがなければ、その他の問題を押してください。',
    };
  }

  if (input.featureId === 'textExplanation') {
    return {
      status: 'need_more_info',
      mode: 'demo',
      message: `${DEMO_PREFIX} 文章解説のデモです。実際のAI解説にはまだつながっていません。`,
      question: 'どの種類の表示ですか？',
      choices: [
        '許可しますか？と出た',
        'インストールの確認',
        '専門用語が分からない',
        'その他の文章',
      ],
      displayText: '表示の種類を選んでください。',
    };
  }

  if (input.featureId === 'safetyCheck') {
    return {
      status: 'need_more_info',
      mode: 'demo',
      message: `${DEMO_PREFIX} 安全性検査のデモです。「安全です」とは言いません。確認したいものを選んでください。`,
      question: '何を確認したいですか？',
      choices: [
        '知らない電話番号',
        'SMSの文章',
        'メールの文章',
        'URL（リンク）',
        'その他',
      ],
      displayText: '確認したいものを選んでください。',
      riskLevel: 'insufficient_info',
    };
  }

  if (input.featureId === 'operationSupport' && combined.length > 0) {
    return {
      status: 'ready_to_help',
      mode: 'demo',
      message: `${DEMO_PREFIX} 「${truncate(combined, 40)}」という相談として受け取りました。下の「案内を始める」で、デモの1ステップ案内を試せます。`,
      displayText: '案内の準備ができました。',
      voiceText:
        '相談内容を受け取りました。案内を始めるを押すと、操作を一つずつ案内します。本物のAIではありません。',
      choices: [
        '案内を始める',
        'もう少し詳しく話す',
        '別のことで相談する',
        '最初の選択肢に戻る',
      ],
    };
  }

  if (combined.length > 0) {
    return {
      status: 'ready_to_help',
      mode: 'demo',
      message: `${DEMO_PREFIX} 「${truncate(combined, 40)}」という相談として受け取りました。本番のAI案内は、FirebaseとGeminiを設定すると使えます。`,
      displayText: 'デモ用に相談を受け取りました。',
      choices: [
        'もう少し詳しく話す',
        '別のことで相談する',
        '最初の選択肢に戻る',
      ],
    };
  }

  return {
    status: 'need_more_info',
    mode: 'demo',
    message: `${DEMO_PREFIX} 文章を書くか、下のデモ用選択肢を押してください。`,
    question: '何について相談しますか？',
    choices: [
      '操作のやり方',
      '画面の文章の意味',
      '電話やメールの心配',
      'その他',
    ],
    displayText: '相談の種類を選んでください。',
  };
}

function isLineTrouble(normalized: string): boolean {
  return (
    normalized.includes('LINE') ||
    normalized.includes('ライン') ||
    normalized.includes('らいん')
  );
}

function isConcreteLineIssue(normalized: string): boolean {
  return (
    normalized.includes('通知') ||
    normalized.includes('開かない') ||
    normalized.includes('送れない') ||
    normalized.includes('多すぎ')
  );
}

function isVaguePhoneTrouble(normalized: string): boolean {
  const vaguePatterns = [
    'スマホが変',
    'スマホがおかしい',
    '携帯が変',
    'よく分からない',
    'わからない',
    '変になった',
    'おかしくなった',
  ];
  return vaguePatterns.some((pattern) => normalized.includes(pattern));
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}…`;
}

import type { AiResponse } from '../../types/ai';
import {
  detectScamPatterns,
  extractPhoneCandidates,
  extractUrls,
  normalizePhoneDigits,
  scamPatternLabels,
} from '../security';
import {
  buildFakePoliceEmailExplanation,
  detectFakePolicePatterns,
  isFakePoliceStyle,
} from '../security/fakePoliceEmail';
import type { ConsultHistoryTurn, SafetyAction } from './types';

const DEMO_PREFIX = '【デモ・AI未接続】';

export type SafetyDemoInput = {
  text: string;
  choiceLabel?: string;
  history?: ConsultHistoryTurn[];
  safetyAction?: SafetyAction;
  searchConsent?: boolean;
};

/**
 * 安全性検査のデモ応答。
 * 「安全です」とは言わない。情報不足は insufficient_info。
 * 出典URLは捏造しない（デモでは sources を空にするか、無い旨を明示）。
 */
export function buildDemoSafetyResponse(
  input: SafetyDemoInput,
): AiResponse | null {
  const combined = `${input.choiceLabel ?? ''} ${input.text}`.trim();
  const normalized = combined.replace(/\s+/g, '');

  if (input.safetyAction === 'phone_search') {
    return buildPhoneSearchDemo(input);
  }

  if (input.safetyAction === 'message_analyze') {
    return buildMessageAnalyzeDemo(input);
  }

  if (!normalized) {
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

  if (isPhoneChoice(input.choiceLabel, normalized)) {
    const phones = extractPhoneCandidates(input.text);
    if (phones.length === 0) {
      return {
        status: 'need_more_info',
        mode: 'demo',
        message: `${DEMO_PREFIX} 電話番号を入力するか、着信履歴のスクリーンショットから文字を取り込んでください。調べる前に番号の確認と、公開情報検索への同意が必要です。`,
        question: '調べたい電話番号を教えてください。',
        displayText: '電話番号を入力・確認してください。',
        riskLevel: 'insufficient_info',
        choices: ['最初の選択肢に戻る'],
      };
    }

    return {
      status: 'need_more_info',
      mode: 'demo',
      message: `${DEMO_PREFIX} 番号「${phones[0].display}」を確認できました。公開情報を調べるには、下の同意のあと「この番号を公開情報で調べる」を押してください。氏名など余分な情報は送りません。`,
      question: 'この番号をインターネットの公開情報で調べてもよいですか？',
      displayText: '番号確認後、検索への同意が必要です。',
      riskLevel: 'insufficient_info',
      choices: ['番号を直す', '最初の選択肢に戻る'],
    };
  }

  if (isMessageChoice(input.choiceLabel, normalized)) {
    if (!input.text.trim()) {
      return {
        status: 'need_more_info',
        mode: 'demo',
        message: `${DEMO_PREFIX} SMSやメールの文章を貼るか、スクリーンショットから取り込んでください（画像そのものは送りません）。`,
        question: 'メッセージの文章を入力してください。',
        displayText: '確認したい文章を入力してください。',
        riskLevel: 'insufficient_info',
        choices: ['最初の選択肢に戻る'],
      };
    }
    return buildMessageAnalyzeDemo(input);
  }

  if (normalized.includes('URL') || normalized.includes('リンク')) {
    if (extractUrls(input.text).length === 0 && !input.text.includes('http')) {
      return {
        status: 'need_more_info',
        mode: 'demo',
        message: `${DEMO_PREFIX} 確認したいURL（リンク）を貼ってください。`,
        displayText: 'URLを入力してください。',
        riskLevel: 'insufficient_info',
        choices: ['最初の選択肢に戻る'],
      };
    }
    return buildMessageAnalyzeDemo(input);
  }

  if (combined.length > 0) {
    return {
      status: 'safety_result',
      mode: 'demo',
      riskLevel: 'insufficient_info',
      message: `${DEMO_PREFIX} いただいた内容だけでは、公開情報に基づく断定はできません。「安全です」とは言いません。`,
      displayText: '公開情報では判断できません',
      voiceText:
        'いまはデモのため、詳しい調査はできません。不審に感じたら、返信や個人情報の提供は控えてください。',
      recommendedActions: [
        '相手に返信しない',
        '個人情報や暗証番号を伝えない',
        '公式の電話番号や窓口から確認する',
      ],
      sources: [],
      choices: ['別の内容を確認する', '最初の選択肢に戻る'],
    };
  }

  return null;
}

function buildPhoneSearchDemo(input: SafetyDemoInput): AiResponse {
  if (!input.searchConsent) {
    return {
      status: 'need_more_info',
      mode: 'demo',
      message: `${DEMO_PREFIX} 電話番号の公開情報調査には、事前の同意が必要です。`,
      displayText: '検索への同意が必要です。',
      riskLevel: 'insufficient_info',
      question: 'この番号をインターネットの公開情報で調べてもよいですか？',
    };
  }

  const phone =
    extractPhoneCandidates(input.text)[0]?.display ||
    normalizePhoneDigits(input.text) ||
    input.text.trim();

  // デモでは実検索しない。情報なし＝安全、にはしない。出典も捏造しない。
  return {
    status: 'safety_result',
    mode: 'demo',
    riskLevel: 'insufficient_info',
    message: `${DEMO_PREFIX} 番号「${phone}」のデモ結果です。いまは公開情報の実検索をしていません。情報が無いことを安全の証拠にはしません。`,
    displayText: '公開情報では判断できません',
    voiceText:
      'デモのため、実際の検索結果はありません。知らない番号には個人情報を伝えず、必要なら公式の窓口に確認してください。',
    rationale:
      'AI未接続のため Google Search Grounding による調査は行っていません。',
    recommendedActions: [
      '相手に個人情報を伝えない',
      '折り返しは着信番号ではなく、公式に掲載された窓口へ',
      '不安なときは周囲の人や相談窓口にも話す',
    ],
    sources: [],
    choices: ['別の番号を調べる', '最初の選択肢に戻る'],
  };
}

function buildMessageAnalyzeDemo(input: SafetyDemoInput): AiResponse {
  const text = input.text.trim();
  const urls = extractUrls(text);
  const scamHits = detectScamPatterns(text);
  const labels = scamPatternLabels(scamHits);
  const fakePoliceHits = detectFakePolicePatterns(text);

  const urlChecks = urls.map((url) => ({
    url,
    status: 'not_configured' as const,
    message:
      'Web Risk の鍵がサーバーに無い、またはデモのため照合できませんでした。リンクは開かないでください。',
  }));

  if (isFakePoliceStyle(fakePoliceHits, scamHits)) {
    const explained = buildFakePoliceEmailExplanation({
      senderNote: '',
      fakeHits: fakePoliceHits,
      scamLabels: labels,
      prefix: DEMO_PREFIX,
    });
    return {
      status: 'safety_result',
      mode: 'demo',
      riskLevel: 'dangerous',
      message: explained.message,
      displayText: explained.displayText,
      voiceText: explained.voiceText,
      rationale: explained.rationale,
      recommendedActions: explained.recommendedActions,
      sources: [],
      urlChecks,
      choices: ['別の文章を確認する', '最初の選択肢に戻る'],
    };
  }

  if (scamHits.length >= 2) {
    return {
      status: 'safety_result',
      mode: 'demo',
      riskLevel: 'dangerous',
      message: `${DEMO_PREFIX} 詐欺の可能性が高いメールです。怪しいと考えられる理由: ${labels.join('。')}。安全に対応するには: URLを開かない。返信しない。個人情報を教えない。「安全です」とは言いません。`,
      displayText: '詐欺の可能性が高いメールです',
      voiceText:
        '詐欺の可能性が高いメールです。急かす表現やお金・個人情報の要求などが見つかりました。リンクは開かず、返信しないでください。',
      rationale: `怪しいと考えられる理由: ${labels.join('。')}`,
      recommendedActions: [
        'URLを開かない',
        '相手に返信しない',
        '暗証番号や認証コードを教えない',
        '金融機関や公的機関を名乗る場合は公式窓口から確認する',
        '不安なときは家族に相談する',
      ],
      sources: [],
      urlChecks,
      choices: ['別の文章を確認する', '最初の選択肢に戻る'],
    };
  }

  if (scamHits.length === 1 || urls.length > 0) {
    return {
      status: 'safety_result',
      mode: 'demo',
      riskLevel: 'caution',
      message: `${DEMO_PREFIX} 注意すべき点があります。危険と断定はしませんが、不用意な操作は避けてください。`,
      displayText: '注意が必要です',
      voiceText:
        '気になる点があります。リンクを開いたり個人情報を送ったりする前に、落ち着いて公式の案内と見比べてください。',
      rationale:
        labels.length > 0
          ? `デモ分析で検知: ${labels.join('、')}`
          : 'リンクが含まれています。',
      recommendedActions: [
        '不審なURLを開かない',
        'パスワードや認証コードを入力しない',
        '公式アプリや公式サイトの案内と照合する',
      ],
      sources: [],
      urlChecks,
      choices: ['別の文章を確認する', '最初の選択肢に戻る'],
    };
  }

  return {
    status: 'safety_result',
    mode: 'demo',
    riskLevel: 'insufficient_info',
    message: `${DEMO_PREFIX} 目立った危険な言い回しは見つかりませんでしたが、それだけで安全とは言いません。`,
    displayText: '公開情報では判断できません',
    voiceText:
      'はっきりした危険な特徴は見当たりませんでしたが、安全と断定はしません。少しでも不安なら返信や手続きを急がないでください。',
    recommendedActions: [
      '少しでも不審なら返信しない',
      'お金や個人情報の要求には応じない',
      '家族や公式窓口に相談する',
    ],
    sources: [],
    urlChecks,
    choices: ['別の文章を確認する', '最初の選択肢に戻る'],
  };
}

function isPhoneChoice(
  choiceLabel: string | undefined,
  normalized: string,
): boolean {
  return (
    choiceLabel === '知らない電話番号' ||
    choiceLabel === '知らない番号から電話があった' ||
    normalized.includes('電話番号') ||
    normalized.includes('知らない番号') ||
    extractPhoneCandidates(normalized).length > 0
  );
}

function isMessageChoice(
  choiceLabel: string | undefined,
  normalized: string,
): boolean {
  return (
    choiceLabel === 'SMSの文章' ||
    choiceLabel === 'メールの文章' ||
    choiceLabel === 'このSMSは大丈夫？' ||
    choiceLabel === 'このメールは大丈夫？' ||
    normalized.includes('SMS') ||
    normalized.includes('メール') ||
    normalized.includes('メッセージ')
  );
}

/**
 * 安全性チェック: 確認済み画面文字の端末内検査。
 * 画像は扱わない。「安全です」とは言わない。
 */

import type { AiResponse, AiRiskLevel } from '../../types/ai';
import { extractEmailCandidates } from './email';
import { extractPhoneCandidates, type PhoneCandidate } from './phone';
import { classifyJapanesePhoneNumber } from './phoneHeuristics';
import {
  detectScamPatterns,
  scamPatternLabels,
} from './scamPatterns';
import type { SafetyInspectMode } from './safetyMode';
import { extractUrls } from './urls';

const HEURISTIC_PREFIX = '【端末内の確認】';
const DEMO_PREFIX = '【デモ・実検索なし】';

export type SafetyInspectInput = {
  mode: SafetyInspectMode;
  /** 利用者が確認した画面文字のみ */
  text: string;
  /**
   * 電話の公開情報検索に同意したときだけ true。
   * 同意前は端末内ヒューリスティックのみ。
   */
  searchConsent?: boolean;
  /**
   * 任意の公開情報検索結果（legacy Cloud Functions 経由）。
   * 無いときは端末内結果だけを返す。
   */
  networkResult?: AiResponse | null;
  /** ネットワーク経路が使えない／未設定のとき */
  networkUnavailableReason?: string;
};

export type SafetyInspectResult = AiResponse & {
  /** 検出した電話番号（電話モード） */
  detectedPhones: PhoneCandidate[];
  /** 検出したメール（メールモード） */
  detectedEmails: string[];
  /** 検出ソースの説明 */
  detectionNote: string;
};

/**
 * 電話／メールモードに応じて端末内検査を行う。
 * 公開情報の実検索は networkResult があるときだけ混ぜる（捏造しない）。
 */
export function inspectSafetyText(
  input: SafetyInspectInput,
): SafetyInspectResult {
  const text = (input.text ?? '').trim();
  if (input.mode === 'phone') {
    return inspectPhone(text, input);
  }
  return inspectEmail(text, input);
}

function inspectPhone(
  text: string,
  input: SafetyInspectInput,
): SafetyInspectResult {
  const phones = extractPhoneCandidates(text);
  if (phones.length === 0) {
    return {
      status: 'need_more_info',
      mode: 'demo',
      riskLevel: 'insufficient_info',
      message: `${HEURISTIC_PREFIX} 画面の文字から電話番号を見つけられませんでした。番号が見える画面を開いてから、もう一度調べてください。`,
      displayText: '番号が見つかりませんでした',
      voiceText:
        '電話番号を見つけられませんでした。着信履歴など、番号が見える画面を開いてから、もう一度調べてください。かけたり個人情報を伝えたりする必要はありません。',
      recommendedActions: [
        '電話アプリで番号が見える画面を開く',
        '番号を目で確認してから調べる',
        '知らない番号にすぐかけ直さない',
      ],
      sources: [],
      choices: [],
      detectedPhones: [],
      detectedEmails: [],
      detectionNote: '電話番号候補なし',
    };
  }

  const primary = phones[0];
  const classified = classifyJapanesePhoneNumber(primary.digits);

  // 同意後の公開情報結果があれば優先（ただし「安全です」は弾く）
  if (input.searchConsent && input.networkResult) {
    return mergeNetworkPhoneResult(primary, classified.kindLabel, input.networkResult);
  }

  const networkNote =
    input.networkUnavailableReason?.trim() ||
    (!input.searchConsent
      ? '公開情報のネット検索は、番号確認のあと同意したときだけ行います。'
      : '公開情報の実検索は、鍵や通信の準備が無いため行っていません。');

  const riskLevel: AiRiskLevel = 'insufficient_info';
  const modeLabel = input.searchConsent ? DEMO_PREFIX : HEURISTIC_PREFIX;

  return {
    status: 'safety_result',
    mode: 'demo',
    riskLevel,
    message: `${modeLabel} 番号「${primary.display}」は、${classified.kindLabel}です。${networkNote} 番号の形や端末内の手がかりだけでは「安全です」とは言いません。`,
    displayText: '公開情報では判断できません',
    voiceText: `番号は${classified.kindLabel}です。${classified.hints[0] ?? ''}安全とは言い切れません。お金や個人情報を求められたら、特に注意してください。`,
    rationale: `${classified.hints.join(' ')} ${networkNote}`,
    recommendedActions: [
      '相手に個人情報を伝えない',
      '折り返しは着信番号ではなく、公式に掲載された窓口へ',
      '不安なときは周囲の人や相談窓口にも話す',
      ...(input.searchConsent
        ? []
        : ['必要なら、同意のうえで公開情報検索もできます']),
    ],
    sources: [],
    choices: [],
    detectedPhones: phones,
    detectedEmails: [],
    detectionNote: `電話番号 ${phones.length} 件（表示: ${primary.display}）`,
  };
}

function mergeNetworkPhoneResult(
  primary: PhoneCandidate,
  kindLabel: string,
  network: AiResponse,
): SafetyInspectResult {
  const riskLevel: AiRiskLevel =
    network.riskLevel ?? 'insufficient_info';
  const mode = network.mode ?? 'offline';
  const prefix =
    mode === 'live'
      ? '【公開情報の検索結果】'
      : mode === 'offline'
        ? '【AI未接続】'
        : DEMO_PREFIX;

  let message =
    network.message?.trim() ||
    `${prefix} 番号「${primary.display}」の調査結果です。`;
  if (/安全です/.test(message) && !/「安全です」とは言/.test(message)) {
    message = `${prefix} 番号「${primary.display}」について公開情報を調べました。安全と断定はできません。端末内では${kindLabel}と見えます。`;
  }

  return {
    status: 'safety_result',
    mode,
    riskLevel,
    message,
    displayText:
      network.displayText?.trim() ||
      (riskLevel === 'dangerous'
        ? '危険な特徴が見つかりました'
        : riskLevel === 'caution'
          ? '注意が必要です'
          : '公開情報では判断できません'),
    voiceText:
      network.voiceText?.trim() ||
      `番号「${primary.display}」の調査結果です。安全とは言い切れません。`,
    rationale:
      network.rationale?.trim() ||
      `端末内の番号種別: ${kindLabel}`,
    recommendedActions:
      network.recommendedActions && network.recommendedActions.length > 0
        ? network.recommendedActions
        : [
            '相手に個人情報を伝えない',
            '折り返しは公式の窓口へ',
            '不安なら家族や相談窓口に話す',
          ],
    sources: network.sources ?? [],
    urlChecks: network.urlChecks,
    choices: network.choices ?? [],
    detectedPhones: [primary],
    detectedEmails: [],
    detectionNote: `電話番号 ${primary.display} + 公開情報経路`,
  };
}

function inspectEmail(
  text: string,
  _input: SafetyInspectInput,
): SafetyInspectResult {
  if (!text) {
    return {
      status: 'need_more_info',
      mode: 'demo',
      riskLevel: 'insufficient_info',
      message: `${HEURISTIC_PREFIX} メールやメッセージの文章が見つかりませんでした。確認したいメールを開いてから調べてください。`,
      displayText: '文章が見つかりませんでした',
      voiceText:
        'メールの文章を見つけられませんでした。確認したいメールを開いてから、もう一度調べてください。リンクはまだ押さないでください。',
      recommendedActions: [
        'メールアプリで怪しいメールを開く',
        'リンクや添付はまだ開かない',
        '画面の文字を確認してから調べる',
      ],
      sources: [],
      detectedPhones: [],
      detectedEmails: [],
      detectionNote: 'メール本文なし',
    };
  }

  const emails = extractEmailCandidates(text);
  const urls = extractUrls(text);
  const scamHits = detectScamPatterns(text);
  const labels = scamPatternLabels(scamHits);

  const urlChecks = urls.map((url) => ({
    url,
    status: 'not_configured' as const,
    message:
      'Web Risk の鍵が無い、または端末内のみの確認のため照合していません。リンクは開かないでください。',
  }));

  const senderNote =
    emails.length > 0
      ? `差出人らしき文字「${emails[0].display}」が見えます。`
      : '差出人のメールアドレスは画面から特定できませんでした。';

  if (scamHits.length >= 2) {
    return {
      status: 'safety_result',
      mode: 'demo',
      riskLevel: 'dangerous',
      message: `${HEURISTIC_PREFIX} ${senderNote}詐欺でよく使われる特徴が複数見つかりました（${labels.join('、')}）。「安全です」とは言いません。`,
      displayText: '危険な特徴が見つかりました',
      voiceText:
        '急かす表現やお金・個人情報の要求など、危険な特徴が見つかりました。リンクは開かず、返信しないでください。',
      rationale: `端末内分析: ${labels.join('、')}`,
      recommendedActions: [
        'URLを開かない',
        '相手に返信しない',
        '暗証番号や認証コードを教えない',
        '金融機関や公的機関を名乗る場合は公式窓口から確認する',
      ],
      sources: [],
      urlChecks,
      detectedPhones: [],
      detectedEmails: emails.map((e) => e.display),
      detectionNote: `メール検査・危険特徴 ${scamHits.length} 件`,
    };
  }

  if (scamHits.length === 1 || urls.length > 0) {
    return {
      status: 'safety_result',
      mode: 'demo',
      riskLevel: 'caution',
      message: `${HEURISTIC_PREFIX} ${senderNote}注意すべき点があります。危険と断定はしませんが、不用意な操作は避けてください。`,
      displayText: '注意が必要です',
      voiceText:
        '気になる点があります。リンクを開いたり個人情報を送ったりする前に、落ち着いて公式の案内と見比べてください。',
      rationale:
        labels.length > 0
          ? `端末内分析: ${labels.join('、')}`
          : 'リンクが含まれています。',
      recommendedActions: [
        '不審なURLを開かない',
        'パスワードや認証コードを入力しない',
        '公式アプリや公式サイトの案内と照合する',
      ],
      sources: [],
      urlChecks,
      detectedPhones: [],
      detectedEmails: emails.map((e) => e.display),
      detectionNote: `メール検査・注意 ${Math.max(scamHits.length, urls.length)} 件`,
    };
  }

  return {
    status: 'safety_result',
    mode: 'demo',
    riskLevel: 'insufficient_info',
    message: `${HEURISTIC_PREFIX} ${senderNote}目立った危険な言い回しは見つかりませんでしたが、それだけで安全とは言いません。`,
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
    detectedPhones: [],
    detectedEmails: emails.map((e) => e.display),
    detectionNote: 'メール検査・目立った危険特徴なし',
  };
}

/**
 * 検査結果を支援セッションの一手（表示＋音声）に落とす。
 * スクロール禁止のため、画面は短い displayText 中心。
 */
export function safetyResultToSessionSteps(result: SafetyInspectResult): {
  displayText: string;
  voiceText: string;
  simplifyDisplayText: string;
  simplifyVoiceText: string;
}[] {
  const display =
    result.displayText?.trim() ||
    result.message?.trim() ||
    '確認結果を表示します';
  const voice =
    result.voiceText?.trim() ||
    result.message?.trim() ||
    display;
  const actions =
    result.recommendedActions && result.recommendedActions.length > 0
      ? `次にできること: ${result.recommendedActions.slice(0, 3).join('。')}。`
      : '';

  return [
    {
      displayText: clip(display, 42),
      voiceText: `${voice} ${actions}「安全です」とは言いません。`.trim(),
      simplifyDisplayText: clip(display, 28),
      simplifyVoiceText: clip(voice, 80),
    },
  ];
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) {
    return t;
  }
  return `${t.slice(0, max - 1)}…`;
}

import type { AiResponse } from '../../types/ai';
import type { FeatureId } from '../../types/navigation';
import type { ConsultHistoryTurn, GuidanceAction } from './types';

export type GuidanceDemoInput = {
  featureId: FeatureId;
  text: string;
  choiceLabel?: string;
  history?: ConsultHistoryTurn[];
  guidanceAction?: GuidanceAction;
};

type GuidanceStep = {
  displayText: string;
  voiceText: string;
  simplifyDisplayText: string;
  simplifyVoiceText: string;
  simplifyQuestion?: string;
};

type GuidanceScript = {
  id: string;
  title: string;
  steps: GuidanceStep[];
};

const DEMO_PREFIX = '【デモ・AI未接続】';

const LINE_NOTIFY_SCRIPT: GuidanceScript = {
  id: 'line-notify',
  title: 'LINEの通知',
  steps: [
    {
      displayText: 'まず、LINEアプリを開いてください。',
      voiceText:
        'まず、ホーム画面からLINEアプリを開いてください。開けたら、「できました」を押してくださいね。',
      simplifyDisplayText: '電話の画面で、緑のLINEのマークを押します。',
      simplifyVoiceText:
        '大丈夫です。ゆっくりで構いません。電話のホーム画面で、緑の四角いLINEのマークを探して押してください。開けたら「できました」を押してください。',
      simplifyQuestion: 'LINEのマークは見つかりましたか？',
    },
    {
      displayText: '下の「ホーム」を押してください。',
      voiceText:
        '画面のいちばん下にある「ホーム」という文字を押してください。友だちの一覧が出る場所です。押せたら「できました」を選んでください。',
      simplifyDisplayText: '画面の下、左から2番めあたりの「ホーム」です。',
      simplifyVoiceText:
        '画面の下にいくつかのマークが並んでいます。その中の「ホーム」を押してください。分からなければ、下の真ん中より左のマークを試してみてください。',
    },
    {
      displayText: '右上の歯車マークを押してください。',
      voiceText:
        '次に、画面の右上にある歯車の形をしたマークを押してください。設定の画面が開きます。押せたら「できました」を選んでくださいね。',
      simplifyDisplayText: '右上の、小さな歯車の絵を押します。',
      simplifyVoiceText:
        '画面の右の上の方を見てください。小さな歯車のような絵があります。それを押すと設定が開きます。押せたら「できました」です。',
    },
    {
      displayText: '「通知」を開き、オンにしてください。',
      voiceText:
        '設定の一覧から「通知」を押してください。通知を受け取る設定がオフになっていたら、オンに切り替えてください。できたら「できました」を押してください。',
      simplifyDisplayText: '一覧の「通知」を押し、スイッチをオンにします。',
      simplifyVoiceText:
        '「通知」という文字を探して押してください。スイッチが左側（オフ）なら、右側（オン）へ動かしてください。終わったら「できました」です。焦らなくて大丈夫です。',
    },
  ],
};

const WIFI_SCRIPT: GuidanceScript = {
  id: 'wifi',
  title: 'Wi-Fi接続',
  steps: [
    {
      displayText: '「設定」アプリを開いてください。',
      voiceText:
        'まず、ホーム画面の「設定」アプリを開いてください。歯車のマークです。開けたら「できました」を押してください。',
      simplifyDisplayText: '歯車の「設定」マークを押します。',
      simplifyVoiceText:
        'ホーム画面で、灰色の歯車のマーク「設定」を探して押してください。開けたら「できました」です。',
    },
    {
      displayText: '「Wi-Fi」を押してください。',
      voiceText:
        '設定の一覧から「Wi-Fi」または「無線LAN」を押してください。押せたら「できました」を選んでください。',
      simplifyDisplayText: '青い扇のようなマークの「Wi-Fi」です。',
      simplifyVoiceText:
        '設定の上の方に「Wi-Fi」があります。青い扇のようなマークの行を押してください。',
    },
    {
      displayText: '使いたい名前を押してください。',
      voiceText:
        '出てきた一覧から、つなぎたいWi-Fiの名前を押してください。パスワードを聞かれたら、メモなどを見ながら入力してください。つなげる準備ができたら「できました」です。',
      simplifyDisplayText: '一覧の中から、知っている名前を押します。',
      simplifyVoiceText:
        '知っている家やお店の名前を押してください。知らない名前は押さなくて大丈夫です。押せたら「できました」を選んでください。',
    },
  ],
};

const APP_INSTALL_SCRIPT: GuidanceScript = {
  id: 'app-install',
  title: 'アプリの入手',
  steps: [
    {
      displayText: 'App Storeを開いてください。',
      voiceText:
        '青い「A」のマークの App Store を開いてください。開けたら「できました」を押してください。',
      simplifyDisplayText: '青い「A」の App Store を押します。',
      simplifyVoiceText:
        'ホーム画面の青い四角に白い「A」がある App Store を押してください。',
    },
    {
      displayText: '下の虫めがねで探してください。',
      voiceText:
        '画面の下にある虫めがねのマーク「検索」を押し、入れたいアプリの名前を入力してください。入力できたら「できました」です。',
      simplifyDisplayText: '下の虫めがね「検索」から名前を入れます。',
      simplifyVoiceText:
        '下の虫めがねを押し、入れたいアプリの名前をゆっくり入力してください。終わったら「できました」です。',
    },
    {
      displayText: '「入手」または雲のマークを押してください。',
      voiceText:
        'アプリの横にある「入手」や雲のマークを押してください。顔認証やパスワードを聞かれたら、いつもの方法で進めてください。始められたら「できました」です。',
      simplifyDisplayText: '青い「入手」や雲のマークを押します。',
      simplifyVoiceText:
        'アプリの名前の右か下に「入手」や雲のマークがあります。それを押してください。分からなければ、そのまま「分かりません」を押しても大丈夫です。',
    },
  ],
};

const NOTIFY_SCRIPT: GuidanceScript = {
  id: 'notify-settings',
  title: '通知の設定',
  steps: [
    {
      displayText: '「設定」アプリを開いてください。',
      voiceText:
        'ホーム画面から「設定」アプリを開いてください。開けたら「できました」を押してください。',
      simplifyDisplayText: '歯車の「設定」を開きます。',
      simplifyVoiceText:
        '灰色の歯車マーク「設定」を押してください。開けたら「できました」です。',
    },
    {
      displayText: '下へスクロールし「通知」を押してください。',
      voiceText:
        '設定の画面を下へゆっくりスクロールし、「通知」を押してください。押せたら「できました」です。',
      simplifyDisplayText: '一覧の「通知」を探して押します。',
      simplifyVoiceText:
        '指で画面を下から上へゆっくり動かし、「通知」という文字を探して押してください。',
    },
    {
      displayText: '変えたいアプリを選び、オンまたはオフにします。',
      voiceText:
        'アプリの一覧から変えたいものを押し、通知のスイッチをオンまたはオフにしてください。できたら「できました」を押してください。',
      simplifyDisplayText: 'アプリを押し、スイッチを動かします。',
      simplifyVoiceText:
        '変えたいアプリの名前を押し、スイッチを右（オン）か左（オフ）へ動かしてください。焦らなくて大丈夫です。',
    },
  ],
};

const GENERIC_SCRIPT: GuidanceScript = {
  id: 'generic-op',
  title: '操作の案内',
  steps: [
    {
      displayText: 'いま困っている画面を開いたままにしてください。',
      voiceText:
        'いま操作したいアプリや設定の画面を開いたままにしてください。準備できたら「できました」を押してください。スクリーンショットを取り込んでも大丈夫です。',
      simplifyDisplayText: '困っているアプリを開いたままにします。',
      simplifyVoiceText:
        'やりたい操作の画面を開いておいてください。開けたら「できました」です。開く場所が分からなければ「分かりません」を押してください。',
      simplifyQuestion: 'どのアプリの画面を開いていますか？',
    },
    {
      displayText: '画面の案内に近いボタンを一つ押してください。',
      voiceText:
        '画面に出ているボタンや文字のうち、やりたいことに近いものを一つだけ押してください。いくつかあっても、一度に一つです。押せたら「できました」です。',
      simplifyDisplayText: 'いちばん近いボタンを、一つだけ押します。',
      simplifyVoiceText:
        '急がなくて大丈夫です。いちばん近いと思うボタンを一つだけ押してください。間違えても戻れることが多いので、安心してください。',
    },
    {
      displayText: 'できた内容を確認し、必要なら同じ手順を繰り返します。',
      voiceText:
        '目的の画面や設定になっていれば完了です。まだ違う場合は、さっきと同じように一つずつ進めてください。確認できたら「できました」を押してください。',
      simplifyDisplayText: '目的の状態か、画面をよく見て確認します。',
      simplifyVoiceText:
        'いまの画面が、やりたかったことに近づいているか見てください。分からなければ「分かりません」を押してください。責めたりしませんので、遠慮なくどうぞ。',
    },
  ],
};

/**
 * デモ用の1ステップ操作案内。
 * 複数手順を一度に返さず、currentStep の1件だけを返す。
 */
export function buildDemoGuidanceResponse(
  input: GuidanceDemoInput,
): AiResponse | null {
  if (input.featureId !== 'operationSupport') {
    return null;
  }

  const action = input.guidanceAction;
  const script = resolveScript(input);
  const historyStep = readStepFromHistory(input.history);

  if (action === 'done') {
    const nextStep = (historyStep?.currentStep ?? 1) + 1;
    const active = scriptFromId(historyStep?.scriptId) ?? script;
    if (nextStep > active.steps.length) {
      return buildCompletion(active);
    }
    return buildStepResponse(active, nextStep, 'normal');
  }

  if (action === 'simplify') {
    const current = historyStep?.currentStep ?? 1;
    const active = scriptFromId(historyStep?.scriptId) ?? script;
    return buildStepResponse(active, current, 'simplify');
  }

  if (action === 'start' || shouldAutoStartGuidance(input)) {
    return buildStepResponse(script, 1, 'normal');
  }

  return null;
}

export function shouldOfferGuidanceStart(
  featureId: FeatureId,
  response: AiResponse,
): boolean {
  return (
    featureId === 'operationSupport' &&
    response.status === 'ready_to_help' &&
    response.mode !== 'offline'
  );
}

function shouldAutoStartGuidance(input: GuidanceDemoInput): boolean {
  const combined = normalize(
    `${input.choiceLabel ?? ''} ${input.text} ${historyBlob(input.history)}`,
  );
  if (!combined) {
    return false;
  }

  // 絞り込み後の具体的な LINE 問題、または初期の具体操作
  if (resolveScriptId(combined) !== 'generic-op') {
    return true;
  }

  // 「案内を始める」明示
  if (
    combined.includes('案内を始める') ||
    combined.includes('操作案内') ||
    combined.includes('やり方を教えて')
  ) {
    return true;
  }

  return false;
}

function resolveScript(input: GuidanceDemoInput): GuidanceScript {
  const fromHistory = scriptFromId(readStepFromHistory(input.history)?.scriptId);
  if (fromHistory) {
    return fromHistory;
  }
  const combined = normalize(
    `${input.choiceLabel ?? ''} ${input.text} ${historyBlob(input.history)}`,
  );
  return scriptFromId(resolveScriptId(combined)) ?? GENERIC_SCRIPT;
}

function resolveScriptId(normalized: string): string {
  if (
    (normalized.includes('line') ||
      normalized.includes('ライン') ||
      normalized.includes('らいん')) &&
    (normalized.includes('通知') || normalized.includes('届かない'))
  ) {
    return 'line-notify';
  }
  if (
    normalized.includes('wifi') ||
    normalized.includes('wi-fi') ||
    normalized.includes('ワイファイ') ||
    normalized.includes('無線')
  ) {
    return 'wifi';
  }
  if (
    normalized.includes('アプリを入れ') ||
    normalized.includes('インストール') ||
    normalized.includes('アプリを消し') ||
    normalized.includes('アンインストール')
  ) {
    return 'app-install';
  }
  if (normalized.includes('通知の設定') || normalized.includes('通知を変え')) {
    return 'notify-settings';
  }
  return 'generic-op';
}

function scriptFromId(id: string | undefined): GuidanceScript | null {
  switch (id) {
    case 'line-notify':
      return LINE_NOTIFY_SCRIPT;
    case 'wifi':
      return WIFI_SCRIPT;
    case 'app-install':
      return APP_INSTALL_SCRIPT;
    case 'notify-settings':
      return NOTIFY_SCRIPT;
    case 'generic-op':
      return GENERIC_SCRIPT;
    default:
      return null;
  }
}

function buildStepResponse(
  script: GuidanceScript,
  stepNumber: number,
  tone: 'normal' | 'simplify',
): AiResponse {
  const index = Math.min(Math.max(stepNumber, 1), script.steps.length) - 1;
  const step = script.steps[index];
  const displayText =
    tone === 'simplify' ? step.simplifyDisplayText : step.displayText;
  const voiceText =
    tone === 'simplify' ? step.simplifyVoiceText : step.voiceText;

  return {
    status: 'guiding',
    mode: 'demo',
    message:
      tone === 'simplify'
        ? `${DEMO_PREFIX} 言い方をやさしくしました。焦らなくて大丈夫です。`
        : `${DEMO_PREFIX} 「${script.title}」の案内です。一度に一つだけ進めます。`,
    displayText,
    voiceText,
    currentStep: index + 1,
    totalSteps: script.steps.length,
    question: tone === 'simplify' ? step.simplifyQuestion : undefined,
    // 履歴から再開できるよう、スクリプト ID を rationale に埋め込む（デモ専用）
    rationale: `demo-script:${script.id}`,
  };
}

function buildCompletion(script: GuidanceScript): AiResponse {
  return {
    status: 'ready_to_help',
    mode: 'demo',
    message: `${DEMO_PREFIX} 「${script.title}」の案内はひととおり終わりました。本番のAI案内は、FirebaseとGeminiを設定すると使えます。`,
    displayText: '案内はここまでです。おつかれさまです。',
    voiceText:
      '案内はひととおり終わりです。ほかに困っていることがあれば、下の選択肢から選んでください。',
    choices: ['もう一度最初から案内する', '別のことで相談する', '最初の選択肢に戻る'],
    rationale: `demo-script:${script.id}`,
  };
}

function readStepFromHistory(
  history: ConsultHistoryTurn[] | undefined,
): { scriptId?: string; currentStep: number } | null {
  if (!history || history.length === 0) {
    return null;
  }

  for (let i = history.length - 1; i >= 0; i -= 1) {
    const turn = history[i];
    if (turn.role !== 'assistant') {
      continue;
    }
    const stepMatch = /\[step:(\d+)\/(\d+)(?:\|([^\]\s]+))?\]/.exec(turn.text);
    if (stepMatch) {
      return {
        currentStep: Number(stepMatch[1]),
        scriptId: stepMatch[3],
      };
    }
    const scriptMatch = /demo-script:([a-z0-9-]+)/.exec(turn.text);
    if (scriptMatch) {
      return { currentStep: 1, scriptId: scriptMatch[1] };
    }
  }
  return null;
}

export function formatGuidanceHistoryText(response: AiResponse): string {
  const scriptId =
    response.rationale?.replace(/^demo-script:/, '') ||
    (response.status === 'guiding' ? 'generic-op' : undefined);
  const stepTag =
    response.status === 'guiding' &&
    typeof response.currentStep === 'number' &&
    typeof response.totalSteps === 'number'
      ? `[step:${response.currentStep}/${response.totalSteps}${scriptId ? `|${scriptId}` : ''}] `
      : '';
  return `${stepTag}${response.displayText ?? response.message ?? ''}`.trim();
}

function historyBlob(history: ConsultHistoryTurn[] | undefined): string {
  if (!history || history.length === 0) {
    return '';
  }
  return history.map((turn) => turn.text).join(' ');
}

function normalize(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase();
}

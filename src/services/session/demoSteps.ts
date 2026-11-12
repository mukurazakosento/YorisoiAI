import type { FeatureId } from '../../types/navigation';
import type { SessionScript } from '../../types/session';

const DEMO = true;

/**
 * 端末内 Llama / WebLLM は未接続。セッション案内は常にデモ。
 * 本番接続後はここで isDemo=false のスクリプトへ切り替える。
 */
export function isOnDeviceAiReady(): boolean {
  return false;
}

/**
 * 機能と相談サマリーからデモ案内スクリプトを組み立てる。
 * 一度に一つだけ進める前提の短い displayText / 詳しい voiceText。
 */
export function buildDemoSessionScript(input: {
  featureId: FeatureId;
  summary: string;
}): SessionScript {
  const summary = input.summary.trim();
  switch (input.featureId) {
    case 'operationSupport':
      return resolveOperationScript(summary);
    case 'textExplanation':
      return resolveExplanationScript(summary);
    case 'safetyCheck':
      return resolveSafetyScript(summary);
    default:
      return GENERIC_OPERATION;
  }
}

function resolveOperationScript(summary: string): SessionScript {
  const n = normalize(summary);
  if (
    (n.includes('line') || n.includes('ライン') || n.includes('らいん')) &&
    (n.includes('通知') || n.includes('届かない') || n.includes('使い方'))
  ) {
    return LINE_NOTIFY;
  }
  if (
    n.includes('wifi') ||
    n.includes('wi-fi') ||
    n.includes('ワイファイ') ||
    n.includes('無線')
  ) {
    return WIFI;
  }
  if (
    n.includes('アプリを入れ') ||
    n.includes('インストール') ||
    n.includes('アプリを消し') ||
    n.includes('アンインストール') ||
    n.includes('入れたい') ||
    n.includes('消したい')
  ) {
    return APP_INSTALL;
  }
  return GENERIC_OPERATION;
}

function resolveExplanationScript(summary: string): SessionScript {
  const n = normalize(summary);
  if (n.includes('許可') || n.includes('アクセス')) {
    return EXPLAIN_PERMISSION;
  }
  if (n.includes('インストール')) {
    return EXPLAIN_INSTALL;
  }
  if (n.includes('専門') || n.includes('用語') || n.includes('意味')) {
    return EXPLAIN_TERM;
  }
  return EXPLAIN_GENERIC;
}

function resolveSafetyScript(summary: string): SessionScript {
  const n = normalize(summary);
  if (n.includes('電話') || n.includes('番号') || n.includes('着信')) {
    return SAFETY_PHONE;
  }
  if (
    n.includes('sms') ||
    n.includes('メール') ||
    n.includes('メッセージ') ||
    n.includes('文言')
  ) {
    return SAFETY_MESSAGE;
  }
  return SAFETY_GENERIC;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase();
}

const LINE_NOTIFY: SessionScript = {
  id: 'op-line-notify',
  title: 'LINEの操作',
  isDemo: DEMO,
  steps: [
    {
      displayText: 'まず、LINEアプリを開いてください。',
      voiceText:
        'まず、ホーム画面から緑のLINEアプリを開いてください。開けたら「できました」を押してくださいね。',
      simplifyDisplayText: '緑のLINEのマークを押します。',
      simplifyVoiceText:
        '大丈夫です。ゆっくりで構いません。ホーム画面の緑の四角いLINEのマークを探して押してください。',
    },
    {
      displayText: '下の「ホーム」を押してください。',
      voiceText:
        '画面のいちばん下にある「ホーム」を押してください。友だちの一覧が出る場所です。押せたら「できました」です。',
      simplifyDisplayText: '画面の下、「ホーム」を押します。',
      simplifyVoiceText:
        '画面の下にマークが並んでいます。その中の「ホーム」を押してください。',
    },
    {
      displayText: '右上の歯車を押し、「通知」を確認します。',
      voiceText:
        '右上の歯車マークを押し、一覧から「通知」を開いてください。オフならオンにしてください。できたら「できました」です。',
      simplifyDisplayText: '右上の歯車→「通知」をオンにします。',
      simplifyVoiceText:
        '右上の小さな歯車を押し、「通知」を探してスイッチを右側（オン）へ動かしてください。',
    },
  ],
};

const WIFI: SessionScript = {
  id: 'op-wifi',
  title: 'Wi-Fi接続',
  isDemo: DEMO,
  steps: [
    {
      displayText: '「設定」アプリを開いてください。',
      voiceText:
        'ホーム画面の歯車マーク「設定」を開いてください。開けたら「できました」を押してください。',
      simplifyDisplayText: '歯車の「設定」を押します。',
      simplifyVoiceText:
        '灰色の歯車マーク「設定」を探して押してください。',
    },
    {
      displayText: '「Wi-Fi」を押してください。',
      voiceText:
        '設定の一覧から「Wi-Fi」を押してください。押せたら「できました」です。',
      simplifyDisplayText: '青い扇のマーク「Wi-Fi」です。',
      simplifyVoiceText:
        '設定の上の方にある「Wi-Fi」の行を押してください。',
    },
    {
      displayText: '使いたい名前を押してください。',
      voiceText:
        '一覧からつなぎたいWi-Fiの名前を押してください。パスワードを聞かれたらメモを見ながら入力します。準備できたら「できました」です。',
      simplifyDisplayText: '知っている名前を一つ押します。',
      simplifyVoiceText:
        '知っている家やお店の名前だけ押してください。知らない名前は押さなくて大丈夫です。',
    },
  ],
};

const APP_INSTALL: SessionScript = {
  id: 'op-app-install',
  title: 'アプリの入手',
  isDemo: DEMO,
  steps: [
    {
      displayText: 'App Storeを開いてください。',
      voiceText:
        '青い「A」のマークの App Store を開いてください。開けたら「できました」です。',
      simplifyDisplayText: '青い「A」の App Store を押します。',
      simplifyVoiceText:
        'ホーム画面の青い四角に白い「A」がある App Store を押してください。',
    },
    {
      displayText: '下の虫めがねで探してください。',
      voiceText:
        '下の虫めがね「検索」を押し、入れたいアプリの名前を入力してください。入力できたら「できました」です。',
      simplifyDisplayText: '下の虫めがねから名前を入れます。',
      simplifyVoiceText:
        '下の虫めがねを押し、アプリの名前をゆっくり入力してください。',
    },
    {
      displayText: '「入手」または雲のマークを押してください。',
      voiceText:
        'アプリの横の「入手」や雲のマークを押してください。顔認証やパスワードを聞かれたらいつもの方法で進めてください。',
      simplifyDisplayText: '青い「入手」や雲を押します。',
      simplifyVoiceText:
        'アプリの右か下にある「入手」や雲のマークを押してください。分からなければ「分かりません」でも大丈夫です。',
    },
  ],
};

const GENERIC_OPERATION: SessionScript = {
  id: 'op-generic',
  title: '操作の案内',
  isDemo: DEMO,
  steps: [
    {
      displayText: '困っている画面を開いたままにしてください。',
      voiceText:
        'いま操作したいアプリや設定の画面を開いたままにしてください。準備できたら「できました」を押してください。',
      simplifyDisplayText: '困っているアプリを開いたままにします。',
      simplifyVoiceText:
        'やりたい操作の画面を開いておいてください。開けたら「できました」です。',
    },
    {
      displayText: '近いボタンを、一つだけ押してください。',
      voiceText:
        '画面のボタンや文字のうち、やりたいことに近いものを一つだけ押してください。一度に一つです。押せたら「できました」です。',
      simplifyDisplayText: 'いちばん近いボタンを一つ押します。',
      simplifyVoiceText:
        '急がなくて大丈夫です。いちばん近いと思うボタンを一つだけ押してください。',
    },
    {
      displayText: '目的の画面か、よく見て確認してください。',
      voiceText:
        '目的の画面や設定になっていれば完了です。まだ違う場合は、同じように一つずつ進めてください。確認できたら「できました」です。',
      simplifyDisplayText: '画面をよく見て、目的に近いか確認します。',
      simplifyVoiceText:
        'いまの画面がやりたかったことに近づいているか見てください。分からなければ「分かりません」を押してください。',
    },
  ],
};

const EXPLAIN_PERMISSION: SessionScript = {
  id: 'tx-permission',
  title: '許可の説明',
  isDemo: DEMO,
  steps: [
    {
      displayText: '許可の確認画面を開いたままにしてください。',
      voiceText:
        '「許可しますか？」などの確認が画面に出ている状態のままにしてください。準備できたら「できました」です。画面収録はまだ準備中なので、いまは文字の案内だけです。',
      simplifyDisplayText: '許可の画面を開いたままにします。',
      simplifyVoiceText:
        '許可するかどうか聞かれている画面を開いたままにしてください。',
    },
    {
      displayText: '許可すると、その機能が使えるようになります。',
      voiceText:
        '簡単に言うと、アプリに写真やマイクなどを使わせてよいか聞いている画面です。許可するとその機能が使えます。許可しないとその機能は使えません。',
      simplifyDisplayText: '許可＝その機能を使えるようにする、です。',
      simplifyVoiceText:
        '「許可」は、そのアプリにその機能を使わせることです。「許可しない」なら使いません。',
    },
    {
      displayText: 'どのアプリか分からなければ、急がなくて大丈夫です。',
      voiceText:
        'どのアプリの確認か分からないときは、許可を急がないでください。知らないアプリなら特に慎重に。「今はしない」でも大丈夫です。',
      simplifyDisplayText: '分からなければ、許可しなくて大丈夫です。',
      simplifyVoiceText:
        '急がなくて大丈夫です。分からなければ「許可しない」やキャンセルを選んで構いません。',
    },
  ],
};

const EXPLAIN_INSTALL: SessionScript = {
  id: 'tx-install',
  title: 'インストール確認の説明',
  isDemo: DEMO,
  steps: [
    {
      displayText: 'インストール確認の画面を開いたままにしてください。',
      voiceText:
        '「インストールしますか？」などの確認が出ている画面を開いたままにしてください。準備できたら「できました」です。',
      simplifyDisplayText: 'インストール確認を開いたままにします。',
      simplifyVoiceText:
        'アプリを入れてよいか聞かれている画面を開いたままにしてください。',
    },
    {
      displayText: '入れるとアプリが端末に追加されます。',
      voiceText:
        '「入れる／インストール」を選ぶとアプリが端末に追加されます。「キャンセル」なら追加されません。身に覚えがなければ止めて大丈夫です。',
      simplifyDisplayText: '入れる＝アプリが追加される、です。',
      simplifyVoiceText:
        '入れるとそのアプリが電話に追加されます。入れたくなければキャンセルです。',
    },
    {
      displayText: '何のアプリか分からなければ、入れないでください。',
      voiceText:
        '何のアプリか、どこから入れようとしているかが分からなければ、「入れない」を選んでください。公式ストア以外は特に注意です。',
      simplifyDisplayText: '分からなければ「入れない」で大丈夫です。',
      simplifyVoiceText:
        '分からなければ入れなくて大丈夫です。急かされても慌てないでください。',
    },
  ],
};

const EXPLAIN_TERM: SessionScript = {
  id: 'tx-term',
  title: '用語の説明',
  isDemo: DEMO,
  steps: [
    {
      displayText: '分からない言葉が出ている画面を開いてください。',
      voiceText:
        '専門用語や難しい言葉が出ている画面を開いたままにしてください。準備できたら「できました」です。',
      simplifyDisplayText: '難しい言葉の画面を開いたままにします。',
      simplifyVoiceText:
        '分からない言葉が出ている画面を開いておいてください。',
    },
    {
      displayText: '難しい言葉は、日常の言い方に言い換えます。',
      voiceText:
        'デモでは、難しい言葉を短い日常の言い方に言い換えて案内します。本番の端末内AIがつながると、画面の文に合わせた説明になります。',
      simplifyDisplayText: '難しい言葉を、やさしい言葉にします。',
      simplifyVoiceText:
        'むずかしい言葉を、やさしい言葉に直して説明します。',
    },
    {
      displayText: '意味が分かったら、自分のペースで操作してください。',
      voiceText:
        '意味が分かったら、ご自身のペースで操作を続けてください。まだ不安なら、支援終了のあとに「解決しなかった」から続けて相談できます。',
      simplifyDisplayText: '分かったら、ゆっくり操作してください。',
      simplifyVoiceText:
        '分かったら、ゆっくり操作してください。まだ不安ならまた相談して大丈夫です。',
    },
  ],
};

const EXPLAIN_GENERIC: SessionScript = {
  id: 'tx-generic',
  title: '文章の説明',
  isDemo: DEMO,
  steps: [
    {
      displayText: '説明したい文章の画面を開いてください。',
      voiceText:
        '説明してほしい文章やポップアップが出ている画面を開いたままにしてください。画面の自動取り込みはまだ準備中です。',
      simplifyDisplayText: '説明したい画面を開いたままにします。',
      simplifyVoiceText:
        '説明したい文章が出ている画面を開いておいてください。',
    },
    {
      displayText: 'その文章は、操作の確認や注意を伝えています。',
      voiceText:
        '多くの場合、その文章は「この操作をしてよいか」「注意してほしいこと」を伝えています。急いで押さず、内容を読んでから決めてください。',
      simplifyDisplayText: '確認や注意の文章です。急がなくて大丈夫です。',
      simplifyVoiceText:
        '確認や注意の文章です。急いで押さなくて大丈夫です。',
    },
    {
      displayText: '分からなければ、いったん閉じても大丈夫です。',
      voiceText:
        '内容が分からなければ、いったん閉じたり「後で」を選んでも大丈夫です。支援終了のあと、もう一度相談できます。',
      simplifyDisplayText: '分からなければ、閉じて大丈夫です。',
      simplifyVoiceText:
        '分からなければ閉じても大丈夫です。また相談できます。',
    },
  ],
};

const SAFETY_PHONE: SessionScript = {
  id: 'sf-phone',
  title: '電話の確認',
  isDemo: DEMO,
  steps: [
    {
      displayText: '「電話」アプリを開いてください。',
      voiceText:
        'まず「電話」アプリを開いてください。開けたら「できました」を押してください。アプリがほかのアプリを自動操作することはありません。',
      simplifyDisplayText: '緑の電話マークを押します。',
      simplifyVoiceText:
        'ホーム画面の緑の電話マークを押してください。',
    },
    {
      displayText: '最近の通話から、気になる番号を見つけてください。',
      voiceText:
        '最近の通話や着信履歴から、気になる番号を見つけてください。見つけたら「できました」です。番号は端末の外へ送りません（デモ案内）。',
      simplifyDisplayText: '気になる番号を履歴から見つけます。',
      simplifyVoiceText:
        '通話の履歴から、気になる番号を探してください。',
    },
    {
      displayText: '知らない番号への折り返しは、急がなくて大丈夫です。',
      voiceText:
        '知らない番号でも、すぐに折り返す必要はありません。お金や個人情報を求められたら特に注意です。こちらから「安全です」とは言いません。不安なら家族や相談窓口にも聞いてください。',
      simplifyDisplayText: '折り返しは急がなくて大丈夫です。',
      simplifyVoiceText:
        '知らない番号にすぐかけ直さなくて大丈夫です。「安全です」とは言い切れません。不安なら家族に聞いてください。',
    },
  ],
};

const SAFETY_MESSAGE: SessionScript = {
  id: 'sf-message',
  title: 'メッセージの確認',
  isDemo: DEMO,
  steps: [
    {
      displayText: 'メールまたはメッセージアプリを開いてください。',
      voiceText:
        'メールやメッセージのアプリを開いてください。開けたら「できました」です。画面の自動読み取りはまだ準備中です。',
      simplifyDisplayText: 'メールやメッセージを開きます。',
      simplifyVoiceText:
        'メールやメッセージのアプリを開いてください。',
    },
    {
      displayText: '気になる文章を画面に出したままにしてください。',
      voiceText:
        '気になるSMSやメールを開き、文章が読める状態にしてください。リンクをすぐ押さないでください。準備できたら「できました」です。',
      simplifyDisplayText: '怪しい文を開いたまま、リンクは押さない。',
      simplifyVoiceText:
        '怪しい文を開いたままにしてください。青いリンクはまだ押さないでください。',
    },
    {
      displayText: '急かす・お金・リンクには特に注意してください。',
      voiceText:
        '「今すぐ」「未払い」「個人情報の入力」や知らないリンクには特に注意です。断定的に「安全です」とは言えません。不安なら閉じる・返信しない・家族に見せる、が無難です。',
      simplifyDisplayText: '急かす文やリンクは、慎重に。',
      simplifyVoiceText:
        '急かす文や知らないリンクは慎重に。「安全です」とは言いません。不安なら閉じても大丈夫です。',
    },
  ],
};

const SAFETY_GENERIC: SessionScript = {
  id: 'sf-generic',
  title: '安全性の確認',
  isDemo: DEMO,
  steps: [
    {
      displayText: '確認したい電話・メールの画面を開いてください。',
      voiceText:
        '確認したい電話やメールなどの画面を開いてください。開けたら「できました」です。自動操作はしません。',
      simplifyDisplayText: '確認したい画面を開きます。',
      simplifyVoiceText:
        '確認したい電話やメールの画面を開いてください。',
    },
    {
      displayText: '相手・金額・リンクを、よく見てください。',
      voiceText:
        '誰から来たか、お金や個人情報を求めていないか、知らないリンクがないかをよく見てください。焦らなくて大丈夫です。',
      simplifyDisplayText: '相手・お金・リンクを確認します。',
      simplifyVoiceText:
        '誰からか、お金の話がないか、リンクがないかを見てください。',
    },
    {
      displayText: '不安なら、いったん止めて相談してください。',
      voiceText:
        '少しでも不安なら、操作をいったん止めてください。こちらから「安全です」とは言いません。家族や信頼できる窓口に聞くのもよい方法です。',
      simplifyDisplayText: '不安なら、止めて相談して大丈夫です。',
      simplifyVoiceText:
        '不安なら止めて大丈夫です。「安全です」とは言いません。家族に聞いても構いません。',
    },
  ],
};

/** 終了案内の定型文（通知・画面共通） */
export const END_SUPPORT_DISPLAY = 'ここをタップで支援を終了';
export const END_SUPPORT_VOICE =
  '案内はひととおり終わりです。画面の「ここをタップで支援を終了」を押すと、解決したかどうかを確認します。';

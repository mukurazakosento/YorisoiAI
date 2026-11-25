import type { FeatureId } from '../../types/navigation';
import type { SessionScript } from '../../types/session';

const DEMO = true;

/**
 * デモ案内スクリプトのコーパス。
 * 接続判定は `services/onDeviceAi`（WebLLM / ネイティブスキャフォールド）が担当。
 * 未接続時のみここが使われ、常に isDemo=true。
 */

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
    (n.includes('写真') || n.includes('画像') || n.includes('孫') || n.includes('送'))
  ) {
    return LINE_SEND_PHOTO;
  }
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
    n.includes('アンインストール') ||
    n.includes('アプリを消し') ||
    n.includes('アプリを削除') ||
    n.includes('アプリ削除') ||
    (n.includes('消したい') && n.includes('アプリ'))
  ) {
    return APP_UNINSTALL;
  }
  if (
    n.includes('アプリを入れ') ||
    n.includes('インストール') ||
    n.includes('入れたい')
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

/** 優先シナリオ: LINE で孫に写真を送る（初期脚本。背面 OCR 変化で上書きされ得る） */
const LINE_SEND_PHOTO: SessionScript = {
  id: 'op-line-send-photo',
  title: 'LINEで写真を送る',
  isDemo: DEMO,
  steps: [
    {
      displayText: 'まず、緑のLINEアプリを開いてください。',
      voiceText:
        'まず、ホーム画面から緑のLINEアプリを開いてください。開けたら「できました」を押してくださいね。',
      simplifyDisplayText: '緑のLINEを開きます。',
      simplifyVoiceText:
        '緑の四角いLINEのマークを探して押してください。',
    },
    {
      displayText: '孫の名前のトークを開いてください。',
      voiceText:
        '友だち一覧から、孫の名前を選んでトークを開いてください。開けたら「できました」です。',
      simplifyDisplayText: '孫の名前を押します。',
      simplifyVoiceText: '孫の名前を探して押してください。',
    },
    {
      displayText: '写真を付けるボタン（＋など）を押してください。',
      voiceText:
        'トーク画面の下のほうにある、プラスや写真のボタンを押してください。よりそいAIは代わりに押しません。',
      simplifyDisplayText: 'プラスや写真のボタンを押します。',
      simplifyVoiceText: '下のプラスや写真のマークを押してください。',
    },
    {
      displayText: '送りたい写真を一つ選んでください。',
      voiceText:
        'アルバムから送りたい写真を一つだけ選んでください。選んだら「できました」です。',
      simplifyDisplayText: '写真を一つ選びます。',
      simplifyVoiceText: '送りたい写真を一つだけ選んでください。',
    },
    {
      displayText: '内容を確かめてから「送信」を押してください。',
      voiceText:
        '相手と写真を確かめてから、送信を押してください。勝手には送りません。',
      simplifyDisplayText: '確かめてから送信します。',
      simplifyVoiceText: '大丈夫なら送信を押してください。',
    },
  ],
};

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
      displayText: '右上の歯車を押してください。',
      voiceText:
        '右上の歯車マークを押してください。押せたら「できました」です。',
      simplifyDisplayText: '右上の小さな歯車を押します。',
      simplifyVoiceText:
        '画面の右上にある小さな歯車を探して押してください。',
    },
    {
      displayText: '「通知」を開いて、オンにしてください。',
      voiceText:
        '一覧から「通知」を開き、オフならオンにしてください。できたら「できました」です。',
      simplifyDisplayText: '「通知」をオンにします。',
      simplifyVoiceText:
        '「通知」を探して押し、スイッチを右側（オン）へ動かしてください。',
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
      displayText: '下の虫めがね「検索」を押してください。',
      voiceText:
        '画面の下にある虫めがね「検索」を押してください。押せたら「できました」です。',
      simplifyDisplayText: '下の虫めがねを押します。',
      simplifyVoiceText:
        '画面の下の虫めがねのマークを押してください。',
    },
    {
      displayText: '入れたいアプリの名前を入力してください。',
      voiceText:
        '入れたいアプリの名前を入力してください。入力できたら「できました」です。',
      simplifyDisplayText: 'アプリの名前をゆっくり入れます。',
      simplifyVoiceText:
        'アプリの名前を、ゆっくり入力してください。',
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

/** 削除専用。ホームへ→長押し→削除→確認。秒数メタ助言なし。自動削除なし。 */
const APP_UNINSTALL: SessionScript = {
  id: 'op-app-uninstall',
  title: 'アプリを消す',
  isDemo: DEMO,
  steps: [
    {
      displayText:
        'ホーム画面から、消したいアプリのある画面まで行ってください。',
      voiceText:
        'ホーム画面から、消したいアプリのある画面まで行ってください。アプリの絵文字マークが見えるところです。よりそいAIは代わりに消しません。',
      simplifyDisplayText: 'ホームから、消したいアプリの画面へ。',
      simplifyVoiceText:
        'ホーム画面から、消したいアプリのある画面まで行ってください。',
    },
    {
      displayText: '消したいアプリを長押しして、メニューが出るまで待ってください。',
      voiceText:
        '消したいアプリのアイコンを指で長押ししてください。メニューや小さな窓が出るまで、そのまま押したままにしてください。メニューが出たら指を離してください。',
      simplifyDisplayText: 'アイコンを長押しして、メニューが出るまで。',
      simplifyVoiceText:
        '消したいアプリを指で長押しします。メニューが出るまでそのままです。',
    },
    {
      displayText:
        'メニューから「削除」を選ぶと、アプリをスマートフォンから取り除けます。',
      voiceText:
        'メニューから削除を選ぶと、アプリをスマートフォンから取り除けます。アプリによっては、中に保存していた写真やメモなどが一緒に消えてしまう場合があります。消す前に、そのアプリの中に残しておきたいものがないか確認しましょう。押すと確認の画面が出ることが多いです。まだ消えていません。代わりには押しません。',
      simplifyDisplayText: 'メニューから「削除」を選びます。',
      simplifyVoiceText:
        'メニューから削除を選ぶとアプリを取り除けます。写真やメモも消えることがあります。残したいものがないか確認しましょう。',
    },
    {
      displayText:
        '消す前に、残しておきたいものがないか確認しましょう。やめるなら「キャンセル」です。',
      voiceText:
        'メニューから削除を選ぶと、アプリをスマートフォンから取り除けます。アプリによっては、中に保存していた写真やメモなどが一緒に消えてしまう場合があります。消す前に、そのアプリの中に残しておきたいものがないか確認しましょう。やめたければ「キャンセル」です。よりそいAIは代わりに押しません。',
      simplifyDisplayText: '消す前に、残したいものがないか確認。',
      simplifyVoiceText:
        '消すと写真やメモも消えることがあります。残したいものがないか確認してからにしてください。',
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
        '「許可しますか？」などの確認が画面に出ている状態のままにしてください。背面支援中なら、ポップアップが出たときに通知と音声で説明します。準備できたら「できました」です。',
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
        '説明してほしい文章やポップアップが出ている画面を開いてください。開けたら「ポップアップを読み取る」で文字を確認できます。勝手に他の画面を見ることはしません。',
      simplifyDisplayText: '説明したい画面を開きます。',
      simplifyVoiceText:
        '説明したい文章が出ている画面を開いてください。',
    },
    {
      displayText: 'その文章は、操作の確認や注意を伝えています。',
      voiceText:
        '多くの場合、その文章は「この操作をしてよいか」「注意してほしいこと」を伝えています。急いで押さず、内容を読んでから決めてください。読み取った文字があれば、それに合わせて説明します。',
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
        '画面共有のあと、「電話」アプリを開いてください。アプリに戻らなくて大丈夫です。番号が見つかったら通知と音声でお伝えします。自動ではかけません。',
      simplifyDisplayText: '緑の電話マークを開きます。',
      simplifyVoiceText:
        'ホーム画面の緑の電話マークを押してください。アプリに戻らなくて大丈夫です。',
    },
    {
      displayText: '気になる番号が見える画面のままにしてください。',
      voiceText:
        '着信履歴など、気になる番号が見えるようにしてください。見つかったら通知でお伝えします。「安全です」とは言いません。',
      simplifyDisplayText: '番号が見えるままにします。',
      simplifyVoiceText:
        '気になる番号が見える画面のままにしてください。',
    },
  ],
};

const SAFETY_MESSAGE: SessionScript = {
  id: 'sf-message',
  title: 'メッセージの確認',
  isDemo: DEMO,
  steps: [
    {
      displayText: 'メールまたはメッセージを開いてください。',
      voiceText: 'メールやメッセージを開いてください。見つかったらお伝えします。',
      simplifyDisplayText: 'メールやメッセージを開きます。',
      simplifyVoiceText: 'メールやメッセージを開いてください。見つかったらお伝えします。',
    },
    {
      displayText: '気になる文章を画面に出したままにしてください。',
      voiceText:
        '気になるSMSやメールを開いたままにしてください。リンクはまだ押さないでください。見つかったら通知でお伝えします。「安全です」とは言いません。',
      simplifyDisplayText: '怪しい文を開いたまま、リンクは押さない。',
      simplifyVoiceText:
        '怪しい文を開いたままにしてください。青いリンクはまだ押さないでください。',
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

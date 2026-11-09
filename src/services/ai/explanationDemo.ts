import type { AiResponse } from '../../types/ai';
import type { ConsultHistoryTurn } from './types';

const DEMO_PREFIX = '【デモ・AI未接続】';

export type ExplanationDemoInput = {
  text: string;
  choiceLabel?: string;
  history?: ConsultHistoryTurn[];
};

/**
 * 文章解説のデモ応答。
 * 許可/確認ダイアログや専門用語を高齢者向けの5区画で説明する。
 * 文脈不足では許可/拒否を勧めず、追加質問する。
 */
export function buildDemoExplanationResponse(
  input: ExplanationDemoInput,
): AiResponse | null {
  const combined = `${input.choiceLabel ?? ''} ${input.text}`.trim();
  const normalized = combined.replace(/\s+/g, '');

  if (!normalized) {
    return {
      status: 'need_more_info',
      mode: 'demo',
      message: `${DEMO_PREFIX} 解説したい文章を書くか、種類を選んでください。`,
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

  if (
    isPhotoPermission(normalized) ||
    (isGenericPermission(normalized) && normalized.includes('写真'))
  ) {
    return buildPermissionExplanation({
      displayedText: '写真へのアクセスを許可しますか？',
      plainMeaning:
        'このアプリに、端末の中の写真を見せてよいか、聞いている画面です。',
      whatHappens:
        '「許可」すると、アプリから写真を選んだり表示したりできるようになります。「許可しない」と、写真を使う機能は使えません。',
      cautions:
        'どのアプリの画面か分からないときは、許可を急がないでください。知らないアプリなら特に慎重に。',
      judgmentPoints:
        '写真を使う必要が本当にあるか、信頼できるアプリかを考えてください。分からなければ「今はしない／許可しない」でも大丈夫です。',
      voiceText:
        '写真へのアクセスを許可するかどうかの確認です。許可すると写真を選べるようになります。どのアプリか分からないときは、許可を急がないでください。',
    });
  }

  if (isInstallConfirm(normalized)) {
    return buildPermissionExplanation({
      displayedText: 'インストールしますか？',
      plainMeaning: '新しいアプリや機能を、端末に入れてよいか確認する画面です。',
      whatHappens:
        '「入れる／インストール」を選ぶと、アプリが端末に追加されます。「キャンセル」なら追加されません。',
      cautions:
        '身に覚えのないインストール確認は、いったん止めてください。公式ストア以外からの入れ方には特に注意が必要です。',
      judgmentPoints:
        '何のアプリか、どこから入れようとしているかが分かると判断しやすいです。分からなければ「入れない」を選んでください。',
      voiceText:
        'アプリをインストールしてよいかの確認です。入れたいものがはっきりしないときは、キャンセルして大丈夫です。',
    });
  }

  if (isMicOrCamera(normalized)) {
    return buildPermissionExplanation({
      displayedText: extractDisplaySnippet(combined) || 'マイクやカメラの許可',
      plainMeaning:
        'マイクやカメラを、そのアプリに使わせてよいか聞いている確認です。',
      whatHappens:
        '許可すると通話・撮影・音声入力などに使われます。拒否すると、その機能は使えません。',
      cautions:
        'マイクとカメラは個人の様子が伝わる大切な権限です。知らないアプリでは許可を急がないでください。',
      judgmentPoints:
        'いま使っている機能に本当に必要か、信頼できる相手かを考えてください。こちらから許可・拒否は決めません。',
      needsContext: !hasAppContext(normalized),
      voiceText:
        'マイクやカメラの許可確認です。必要なとき以外は、許可しなくても構いません。',
    });
  }

  if (isMoneyOrAccount(normalized)) {
    return {
      status: 'need_more_info',
      mode: 'demo',
      message: `${DEMO_PREFIX} お金やアカウントに関わる表示は、慎重に扱います。許可や削除をこちらから勧めません。`,
      question:
        'どのアプリ（またはどの会社）の画面で、どんな確認が出ていますか？短い言葉で教えてください。',
      choices: [
        '銀行・カードの画面',
        'AppleやGoogleのアカウント',
        'その他のアプリ',
        '分からない',
      ],
      displayText: 'お金・アカウントの確認には、もう少し情報が必要です。',
      voiceText:
        'お金やアカウントの確認は大切なので、どの画面か教えてください。こちらから許可や削除は勧めません。',
    };
  }

  if (isLocationPermission(normalized)) {
    return buildPermissionExplanation({
      displayedText: '位置情報へのアクセスを許可しますか？',
      plainMeaning: 'いまいる場所の情報を、アプリに伝えてよいかの確認です。',
      whatHappens:
        '許可すると地図や天気などで場所を使えます。拒否すると、場所を使う機能は制限されます。',
      cautions:
        '位置情報は個人の行動が分かる大切な情報です。必要がなければ許可しなくても大丈夫です。',
      judgmentPoints:
        '地図など場所が必要な機能か、信頼できるアプリかを考えてください。',
      voiceText:
        '位置情報の許可確認です。必要がはっきりしないときは、許可しない選択でも構いません。',
    });
  }

  if (isGenericPermission(normalized) && !hasAppContext(normalized)) {
    return {
      status: 'need_more_info',
      mode: 'demo',
      message: `${DEMO_PREFIX} 「許可しますか？」という確認ですね。どのアプリの画面か分かると、正確に説明できます。許可・拒否はこちらから決めません。`,
      question: 'どのアプリで、その確認が出ましたか？',
      choices: [
        'LINE',
        '電話・連絡先',
        '写真・カメラ',
        '分からない・その他',
      ],
      displayText: 'どのアプリの許可確認か教えてください。',
    };
  }

  if (isTechTerm(normalized)) {
    const term = detectTechTerm(normalized);
    return buildTermExplanation(term);
  }

  if (
    input.choiceLabel === '許可しますか？と出た' ||
    input.choiceLabel === 'インストールの確認' ||
    input.choiceLabel === '専門用語が分からない' ||
    input.choiceLabel === 'その他の文章'
  ) {
    return {
      status: 'need_more_info',
      mode: 'demo',
      message: `${DEMO_PREFIX} 画面に出ている文章を、そのまま書いてください（スクリーンショットから取り込んでも大丈夫です）。`,
      question: '表示されている短い文章を教えてください。',
      displayText: '表示文を入力してください。',
      choices: ['最初の選択肢に戻る'],
    };
  }

  // 文面がある場合の一般デモ解説（断定を避ける）
  if (combined.length > 0) {
    const snippet = truncate(combined, 60);
    return buildPermissionExplanation({
      displayedText: snippet,
      plainMeaning:
        '画面の確認や説明の文章だと受け取っています。詳しい意味は、前後の画面やアプリ名があるとより正確になります。',
      whatHappens:
        '表示だけでは、押したあとに何が起きるか断定できません。許可や送信のボタンは、意味が分かるまで急がなくて大丈夫です。',
      cautions:
        'お金・パスワード・個人情報・位置・マイク・カメラに関わる表示は特に慎重に。',
      judgmentPoints:
        'どのアプリか、なぜその確認が出たか分かる情報があれば教えてください。こちらから許可・拒否は勧めません。',
      needsContext: true,
      voiceText:
        'いただいた文章の意味を、デモで短く整理しました。どのアプリの画面か分かると、もっと正確に説明できます。',
    });
  }

  return null;
}

function buildPermissionExplanation(args: {
  displayedText: string;
  plainMeaning: string;
  whatHappens: string;
  cautions: string;
  judgmentPoints: string;
  voiceText: string;
  needsContext?: boolean;
}): AiResponse {
  if (args.needsContext) {
    return {
      status: 'explained',
      mode: 'demo',
      message: `${DEMO_PREFIX} 分かる範囲で説明します。許可や拒否はこちらから勧めません。`,
      displayText: args.plainMeaning,
      voiceText: args.voiceText,
      explanation: {
        displayedText: args.displayedText,
        plainMeaning: args.plainMeaning,
        whatHappens: args.whatHappens,
        cautions: args.cautions,
        judgmentPoints: args.judgmentPoints,
      },
      question: 'どのアプリの画面でしたか？分かれば教えてください。',
      choices: ['LINE', '設定アプリ', '分からない', '最初の選択肢に戻る'],
    };
  }

  return {
    status: 'explained',
    mode: 'demo',
    message: `${DEMO_PREFIX} 表示の意味を整理しました。本物のAI解説ではありません。`,
    displayText: args.plainMeaning,
    voiceText: args.voiceText,
    explanation: {
      displayedText: args.displayedText,
      plainMeaning: args.plainMeaning,
      whatHappens: args.whatHappens,
      cautions: args.cautions,
      judgmentPoints: args.judgmentPoints,
    },
    choices: ['別の文章を解説する', '最初の選択肢に戻る'],
  };
}

function buildTermExplanation(term: string): AiResponse {
  const dictionary: Record<
    string,
    { plain: string; happens: string; caution: string; point: string }
  > = {
    アプリ: {
      plain: 'スマートフォンで使う小さな道具・プログラムのことです。',
      happens: 'アプリストアから入れると、ホーム画面などにアイコンが並びます。',
      caution: '知らないところから入れると危険な場合があります。',
      point: '公式のストアから入れるのが安心です。',
    },
    インストール: {
      plain: 'アプリを端末に入れることです。',
      happens: 'インストールすると、そのアプリが使えるようになります。',
      caution: '身に覚えのないインストールは止めてください。',
      point: '何を入れる画面か分からなければ、キャンセルで大丈夫です。',
    },
    アンインストール: {
      plain: 'アプリを端末から消すことです。',
      happens: '消すと、そのアプリは使えなくなります（必要なデータも消えることがあります）。',
      caution: '消してよいか分からないアプリは、急いで消さないでください。',
      point: 'よく使うアプリかどうか確認してから決めましょう。',
    },
    同期: {
      plain: '別の場所にある情報を、同じ内容にそろえることです。',
      happens: '同期すると、別の端末やサービスにも同じデータが反映されることがあります。',
      caution: '個人情報がどこへ送られるか分からない同期は慎重に。',
      point: '何と何をそろえる同期か分かると判断しやすいです。',
    },
    通知: {
      plain: 'アプリからのお知らせが画面に出ることです。',
      happens: '許可すると音やバナーでお知らせが届きます。',
      caution: '通知が多すぎると疲れます。後から設定で変えられます。',
      point: '本当にすぐ知りたいお知らせかどうか考えてください。',
    },
    アクセス権限: {
      plain: 'アプリが写真・マイクなどを使ってよいかの許可のことです。',
      happens: '許可した範囲だけ、アプリがその機能を使えます。',
      caution: '必要なもの以外は許可しなくても構いません。',
      point: '何のために使う権限かを確認してください。',
    },
    バックアップ: {
      plain: '万一に備えて、データの控えを残すことです。',
      happens: 'バックアップがあると、機種変更や故障のときに復元しやすくなります。',
      caution: 'どこに控えが保存されるか分からないときは急がないでください。',
      point: '公式の案内に沿ったバックアップか確認してください。',
    },
    アカウント: {
      plain: 'あなた専用の利用者情報・ログインのまとまりです。',
      happens: 'アカウントがあると、サービスにサインインして使えます。',
      caution: 'パスワードや認証コードを人に教えないでください。削除は取り消せないことがあります。',
      point: '削除や共有の確認は、特に慎重に。',
    },
    'Wi-Fi': {
      plain: '電波でインターネットにつなぐ仕組みです。',
      happens: '自宅や施設のWi-Fiに接続すると、モバイル通信を使わずにネットが使えます。',
      caution: '知らない無料Wi-Fiでは、大切なお手続きを避けた方が安心です。',
      point: '自宅や信頼できる場所のWi-Fiかを確認してください。',
    },
    Bluetooth: {
      plain: '近くの機器同士を無線でつなぐ仕組みです。',
      happens: 'イヤホンや補聴器などと接続できるようになります。',
      caution: '知らない機器からの接続要求は、安易に許可しないでください。',
      point: 'つなぎたい機器の名前が分かっているか確認してください。',
    },
  };

  const entry = dictionary[term] ?? {
    plain: `「${term}」はスマートフォンでよく使う言葉です。`,
    happens: '場面によって意味が少し違うことがあります。',
    caution: 'お金や個人情報に関わる操作と一緒に出たら、特に慎重に。',
    point: '画面の前後の文も教えてもらえると、より分かりやすく説明できます。',
  };

  return {
    status: 'explained',
    mode: 'demo',
    message: `${DEMO_PREFIX} 専門用語のデモ解説です。`,
    displayText: entry.plain,
    voiceText: `${term}について説明します。${entry.plain} ${entry.happens}`,
    explanation: {
      displayedText: term,
      plainMeaning: entry.plain,
      whatHappens: entry.happens,
      cautions: entry.caution,
      judgmentPoints: entry.point,
    },
    choices: ['別の言葉を知りたい', '最初の選択肢に戻る'],
  };
}

function isPhotoPermission(n: string): boolean {
  return (
    (n.includes('写真') || n.includes('画像')) &&
    (n.includes('許可') || n.includes('アクセス'))
  );
}

function isInstallConfirm(n: string): boolean {
  return (
    n.includes('インストール') ||
    n.includes('インストールしますか') ||
    n.includes('インストールの確認')
  );
}

function isMicOrCamera(n: string): boolean {
  return n.includes('マイク') || n.includes('カメラ');
}

function isLocationPermission(n: string): boolean {
  return n.includes('位置情報') || (n.includes('位置') && n.includes('許可'));
}

function isMoneyOrAccount(n: string): boolean {
  return (
    n.includes('口座') ||
    n.includes('振込') ||
    n.includes('振り込み') ||
    n.includes('課金') ||
    n.includes('支払い') ||
    n.includes('パスワード') ||
    n.includes('アカウントを削除') ||
    n.includes('アカウント削除') ||
    n.includes('個人情報')
  );
}

function isGenericPermission(n: string): boolean {
  return (
    n.includes('許可しますか') ||
    n.includes('アクセスを許可') ||
    n.includes('許可しますか？と出た')
  );
}

function hasAppContext(n: string): boolean {
  return (
    n.includes('LINE') ||
    n.includes('ライン') ||
    n.includes('設定') ||
    n.includes('Safari') ||
    n.includes('Chrome') ||
    n.includes('アプリ名')
  );
}

function isTechTerm(n: string): boolean {
  return detectTechTerm(n) !== '';
}

function detectTechTerm(n: string): string {
  const terms = [
    'アンインストール',
    'インストール',
    'アクセス権限',
    'バックアップ',
    'Bluetooth',
    'アカウント',
    'Wi-Fi',
    '同期',
    '通知',
    'アプリ',
  ];
  for (const term of terms) {
    if (n.includes(term)) {
      return term;
    }
  }
  return '';
}

function extractDisplaySnippet(text: string): string {
  const line = text
    .split(/\n/)
    .map((part) => part.trim())
    .find((part) => part.length > 0);
  return line ? truncate(line, 80) : '';
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max)}…`;
}

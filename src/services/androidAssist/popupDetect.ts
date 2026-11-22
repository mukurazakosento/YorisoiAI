/**
 * JS mirror of AssistPopupDetector / AssistPopupExplainer / AssistSecretRedactor.
 * Used by smokes and in-app guidance; native FGS is the live path on device.
 */

export type PopupKind =
  | 'PERMISSION_CAMERA'
  | 'PERMISSION_MIC'
  | 'PERMISSION_PHOTOS'
  | 'PERMISSION_NOTIFICATIONS'
  | 'PERMISSION_LOCATION'
  | 'PERMISSION_CONTACTS'
  | 'PERMISSION_FILES'
  | 'PERMISSION_GENERIC'
  | 'TERMS'
  | 'UPDATE'
  | 'INSTALL'
  | 'UNKNOWN_DIALOG';

export type PopupDetection = {
  kind: PopupKind;
  fingerprint: string;
  topicLabel: string;
  buttons: string[];
  excerpt: string;
};

export type PopupExplainStep = {
  stepId: string;
  stageId: string;
  displayText: string;
  voiceText: string;
  mode: 'demo';
};

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '');
}

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function looksLikeDialog(n: string): boolean {
  const permissionCue =
    n.includes('許可') ||
    n.includes('アクセス') ||
    n.includes('使ってよろしい') ||
    n.includes('使用を許可');
  const termsCue =
    n.includes('利用規約') ||
    n.includes('プライバシー') ||
    n.includes('同意する') ||
    n.includes('同意して');
  const updateCue =
    n.includes('アップデート') ||
    n.includes('更新があります') ||
    n.includes('新しいバージョン') ||
    n.includes('インストール');
  const questionCue =
    n.includes('しますか') ||
    n.includes('よろしいですか') ||
    n.includes('いいですか') ||
    n.includes('？') ||
    n.includes('?');
  const buttonCue =
    n.includes('許可しない') ||
    n.includes('拒否') ||
    n.includes('キャンセル') ||
    n.includes('一度だけ') ||
    n.includes('アプリの使用中') ||
    n.includes('許可する') ||
    n.includes('同意');
  return (
    (permissionCue && (questionCue || buttonCue)) ||
    (termsCue && buttonCue) ||
    (updateCue && (questionCue || buttonCue)) ||
    (permissionCue && buttonCue)
  );
}

function classifyKind(n: string): PopupKind {
  if (n.includes('カメラ')) return 'PERMISSION_CAMERA';
  if (n.includes('マイク') || (n.includes('音声') && n.includes('録音'))) {
    return 'PERMISSION_MIC';
  }
  if (
    n.includes('写真') ||
    n.includes('画像') ||
    n.includes('ギャラリー') ||
    n.includes('メディア')
  ) {
    return 'PERMISSION_PHOTOS';
  }
  if (n.includes('通知')) return 'PERMISSION_NOTIFICATIONS';
  if (n.includes('位置') || n.includes('gps') || n.includes('付近の')) {
    return 'PERMISSION_LOCATION';
  }
  if (n.includes('連絡先') || n.includes('アドレス帳')) return 'PERMISSION_CONTACTS';
  if (n.includes('ファイル') || n.includes('ストレージ') || n.includes('フォルダ')) {
    return 'PERMISSION_FILES';
  }
  if (
    n.includes('利用規約') ||
    n.includes('プライバシーポリシー') ||
    n.includes('同意する')
  ) {
    return 'TERMS';
  }
  if (n.includes('アップデート') || n.includes('新しいバージョン') || n.includes('更新')) {
    return 'UPDATE';
  }
  if (n.includes('インストール')) return 'INSTALL';
  if (n.includes('許可') || n.includes('アクセス')) return 'PERMISSION_GENERIC';
  return 'UNKNOWN_DIALOG';
}

function topicLabelFor(kind: PopupKind, n: string): string {
  switch (kind) {
    case 'PERMISSION_CAMERA':
      return 'カメラ';
    case 'PERMISSION_MIC':
      return 'マイク';
    case 'PERMISSION_PHOTOS':
      return '写真・画像';
    case 'PERMISSION_NOTIFICATIONS':
      return '通知';
    case 'PERMISSION_LOCATION':
      return '位置情報';
    case 'PERMISSION_CONTACTS':
      return '連絡先';
    case 'PERMISSION_FILES':
      return 'ファイル';
    case 'PERMISSION_GENERIC':
      return n.includes('bluetooth') ? 'Bluetooth' : 'アプリの機能';
    case 'TERMS':
      return '利用規約・同意';
    case 'UPDATE':
      return 'アプリの更新';
    case 'INSTALL':
      return 'インストール';
    default:
      return '確認画面';
  }
}

function extractButtons(raw: string, n: string): string[] {
  const candidates = [
    '許可しない',
    '許可する',
    '許可',
    '拒否',
    'キャンセル',
    '一度だけ',
    '今回のみ',
    'アプリの使用中のみ',
    '使用中のみ',
    '同意する',
    '同意しない',
    '後で',
    '今はしない',
    '更新',
    'インストール',
    '閉じる',
    'OK',
    'はい',
    'いいえ',
  ];
  const found: string[] = [];
  for (const c of candidates) {
    if (raw.includes(c) || n.includes(normalize(c))) {
      if (c === '許可' && (found.includes('許可する') || found.includes('許可しない'))) {
        continue;
      }
      found.push(c);
    }
  }
  return [...new Set(found)].slice(0, 4);
}

export function detectPopup(ocrText: string): PopupDetection | null {
  const raw = ocrText.trim();
  if (raw.length < 4) return null;
  const n = normalize(raw);
  if (!looksLikeDialog(n)) return null;
  const buttons = extractButtons(raw, n);
  const kind = classifyKind(n);
  const topicLabel = topicLabelFor(kind, n);
  const excerpt = clip(raw, 160);
  const fingerprint = [kind, topicLabel, [...buttons].sort().join('|')].join('#');
  return { kind, fingerprint, topicLabel, buttons, excerpt };
}

export function requiredPopupStreak(
  detection: PopupDetection,
  intervalMs: number,
): number {
  if (intervalMs >= 15_000) return 1;
  const strong =
    detection.kind !== 'UNKNOWN_DIALOG' && detection.buttons.length > 0;
  return strong ? 1 : 2;
}

export function isPopupStable(
  previousFingerprint: string | null | undefined,
  current: PopupDetection,
  streak: number,
  needed = 2,
): boolean {
  if (previousFingerprint !== current.fingerprint) return false;
  return streak >= Math.max(1, needed);
}

export function redactSecretsForVoice(text: string): string {
  return text
    .replace(
      /(パスワード|パスコード|暗証番号|password|passcode)\s*[:：]?\s*\S+/gi,
      'パスワード（伏せます）',
    )
    .replace(
      /(認証コード|確認コード|ワンタイム|OTP|コード)\s*[:：]?\s*\d{4,8}/gi,
      '認証コード（伏せます）',
    )
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, '番号（伏せます）')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, 'メール（伏せます）');
}

export function containsSensitive(text: string): boolean {
  return (
    /(パスワード|パスコード|暗証番号|password|passcode)\s*[:：]?\s*\S+/i.test(text) ||
    /(認証コード|確認コード|ワンタイム|OTP|コード)\s*[:：]?\s*\d{4,8}/i.test(text) ||
    /\b(?:\d[ -]*?){13,19}\b/.test(text)
  );
}

function contentFor(d: PopupDetection): {
  what: string;
  why: string;
  outcomes: string;
  caution: string;
} {
  switch (d.kind) {
    case 'PERMISSION_CAMERA':
      return {
        what: 'カメラを使ってよいか聞いている画面です。',
        why: '写真や動画を撮る機能に必要です。',
        outcomes: '許可するとカメラが使えます。許可しないとその機能は使えません。',
        caution: '知らないアプリなら急がなくて大丈夫です。',
      };
    case 'PERMISSION_MIC':
      return {
        what: 'マイクを使ってよいか聞いている画面です。',
        why: '音声入力や通話に使うことがあります。',
        outcomes: '許可するとマイクが使えます。不要なら許可しなくて構いません。',
        caution: '分からなければ「許可しない」でも大丈夫です。',
      };
    case 'PERMISSION_PHOTOS':
      return {
        what: '写真や画像へのアクセスを聞いている画面です。',
        why: 'アルバムから画像を選ぶときに使います。',
        outcomes: '許可すると写真を選べます。許可しないと選べません。',
        caution: '必要なときだけ許可すれば十分です。',
      };
    case 'PERMISSION_NOTIFICATIONS':
      return {
        what: '通知を送ってよいか聞いている画面です。',
        why: 'お知らせやメッセージの着信表示に使います。',
        outcomes: '許可すると通知が届きます。許可しないと画面を開くまで気づきにくいです。',
        caution: 'たくさん来ると疲れることもあるので、必要か考えてください。',
      };
    case 'PERMISSION_LOCATION':
      return {
        what: '位置情報を使ってよいか聞いている画面です。',
        why: '地図や近くの情報に使うことがあります。',
        outcomes: '許可すると位置が伝わります。不要なら許可しなくて構いません。',
        caution: '知らないアプリには特に慎重に。',
      };
    case 'PERMISSION_CONTACTS':
      return {
        what: '連絡先へのアクセスを聞いている画面です。',
        why: '友だちを探す機能などに使うことがあります。',
        outcomes: '許可すると連絡先が読めます。不要なら拒否して大丈夫です。',
        caution: '本当に必要か分からなければ許可を急がないでください。',
      };
    case 'PERMISSION_FILES':
      return {
        what: 'ファイルやストレージへのアクセスを聞いている画面です。',
        why: '保存や読み込みに使うことがあります。',
        outcomes: '許可するとファイルに触れます。不要なら許可しなくて構いません。',
        caution: '目的が分からなければ「許可しない」で大丈夫です。',
      };
    case 'PERMISSION_GENERIC':
      return {
        what: `「${d.topicLabel}」の利用許可を聞いている画面です。`,
        why: 'アプリがその機能を使うための確認です。',
        outcomes: '許可するとその機能が使えます。拒否すると使えません。',
        caution: '断定はしません。分からなければ拒否でも構いません。',
      };
    case 'TERMS':
      return {
        what: '利用規約や同意の確認画面です。',
        why: 'サービス利用の条件に同意するかを聞いています。',
        outcomes: '同意すると先へ進めます。同意しないと使えないことが多いです。',
        caution: '内容が読めないときは、急いで同意しなくて大丈夫です。',
      };
    case 'UPDATE':
      return {
        what: 'アプリの更新を進める確認画面です。',
        why: '新しい版に入れ替えるかを聞いています。',
        outcomes: '更新すると新しい機能や修正が入ることがあります。',
        caution: '通信中や充電切れに注意してください。急かされても慌てないでください。',
      };
    case 'INSTALL':
      return {
        what: 'アプリを入れてよいかの確認画面です。',
        why: '端末にアプリを追加するかを聞いています。',
        outcomes: '入れるとホームに追加されます。入れなければ追加されません。',
        caution: '何のアプリか分からなければ、入れないでください。',
      };
    default:
      return {
        what: '何かを確認する画面のようです。',
        why: 'はっきりした種類までは読み取れませんでした。',
        outcomes: 'ボタンを押す前に、文言をもう一度見てください。',
        caution: '推測では断定しません。分からなければキャンセルや戻るを選んでください。',
      };
  }
}

export function explainPopup(detection: PopupDetection): PopupExplainStep {
  const sensitive = containsSensitive(detection.excerpt);
  const buttons = detection.buttons;
  const buttonPhrase =
    buttons.length === 0
      ? '画面下のボタンをよく見てください。'
      : `ボタンは「${buttons.join('」「')}」などです。`;
  const { what, why, outcomes, caution } = contentFor(detection);
  const display = [what, buttonPhrase, caution].join(' ').slice(0, 120);
  let voiceRaw = `${what}${why}${buttonPhrase}${outcomes}${caution}よりそいAIは代わりに押しません。`;
  if (sensitive) {
    voiceRaw += 'パスワードや番号は読み上げません。';
  }
  const hash = Math.abs(
    detection.fingerprint.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0),
  );
  return {
    stepId: `popup-${hash}`,
    stageId: `popup-${detection.kind.toLowerCase()}`,
    displayText: display,
    voiceText: redactSecretsForVoice(voiceRaw),
    mode: 'demo',
  };
}

export function explainScreenText(ocrText: string): PopupExplainStep {
  const raw = ocrText.trim().replace(/\s+/g, ' ');
  if (!raw) {
    return {
      stepId: 'ocr-unreadable',
      stageId: 'unreadable',
      displayText: '画面をうまく読み取れませんでした。',
      voiceText:
        '画面をうまく読み取れませんでした。明るいところで、もう少し待つか、アプリに戻ってください。',
      mode: 'demo',
    };
  }
  if (containsSensitive(raw)) {
    return {
      stepId: 'explain-sensitive',
      stageId: 'explain-sensitive',
      displayText: '秘密の文字があるので詳しく読み上げません。',
      voiceText:
        'パスワードや番号らしき文字があるので、詳しくは読み上げません。自分の目で確認してください。',
      mode: 'demo',
    };
  }
  const detection = detectPopup(raw);
  if (detection) {
    return explainPopup(detection);
  }
  const clipped = raw.length > 80 ? `${raw.slice(0, 80)}…` : raw;
  const hash = Math.abs(
    clipped.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0),
  );
  return {
    stepId: `explain-ocr-${hash}`,
    stageId: 'explain-screen',
    displayText: `画面には「${clipped.slice(0, 40)}」とあります。`,
    voiceText: `いまの画面の文字は、だいたい次のとおりです。「${redactSecretsForVoice(clipped)}」。分からなければアプリに戻って聞いてください。代わりには操作しません。`,
    mode: 'demo',
  };
}

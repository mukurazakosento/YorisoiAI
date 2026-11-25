/**
 * アプリ削除（アンインストール）専用の高齢者向け案内。
 * 既存の汎用操作支援・インストール案内とは別経路。
 * 自動タップ・自動削除・自動確認はしない。
 *
 * 方針:
 * - 秒数で長押しを指定しない（メニューが出るまで、と伝える）
 * - 「長押ししてメニューが出るまで」と結果説明を重視
 * - 削除ボタンを押したあとに何が起きるか（確認ダイアログ等）を先に伝える
 */

export type UninstallGuidanceStep = {
  stepId: string;
  stageId: string;
  displayText: string;
  voiceText: string;
};

const DELETE_LABELS = [
  'アンインストール',
  '削除',
  'アンインストールしますか',
  '削除しますか',
  'アプリを削除',
  'このアプリを削除',
  'OK',
  'はい',
] as const;

/**
 * 目標文が「アプリを消したい」系か。インストールとは別に判定する。
 */
export function looksLikeUninstallGoal(goalNormalized: string): boolean {
  const g = goalNormalized.replace(/\s+/g, '').toLowerCase();
  if (!g) {
    return false;
  }
  if (
    g.includes('アンインストール') ||
    g.includes('uninstall') ||
    g.includes('アプリを消し') ||
    g.includes('アプリを削除') ||
    g.includes('アプリ削除') ||
    g.includes('アプリを消したい') ||
    g.includes('消したいアプリ') ||
    g.includes('アプリを消す') ||
    g.includes('アプリ消し')
  ) {
    return true;
  }
  // 「消したい」単体でも操作支援の削除導線として扱う（入れたいは除外）
  if (
    (g.includes('消し') || g.includes('削除')) &&
    (g.includes('アプリ') || g.includes('アイコン')) &&
    !g.includes('入れ') &&
    !g.includes('インストール')
  ) {
    return true;
  }
  return false;
}

/**
 * 相談開始などから渡す正規サマリー（検出・デモ脚本のキーになる）。
 */
export const UNINSTALL_GOAL_SUMMARY = 'アプリをアンインストールしたい';

/**
 * OCR に応じた削除専用の次の一手。一度に一つだけ。
 */
export function buildUninstallGuidanceStep(input: {
  ocrNormalized: string;
  ocrRaw: string;
}): UninstallGuidanceStep {
  const o = input.ocrNormalized;
  const raw = input.ocrRaw;

  if (looksLikeUninstallConfirmDialog(o)) {
    return uninstallConfirmConsequenceStep(raw, o);
  }

  if (looksLikeUninstallMenu(o)) {
    return uninstallTapDeleteStep(raw, o);
  }

  if (looksLikeHomeOrAppList(o)) {
    return uninstallLongPressStep();
  }

  return uninstallFindAppStep();
}

function looksLikeUninstallConfirmDialog(o: string): boolean {
  const ask =
    o.includes('しますか') ||
    o.includes('よろしい') ||
    o.includes('ほんとうに') ||
    o.includes('本当に') ||
    o.includes('取り消せ') ||
    o.includes('削除します') ||
    o.includes('アンインストールします');
  const del =
    o.includes('削除') ||
    o.includes('アンインストール') ||
    o.includes('消します');
  return ask && del;
}

function looksLikeUninstallMenu(o: string): boolean {
  return (
    o.includes('アンインストール') ||
    o.includes('アプリ情報') ||
    (o.includes('削除') &&
      (o.includes('アプリ') ||
        o.includes('メニュー') ||
        o.includes('編集') ||
        o.includes('ウィジェット') ||
        o.includes('無効')))
  );
}

function looksLikeHomeOrAppList(o: string): boolean {
  // ホーム／ドロワーっぽい手がかり。厳密でなくてよい（無いときは find-app へ）。
  return (
    o.includes('google') ||
    o.includes('playストア') ||
    o.includes('電話') ||
    o.includes('メッセージ') ||
    o.includes('設定') ||
    o.includes('カメラ') ||
    o.includes('クロック') ||
    o.includes('天気') ||
    o.length > 8
  );
}

function uninstallFindAppStep(): UninstallGuidanceStep {
  return {
    stepId: 'uninstall-find-app',
    stageId: 'uninstall-find',
    displayText: '消したいアプリが見える画面まで進んでください。',
    voiceText:
      'ホーム画面やアプリ一覧で、消したいアプリのアイコンが見えるところまで進んでください。よりそいAIは代わりに消しません。',
  };
}

function uninstallLongPressStep(): UninstallGuidanceStep {
  return {
    stepId: 'uninstall-long-press',
    stageId: 'uninstall-long-press',
    displayText: '消したいアプリを長押しして、メニューが出るまで待ってください。',
    voiceText:
      '消したいアプリのアイコンを指で長押ししてください。メニューや小さな窓が出るまで、そのまま押したままにしてください。何秒、と数えなくて大丈夫です。メニューが出たら指を離してください。',
  };
}

function uninstallTapDeleteStep(raw: string, o: string): UninstallGuidanceStep {
  const label = pickDeleteLabel(raw, o);
  const quoted = label ? `「${label}」` : '「削除」や「アンインストール」';
  return {
    stepId: 'uninstall-tap-delete',
    stageId: 'uninstall-menu',
    displayText: `${quoted}を押してください。押すと確認の画面が出ることが多いです。`,
    voiceText: `メニューの${quoted}を押してください。押すと「本当に削除しますか」などの確認が出ることが多いです。まだ消えていません。確認の画面で内容を読んでから、ご自身で進めてください。代わりには押しません。`,
  };
}

function uninstallConfirmConsequenceStep(
  raw: string,
  o: string,
): UninstallGuidanceStep {
  const label = pickDeleteLabel(raw, o) ?? '削除';
  return {
    stepId: 'uninstall-confirm-consequence',
    stageId: 'uninstall-confirm',
    displayText: `「${label}」を押すとアプリが消えます。やめるなら「キャンセル」です。`,
    voiceText: `確認の画面です。「${label}」や「OK」を押すと、このアプリが端末から消えます。あとでストアから入れ直せることも多いですが、アプリの中のデータが消えることもあります。やめたければ「キャンセル」や「いいえ」を押してください。よりそいAIは代わりに押しません。`,
  };
}

function pickDeleteLabel(raw: string, o: string): string | null {
  for (const label of DELETE_LABELS) {
    if (raw.includes(label) || o.includes(label.replace(/\s+/g, ''))) {
      // Prefer the shorter actionable labels for display
      if (label === 'アンインストールしますか' || label === '削除しますか') {
        continue;
      }
      if (label === 'OK' || label === 'はい') {
        // Only use OK/はい when a delete word is also present (already gated)
        continue;
      }
      return label;
    }
  }
  if (o.includes('アンインストール')) {
    return 'アンインストール';
  }
  if (o.includes('削除')) {
    return '削除';
  }
  return null;
}

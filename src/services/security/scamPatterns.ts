/**
 * SMS / メール向けの端末内ヒューリスティック。
 * 外部 AI や鍵は不要。「安全です」とは言わない材料だけを返す。
 */

export type ScamPatternHit = {
  id: string;
  label: string;
};

/**
 * 詐欺・フィッシングでよく出る表現を検出する。
 * ヒットがあっても断定はしない（呼び出し側が riskLevel を決める）。
 */
export function detectScamPatterns(text: string): ScamPatternHit[] {
  const n = (text ?? '').replace(/\s+/g, '');
  const hits: ScamPatternHit[] = [];

  if (/至急|すぐに|今すぐ|期限|残り\d|放置|本日中|あと\d/u.test(n)) {
    hits.push({ id: 'urgency', label: '不自然に急がせる表現' });
  }
  if (/未払い|支払い|料金|請求|振込|振り込み|口座|送金|ギフト券/u.test(n)) {
    hits.push({ id: 'money', label: '料金・振込・金銭の要求' });
  }
  if (/アカウント.*停止|停止.*アカウント|凍結|利用停止|ログイン.*確認/u.test(n)) {
    hits.push({ id: 'account', label: 'アカウント停止を口実にした誘導' });
  }
  if (
    /パスワード|暗証番号|認証コード|個人情報|マイナンバー|クレジットカード/u.test(
      n,
    )
  ) {
    hits.push({ id: 'secrets', label: '個人情報や暗証の要求' });
  }
  if (/http|www\.|bit\.ly|クリック|こちらをタップ|リンク/i.test(text ?? '')) {
    hits.push({ id: 'link', label: 'リンクへの誘導' });
  }
  if (
    /税務署|警察|警察庁|警視庁|裁判所|配送業者|ヤマト|佐川|Amazon|アマゾン|Apple|アップル|銀行|カード会社/u.test(
      n,
    ) &&
    (/です|ます|ください|お願い/u.test(n) || hits.length > 0)
  ) {
    hits.push({
      id: 'impersonation',
      label: '公的機関や有名企業を名乗る可能性',
    });
  }
  if (/捜査対象|被疑者|容疑者|逮捕|保釈|保釈金/u.test(n)) {
    hits.push({
      id: 'police_fear',
      label: '捜査・逮捕・保釈など不安を煽る表現',
    });
  }
  if (/当選|還付|給付金|無料で貰える|特別なご案内/u.test(n)) {
    hits.push({ id: 'prize', label: '当選・還付などの甘い話' });
  }

  return hits;
}

export function scamPatternLabels(hits: ScamPatternHit[]): string[] {
  return hits.map((h) => h.label);
}

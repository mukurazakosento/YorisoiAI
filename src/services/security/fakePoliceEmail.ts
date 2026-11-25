/**
 * 偽警察・捜査名目メール向けの端末内ヒューリスティックと説明文。
 * 「絶対に詐欺」とは言わず、「詐欺の可能性が高い」と理由・次の行動を示す。
 * 自動タップ・自動送信・URL自動オープンはしない。
 */

import type { ScamPatternHit } from './scamPatterns';

/** デモ／スモーク用の架空メール（実在機関の本物ではない）。 */
export const FAKE_POLICE_EMAIL_DEMO = {
  from: 'keishicho-sodan@example-police-demo.invalid',
  subject: 'あなたが捜査対象となっています',
  body: [
    '【デモ・架空の文面です。実在の警察からのメールではありません】',
    '差出人: 警察庁 サイバー捜査相談窓口',
    '件名: あなたが捜査対象となっています',
    '',
    'あなたの口座が犯罪に利用された疑いがあります。',
    '至急、下記URLから本人確認を行ってください。',
    'https://example-police-demo.invalid/verify-urgent',
    '手続きを怠ると逮捕される可能性があります。',
    '保釈金の案内もこちらで確認できます。',
  ].join('\n'),
} as const;

export const FAKE_POLICE_DEMO_FULL_TEXT = [
  `差出人: ${FAKE_POLICE_EMAIL_DEMO.from}`,
  `件名: ${FAKE_POLICE_EMAIL_DEMO.subject}`,
  FAKE_POLICE_EMAIL_DEMO.body,
].join('\n');

export type FakePoliceReason = {
  id: string;
  label: string;
};

/**
 * 偽警察・捜査脅迫系の手がかり。ヒットしても断定はしない。
 */
export function detectFakePolicePatterns(text: string): FakePoliceReason[] {
  const n = (text ?? '').replace(/\s+/g, '');
  const hits: FakePoliceReason[] = [];

  if (
    /警察庁|警視庁|警察署|警察官|警察から|サイバー捜査|捜査機関/u.test(n)
  ) {
    hits.push({
      id: 'police_impersonation',
      label: '警察や捜査機関を名乗っている',
    });
  }
  if (/捜査対象|被疑者|容疑者|犯罪に利用|口座が犯罪|不正利用の疑い/u.test(n)) {
    hits.push({
      id: 'investigation_claim',
      label: '捜査対象や犯罪利用をほのめかして不安にさせている',
    });
  }
  if (/逮捕|身柄|連行|処罰/u.test(n)) {
    hits.push({
      id: 'arrest_threat',
      label: '逮捕などの強い脅しがある',
    });
  }
  if (/保釈|保釈金/u.test(n)) {
    hits.push({
      id: 'bail_money',
      label: '保釈金など金銭の話が出ている',
    });
  }
  if (
    /http|www\.|bit\.ly|クリック|こちらをタップ|下記URL|URLから|リンク/i.test(
      text ?? '',
    ) &&
    (/至急|すぐに|今すぐ|本日中|放置/u.test(n) || hits.length > 0)
  ) {
    hits.push({
      id: 'urgent_url',
      label: '急いでURLを開かせようとしている',
    });
  }

  return hits;
}

export function isFakePoliceStyle(
  fakeHits: FakePoliceReason[],
  scamHits: ScamPatternHit[],
): boolean {
  const ids = new Set([
    ...fakeHits.map((h) => h.id),
    ...scamHits.map((h) => h.id),
  ]);
  const hasPolice =
    ids.has('police_impersonation') ||
    ids.has('investigation_claim') ||
    scamHits.some((h) => h.id === 'impersonation');
  const hasFear =
    ids.has('arrest_threat') ||
    ids.has('bail_money') ||
    ids.has('investigation_claim');
  const hasLure =
    ids.has('urgent_url') ||
    scamHits.some((h) => h.id === 'link' || h.id === 'urgency' || h.id === 'money');
  // 警察名指し +（脅し or URL誘導）で偽警察スタイルとみなす
  return hasPolice && (hasFear || hasLure) && fakeHits.length + scamHits.length >= 2;
}

export const FAKE_POLICE_HEADLINE = '詐欺の可能性が高いメールです';

export const FAKE_POLICE_ACTIONS = [
  'URLや添付は開かない',
  '個人情報・口座・暗証番号を入力しない',
  '振込や送金はしない',
  '不安なときは家族に相談する',
  '警察相談専用電話 #9110（シャープくじゅういちゼロ）に相談する',
] as const;

/**
 * 理由＋次の行動つきの説明文を組み立てる。
 */
export function buildFakePoliceEmailExplanation(input: {
  senderNote: string;
  fakeHits: FakePoliceReason[];
  scamLabels: string[];
  prefix: string;
}): {
  displayText: string;
  message: string;
  voiceText: string;
  rationale: string;
  recommendedActions: string[];
} {
  // 怪しい理由は短い文を最大2つ（長い箇条書きにしない）
  const reasonLabels = [
    ...input.fakeHits.map((h) => h.label),
    ...input.scamLabels.filter(
      (label) => !input.fakeHits.some((h) => h.label === label),
    ),
  ].slice(0, 2);

  const reasonsBlock =
    reasonLabels.length > 0
      ? `怪しいと考えられる理由: ${reasonLabels.join('。')}。`
      : '怪しいと考えられる理由: 警察を名乗り、急かしてリンクへ誘導する文面です。';

  const shortActions = [
    'URLや添付は開かない',
    '個人情報・口座・暗証番号を入力しない',
    '不安なときは家族か、警察相談のシャープくじゅういちゼロに相談する',
  ];
  const actionsBlock = `安全に対応するには: ${shortActions.join('。')}。`;

  return {
    displayText: FAKE_POLICE_HEADLINE,
    message: `${input.prefix} ${input.senderNote}${FAKE_POLICE_HEADLINE}。${reasonsBlock}${actionsBlock}「絶対に詐欺」と断定はしませんが、急いで手続きしないでください。`,
    voiceText: `${FAKE_POLICE_HEADLINE}。${reasonsBlock}リンクは開かず、お金や個人情報も渡さないでください。不安なら家族か、警察相談のシャープくじゅういちゼロに相談してください。自動では送りません。`,
    rationale: reasonsBlock,
    recommendedActions: [...FAKE_POLICE_ACTIONS],
  };
}

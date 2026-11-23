/**
 * 日本の電話番号の端末内分類（キャリア種別の粗い推定）。
 * 公開の迷惑電話DB・実検索は別経路。ここだけでは「安全」と断定しない。
 */

import { normalizePhoneDigits } from './phone';

export type PhoneNumberKind =
  | 'emergency'
  | 'toll_free'
  | 'mobile'
  | 'ip_phone'
  | 'landline'
  | 'unknown';

export type PhoneHeuristicResult = {
  kind: PhoneNumberKind;
  /** 高齢者向けの短い説明 */
  kindLabel: string;
  /** 注意のヒント（断定しない） */
  hints: string[];
};

/**
 * 番号の桁だけから種別を推定する（ネット不要）。
 */
export function classifyJapanesePhoneNumber(
  phoneNumber: string,
): PhoneHeuristicResult {
  const digits = normalizePhoneDigits(phoneNumber).replace(/^\+81/, '0');
  const bare = digits.replace(/\D/g, '');

  if (
    bare === '110' ||
    bare === '119' ||
    bare === '118' ||
    bare === '171'
  ) {
    return {
      kind: 'emergency',
      kindLabel: '緊急・公的な短い番号の形',
      hints: [
        '本物の緊急通報か、画面の表示をよく確認してください。',
        '知らない相手からの「警察です」などの電話は、折り返しを急がなくて大丈夫です。',
      ],
    };
  }

  if (
    bare.startsWith('0120') ||
    bare.startsWith('0800') ||
    bare.startsWith('0570')
  ) {
    return {
      kind: 'toll_free',
      kindLabel: 'フリーダイヤルやナビダイヤルに多い番号の形',
      hints: [
        '企業の案内窓口で使われることがあります。',
        '番号の形だけでは、相手が本物かどうかは分かりません。',
      ],
    };
  }

  if (
    bare.startsWith('090') ||
    bare.startsWith('080') ||
    bare.startsWith('070')
  ) {
    return {
      kind: 'mobile',
      kindLabel: '携帯電話に多い番号の形',
      hints: [
        '個人の携帯で使われることが多い番号です。',
        '知らない番号でも、すぐにかけ直す必要はありません。',
      ],
    };
  }

  if (bare.startsWith('050')) {
    return {
      kind: 'ip_phone',
      kindLabel: 'IP電話などに多い番号の形',
      hints: [
        'インターネット経由の電話で使われることがあります。',
        '迷惑電話の報告で話題になることもありますが、番号だけでは判断できません。',
      ],
    };
  }

  if (/^0\d{9,10}$/.test(bare)) {
    return {
      kind: 'landline',
      kindLabel: '固定電話に多い番号の形',
      hints: [
        '地域の固定電話で使われる形です。',
        '表示名や着信の様子もあわせて見てください。安全とは言い切れません。',
      ],
    };
  }

  return {
    kind: 'unknown',
    kindLabel: '番号の種類を端末だけでは特定できませんでした',
    hints: [
      '番号の形だけでは、相手が信頼できるかは分かりません。',
      'お金や個人情報を求められたら、特に慎重にしてください。',
    ],
  };
}

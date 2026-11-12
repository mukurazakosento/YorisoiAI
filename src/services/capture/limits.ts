import type { CaptureOsLimits } from './types';

/**
 * iOS / Expo 上の正直な制限。UI・README・スモークで同じ文言体系を使う。
 * サイレントな他アプリ監視・偽のポップアップ自動検知はしない。
 */
export const CAPTURE_OS_LIMITS: CaptureOsLimits = {
  can: [
    '利用者が自分で始めた画面収録（コントロールセンター等）や、自分で撮ったスクリーンショットを選ぶこと',
    '選んだ画像を端末内 OCR（Google ML Kit 日本語）で読み、確認した文字だけを案内に使うこと',
    '支援セッション中に「画面を読み取る」で都度フレームを取り込むこと（自動スパイではない）',
    '将来、ユーザー開始の Broadcast Upload Extension から定期フレームを受け取る設計（いまは未リンク）',
  ],
  cannot: [
    '他アプリ画面を無言で常時録画・監視すること（サイレントスパイ不可）',
    'ポップアップやダイアログを OS なしで自動検知すること（偽の自動検知もしない）',
    'Expo Go / Web でライブ画面収録や端末内 OCR を動かすこと',
    '画像・画面映像を外部 AI / Firebase / Storage に送ること',
    '他アプリをアプリ側から自動操作すること',
  ],
};

/** 画面・README 向けの短い要約（ノンスクロール） */
export const CAPTURE_LIMITS_SHORT = {
  canOneLiner:
    '自分で撮った画面の文字を、端末の中だけで読み取ります。',
  cannotOneLiner:
    'ほかのアプリを勝手に見たり、ポップアップを自動で見つけることはできません。',
  expoGoWeb:
    '画面収録と文字認識は Expo Go / Web では動きません。EAS の development build が必要です。',
  broadcastNotLinked:
    'Broadcast Upload（定期フレーム）はまだ組み込んでいません。いまはスクショ選択で読み取ります。',
} as const;

export function formatCaptureLimitsForReadme(): string {
  const can = CAPTURE_OS_LIMITS.can.map((line) => `- できる: ${line}`).join('\n');
  const cannot = CAPTURE_OS_LIMITS.cannot
    .map((line) => `- できない: ${line}`)
    .join('\n');
  return `${can}\n${cannot}`;
}

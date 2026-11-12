/**
 * ReplayKit Broadcast Upload Extension のリンク状態。
 *
 * 本物の「他アプリを含む定期フレーム」には、iOS の Broadcast Upload
 * Extension（App Groups 連携）が必要です。Expo Go や通常の JS だけでは
 * 実現できません。
 *
 * このファイルは **未リンクを偽らない** ための境界です。
 * Extension を EAS / Xcode で追加したあとに、ネイティブモジュールから
 * `true` を返す実装へ差し替えます。いまは常に false。
 */
export function isBroadcastUploadLinked(): boolean {
  return false;
}

/** 将来の Broadcast 経路向けドキュメント用 ID（秘密ではない） */
export const BROADCAST_EXTENSION_PLAN = {
  approach: 'ReplayKit Broadcast Upload Extension + App Groups',
  status: 'not-linked',
  note:
    'ユーザーがコントロールセンター等から収録を開始したときだけフレームを受け取れる想定。サイレント監視はしない。',
} as const;

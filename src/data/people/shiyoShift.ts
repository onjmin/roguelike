// シヨの メイド喫茶の アルバイト（2026-10-16 作者：「メイドカフェに 革命シヨも アルバイト しているように 登場させて」）。
// 金・土・日の 夕方から 夜（SHIYO_SHIFT）だけ、メイド喫茶「メイドの土産」（data/village/diners.ts。段7）の ホールに 立つ。
// その あいだは 村の いつもの 場所（data/village/map.ts の VILLAGE_SPOTS.shiyo）に いない。倉庫は 中の 棚で つかえる。
// 先輩メイドの みるくは、シヨが いる 日は「来てほしい」では なく 一緒に 働く 話を する（SHIYO_MAID_MILK）。

import type { Today } from "../town/calendar";

/** メイド喫茶が 建つ 段（data/village/diners.ts の maid と 同じ）。 */
const MAID_FROM = 7;

/** 出る 曜日（0=日〜6=土）と 時（from 時から to 時の 前まで）。 */
export const SHIYO_SHIFT = { days: [5, 6, 0], from: 17, to: 22 } as const;

/** いま シヨが メイド喫茶で 働いて いるか。 */
export const shiyoAtMaid = (stage: number, t: Today, hour: number): boolean =>
	stage >= MAID_FROM &&
	(SHIYO_SHIFT.days as readonly number[]).includes(t.w) &&
	hour >= SHIYO_SHIFT.from &&
	hour < SHIYO_SHIFT.to;

/** ホールで 立つ マス（メイド喫茶の 中。冷蔵庫の 前、ここあの 左）。 */
export const SHIYO_MAID_AT = [2, 4] as const;

/** ホールの シヨ（話す たびに 次）。 */
export const SHIYO_MAID_LINES: readonly string[] = [
	"お、おかえりなさいませ、ご主人さま……\n……キリコ!?　見なかった　ことに　して",
	"バイトよ、バイト。\n倉庫番だけじゃ　革命資金が　たりないの",
	"オムライスに「革命」って　書いたら\n店長に　怒られたわ。……なんでよ",
	"倉庫の　棚は　あけて　あるわ。\n預けものは　自分で　どうぞ",
];

/** シヨが いる 日の 先輩メイドの みるく。 */
export const SHIYO_MAID_MILK: readonly string[] = [
	"倉庫の　メイドさん、ほんとに\n来て　くれたんです！　シヨ先輩です",
	"シヨ先輩、おまじないの　とき\n……こぶしを　にぎっちゃうんですよね",
];

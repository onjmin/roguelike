// 議会の 日と 人の 出入り（CIVIC.md §4）。寄り合い（段2〜3。まとめ掲示板の はり紙）と 議会だより（段4〜）の 文も。
// DOM も 保存も 使わない。日付と 帰りの 時刻は 呼ぶ 側が わたす（村は calendar.today() と 記録の 時刻、試験は そのまま）。
//
// - 議会の 日：月曜は かならず、ほかの 曜日は 帰りの 種で 3割（合わせて 帰りの 約 4割）。同じ 帰りなら 同じ。
// - 議会の 日だけ、帰りの 客（ui/guests.ts の guestsOf）とは 別の 乱数 `assembly:${帰り}` で 議席を 決める。
//   議会の ない 日の 顔ぶれは かえない。選ばれた 子は 音楽室・本屋・銭湯から 外す（二重に いない）。
//   候補＝越してきた 住人 − 舞台で 歌う 子 − 原住民（肩書きが 議会に 合わない）− deep の 節目を まだ 見て いない 子。
//   役（おんちゃん 議長・プロト 書記・アル 中継）は 段7 の 市役所の 議場だけ p=0.7、ほかは p=0.35、席の 数まで。
// - 段2〜3 は 寄り合い：同じ 乱数で 1〜2人が 集会所・レンガ館に 来る。
// - 議題と 派閥は ぜんぶ 架空の 村の 話。保守神社は 出さない。どちらの 派にも 立たない。

import { Rng } from "../core/rng";
import type { Today } from "./calendar";
import type { MobId } from "./mobs";

/** 議会の 定例会の 曜日（月曜。ナイターの ない 日）。 */
export const SESSION_WDAY = 1;
/** ほかの 曜日に 議会が ある 見こみ（帰りの 種）。 */
export const SESSION_P = 0.3;

/** 議会の 日か（月曜は かならず、ほかは 帰りの 種で 3割）。 */
export const inSession = (t: Today, at: number): boolean =>
	t.w === SESSION_WDAY || Rng.fromSeed(`session:${at}`).chance(SESSION_P);

/** 寄り合いの 段（建物なし。まとめ掲示板の はり紙と、集会所・レンガ館に 来る 人）。 */
export const YORIAI_FROM = 2;
/** 町役場が 建つ 段（議会だより・町役場の 議席）。 */
export const TOWNHALL_FROM = 4;
/** 市役所（議場つき）が 建つ 段。 */
export const CITYHALL_FROM = 7;

export type Spot = { readonly x: number; readonly y: number };

/** 議席（部屋の 中の 座標。議員の 机の 前で 上を 向く）。町役場 3・市役所 8。 */
export const SEATS: Readonly<Record<"townhall" | "cityhall", readonly Spot[]>> =
	{
		townhall: [
			{ x: 8, y: 8 },
			{ x: 10, y: 8 },
			{ x: 12, y: 8 },
		],
		cityhall: [
			{ x: 3, y: 7 },
			{ x: 6, y: 7 },
			{ x: 10, y: 7 },
			{ x: 13, y: 7 },
			{ x: 3, y: 9 },
			{ x: 6, y: 9 },
			{ x: 10, y: 9 },
			{ x: 13, y: 9 },
		],
	};

/** 市役所の 議場の 役（議長・書記・中継。立つ 所と 名前欄の 肩書き）。 */
export const ROLES: readonly {
	readonly role: "chair" | "clerk" | "camera";
	readonly mob: MobId;
	readonly at: Spot;
}[] = [
	{ role: "chair", mob: "onchan", at: { x: 7, y: 3 } },
	{ role: "clerk", mob: "proto", at: { x: 4, y: 3 } },
	{ role: "camera", mob: "aru", at: { x: 13, y: 3 } },
];

/** 寄り合いで 住人が 立つ 所（本館の 段 0 集会所・1 レンガ館）。 */
export const YORIAI_SPOTS: readonly (readonly Spot[])[] = [
	[
		{ x: 1, y: 4 },
		{ x: 1, y: 5 },
	],
	[
		{ x: 2, y: 4 },
		{ x: 9, y: 4 },
	],
];

/** 議会に 来ない 住人（原住民。肩書きが 議会に 合わない）。 */
export const NOT_IN_ASSEMBLY: readonly MobId[] = ["shobon"];

/** 議会の 日の 顔ぶれ（役は 市役所だけ。議長が いなければ 名無しの 議長）。 */
export type Assembly = {
	/** 議会の 日（寄り合いを ふくむ）。だれも 来なくても 議会は ある。 */
	readonly session: boolean;
	readonly chair: MobId | null;
	readonly clerk: MobId | null;
	readonly camera: MobId | null;
	/** 議席の 住人（席の 数まで。並びは SEATS の 順）。 */
	readonly seats: readonly MobId[];
};

const NONE: Assembly = {
	session: false,
	chair: null,
	clerk: null,
	camera: null,
	seats: [],
};

/** その 段で 議会が 開く 場所（段2〜3 は 寄り合い）。 */
export const assemblyRoom = (
	stage: number,
): "yoriai" | "townhall" | "cityhall" | null =>
	stage >= CITYHALL_FROM
		? "cityhall"
		: stage >= TOWNHALL_FROM
			? "townhall"
			: stage >= YORIAI_FROM
				? "yoriai"
				: null;

/**
 * 議会の 日の 顔ぶれ（議会の ない 日・段が 足りない 日は だれも いない）。candidates は 越してきた 住人
 * （呼ぶ 側が 舞台で 歌う 子・deep の 節目を まだ 見て いない 子を 外して わたす）。
 */
export const assemblyOf = (
	stage: number,
	at: number,
	t: Today,
	candidates: readonly MobId[],
): Assembly => {
	const room = assemblyRoom(stage);
	if (!room || !inSession(t, at)) return NONE;
	const rng = Rng.fromSeed(`assembly:${at}`);
	const pool = rng.shuffle(
		candidates.filter((id) => !NOT_IN_ASSEMBLY.includes(id)),
	);
	if (room === "yoriai") {
		// 寄り合い：1〜2人（越してきた 子が いれば かならず 1人）
		const n = Math.min(pool.length, 1 + rng.int(2));
		return { ...NONE, session: true, seats: pool.slice(0, n) };
	}
	const roles: Partial<Record<"chair" | "clerk" | "camera", MobId>> = {};
	const taken = new Set<MobId>();
	if (room === "cityhall")
		for (const r of ROLES)
			if (pool.includes(r.mob) && rng.chance(0.7)) {
				roles[r.role] = r.mob;
				taken.add(r.mob);
			}
	const seats: MobId[] = [];
	const max = SEATS[room].length;
	for (const id of pool) {
		if (taken.has(id) || seats.length >= max) continue;
		if (rng.chance(0.35)) seats.push(id);
	}
	return {
		session: true,
		chair: roles.chair ?? null,
		clerk: roles.clerk ?? null,
		camera: roles.camera ?? null,
		seats,
	};
};

/** 顔ぶれに いる 住人（役と 議席）。 */
export const assemblyMembers = (a: Assembly): MobId[] => [
	...[a.chair, a.clerk, a.camera].filter((x): x is MobId => x !== null),
	...a.seats,
];

// ───────────────── 文（村の 窓 22字×2行） ─────────────────

/** 議席・寄り合いの 住人の 1窓（原住民は 来ない。侵略は 議会では 言わない）。 */
export const ASSEMBLY_LINES: Readonly<Partial<Record<MobId, string>>> = {
	onchan: "静粛に　だおん。\n……ワイも　ヤジ　飛ばしたいおん",
	proto: "議事録　作成中ゼロ。\nヤジも　ぜんぶ　記録ゼロ",
	aru: "議会の　中継、ぼくが　撮ってます！\n……再生数、2です",
	jtleman: "議事進行には　紳士が　要る。\n……名犬Jも　傍聴だ",
	nichie: "毎日を　日曜日に　する\n条例、今日も　出したニィ！",
	panmatsu: "屋根は　きつね色だ。\n焼きたての　パンの　色だからな",
	ngoane: "湯は　41℃が　いいンゴねぇ……\nフェリスちゃんが　のぼせるンゴ",
	onsu: "age派よ！　ageないと\nだれも　来ないのぉ！……ふ、ふん",
	yayapoji: "可否同数が　いちばん　好きだ。\n……議長が　こまる　顔も",
	mujje: "ホゲェ（賛成）",
	asakonro: "当番、ふやす　もん！\n火は　絶やしちゃ　だめ　だもん",
	miaumiau: "全部　age　して\n議事録を　うめるぷ！",
	rino: "予算の　話か？\n……出す　なら　金払え",
	ren: "修正案、v1.0.3　です〜！\n……あ、もう　v1.0.4　かな〜？",
	hinary: "参考人の　ヒナリーです。\n避難Jの　議会を　研究しています",
	puyu: "ぎかい、むずかしいゆ。\nみんな　なかよく　したら　いいゆ🥺",
};

/** 市役所の 名無しの 議長（おんちゃんが 来ない 議会の 日）。 */
export const NANASHI_CHAIR = {
	name: "議長",
	line: "本日の　議事日程は、\nお手元の　スレの　とおりです",
} as const;

/** 役の 肩書き（名前欄の 後ろ）。 */
export const ROLE_TITLE: Readonly<
	Record<"chair" | "clerk" | "camera", string>
> = {
	chair: "議長",
	clerk: "書記",
	camera: "中継",
};

/** 寄り合いの 議題（段2〜3。1回の 帰りに 1つ。from の 段から）。 */
export const AGENDA: readonly {
	readonly id: string;
	readonly from: number;
	readonly notice: string;
	readonly result: string;
}[] = [
	{
		id: "isu",
		from: 2,
		notice: "寄り合いの　はり紙。\n『議題：集会所の　いすを　ふやすか』",
		result: "結果：賛成　3、反対　0。\n……なお　いすは　まだ　届かない　模様。",
	},
	{
		id: "karaage",
		from: 2,
		notice: "寄り合いの　はり紙。\n『議題：唐揚げに　レモンを　かけるか』",
		result:
			"結果：かける　2、かけない　2。\n……なお　唐揚げは　もう　ない　模様。",
	},
	{
		id: "yane",
		from: 3,
		notice: "寄り合いの　はり紙。\n『議題：おんJの　屋根の　色』",
		result:
			"結果：きつね色　4、水色　4。引き分け。\n……なお　屋根は　灰色の　まま。",
	},
];

/** 議会だより（段4〜。まとめ掲示板。議会中継の 話の 決着）。 */
export const DAYORI: readonly {
	readonly title: string;
	readonly result: string;
}[] = [
	{ title: "おんJの　屋根の　色", result: "可否同数" },
	{ title: "当番表の　欄", result: "可決" },
	{ title: "麻婆豆腐の　辛さ", result: "単位は　ロゼ" },
	{ title: "銭湯の　湯温", result: "41.5℃" },
	{ title: "毎日　日曜日", result: "否決" },
	{ title: "ageか　sageか", result: "住み分け" },
	{ title: "キリ番の　請願", result: "次の　議題へ" },
	{ title: "ROM専の　席", result: "可決" },
];

/** 寄り合い・議会だよりの 窓。 */
export const CIVIC_BOARD = {
	/** まとめ掲示板の メニュー（段2〜3 は 寄り合い、段4 から 議会だより）。 */
	yoriaiMenu: "寄り合いの　はり紙",
	dayoriMenu: "議会だより",
	/** 寄り合いの 前置き（はじめての 1回だけ。オンボーディングなので はっきり 言う）。 */
	soukai: "村は　小さいので、議会の　かわりに\nみんなで　集まる『総会』です",
	dayori: "議会だより。\n『{title}』……{result}",
	/** 段4〜5 の レンガ館の 告知の はり紙。 */
	moved: "はり紙。\n『寄り合いは　町役場に　うつりました』",
	/** 寄り合いの 日に 集会所・レンガ館へ 来た 住人の 名前欄の 後ろ。 */
	yoriai: "（寄り合い）",
} as const;

/** この 帰りの 寄り合いの 議題（段で 増える。帰りの 時刻で 1つ）。 */
export const agendaOf = (
	stage: number,
	at: number,
): (typeof AGENDA)[number] => {
	const list = AGENDA.filter((a) => stage >= a.from);
	return list[Rng.fromSeed(`agenda:${at}`).int(list.length)] ?? AGENDA[0];
};

/** この 帰りの 議会だより。 */
export const dayoriOf = (at: number): (typeof DAYORI)[number] =>
	DAYORI[Rng.fromSeed(`dayori:${at}`).int(DAYORI.length)] ?? DAYORI[0];

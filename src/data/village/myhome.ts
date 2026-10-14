// キリコの 家（マイホーム）。小屋の 段（段3）から 中庭の 分譲住宅（地図の 53,31。data/village/facilities.ts の myhome）を
// 35年ローンで 買う。2026-10-13 から 本当に 払う（作者：「稼いだ 金で 何か 買えるように」。財布は engine/wallet.ts）：
// 契約で 頭金（HOME_DOWN）、帰るたびに 月の 返済（HOME_MONTHLY）。払えない 月は 滞納に なる（追い出されは しない）。
// 中では 家具を 置く・動かす・片づける、壁紙と 床を かえる（模様替え）。家具は 3通りで 手に 入る：
// 帰るたびに 1つ 宅配便で 届く（仲間・町の 人から。HOME_GIFTS）、町の 住人に 話すと 1度だけ（RESIDENT_GIFTS）、
// リサイクルショップの レジで 買う（FURNITURE_PRICE。高め）。持ち帰った 板の 底の 品も 台に のせて 飾れる（GOAL_FURNITURE）。電話で 親しく なった 人（喫茶か ♥1 から。ui/village/bonds.ts）を 招ける。
// ここは 形と 決まりだけ（DOM も 保存も 使わない）。保存・場面は ui/village/myhome.ts。

import { DUNGEON_IDS, DUNGEONS } from "../../core/data/dungeons";
import { defOf } from "../../core/item";
import type { DungeonId } from "../../core/types";
import { ARCADE_TEXT } from "../arcade/text";
import type { ArcadeGame } from "../arcade/types";
import { textWidth } from "../bushitsu/bushitsu";
import type { Cell } from "./map";
import { type RoomArtName, ri, riCell } from "./rpgenArt";
import { base } from "./tiles";

/**
 * 分譲住宅が 建つ 町の 段（2026-10-14 に 段6 から 段3 へ 早めた。作者：「お楽しみが 後半に 寄っている」。
 * 同じ日に 段4 へ：家は 東の 区画に 建つので、東の 森が 開く 段4 より 前だと 森の 中に 建って 見えた）。
 */
export const MYHOME_FROM = 4;

/** ローンの 月数（35年）。帰るたびに 1か月 返す。 */
export const LOAN_MONTHS = 35 * 12;
/** 契約の ときの 頭金（円）。 */
export const HOME_DOWN = 20000;
/** 帰るたびの 返済（円。財布から 引き落とし。足りなければ 滞納）。 */
export const HOME_MONTHLY = 1500;

// ───────────────── 家具 ─────────────────

/** 店で 売る・もらう 家具。 */
export type BaseFurnitureId =
	| "bed"
	| "table"
	| "crt"
	| "bonsai"
	| "coffee"
	| "sofa"
	| "shelf"
	| "tv"
	| "tank"
	| "guitar"
	| "fridge"
	| "records"
	| "game"
	| "tansu"
	| "chair"
	| "safe"
	| "dumbbell"
	| "shelfDark"
	| "tvTall"
	| "platformer"
	| "bomberbox"
	| "cabSnake"
	| "cabStack"
	| "cabCross"
	| "goban"
	| "shogiban"
	| "laptop"
	| "desktopPc"
	| "taiko"
	| "turntable"
	| "crtGame"
	| "barrel"
	| "kingyoBucket"
	| "pinball"
	| "danmakuCab"
	| "kakejiku"
	| "mojiBook"
	| "puyuPlush"
	| "gamingPc"
	| "easel"
	| "cabResu"
	| "pickaxe"
	| "handheld"
	| "reversiBoard"
	| "hanafuda"
	| "picrossNote"
	| "crateBox"
	| "billiards"
	| "dartboard"
	| "fishingRod";

/** 持ち帰った 板の 底の 品（台に のせて 飾る。GOAL_FURNITURE）。 */
export type GoalFurnitureId = `goal_${DungeonId}`;

export type FurnitureId = BaseFurnitureId | GoalFurnitureId;

export type Furniture = {
	name: string;
	/** 絵（行 × 列。マスごとの 絵）。 */
	cells: readonly (readonly string[])[];
	/** 調べた ときの 文（1窓）。 */
	line: string;
};

/** 遊べる 家具の 自前の 絵（48x32 の ドット）。 */
const HOME_GAMES_IMG = "pub:sprites/home-games.png";
/** 遊べる 家具の 自前の 絵 その2（160x32。白い 筐体・リバーシ・花札・方眼ノート・つるはし・携帯ゲーム機・ダーツ・釣り竿・ビリヤード台）。 */
const HOME_GAMES2_IMG = "pub:sprites/home-games2.png";

const row = (name: RoomArtName, w: number, r = 0): string[] =>
	Array.from({ length: w }, (_, c) => riCell(name, c, r));

const BASE_FURNITURE: Record<BaseFurnitureId, Furniture> = {
	bed: {
		name: "ベッド",
		cells: [[base(2, 112)], [base(2, 113)]],
		line: "ベッド。\nシーツに　まだ　のりが　きいている。",
	},
	table: {
		name: "ちゃぶ台",
		cells: [[ri("roundTable")]],
		line: "ちゃぶ台。\n脚が　1本　すこし　短い。",
	},
	crt: {
		name: "ブラウン管テレビ",
		cells: [[ri("tvCrt")]],
		line: "ブラウン管テレビ。\nたたくと　映る。",
	},
	bonsai: {
		name: "盆栽",
		cells: [[ri("bonsai")]],
		line: "盆栽。\n「水は　朝だけ」の　札。",
	},
	coffee: {
		name: "コーヒーメーカー",
		cells: [[ri("coffeeMaker")]],
		line: "コーヒーメーカー。\n豆の　におい。",
	},
	sofa: {
		name: "白い　ソファ",
		cells: [row("sofaWhite", 2, 0), row("sofaWhite", 2, 1)],
		line: "白い　ソファ。\nすわると、ちょうど　いい　沈みかた。",
	},
	shelf: {
		name: "本棚",
		cells: [[riCell("bookshelf", 0, 0)], [riCell("bookshelf", 0, 1)]],
		line: "本棚。\nまだ　半分　あいている。",
	},
	shelfDark: {
		name: "黒い　本棚",
		cells: [[riCell("bookshelfDark", 0, 0)], [riCell("bookshelfDark", 0, 1)]],
		line: "黒い　本棚。\n過去ログの　製本が　ぎっしり。",
	},
	platformer: {
		name: "横スクロールの　筐体",
		cells: [[base(1, 519)], [base(1, 520)]],
		line: "横スクロールの　筐体。\n画面に「スーパーキリコ」の　文字。",
	},
	bomberbox: {
		name: "ボンバーの　ゲーム機",
		cells: [[base(2, 519)], [base(2, 520)]],
		line: "ボンバーの　ゲーム機。\n画面に「荒らし爆破」の　文字。",
	},
	// 遊べる 家具（1つに 1つの ゲーム。data/arcade/types.ts。line は ARCADE_TEXT の line と 同じ）
	cabSnake: {
		name: "金色の　筐体",
		cells: [[base(0, 519)], [base(0, 520)]],
		line: ARCADE_TEXT.snake.line,
	},
	cabStack: {
		name: "青い　筐体",
		cells: [[base(3, 519)], [base(3, 520)]],
		line: ARCADE_TEXT.stack.line,
	},
	cabCross: {
		name: "赤い　筐体",
		cells: [[base(4, 519)], [base(4, 520)]],
		line: ARCADE_TEXT.crossing.line,
	},
	goban: {
		name: "碁盤",
		cells: [[ri("goban")]],
		line: ARCADE_TEXT.gomoku.line,
	},
	shogiban: {
		name: "将棋盤",
		cells: [[ri("shogiban")]],
		line: ARCADE_TEXT.hasami.line,
	},
	laptop: {
		name: "ノートパソコン",
		cells: [[ri("laptop")]],
		line: ARCADE_TEXT.mines.line,
	},
	desktopPc: {
		name: "デスクトップの　パソコン",
		cells: [[ri("pcTop")]],
		line: ARCADE_TEXT.grass.line,
	},
	taiko: {
		name: "太鼓",
		cells: [[ri("taiko")]],
		line: ARCADE_TEXT.taiko.line,
	},
	turntable: {
		name: "ターンテーブル",
		cells: [[ri("turntableTop")]],
		line: ARCADE_TEXT.simon.line,
	},
	crtGame: {
		name: "古い　ゲーム機",
		cells: [[ri("tvCrtB")]],
		line: ARCADE_TEXT.pong.line,
	},
	barrel: {
		name: "イッチの　樽",
		cells: [[ri("barrel")]],
		line: ARCADE_TEXT.kurohige.line,
	},
	kingyoBucket: {
		name: "金魚の　バケツ",
		cells: [[ri("bucket")]],
		line: ARCADE_TEXT.kingyo.line,
	},
	// 自前の 絵（public/sprites/home-games.png。ピンボール台・弾幕の 筐体・ぷゆゆの ぬいぐるみ）
	pinball: {
		name: "ピンボール台",
		cells: [[`${HOME_GAMES_IMG}#0,0,16,16`], [`${HOME_GAMES_IMG}#0,16,16,16`]],
		line: ARCADE_TEXT.pinball.line,
	},
	danmakuCab: {
		name: "紫の　筐体",
		cells: [
			[`${HOME_GAMES_IMG}#16,0,16,16`],
			[`${HOME_GAMES_IMG}#16,16,16,16`],
		],
		line: ARCADE_TEXT.danmaku.line,
	},
	kakejiku: {
		name: "掛け軸",
		cells: [[ri("scroll")]],
		line: ARCADE_TEXT.mikiri.line,
	},
	mojiBook: {
		name: "文字さがしの　冊子",
		cells: [[ri("paperNote")]],
		line: ARCADE_TEXT.mojisagashi.line,
	},
	puyuPlush: {
		name: "ぷゆゆの　ぬいぐるみ",
		cells: [[`${HOME_GAMES_IMG}#32,16,16,16`]],
		line: ARCADE_TEXT.clicker.line,
	},
	cabResu: {
		name: "白い　筐体",
		cells: [
			[`${HOME_GAMES2_IMG}#0,0,16,16`],
			[`${HOME_GAMES2_IMG}#0,16,16,16`],
		],
		line: ARCADE_TEXT.resukui.line,
	},
	pickaxe: {
		name: "つるはしと　ヘルメット",
		cells: [[`${HOME_GAMES2_IMG}#64,16,16,16`]],
		line: ARCADE_TEXT.digkiriko.line,
	},
	handheld: {
		name: "携帯ゲーム機",
		cells: [[`${HOME_GAMES2_IMG}#80,16,16,16`]],
		line: ARCADE_TEXT.patapata.line,
	},
	reversiBoard: {
		name: "リバーシの　盤",
		cells: [[`${HOME_GAMES2_IMG}#16,16,16,16`]],
		line: ARCADE_TEXT.reversi.line,
	},
	hanafuda: {
		name: "花札",
		cells: [[`${HOME_GAMES2_IMG}#32,16,16,16`]],
		line: ARCADE_TEXT.koikoi.line,
	},
	picrossNote: {
		name: "方眼ノート",
		cells: [[`${HOME_GAMES2_IMG}#48,16,16,16`]],
		line: ARCADE_TEXT.picross.line,
	},
	crateBox: {
		name: "木箱",
		cells: [[ri("crate")]],
		line: ARCADE_TEXT.soko.line,
	},
	billiards: {
		name: "ビリヤード台",
		cells: [
			[`${HOME_GAMES2_IMG}#128,16,16,16`, `${HOME_GAMES2_IMG}#144,16,16,16`],
		],
		line: ARCADE_TEXT.nineball.line,
	},
	dartboard: {
		name: "ダーツの　的",
		cells: [[`${HOME_GAMES2_IMG}#96,16,16,16`]],
		line: ARCADE_TEXT.darts.line,
	},
	fishingRod: {
		name: "釣り竿と　クーラー",
		cells: [[`${HOME_GAMES2_IMG}#112,16,16,16`]],
		line: ARCADE_TEXT.tsuribori.line,
	},
	// 絵を 描ける イーゼル（ui/paint/paint.ts。ゲームでは ないので FURNITURE_GAME には 入れない）。
	// 絵は 実行中に 作る（イーゼルの 絵 home-games.png 32,0 に 描いた 絵を 重ねた もの。engine/assets.ts の rt:）
	easel: {
		name: "画家の　キャンバス",
		cells: [["rt:easel"]],
		line: "画家の　キャンバス。\n絵の具の　においが　する。",
	},
	gamingPc: {
		name: "ゲーミングPC",
		cells: [[`${HOME_GAMES_IMG}#48,16,16,16`]],
		line: ARCADE_TEXT.doom.line,
	},
	tvTall: {
		name: "台つきの　テレビ",
		cells: [[riCell("tvTall", 0, 0)], [riCell("tvTall", 0, 1)]],
		line: "台つきの　テレビ。\n下の　段に　ビデオデッキ。",
	},
	tv: {
		name: "大きな　テレビ",
		cells: [row("tvGame", 2, 0), row("tvGame", 2, 1)],
		line: "大きな　テレビ。\nナイター中継が　よく　映る。",
	},
	tank: {
		name: "水槽",
		cells: [row("fishTank", 3)],
		line: "水槽。\n小さな　魚が　保守している。",
	},
	guitar: {
		name: "ギター",
		cells: [[ri("guitar")]],
		line: "ギター。\nチューニングは　ばっちり。",
	},
	fridge: {
		name: "冷蔵庫",
		cells: [[ri("fridgeWhite")]],
		line: "冷蔵庫。\n中は　麦茶だけ。",
	},
	records: {
		name: "レコードの　箱",
		cells: [[ri("records")]],
		line: "レコードの　箱。\n蓄音機で　聞いた　曲も　ある。",
	},
	game: {
		name: "ゲーム機",
		cells: [[ri("console")]],
		line: "ゲーム機。\n「ぷゆぷゆ」の　ソフトが　刺さっている。",
	},
	tansu: {
		name: "たんす",
		cells: [row("cabWood", 3)],
		line: "たんす。\n引き出しに　質札が　1枚。",
	},
	chair: {
		name: "赤い　いす",
		cells: [[ri("chairRed")]],
		line: "赤い　いす。\nファミレスの　すみに　あった　形。",
	},
	safe: {
		name: "金庫",
		cells: [[ri("safe")]],
		line: "金庫。\n……入れる　物は、まだ　ない。",
	},
	dumbbell: {
		name: "ダンベル",
		cells: [[ri("dumbbells")]],
		line: "ダンベル。\n……持ちあげると、重い。",
	},
};

/** 底の 品を のせる 台。 */
const GOAL_STAND = ri("tableBeige");

/** 1行の 幅（全角 22字）。 */
const LINE_W = 22;

/**
 * 底の 品を 調べた 文：名前と 味わいの 2行。味わいが 1行に 入らなければ、味わいだけを
 * 区切り（、。　……の 前）で 2行に わける（名前は 一覧に 出ている）。
 */
const goalLine = (name: string, flavor: string): string => {
	if (textWidth(flavor) <= LINE_W) return `${name}。\n${flavor}`;
	const chars = [...flavor];
	let best: [string, string] | null = null;
	for (let i = 1; i < chars.length; i++) {
		const ch = chars[i - 1];
		const breaks =
			ch === "、" || ch === "。" || ch === "　" || chars[i] === "…";
		if (!breaks) continue;
		const a = chars.slice(0, i).join("").replace(/　$/, "");
		const b = chars.slice(i).join("");
		if (textWidth(a) > LINE_W || textWidth(b) > LINE_W) continue;
		// 2行の 長さが いちばん そろう 所
		if (
			!best ||
			Math.abs(textWidth(a) - textWidth(b)) <
				Math.abs(textWidth(best[0]) - textWidth(best[1]))
		)
			best = [a, b];
	}
	return best ? best.join("\n") : `${name}。`;
};

/** 板の 底の 品の 家具の id。 */
export const goalFurniture = (d: DungeonId): GoalFurnitureId => `goal_${d}`;

/**
 * 持ち帰った 板の 底の 品（2026-10-14 作者：底の 品を 家に 飾れる ように）。はじめて 持ち帰った あと、
 * 家を 買って いれば 家に 入った ときに 届く（ui/village/myhome.ts の openParcels）。店では 売らない。
 * 絵は 道具の 絵（core/data/items.ts の icon）、調べた 文は 品の 名前と 味わいの 1行。
 */
export const GOAL_FURNITURE = Object.fromEntries(
	DUNGEON_IDS.map((d) => {
		const def = defOf(DUNGEONS[d].goal);
		return [
			goalFurniture(d),
			{
				name: def.name,
				// 品の 下に 台（1×2。上の マスに 品、下の マスに 台）
				cells: [[def.icon ?? ""], [GOAL_STAND]],
				line: goalLine(def.name, def.flavor),
			},
		];
	}),
) as unknown as Record<GoalFurnitureId, Furniture>;

export const FURNITURE: Record<FurnitureId, Furniture> = {
	...BASE_FURNITURE,
	...GOAL_FURNITURE,
};

/**
 * リサイクルショップの レジで 買う ときの 値段（円）。本編に 関係ない 物なので 高め
 * （1回の 冒険の 売り上げは 数千円。node scripts/sales-sim.mjs）。
 */
export const FURNITURE_PRICE: Record<BaseFurnitureId, number> = {
	bed: 20000,
	table: 8000,
	crt: 6000,
	bonsai: 12000,
	coffee: 15000,
	sofa: 40000,
	shelf: 25000,
	shelfDark: 30000,
	tv: 60000,
	tvTall: 35000,
	tank: 45000,
	guitar: 30000,
	fridge: 30000,
	records: 18000,
	game: 50000,
	tansu: 28000,
	chair: 10000,
	safe: 80000,
	dumbbell: 9000,
	// ゲームの 家具は 売っていない（できごとで もらう：EVENT_GIFTS）
	platformer: 99999,
	bomberbox: 99999,
	// 遊べる 家具（リサイクルショップで 売る）
	cabSnake: 38000,
	cabStack: 42000,
	cabCross: 36000,
	goban: 14000,
	shogiban: 12000,
	laptop: 32000,
	desktopPc: 45000,
	taiko: 22000,
	turntable: 26000,
	crtGame: 18000,
	barrel: 9000,
	kingyoBucket: 7000,
	pinball: 48000,
	danmakuCab: 40000,
	kakejiku: 16000,
	mojiBook: 6000,
	puyuPlush: 5000,
	gamingPc: 55000,
	easel: 14000,
	cabResu: 40000,
	pickaxe: 15000,
	handheld: 12000,
	reversiBoard: 9000,
	hanafuda: 8000,
	picrossNote: 5000,
	crateBox: 6000,
	billiards: 60000,
	dartboard: 11000,
	fishingRod: 10000,
};

/** 遊べる 家具（調べると「遊ぶ」。data/arcade/types.ts の ゲーム）。 */
export const FURNITURE_GAME: Partial<Record<FurnitureId, ArcadeGame>> = {
	platformer: "platform",
	bomberbox: "bomber",
	cabSnake: "snake",
	cabStack: "stack",
	cabCross: "crossing",
	goban: "gomoku",
	shogiban: "hasami",
	laptop: "mines",
	desktopPc: "grass",
	taiko: "taiko",
	turntable: "simon",
	crtGame: "pong",
	barrel: "kurohige",
	kingyoBucket: "kingyo",
	// 宅配便で 届く ゲーム機（部室棟の おさがり）でも 遊べる
	game: "puyupuyu",
	pinball: "pinball",
	danmakuCab: "danmaku",
	kakejiku: "mikiri",
	mojiBook: "mojisagashi",
	puyuPlush: "clicker",
	gamingPc: "doom",
	cabResu: "resukui",
	pickaxe: "digkiriko",
	handheld: "patapata",
	reversiBoard: "reversi",
	hanafuda: "koikoi",
	picrossNote: "picross",
	crateBox: "soko",
	billiards: "nineball",
	dartboard: "darts",
	fishingRod: "tsuribori",
};

/** パソコン（調べると ゲームの ほかに BASIC も 選べる。ui/petitcon/petitcon.ts）。 */
export const PC_FURNITURE: readonly FurnitureId[] = [
	"desktopPc",
	"laptop",
	"gamingPc",
];

/** 店では 売らない 家具（できごとで もらう）。 */
export const NOT_SOLD: readonly FurnitureId[] = ["platformer", "bomberbox"];

export const furnitureSize = (id: FurnitureId): { w: number; h: number } => {
	const c = FURNITURE[id].cells;
	return { w: c[0].length, h: c.length };
};

// ───────────────── もらう ─────────────────

export type Gift = {
	id: FurnitureId;
	/** くれた 人（名前）。 */
	from: string;
	/** 添え書き・ひとこと（1窓）。 */
	note: string;
};

/** 契約の 日に 不動産屋が 置いていく 物。 */
export const MOVE_IN_GIFT: Gift = {
	id: "bed",
	from: "不動産屋",
	note: "「ご入居　おめでとう　ございます。\nベッドは　サービスです」",
};

/** 帰るたびに 1つ 届く 宅配便（並びの 順。届くのは 契約の あとの 帰りから）。 */
export const HOME_GIFTS: readonly Gift[] = [
	{
		id: "sofa",
		from: "ロゼ",
		note: "添え書き「引っ越し祝い！\nすわって　スレ　見てね」",
	},
	{ id: "shelf", from: "シヨ", note: "添え書き「本は　自分で　ならべて」" },
	{ id: "tv", from: "やきう", note: "添え書き「ナイター　見に　行くで」" },
	{ id: "tank", from: "フェリス", note: "添え書き「浜で　すくった　子です」" },
	{
		id: "guitar",
		from: "ゼロ",
		note: "添え書き「……弾けたら　聞かせて」",
	},
	{
		id: "fridge",
		from: "おんJヶ丘　町内会",
		note: "添え書き「ゴミの　日は　月・木です」",
	},
	{ id: "records", from: "名無し", note: "添え書き「蓄音機の　おとも」" },
	{
		id: "game",
		from: "おんJ高校　部室棟",
		note: "添え書き「部の　おさがり。2P　募集」",
	},
	{
		id: "tansu",
		from: "質屋「流れ」",
		note: "添え書き「流れ品。3か月　たったんで」",
	},
	{
		id: "chair",
		from: "ファミレス「ドリンクバー」",
		note: "添え書き「改装で　あまりました」",
	},
	{
		id: "safe",
		from: "おんJタウン　銀行",
		note: "添え書き「貸金庫の　おまけです」",
	},
	{ id: "dumbbell", from: "ageジム", note: "添え書き「入会　お待ちしてます」" },
];

/**
 * ちょっとした できごとで もらう 遊べる 家具（家に 入った ときに 宅配便で 届く。家を 買った あとだけ）。
 * when は できごとの 名前（ui/village/myhome.ts が 調べる）：arcade5 ＝ ゲームセンターの 台で 5回 遊んだ・
 * bushitsu3 ＝ 部室棟に 3回 来た。
 */
export const EVENT_GIFTS: readonly (Gift & {
	when: "arcade5" | "bushitsu3";
})[] = [
	{
		id: "platformer",
		from: "ゲームセンター「連コ」",
		note: "添え書き「台の　入れかえで　1台　あまった。\n常連さんに」",
		when: "arcade5",
	},
	{
		id: "bomberbox",
		from: "おんJ高校　ゲーム制作部",
		note: "添え書き「エターなった　ゲーム、\n完成しました。……たぶん」",
		when: "bushitsu3",
	},
];

/** 町の 住人に 話すと 1度だけ もらえる 物（施設の id・人の id）。家を 買った あとだけ。 */
export const RESIDENT_GIFTS: readonly (Gift & {
	facility: string;
	person: string;
})[] = [
	{
		id: "table",
		from: "リサイクルショップの　店員",
		note: "「家　買うたんか。\nほな、この　ちゃぶ台　持ってき」",
		facility: "recycle",
		person: "recycle_clerk",
	},
	{
		id: "crt",
		from: "コーポの　住人",
		note: "「テレビ　買いかえたんや。\n古いの、もらってくれへん？」",
		facility: "corpo",
		person: "corpo_tenant",
	},
	{
		id: "bonsai",
		from: "名無しの　ばあちゃん",
		note: "「新しい　家に　緑が　ないとね。\nこれ、持って　おいき」",
		facility: "danchi",
		person: "danchi_granny",
	},
	{
		id: "coffee",
		from: "マンションの　住人",
		note: "「2台　あるんや、それ。\nローン　仲間に　1台　あげるわ」",
		facility: "mansion",
		person: "mansion_tenant",
	},
];

// ───────────────── 招く ─────────────────

/**
 * 招いた 人の ひとこと（置いた 家具が 少ない・ふつう・多い の 3つ。1窓ずつ）。
 * 仲間は 名前で、住人は VISIT_ANY。キーは 仲間・住人の id。
 */
export const HOME_VISIT: Partial<Record<string, readonly string[]>> = {
	roze: [
		"ひろっ！　なんも　ないやん。\nソファ　置こ、ソファ。スレ　見る　用の",
		"ええ　感じやん。\n……ここで　ネタ　拾ったら　ウチに　先　見せてな",
		"もう　店　開けるやん、これ。\nロゼの　出張所に　しとこか",
	],
	zero: [
		"……がらんと　してる。\n帳簿で　いうと、まだ　1ページ目",
		"収支、ちょっと　黒字に　なってきたね。\n……この　部屋の　話",
		"これ　ぜんぶ　キリコの　売り上げから？\n……ローン、ちゃんと　返してね",
	],
	feris: [
		"わあ、まっしろ！\nここ、なに　置く　予定ですか？",
		"いい　お部屋ですね。\n図鑑の　机も　置けそう",
		"すごい……。\nわたしの　部屋より　にぎやかです",
	],
	shiyo: [
		"……倉庫より　空いてる。\n物、あずけに　来てもいい？",
		"整理整頓、まあまあ。\n……収納の　中は　見ないで　おく",
		"物、多い。\n……でも　ちゃんと　使ってるなら、いい",
	],
	nanj: [
		"なんもないやんけ！\nテレビ　置けや、ナイター　見るで",
		"ええやん。\n……ワイの　小屋より　ずっと　家っぽいわ",
		"ほんま　ええ　家に　なったな。\n……キリコ、えらいで",
	],
};

/** 住人を 招いた とき（家具の 少ない・ふつう・多い）。 */
export const VISIT_ANY: readonly string[] = [
	"おじゃまします。\n……ひろい　お部屋ですね",
	"おじゃまします。\n住みごこち　よさそう",
	"おじゃまします。\nすごい、家具が　いっぱい",
];

// ───────────────── 模様替え ─────────────────

export type Wallpaper = {
	name: string;
	up: string;
	low: string;
	color: string;
};
export type Flooring = { name: string; floor: string; color: string };

export const WALLPAPERS: readonly Wallpaper[] = [
	{ name: "白い　壁", up: base(1, 77), low: base(1, 78), color: "#e8e4dc" },
	{ name: "板の　壁", up: base(1, 55), low: base(1, 56), color: "#6a4a2a" },
	{ name: "和室の　壁", up: base(1, 57), low: base(1, 58), color: "#8a6a3a" },
	{ name: "黄色い　壁", up: base(1, 73), low: base(1, 74), color: "#c8a86a" },
	{ name: "赤レンガ", up: base(1, 61), low: base(1, 62), color: "#a84a3a" },
	{ name: "白レンガ", up: base(1, 63), low: base(1, 64), color: "#d8d8d8" },
	{ name: "しまの　壁", up: base(1, 75), low: base(1, 76), color: "#c8c8c8" },
];

export const FLOORINGS: readonly Flooring[] = [
	{ name: "板の　床", floor: base(0, 46), color: "#b8905a" },
	{ name: "明るい　板", floor: ri("flWoodLight"), color: "#d8b888" },
	{ name: "濃い　板", floor: ri("flDarkWood"), color: "#5a4030" },
	{ name: "畳", floor: ri("flTatami"), color: "#b8b878" },
	{ name: "ベージュの　床", floor: ri("flBeige"), color: "#d8c8a8" },
	{ name: "じゅうたん", floor: ri("flCarpet"), color: "#c04010" },
	{ name: "白い　タイル", floor: ri("flWhite"), color: "#e4e4e0" },
];

// ───────────────── 部屋 ─────────────────

/**
 * 部屋の 形（12×10）。W 窓・m 返済予定表（下の 床から 読む）・K 収納（模様替えの 箱）。
 * 家具は y=3〜8・x=1〜10 の 床に 置く。KEEP の マスには 置かない（入口の 前・予定表の 前）。
 */
export const HOME_ROWS: readonly string[] = [
	"############",
	"#HHWHHHHWHH#",
	"#hhmhhhhhhh#",
	"#P........K#",
	"#..........#",
	"#..........#",
	"#..........#",
	"#..........#",
	"#..........#",
	"#####DD#####",
];

/** 家具を 置かない マス（入口の マットの 前・返済予定表の 前・電話の 前）。 */
export const HOME_KEEP: readonly Cell[] = [
	[5, 8],
	[6, 8],
	[3, 3],
	[1, 4],
];
/** 招いた 人が 立つ 所（空いて いる 床から 順に さがす）。 */
export const GUEST_SPOTS: readonly Cell[] = [
	[5, 5],
	[6, 5],
	[4, 6],
	[7, 6],
	[5, 7],
	[2, 5],
	[8, 4],
];
/** 入って 立つ 所（左の マットの 1つ上）。 */
const ENTRY: Cell = [5, 8];

export type Placed = { id: FurnitureId; x: number; y: number };

export type HomeLayout = {
	placed: readonly Placed[];
	wall: number;
	floor: number;
};

const covers = (p: Placed, x: number, y: number): boolean => {
	const { w, h } = furnitureSize(p.id);
	return x >= p.x && x < p.x + w && y >= p.y && y < p.y + h;
};

/** その マスの 家具。 */
export const furnitureAt = (
	placed: readonly Placed[],
	x: number,
	y: number,
): Placed | undefined => placed.find((p) => covers(p, x, y));

const W = HOME_ROWS[0].length;
const H = HOME_ROWS.length;
const baseCh = (x: number, y: number): string =>
	[...(HOME_ROWS[y] ?? "")][x] ?? "#";

/** 家具の ない 床か（壁・収納・出口の マットは 床で ない）。 */
const isFloor = (placed: readonly Placed[], x: number, y: number): boolean =>
	baseCh(x, y) === "." && !furnitureAt(placed, x, y);

/**
 * その 並びで 歩けなく なる 所が ないか：床は みんな 入口から つながり、家具・収納・返済予定表は
 * どれも となりの 床から 調べられる。
 */
export const layoutOk = (placed: readonly Placed[]): boolean => {
	const seen = new Set<string>();
	const todo: Cell[] = [ENTRY];
	if (!isFloor(placed, ...ENTRY)) return false;
	seen.add(ENTRY.join(","));
	while (todo.length) {
		const [x, y] = todo.pop() as Cell;
		for (const [dx, dy] of [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		]) {
			const n: Cell = [x + dx, y + dy];
			const k = n.join(",");
			if (seen.has(k) || !isFloor(placed, ...n)) continue;
			seen.add(k);
			todo.push(n);
		}
	}
	for (let y = 0; y < H; y++)
		for (let x = 0; x < W; x++)
			if (isFloor(placed, x, y) && !seen.has(`${x},${y}`)) return false;
	const reach = (x: number, y: number) =>
		[
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		].some(([dx, dy]) => seen.has(`${x + dx},${y + dy}`));
	const things: Cell[] = [
		[10, 3],
		[3, 2],
		[1, 3],
	];
	for (const p of placed) {
		const { w, h } = furnitureSize(p.id);
		let ok = false;
		for (let y = p.y; y < p.y + h; y++)
			for (let x = p.x; x < p.x + w; x++) if (reach(x, y)) ok = true;
		if (!ok) return false;
	}
	return things.every(([x, y]) => reach(x, y));
};

/** 家具が その 左上で 置けるか（床の 上・KEEP を ふさがない・ほかと 重ならない・歩けなく ならない）。 */
export const canPlace = (
	placed: readonly Placed[],
	p: Placed,
	stand?: Cell,
): boolean => {
	const { w, h } = furnitureSize(p.id);
	for (let y = p.y; y < p.y + h; y++)
		for (let x = p.x; x < p.x + w; x++) {
			if (!isFloor(placed, x, y)) return false;
			if (HOME_KEEP.some(([kx, ky]) => kx === x && ky === y)) return false;
			if (stand && stand[0] === x && stand[1] === y) return false;
		}
	return layoutOk([...placed, p]);
};

/**
 * 目の前の マス（front）に 家具を 置く 所（左上）。front を ふくみ、立っている マス（stand）を ふくまない
 * 並びの うち、向こうへ のびる 形から 先に ためす。置けなければ null。
 */
export const placeInFront = (
	placed: readonly Placed[],
	id: FurnitureId,
	stand: Cell,
	front: Cell,
): Placed | null => {
	const { w, h } = furnitureSize(id);
	const dx = front[0] - stand[0];
	const dy = front[1] - stand[1];
	const xs = Array.from({ length: w }, (_, i) => front[0] - i);
	const ys = Array.from({ length: h }, (_, i) => front[1] - i);
	// 向こうへ のびる 形が 先（上を 向いたら 上へ、左を 向いたら 左へ）
	if (dx < 0) xs.reverse();
	if (dy < 0) ys.reverse();
	for (const y of ys)
		for (const x of xs) {
			const p = { id, x, y };
			if (canPlace(placed, p, stand)) return p;
		}
	return null;
};

/** 部屋の 家具の 字（マスごとに 1字。ほかの 字と かぶらない）。 */
const CHARS = "abcdefgijklnopqrstuvwxyzABCEGIJLMNOPQRSTUVXYZ0123456789";
export const HOME_MAX = 20;

/** 部屋の 行と、字 → 絵・調べる 物（家具の id。予定表は loan、収納は closet）。 */
export const homeRows = (
	layout: HomeLayout,
): {
	rows: string[];
	art: Record<string, string>;
	things: Record<string, string>;
} => {
	const rows = HOME_ROWS.map((r) => [...r]);
	const art: Record<string, string> = {};
	const things: Record<string, string> = {
		m: "loan",
		K: "closet",
		P: "phone",
	};
	let n = 0;
	for (const p of layout.placed.slice(0, HOME_MAX)) {
		FURNITURE[p.id].cells.forEach((line, dy) => {
			line.forEach((ref, dx) => {
				const ch = CHARS[n++];
				rows[p.y + dy][p.x + dx] = ch;
				art[ch] = ref;
				things[ch] = p.id;
			});
		});
	}
	return { rows: rows.map((r) => r.join("")), art, things };
};

// ───────────────── 文 ─────────────────

export const HOME_MSG = {
	/** 買う 前の 扉。 */
	forSale: [
		"分譲住宅「おんJヶ丘」。\n玄関に「モデルハウス　ご見学　どうぞ」。",
	],
	agent: [
		"いらっしゃいませ！　おんJヶ丘　不動産です。\nこちら、最後の　1区画　なんですよ",
		"35年ローン、毎月　{monthly}。\n金利は「保守金利」で　ございます",
	],
	ask: ["契約する（頭金を　払う）", "やめておく"],
	declined: "またの　ご来場を　お待ちしております。",
	contract: [
		"書類に　名前を　書いた。\n「キリコ」。……はんこは、ない。",
		"「拇印で　けっこうです！」",
		// 引き落とすのは 家に 入った とき（ui/village/myhome.ts の syncReturns。冒険から 帰って 家に 来るたびに 1か月）
		"返済は、冒険から　帰って　家に　来るたびに\n1か月ぶん　引き落とし。帳簿は　ロゼ。",
	],
	/** 頭金（{price}・{have}）。 */
	down: "「頭金は　{price}。\nお手元の　ご予算は……」",
	downShort: "「……{have}。\n頭金が　たりませんね。また　ぜひ」",
	paid: "頭金　{price}を　払った。",
	keys: "家の　鍵を　受けとった。",
	welcome: "「では、ごゆっくり。\n家具は……これから　ですね」",
	/** 宅配便。 */
	parcel: "玄関に　荷物が　届いていた。",
	/** 持ち帰った 板の 底の 品（{n}つ。収納に 入る）。 */
	goals: "持ち帰った　品が　{n}点、\n台に　のって　届いていた。",
	from: "{from}から：{name}",
	/** 返済予定表（{y}年{m}か月）。 */
	loan: [
		"返済予定表。\n35年ローン　残り　{y}年{m}か月。",
		"毎月の　返済額は　{monthly}。\n手もとの　お金：{have}",
	],
	/** 滞納（{n} 回）。 */
	late: "赤い　字で「滞納　{n}回」。\n……次に　来たら　まとめて　引き落とし。",
	/** 家に 入ったとき 返済した（{n}か月・{price}）。 */
	repaid: "ローンを　{n}か月ぶん　返した（{price}）。",
	/** 払えなかった。 */
	unpaid: "返済の　お金が　たりなかった。\n予定表に　赤い　字が　ふえた。",
	loanDone: ["返済予定表。\n「完済」の　はんこ。"],
	closet: "収納。\n片づけた　家具と、模様替えの　道具。",
	closetMenu: [
		"家具を　出す",
		"壁紙を　かえる",
		"床を　かえる",
		"ぜんぶ　片づける",
		"もらった　物",
		"やめる",
	],
	/** ぜんぶ 片づける。 */
	clearAsk: "置いた　家具を　ぜんぶ　収納に　しまう？",
	clearMenu: ["しまう", "やめる"],
	cleared: "家具を　ぜんぶ　しまった。\n部屋が　広く　なった。",
	clearNone: "置いた　家具は　ない。",
	stored: "片づけた　家具",
	none: "片づけた　家具は　ない。",
	placeHint:
		"置きたい　所の　前に　立って　A。\n（スマホは　キリコを　タップ）",
	wallTitle: "壁紙",
	floorTitle: "床",
	changed: "{name}に　した。",
	/** 家具を 調べた あと。 */
	thingMenu: ["動かす", "片づける", "そのまま"],
	/** 遊べる 家具を 調べた あと。 */
	gameMenu: ["遊ぶ", "動かす", "片づける", "そのまま"],
	pcMenu: [
		"遊ぶ",
		"BASIC",
		"ネット",
		"トレード",
		"動かす",
		"片づける",
		"そのまま",
	],
	easelMenu: ["描く", "動かす", "片づける", "そのまま"],
	craneGift:
		"金の　ぷゆゆを　家に　送った。\n（ぷゆゆの　ぬいぐるみ　が　収納に）",
	picked: "{name}を　持った。\nうすい　絵の　所に、A　で　置く。",
	/** 持っている あいだの 知らせ（画面の 上）。 */
	carryHint: "{name}：うすい　絵の　所に　A　で　置く",
	/** 持った まま 収納を 調べた。 */
	returned: "{name}を　収納に　もどした。",
	putAway: "{name}を　収納に　しまった。",
	emptyTitle: "どれを　置く？",
	cannot: "そこには　置けない。\n（通れなく　なるか、すきまが　ない）",
	full: "これ　いじょう　置けない。",
	carrying: "{name}を　持っている。",
	gotFrom: "{name}を　もらった。\n家の　収納に　入れておこう。",
	/** 宅配便で 届いたが もう 持っていた。 */
	already: "……{name}は　もう　ある。\n気持ちだけ　もらっておこう。",
	/** リサイクルショップの レジ（{have} は 手もとの お金）。 */
	shop: "「家具なら　ここで　そろうで。\n配送料は　サービスや」",
	shopTitle: "家具を　買う",
	shopNoHome:
		"「家具？　まず　住む　家が　いるやろ。\nおんJヶ丘の　分譲、まだ　あいとるで」",
	shopEmpty: "「うちに　ある　家具は、\nもう　ぜんぶ　持っとるやん」",
	shopAsk: "{name}を　{price}で　買う？",
	shopMenu: ["買う", "やめる"],
	shopShort: "「……{price}、たりへんな。\nまた　来てや」",
	bought: "{name}を　買った。\n家の　収納に　届けてもらった。",
	/** 電話（招く）。 */
	phone: "電話。\n仲よく　なった　人の　番号が　ある。",
	phoneNone:
		"まだ　かける　相手が　いない。\n（話したり、贈り物を　したり　すると）",
	phoneTitle: "だれを　招く？",
	phoneCall: "{name}に　電話を　かけた。\n……すぐ　行く、と　言った。",
	phoneBye: "{name}は　帰っていった。",
	phoneMenu: ["帰って　もらう", "そのまま"],
	phoneHere: "{name}が　来ている。",
} as const;

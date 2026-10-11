// キリコの 家（マイホーム）。住宅街（段6）から 中庭の 分譲住宅（地図の 53,31。data/village/facilities.ts の myhome）を
// 35年ローンで 買える（演出だけ：ゲームの 中に お金を 払う ところは ない。返済予定表が 帰るたびに 1か月 進む）。
// 中では 家具を 置く・動かす・片づける、壁紙と 床を かえる（模様替え）。家具は 買わず、もらう：
// 帰るたびに 1つ 宅配便で 届く（仲間・町の 人から。HOME_GIFTS）のと、町の 住人に 話すと 1度だけ（RESIDENT_GIFTS）。
// ここは 形と 決まりだけ（DOM も 保存も 使わない）。保存・場面は ui/myhome.ts。

import type { Cell } from "./map";
import { type RoomArtName, ri, riCell } from "./rpgenArt";
import { base } from "./tiles";

/** 分譲住宅が 建つ 町の 段（住宅街）。 */
export const MYHOME_FROM = 6;

/** ローンの 月数（35年）。帰るたびに 1か月 返す（演出）。 */
export const LOAN_MONTHS = 35 * 12;

// ───────────────── 家具 ─────────────────

export type FurnitureId =
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
	| "dumbbell";

export type Furniture = {
	name: string;
	/** 絵（行 × 列。マスごとの 絵）。 */
	cells: readonly (readonly string[])[];
	/** 調べた ときの 文（1窓）。 */
	line: string;
};

const row = (name: RoomArtName, w: number, r = 0): string[] =>
	Array.from({ length: w }, (_, c) => riCell(name, c, r));

export const FURNITURE: Record<FurnitureId, Furniture> = {
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
		cells: [row("sofaWhite", 2)],
		line: "白い　ソファ。\nすわると、ちょうど　いい　沈みかた。",
	},
	shelf: {
		name: "本棚",
		cells: [row("bookshelf", 2)],
		line: "本棚。\nまだ　半分　あいている。",
	},
	tv: {
		name: "大きな　テレビ",
		cells: [row("tvBig", 2)],
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
		name: "ゲーム機と　テレビ",
		cells: [row("tvGame", 2, 0), row("tvGame", 2, 1)],
		line: "ゲーム機と　テレビ。\nコントローラーが　2つ。",
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
		from: "保守ヶ丘　町内会",
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
		from: "保守村　銀行",
		note: "添え書き「貸金庫の　おまけです」",
	},
	{ id: "dumbbell", from: "ageジム", note: "添え書き「入会　お待ちしてます」" },
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
	"#.........K#",
	"#..........#",
	"#..........#",
	"#..........#",
	"#..........#",
	"#..........#",
	"#####DD#####",
];

/** 家具を 置かない マス（入口の マットの 前・返済予定表の 前）。 */
export const HOME_KEEP: readonly Cell[] = [
	[5, 8],
	[6, 8],
	[3, 3],
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
	const things: Record<string, string> = { m: "loan", K: "closet" };
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
	forSale: ["分譲住宅「保守ヶ丘」。\n玄関に「モデルハウス　ご見学　どうぞ」。"],
	agent: [
		"いらっしゃいませ！　保守ヶ丘　不動産です。\nこちら、最後の　1区画　なんですよ",
		"35年ローンで、頭金は　0円。\n金利は「保守金利」で　ございます",
	],
	ask: ["契約する", "やめておく"],
	declined: "またの　ご来場を　お待ちしております。",
	contract: [
		"書類に　名前を　書いた。\n「キリコ」。……はんこは、ない。",
		"「拇印で　けっこうです！」",
		"返済は　毎月、口座から　引き落とし。\n……口座、あったっけ。",
	],
	keys: "家の　鍵を　受けとった。",
	welcome: "「では、ごゆっくり。\n家具は……これから　ですね」",
	/** 宅配便。 */
	parcel: "玄関に　荷物が　届いていた。",
	from: "{from}から：{name}",
	/** 返済予定表（{y}年{m}か月）。 */
	loan: [
		"返済予定表。\n35年ローン　残り　{y}年{m}か月。",
		"毎月の　返済額の　ところは、\n……にじんで　読めない。",
	],
	loanDone: ["返済予定表。\n「完済」の　はんこ。"],
	closet: "収納。\n片づけた　家具と、模様替えの　道具。",
	closetMenu: ["家具を　見る", "壁紙を　かえる", "床を　かえる", "やめる"],
	stored: "片づけた　家具",
	none: "片づけた　家具は　ない。",
	placeHint:
		"置きたい　所の　前に　立って　A。\n（スマホは　キリコを　タップ）",
	wallTitle: "壁紙",
	floorTitle: "床",
	changed: "{name}に　した。",
	/** 家具を 調べた あと。 */
	thingMenu: ["動かす", "片づける", "そのまま"],
	picked: "{name}を　持ちあげた。\n置きたい　所の　前で　A。",
	putAway: "{name}を　収納に　しまった。",
	emptyTitle: "ここに　置く",
	cannot: "そこには　置けない。\n（通れなく　なるか、すきまが　ない）",
	full: "これ　いじょう　置けない。",
	carrying: "{name}を　持っている。",
	gotFrom: "{name}を　もらった。\n家の　収納に　入れておこう。",
} as const;

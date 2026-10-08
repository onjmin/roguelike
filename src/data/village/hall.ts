// おんJ 本館の 中（村の 崖の 前の 建物。扉を 踏むと 入る）。DOM も 保存も 使わない 組み立てだけ
// （src/sim/villageTests.ts で 形と 歩ける道を 調べる）。スクリプトは ui/hallEvents.ts が id ごとに 付ける。
//
// 本館の 段（hallTier。data/village/tiles.ts）で 広さと 中身が 育つ（前の 段の 物は 残る）：
//   0 集会所（町の 段0〜2。8×7）   座布団と 長机・壁の スレ（冒険の記録）・保守の 当番表・>>1 テンプレ（あそびかた）・
//                                  期間限定の 告知・本棚（ことばの 辞典と 図鑑）
//   1 レンガ館（段3〜5。12×9）    ＋ 本棚（図鑑）・飾り棚（持ち帰った 品）・帳簿の 貼り紙・名無しの 当番・
//                                  野球の 実況民（虎と 兎）
//   2 本館（段6〜7。16×11）       ＋ 実況モニター（リプレイ 上映）・殿堂の 壁（総選挙の はり紙）と 空いた いす・
//                                  モニターを 見る 名無し・野球の 実況民 6人（段7 は 野次馬と 星も）
// 部屋は rpg の 屋内と 同じ 形：上に 天井（#）と 壁 2段（H 上段・h 下段）、下の 壁の まんなかに 出口の マット（2マス）。
// 壁に かけた 物は 壁の 下段の マスに 見えない イベントを 置き、1つ下の 床から 上を 向いて 調べる。
// 外の 扉 2マスと 出口の マット 2マスは 左右で 対（入ると 同じ がわの 1マス 内がわで 上を 向く）。
// 出ると 入った 扉の 前（外の 崖の 下の 道。下を 向く）。
// 仲間 5人と 村の 住人は 外に 残る（村の 座標・並び・近くに いるか で 話が 決まる）。中の 人は 名無し（敵と 同じ 絵は 使わない）。
//
// 字（部屋ごとに 自分の パレット。村の 字とは 別）
//   #  天井   H h  壁（上段・下段。段で 板壁 → 白い 壁 → 石の 壁）   W  上段の 窓
//   .  床（段で 板 → 板 → 石）   -  金の じゅうたん   D  出口の マット（踏むと 外へ）
//   K k  壁の スレ（掲示板の 左右）   [ ]  保守の 当番表（黒板の 左右）   t  >>1 テンプレ   N  期間限定の 告知
//   $  帳簿の 貼り紙（金貨の 札）   C c  飾り棚（上段・下段。棚と 持ち帰った 品は ui/hallEvents.ts の decor が 描く）
//   M m  実況モニター（左右）   G g  殿堂の 旗（左右）
//   z  座布団   ( )  長机（左右）   x  みかん箱   B  本棚   F  鉢植え   T  机   n  いす   r  空いた いす（殿堂の となり）
//   P  石の 柱   Q  いちばん 古い スレの 札（原住民の「ここが野球chだ」。裏シナリオ：跡地へ 降りる 床下の 入口）

import { TOWN_STAGES } from "../../core/town";
import type { DungeonId } from "../../core/types";
import type { TileDef } from "../../engine/defs";
import type { Dir } from "../../engine/types";
import { YAJI_WALK } from "../cast";
import type { Cell, VillageView } from "./map";
import { VILLAGE_SPOTS } from "./map";
import { base, basePx, floor, hallTier, INDOOR, solid } from "./tiles";

export type HallTier = 0 | 1 | 2;

/** 地図の 形に 使う 本館の 段（町の 段を 0〜7 に 丸めてから）。 */
export const hallTierOf = (v: Pick<VillageView, "stage">): HallTier =>
	hallTier(Math.max(0, Math.min(TOWN_STAGES - 1, Math.floor(v.stage) || 0)));

/** 本館の 名前（入ったときの 札。段で かわる）。 */
export const HALL_NAMES: readonly string[] = [
	"おんJ　集会所",
	"おんJ　レンガ館",
	"おんJ　本館",
];

// ───────────────── 行 ─────────────────

const HALL_ROWS: readonly (readonly string[])[] = [
	// 集会所：座布団と 長机。壁に スレ・当番表・テンプレ・告知
	[
		"########",
		"#HHWWHH#",
		"#Kk[]tN#",
		"#......#",
		"#.z()zQ#",
		"#.....B#",
		"###DD###",
	],
	// レンガ館：本棚・飾り棚・帳簿。名無しの 当番
	[
		"############",
		"#HHHHWWCCCC#",
		"#KktN[]$ccc#",
		"#..........#",
		"#..........#",
		"#B........Q#",
		"#.nTn......#",
		"#F........F#",
		"#####DD#####",
	],
	// 本館：金の じゅうたんが 実況モニターまで。石の 柱・殿堂の 旗と 空いた いす
	[
		"################",
		"#HHHHWWHHCCCCHH#",
		"#KktN[]Mm$cccGg#",
		"#......--.....r#",
		"#......--......#",
		"#B.P...--...P..#",
		"#......--......#",
		"#B.....--.....Q#",
		"#..P...--...P..#",
		"#F.....--.....F#",
		"#######DD#######",
	],
];

/** 本館の 中の 地図（行）。 */
export const hallRows = (tier: HallTier): string[] => [...HALL_ROWS[tier]];

/** 出口の マット（2マス。左が 外の 左の 扉と 対）。 */
export const hallMats = (tier: HallTier): readonly Cell[] => {
	const rows = HALL_ROWS[tier];
	const y = rows.length - 1;
	const x = [...rows[y]].indexOf("D");
	return [
		[x, y],
		[x + 1, y],
	];
};

/** 外の 扉 i（0 左・1 右）から 入ったときに 立つ マス（マットの 1つ上。上を 向く）。 */
export const hallEntry = (tier: HallTier, i: number): Cell => {
	const [x, y] = hallMats(tier)[i === 0 ? 0 : 1];
	return [x, y - 1];
};

/**
 * 本館から 出たときに 立つ 外の マス（入った 扉の 1つ下。下を 向く）。from は 入った 扉の x
 * （Story の 印 hallFrom。無い・知らない 値なら 右の 扉）。
 */
export const hallOutside = (from?: unknown): Cell => {
	const doors = VILLAGE_SPOTS.hallDoors;
	const door = doors.find(([x]) => x === from) ?? doors[doors.length - 1];
	return [door[0], door[1] + 1];
};

/** 出るときの 向き（外では 下）。 */
export const HALL_OUT_DIR: Dir = "down";

// ───────────────── パレット ─────────────────

const CEIL = "#1b1410";
const PAPER = basePx(32, 1446); // 貼り紙（字の 行）
const POSTER = basePx(48, 1446); // 手配書のような 貼り紙（告知）
const LEDGER = base(4, 96); // 金貨の 札（売り上げの 帳簿）
const WINDOW = basePx(16, 1382); // 格子窓

/** 段ごとの 床・壁（上段・下段）。 */
const HALL_LOOK = [
	{
		floor: base(0, 46),
		floorColor: "#b8905a",
		up: base(1, 55),
		low: base(1, 56),
		wallColor: "#6a4a2a",
	},
	{
		floor: base(0, 46),
		floorColor: "#b8905a",
		up: base(1, 77),
		low: base(1, 78),
		wallColor: "#e8e4dc",
	},
	{
		floor: base(3, 46),
		floorColor: "#9a9a9a",
		up: base(1, 63),
		low: base(1, 64),
		wallColor: "#d8d8d8",
	},
] as const;

/**
 * 本館の 中の パレット（rpg の 屋内 INDOOR が 下地。段で 床・壁の 絵が かわる。置く 物は 同じ 字）。
 * t k z C P M G g は 本館では べつの 物（壁に かける 物・座布団・飾り棚・柱）に 上書きする。
 */
export const hallPalette = (tier: HallTier): Record<string, TileDef> => {
	const l = HALL_LOOK[tier];
	const on = (...refs: string[]) => solid(l.floorColor, l.floor, ...refs);
	const up = (...refs: string[]) => solid(l.wallColor, l.up, ...refs);
	const low = (...refs: string[]) => solid(l.wallColor, l.low, ...refs);
	return {
		...INDOOR,
		"#": solid(CEIL),
		H: up(),
		h: low(),
		W: up(WINDOW),
		".": floor(l.floorColor, l.floor),
		"-": floor("#c0a030", base(5, 47)),
		D: floor("#a01818", l.floor, base(2, 49)),
		K: low(base(6, 37, 1, 2)),
		k: low(base(7, 37, 1, 2)),
		"[": low(base(2, 509)),
		"]": low(base(4, 509)),
		t: low(PAPER),
		N: low(POSTER),
		$: low(LEDGER),
		C: up(),
		c: low(),
		M: low(base(0, 485, 1, 2)),
		m: low(base(1, 485, 1, 2)),
		G: low(base(3, 118, 1, 2)),
		g: low(base(4, 118, 1, 2)),
		z: on(base(4, 108)),
		"(": on(base(0, 121)),
		")": on(base(2, 121)),
		x: on(base(4, 123)),
		B: on(base(3, 104, 1, 2)),
		F: on(base(7, 129, 1, 2)),
		T: on(base(2, 108)),
		n: on(base(2, 109)),
		r: on(base(3, 109)),
		P: on(base(3, 352, 1, 2)),
		// 集会所は すみの 1マスに 置くので 背の 低い 札（立て札の まんなか 16px。うしろの マスから 読める）。広い 館では 立て札
		Q: on(tier === 0 ? basePx(80, 600) : base(5, 37, 1, 2)),
	};
};

// ───────────────── 置く 物 ─────────────────

/** 本館の 中に 置く イベント（人・壁の 物・出口）。スクリプトは ui/hallEvents.ts が id で 付ける。 */
export type HallPlace = {
	id: string;
	x: number;
	y: number;
	trigger: "talk" | "touch";
	/** 見た目（無ければ 見えない イベント。タイルの 絵を そのまま 調べる）。 */
	sprite?: string;
	dir?: Dir;
};

/** 名無し（本館の 中の 人。村の 住人とも 敵とも 別の 絵）。 */
export const NANASHI_WALK: readonly string[] = [
	"sa:xjuotB", // 彡(⭕)(⭕)
	"sa:qPN3cT", // 赤面J民
	"sa:C2hS8U", // 陽すこ民
	"sa:VaBXqn", // J min Black
];

/** 字 → 壁の 物の id（同じ 物が 2〜3マスなら _0 から 番号）。 */
const WALL_IDS: Record<string, string> = {
	K: "board",
	k: "board",
	"[": "toban",
	"]": "toban",
	t: "template",
	N: "notice",
	$: "ledger",
	c: "shelf",
	M: "monitor",
	m: "monitor",
	// 右の 旗の 前には 空いた いす（殿堂は 左の 旗の 前から 読む）
	G: "dendo",
	B: "book",
	r: "chair",
	Q: "oldest",
};

/** 名無し・野次馬の 立つ マス（段ごと。上を 向いて モニターを 見る 人は dir: up）。 */
const PEOPLE: readonly (readonly {
	id: string;
	at: Cell;
	dir: Dir;
	from?: number;
}[])[] = [
	[],
	[
		{ id: "nanashi_toban", at: [8, 5], dir: "down" },
		// 野球の 実況民（data/hall.ts の JIKKYO）。机を かこんで スマホで 実況しながら 言いあう
		{ id: "jikkyo_tora", at: [3, 5], dir: "down" },
		{ id: "jikkyo_g", at: [6, 6], dir: "left" },
	],
	[
		{ id: "nanashi_toban", at: [2, 4], dir: "down" },
		// 野球の 実況民（おんJに 多い 順：虎 2人・兎・竜・鯉。パ民は 鷹が ひとり すみっこ。段7 は 星も）
		{ id: "jikkyo_tora", at: [10, 4], dir: "up" },
		{ id: "jikkyo_tora2", at: [5, 4], dir: "up" },
		{ id: "jikkyo_g", at: [10, 5], dir: "up" },
		{ id: "jikkyo_ryu", at: [4, 4], dir: "up" },
		{ id: "jikkyo_koi", at: [11, 5], dir: "up" },
		{ id: "jikkyo_taka", at: [13, 7], dir: "up" },
		{ id: "jikkyo_hoshi", at: [5, 6], dir: "up", from: 7 },
		{ id: "nanashi_0", at: [6, 4], dir: "up" },
		{ id: "nanashi_1", at: [9, 4], dir: "up" },
		{ id: "nanashi_2", at: [5, 5], dir: "up" },
		// 祭り（段7）：野次馬も 見に 来ている
		{ id: "yaji_0", at: [6, 6], dir: "up", from: 7 },
		{ id: "yaji_1", at: [10, 6], dir: "up", from: 7 },
	],
];

/** 本館の 中に 置く イベントの 一覧。 */
export const hallPlaces = (v: VillageView): HallPlace[] => {
	const tier = hallTierOf(v);
	const stage = Math.floor(v.stage) || 0;
	const out: HallPlace[] = [];
	// 出口の マット（踏むと 外へ）
	hallMats(tier).forEach(([x, y], i) => {
		out.push({ id: `mat_${i}`, x, y, trigger: "touch" });
	});
	// 壁の 物・本棚・いす（見えない イベント。タイルの 絵を 調べる）
	const count: Record<string, number> = {};
	HALL_ROWS[tier].forEach((r, y) => {
		[...r].forEach((ch, x) => {
			const id = WALL_IDS[ch];
			if (!id) return;
			const n = count[id] ?? 0;
			count[id] = n + 1;
			out.push({ id: `${id}_${n}`, x, y, trigger: "talk" });
		});
	});
	// 名無し（と 段7 の 野次馬）
	let nanashi = 0;
	for (const p of PEOPLE[tier]) {
		if (p.from !== undefined && stage < p.from) continue;
		const yaji = p.id.startsWith("yaji_");
		const sprite = yaji
			? YAJI_WALK[Number(p.id.slice(5)) % YAJI_WALK.length]
			: NANASHI_WALK[nanashi++ % NANASHI_WALK.length];
		out.push({
			id: p.id,
			x: p.at[0],
			y: p.at[1],
			trigger: "talk",
			sprite,
			dir: p.dir,
		});
	}
	return out;
};

// ───────────────── 飾り棚 ─────────────────

/**
 * 蓄音機で 鳴らしている 品の 板（植民地化宣言・長湯スレ・鉄塔の保守スレ。裏シナリオの >>1 と 20人目の レスも。
 * 棚には 置かない）。
 */
export const ON_PHONO: readonly DungeonId[] = [
	"shallow",
	"main",
	"deep",
	"ato",
	"hinan",
];

/**
 * シヨが 倉庫で あずかっている 品の 板（過去ログの底の 1作目の スレ。STORY.md §5.8。裏の 2段目の 続きの レスも
 * ：data/story.ts の CLEAR.y1901。棚には 置かない）。
 */
export const IN_STORE: readonly DungeonId[] = ["hidden", "y1901"];

/** まとめ掲示板に 貼ってある 品の 板（乗っ取り屋の 置き手紙。data/scraps.ts。棚には 置かない）。 */
export const ON_BOARD: readonly DungeonId[] = ["isle1", "isle2", "isle3"];

/** 飾り棚の 段（上の 段から 左 → 右。絵を 描く マス）。棚が 無い 段は 空。 */
export const shelfSlots = (tier: HallTier): Cell[] => {
	const out: Cell[] = [];
	for (const ch of ["C", "c"])
		HALL_ROWS[tier].forEach((r, y) => {
			[...r].forEach((c, x) => {
				if (c === ch) out.push([x, y]);
			});
		});
	return out;
};

/** 棚に 並べる 板（持ち帰った 板の うち 蓄音機に ついて いない・倉庫に ない 品。order の 順）。 */
export const shelfBoards = (
	cleared: readonly DungeonId[],
	order: readonly DungeonId[],
): DungeonId[] =>
	order.filter(
		(d) =>
			cleared.includes(d) &&
			!ON_PHONO.includes(d) &&
			!IN_STORE.includes(d) &&
			!ON_BOARD.includes(d),
	);

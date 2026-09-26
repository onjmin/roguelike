// 村（保守村）の マップチップ。rpg の data/tiles.ts から、村で使う物を 移した。
// 同梱の 16px チップシート public/assets/rpg-reze/Base.png（8列×652行）から 1マスずつ切り出す
// （ui/town.ts の 町の帯と 同じ絵。RPGEN の CDN の置物 `sp:` は使わない）。
//
// (c, r) はマス単位の列・行。w×h マスぶん切り出すと、マスの「下端そろえ・左右中央」で描かれる
// （16x32 の扉・立て札・掲示板は上のマスへ、32x32 の木は左右と上へ はみ出す）。
// 2マス幅以上の物は、はみ出しが 後から描くマスに消されないよう `above`（キャラより手前）に入れ、
// その物が覆うマスは すべて通れないようにしておく。
//
// 文字 → タイルの対応表（パレット）を 組み合わせて使う（data/village/map.ts の villagePalette）。
// どのパレットでも " " は外側の黒。

import type { TileDef } from "../../engine/defs";

const BASE = "pub:assets/rpg-reze/Base.png";

/** Base.png の (c, r) マスから w×h マス。 */
export const base = (c: number, r: number, w = 1, h = 1): string =>
	`${BASE}#${c * 16},${r * 16},${w * 16},${h * 16}`;
/** Base.png をピクセル単位で切り出す（半マスずれて描かれている窓・ランプなどの小物用）。 */
export const basePx = (x: number, y: number, w = 16, h = 16): string =>
	`${BASE}#${x},${y},${w},${h}`;

/** 通れる地形。layers は下から順に重ねる。 */
export const floor = (color: string, ...layers: string[]): TileDef => ({
	layers,
	color,
	passable: true,
});
/** 通れない物。 */
export const solid = (color: string, ...layers: string[]): TileDef => ({
	layers,
	color,
	passable: false,
});
/** 大きな物（2マス幅の木など）。キャラより手前に描き、通れない。 */
export const big = (color: string, ground: string, img: string): TileDef => ({
	layers: [ground],
	above: [img],
	color,
	passable: false,
});
/** カウンター（向こう側の人に話しかけられる）。 */
export const counter = (color: string, ...layers: string[]): TileDef => ({
	layers,
	color,
	passable: false,
	counter: true,
});

// ───────────────── 地面 ─────────────────
/** 草（芝）。 */
export const TURF = base(0, 4);
/** 土の道（町の段 4 まで）。 */
export const DIRT = base(5, 4);
/** 石だたみの道（町の段 5 から。ui/town.ts と同じ）。 */
export const STONE = base(2, 47);
/** 敷石（rpg の町の道）。 */
export const PAVE = base(5, 48);

/** 画像が まだ読めないときの色（ui/town.ts と同じ）。 */
export const C_GRASS = "#97bc25";
export const C_DIRT = "#b29f6e";
export const C_STONE = "#81664d";
const C_PAVE = "#8c8c90";
const C_ROCK = "#6b5f45";
const C_CAVE = "#2a2620";
const C_WOOD = "#b8905a";

const BLACK: TileDef = { layers: [], color: "#000", passable: false };

// ───────────────── 町（rpg の TOWN から） ─────────────────
// 家は「屋根2段（棟 n/a/z ＋ 屋根 ^/A/Z）＋ 壁2段（上段＝窓・看板、下段＝扉）」で組む。
//   .  敷石   :  広場の石畳   ,  芝生
//   n ^ 赤い屋根（棟・屋根）  a A 青い屋根  z Z わら屋根
//   % #  レンガ壁（上段・下段）  ( )  白壁（上段・下段）  [ ]  板壁（上段・下段）
//   W  窓（レンガ壁）  w  窓（白壁・板壁）  D  扉（レンガ壁）  d  扉（白壁）  e  扉（板壁）
//   $  道具屋の看板（壁の上段に付く）
//   |  木の柵  *  花壇（ピンク）  &  花壇（黄）  T  木（2マス幅）
//   U  井戸  K k  掲示板（2マス・左右）  x  木箱  L  ランプ
// rpg の ! 立て看板 は 村では 崖の立て札（CLIFF）に使うので 入れない。
// 街灯・ベンチ（RPGEN の CDN）、噴水・自販機・鉢植えは 村に無いので 入れない。
const WIN_BRICK = basePx(16, 1382); // 格子窓（壁装飾 1,86 を半マス上げて切り出し）
const WIN_WHITE = basePx(48, 1382); // 木枠の窓（壁装飾 3,86）

export const TOWN: Record<string, TileDef> = {
	".": floor(C_PAVE, PAVE),
	":": floor("#8a7a6a", base(2, 46)),
	",": floor(C_GRASS, TURF),
	n: solid("#a83a2a", base(3, 82)),
	"^": solid("#c04a3a", base(3, 83)),
	a: solid("#3a5a8a", base(2, 82)),
	A: solid("#4a6a9a", base(2, 83)),
	z: solid("#b89a3a", base(6, 82)),
	Z: solid("#c8aa4a", base(6, 83)),
	"%": solid("#a04a3a", base(1, 61)),
	"#": solid("#a04a3a", base(1, 62)),
	"(": solid("#e8e8e8", base(1, 59)),
	")": solid("#e8e8e8", base(1, 60)),
	"[": solid("#6a4a2a", base(1, 55)),
	"]": solid("#6a4a2a", base(1, 56)),
	W: solid("#a04a3a", base(1, 61), WIN_BRICK),
	w: solid("#e8e8e8", base(1, 59), WIN_WHITE),
	D: floor("#a04a3a", base(1, 62), base(7, 61, 1, 2)),
	d: floor("#e8e8e8", base(1, 60), base(7, 77, 1, 2)),
	e: floor("#6a4a2a", base(1, 56), base(7, 55, 1, 2)),
	$: solid("#a04a3a", base(1, 61), base(2, 95)),
	"|": solid(C_GRASS, TURF, base(5, 30)),
	"*": solid(C_GRASS, TURF, base(5, 11)),
	"&": solid(C_GRASS, TURF, base(7, 11)),
	T: big(C_GRASS, TURF, base(0, 6, 2, 2)),
	U: solid(C_PAVE, PAVE, base(2, 37)),
	K: solid(C_PAVE, PAVE, base(6, 37, 1, 2)),
	k: solid(C_PAVE, PAVE, base(7, 37, 1, 2)),
	x: solid(C_PAVE, PAVE, base(4, 123)),
	// 灯ったランプ（ui/town.ts の lantern と同じ切り出し）
	L: solid(C_PAVE, PAVE, basePx(96, 2250)),
	" ": BLACK,
};

// ───────────────── 北の崖と ダンジョンの口 ─────────────────
// 崖は 上から 4段（ui/town.ts の cliff と同じ絵）。いちばん下の段の絵は 下の端が透けるので 草を敷く。
//   1  崖の上（草）  2  崖のふち  3  岩肌（上）  4  岩肌（下）
//   M  ダンジョンの口（通れる。踏むと もぐる）  m  板で ふさいだ口（通れない）
//   !  立て札（崖の足もとに立つ。道は ふさがない）
// 口の絵 base(2,23,1,2) は 右の端が 丸いので、下に 岩肌を 敷いて すき間を 埋める。
const ROCK_LOW = base(1, 19);
const MOUTH = base(2, 23, 1, 2);

export const CLIFF: Record<string, TileDef> = {
	"1": solid(C_GRASS, base(1, 16)),
	"2": solid(C_GRASS, base(1, 17)),
	"3": solid(C_ROCK, base(1, 18)),
	"4": solid(C_ROCK, TURF, ROCK_LOW),
	M: floor(C_CAVE, TURF, ROCK_LOW, MOUTH),
	m: solid(C_CAVE, TURF, ROCK_LOW, MOUTH, base(4, 123)),
	"!": solid(C_ROCK, TURF, ROCK_LOW, base(5, 37, 1, 2)),
};

// ───────────────── カウンター ─────────────────
// 屋台・店・倉庫の 台（左端・中・右端）。TOWN の [ ] 板壁と かぶらない字にする。
export const COUNTERS: Record<string, TileDef> = {
	"<": counter(C_WOOD, TURF, base(1, 98)),
	"-": counter(C_WOOD, TURF, base(2, 98)),
	">": counter(C_WOOD, TURF, base(3, 98)),
};

// ───────────────── 空き地 ─────────────────
//   v  雑草（通れる）  u  ロゼの 麻婆豆腐の 鍋（通れない）
//   H h  生け垣（村の まわり。16px の しげみ 2種）
export const LOT: Record<string, TileDef> = {
	v: floor(C_GRASS, TURF, base(3, 11)),
	u: solid(C_GRASS, TURF, base(0, 123)),
	H: solid(C_GRASS, TURF, base(1, 10)),
	h: solid(C_GRASS, TURF, base(0, 10)),
};

// 村（保守村）の マップチップ。rpg の data/tiles.ts から、村で使う物を 移した。
// 同梱の 16px チップシート public/assets/rpg-reze/Base.png（8列×652行）から 1マスずつ切り出す
// （RPGEN の CDN の置物 `sp:` は使わない）。
//
// (c, r) はマス単位の列・行。w×h マスぶん切り出すと、マスの「下端そろえ・左右中央」で描かれる
// （16x32 の扉・立て札・掲示板は上のマスへ、32x32 の木は左右と上へ はみ出す）。
// 2マス幅以上の物は、はみ出しが 後から描くマスに消されないよう `above`（キャラより手前）に入れ、
// その物が覆うマスは すべて通れないようにしておく。
//
// 文字 → タイルの対応表（パレット）を 組み合わせて使う（data/village/map.ts の villagePalette）。
// 町の段で 絵の かわる字（道・倉庫の壁と屋根）は map.ts が 段で えらぶ。
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
/** 石だたみの道（町の段 5 から）。 */
export const STONE = base(2, 47);
/** 広場の 石畳（町の段 5 から）。 */
export const PLAZA = base(2, 46);

/** 画像が まだ読めないときの色。 */
export const C_GRASS = "#97bc25";
export const C_DIRT = "#b29f6e";
export const C_STONE = "#81664d";
export const C_PLAZA = "#8a7a6a";
const C_ROCK = "#6b5f45";
const C_CAVE = "#2a2620";
const C_WOOD = "#b8905a";

const BLACK: TileDef = { layers: [], color: "#000", passable: false };

// ───────────────── 村の 地面と 置物 ─────────────────
// 道（.）・広場（:）・掲示板（K k）の 下の地面は 町の段で かわるので map.ts が 足す。
//   ,  芝生   v  雑草（通れる）   H h  生け垣（村の まわり。16px の しげみ 2種）
//   T  木（2マス幅）   Y  桜（2マス幅。段7）   *  花（ピンク）   &  花（黄）   U  井戸
//   b  しげみ   x  木箱   X  たる   u  ロゼの 麻婆豆腐の 鍋   L  灯ったランプ
export const GROUND: Record<string, TileDef> = {
	",": floor(C_GRASS, TURF),
	v: floor(C_GRASS, TURF, base(3, 11)),
	H: solid(C_GRASS, TURF, base(1, 10)),
	h: solid(C_GRASS, TURF, base(0, 10)),
	T: big(C_GRASS, TURF, base(0, 6, 2, 2)),
	Y: big(C_GRASS, TURF, base(0, 292, 2, 2)),
	"*": solid(C_GRASS, TURF, base(5, 11)),
	"&": solid(C_GRASS, TURF, base(7, 11)),
	b: solid(C_GRASS, TURF, base(0, 10)),
	x: solid(C_GRASS, TURF, base(4, 123)),
	X: solid(C_GRASS, TURF, base(3, 125)),
	u: solid(C_GRASS, TURF, base(0, 123)),
	// 灯ったランプ（マスの 区切りから ずれているので 画素で 切り出す）
	L: solid(C_GRASS, TURF, basePx(96, 2250)),
	" ": BLACK,
};

// ───────────────── 北の崖と ダンジョンの口 ─────────────────
// 崖は 上から 4段。いちばん下の段の絵は 下の端が透けるので 草を敷く。
//   1  崖の上（草）  2  崖のふち  3  岩肌（上）  4  岩肌（下）
//   M  ダンジョンの口（通れる。踏むと もぐる）  m  板で ふさいだ口（通れない）
//   !  立て札（崖の足もとに立つ。道は ふさがない）
//   y  崖のふちに 桜（段7）
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
	y: big(C_GRASS, base(1, 17), base(0, 292, 2, 2)),
};

// ───────────────── 屋台と 店先 ─────────────────
// 売り場は「うしろ（人が立つ 囲い）＋ 手前の 台」。台ごしに 話しかける（counter）。
//   < - >  台（左端・中・右端）   q Q  品物を のせた 台（左端・中）
//   o  本の 看板（立て看板。段2から 日よけの上）   c  しましまの 日よけ（段2〜4。通れない）
//   p P  囲いの 床と 日よけの 柱（左はし・右はし）
const AWNING = base(1, 366);
const BOOK_SIGN = base(3, 96);
/** 台の上の 品物（下の行の 上端は 透けているので、下へ 6px のばして 切ると 6px 持ちあがる）。 */
const goods = (c: number) => basePx(c * 16, 139 * 16, 16, 22);
/** 柵の杭（base(0,30)・(1,30)）を 横に ずらして 切り出し、マスの 左はし・右はしに 立てる。 */
const POST_L = basePx(5, 30 * 16);
const POST_R = basePx(11, 30 * 16);

export const STALL: Record<string, TileDef> = {
	"<": counter(C_WOOD, TURF, base(1, 98)),
	"-": counter(C_WOOD, TURF, base(2, 98)),
	">": counter(C_WOOD, TURF, base(3, 98)),
	q: counter(C_WOOD, TURF, base(1, 98), goods(5)),
	Q: counter(C_WOOD, TURF, base(2, 98), goods(6)),
	o: solid(C_GRASS, TURF, BOOK_SIGN),
	c: solid(C_GRASS, TURF, AWNING),
	p: floor(C_GRASS, TURF, POST_L),
	P: floor(C_GRASS, TURF, POST_R),
};

// ───────────────── 店（常識堂。段5から） ─────────────────
// 白い壁・赤い屋根。屋根は 棟（82）と 軒（84）の 2段、壁は 上段・下段。
//   n N  屋根（棟・軒）   ( )  白壁（上段・下段）   w  窓   f  窓と 花の箱（2階）
//   O  本の 看板（壁に 付ける）   l  ちょうちん   d  扉（見るだけ。通れない）   a  下段に 日よけ
const WIN_WHITE = basePx(48, 1382); // 木枠の窓（壁装飾 3,86 を 半マス上げて切り出し）
/** 窓の下の 花の箱（下の すき間を 切って、窓の 下はしに そろえる）。 */
const flowerBox = (c: number) => basePx(c * 16, 362 * 16 + 2, 16, 10);
const CHOCHIN = basePx(2 * 16 + 3, 297 * 16 + 2, 10, 13);
const WHITE_UP = base(1, 59);
const WHITE_LOW = base(1, 60);
const C_WHITE = "#e8e8e8";

export const SHOP: Record<string, TileDef> = {
	n: solid("#a83a2a", base(3, 82)),
	N: solid("#c04a3a", base(3, 84)),
	"(": solid(C_WHITE, WHITE_UP),
	")": solid(C_WHITE, WHITE_LOW),
	w: solid(C_WHITE, WHITE_UP, WIN_WHITE),
	f: solid(C_WHITE, WHITE_UP, WIN_WHITE, flowerBox(2)),
	O: solid(C_WHITE, WHITE_UP, BOOK_SIGN),
	l: solid(C_WHITE, WHITE_UP, CHOCHIN),
	d: solid(C_WHITE, WHITE_LOW, base(7, 59, 1, 2)),
	a: solid(C_WHITE, WHITE_LOW, AWNING),
};

// ───────────────── 小屋（段3から） ─────────────────
// 板壁・わら屋根・煙突。
//   C  煙突（棟に 重ねる）   z Z  わら屋根（棟・軒）   [ ]  板壁（上段・下段）   J  窓
//   e  扉（見るだけ）   E  下段に 花の箱（段6から）
const PLANK_UP = base(1, 55);
const PLANK_LOW = base(1, 56);
const C_PLANK = "#6a4a2a";

export const HUT: Record<string, TileDef> = {
	C: solid("#b89a3a", base(6, 82), base(7, 84)),
	z: solid("#b89a3a", base(6, 82)),
	Z: solid("#c8aa4a", base(6, 84)),
	"[": solid(C_PLANK, PLANK_UP),
	"]": solid(C_PLANK, PLANK_LOW),
	J: solid(C_PLANK, PLANK_UP, WIN_WHITE),
	e: solid(C_PLANK, PLANK_LOW, base(7, 55, 1, 2)),
	E: solid(C_PLANK, PLANK_LOW, base(3, 362)),
};

// ───────────────── 倉庫（段4から） ─────────────────
// 段4・5 は 板張りの 物置（だいだいの屋根）、段6 から 石造りの 倉庫（灰色の 高い屋根）。
// 字は 同じで、map.ts が 段で どちらかを えらぶ。
//   r R  屋根（棟・軒）   { }  壁（上段・下段）   g  袋の 看板   7 8  両開きの 扉（左・右。見るだけ）
const storeTiles = (
	roofCol: number,
	wallRow: number,
	color: string,
): Record<string, TileDef> => ({
	r: solid(color, base(roofCol, 82)),
	R: solid(color, base(roofCol, 84)),
	"{": solid(color, base(1, wallRow)),
	"}": solid(color, base(1, wallRow + 1)),
	g: solid(color, base(1, wallRow), base(2, 95)),
	"7": solid(color, base(1, wallRow + 1), base(0, 92, 1, 2)),
	"8": solid(color, base(1, wallRow + 1), base(1, 92, 1, 2)),
});
export const SHED = storeTiles(1, 73, "#9a7a4a");
export const STOREHOUSE = storeTiles(4, 67, "#8a8a8a");

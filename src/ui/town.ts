// 地上の町（ダンジョンの入口の上）。持ち帰るたびに 育つ（トルネコ1の 店が 屋台から 大きな店になるのと 同じ）。
//
// 同梱シート Base.png のタイルだけで組む。横 16 マス × 縦 5 マス（256×80）の帯。
// いちばん下の1段は 道（何も置かない）。タイトルの キリコたち（16×16）は その上に あとから重ねて描く。
// 建物は 下から2段目（y = 48..64）を地面にして立つ。奥（上）の物から順に描く。
//
// 段階（前の段階の物は 残る）
//   0 何もない原っぱ。左の崖に ダンジョンの口、立て札、木と草
//   1 屋根のない屋台（台と品物と 本の看板）
//   2 屋台に しましまの日よけ・木箱・ランプ
//   3 となりに 小屋（わら屋根・煙突の煙）
//   4 倉庫（小さな物置。袋の看板）
//   5 屋台が 小さな店になる（赤い屋根の白い店）。道が石だたみになる
//   6 倉庫が 石造りの大きな倉庫になる。柵と花
//   7 2階建ての大きな店。窓の花、ちょうちん、ランプ、桜
//
// 家の組み方（家・壁・屋根 の区画）
//   壁は2段（上の段 wr・下の段 wr+1）。列 0/1/2 が 左はし・なか・右はし、3 が 1マスだけの壁、7 が 扉（1×2）。
//   屋根は列ごとに 4段：81 奥の面・82 棟（下に棟の線）・83 手前の面・84 軒（下に影）。
//   ここでは 82 と 84 を重ねる（小さい家は 82 の下半分だけ）。左右に 3px はみ出して 軒の出にする。

import { getImage } from "../engine/assets";

const BASE = "pub:assets/rpg-reze/Base.png";
const T = 16;
const COLS = 16;
const ROWS = 5;

/** 町の帯の大きさ（元の px）。 */
export const TOWN_W = COLS * T;
export const TOWN_H = ROWS * T;
/** 段階の数（0..TOWN_STAGES-1）。 */
export const TOWN_STAGES = 8;

/** 建物の立つ線（この下の1段が 道）。 */
const GY = 4 * T;

/** 木枠の窓（壁装飾 3,86 は マスをまたいでいるので px で切り出す）。 */
const WIN_X = 48;
const WIN_Y = 1382;

type Roof = "tall" | "half" | "eave";
/** 屋根の段（シートの行・その中の y・高さ）。 */
const ROOF_ROWS: Record<Roof, [number, number, number][]> = {
	tall: [
		[82, 0, 16],
		[84, 0, 16],
	],
	half: [
		[82, 8, 8],
		[84, 0, 16],
	],
	eave: [[84, 0, 16]],
};

/** 画像が まだ無いときの 地面と道の色。 */
const GRASS_COLOR = "#97bc25";
const DIRT_COLOR = "#b29f6e";
const STONE_COLOR = "#81664d";

type Pen = {
	g: CanvasRenderingContext2D;
	img: CanvasImageSource;
	t: number;
};

/** シートの px 範囲を そのままの大きさで (dx, dy) に写す。 */
const blit = (
	p: Pen,
	sx: number,
	sy: number,
	sw: number,
	sh: number,
	dx: number,
	dy: number,
) => p.g.drawImage(p.img, sx, sy, sw, sh, dx, dy, sw, sh);

/** シートのマス (c, r)（w×h マス）を px (x, y) に写す。 */
const tile = (
	p: Pen,
	c: number,
	r: number,
	x: number,
	y: number,
	w = 1,
	h = 1,
) => blit(p, c * T, r * T, w * T, h * T, x, y);

/** 壁（x マス目から w マス、rows 段。いちばん下の段だけ 下の段の絵）。 */
const walls = (p: Pen, x: number, w: number, wr: number, rows: number) => {
	for (let j = 0; j < rows; j++) {
		const r = j === rows - 1 ? wr + 1 : wr;
		for (let i = 0; i < w; i++) {
			const c = w === 1 ? 3 : i === 0 ? 0 : i === w - 1 ? 2 : 1;
			tile(p, c, r, (x + i) * T, GY - (rows - j) * T);
		}
	}
};

/** 屋根（下の端が bottom。左右に ov px の軒の出）。 */
const roof = (
	p: Pen,
	x: number,
	w: number,
	rc: number,
	bottom: number,
	kind: Roof,
	ov = 3,
) => {
	const rows = ROOF_ROWS[kind];
	let y = bottom - rows.reduce((s, [, , h]) => s + h, 0);
	for (const [r, sy, sh] of rows) {
		for (let i = 0; i < w; i++)
			blit(p, rc * T, r * T + sy, T, sh, (x + i) * T, y);
		blit(p, rc * T + T - ov, r * T + sy, ov, sh, x * T - ov, y);
		blit(p, rc * T, r * T + sy, ov, sh, (x + w) * T, y);
		y += sh;
	}
};

/** 家（壁 wr の組・屋根 rc の列）。 */
const house = (
	p: Pen,
	x: number,
	w: number,
	wr: number,
	rc: number,
	kind: Roof,
	rows = 2,
) => {
	walls(p, x, w, wr, rows);
	roof(p, x, w, rc, GY - rows * T, kind);
};

const win = (p: Pen, x: number, y: number) =>
	blit(p, WIN_X, WIN_Y, 16, 16, x, y);

/** 細い柱（立て札の柱を 4px 幅で切って つなぐ）。 */
const pole = (p: Pen, x: number, y: number, h: number) => {
	for (let k = 0; k < h; k += 8)
		blit(p, 5 * T + 6, 38 * T + 8, 4, Math.min(8, h - k), x, y + k);
};

/** 灯りのにじみ（ゆらぐ）。 */
const glow = (p: Pen, cx: number, cy: number, phase: number) => {
	const a =
		0.22 +
		0.08 * Math.sin(p.t / 180 + phase) +
		0.05 * Math.sin(p.t / 67 + phase * 2);
	p.g.fillStyle = `rgba(255, 214, 120, ${a.toFixed(3)})`;
	p.g.fillRect(cx - 5, cy - 3, 10, 6);
	p.g.fillRect(cx - 3, cy - 5, 6, 10);
};

/** 灯ったランプ（16×16 の切り出し。本体は x+4..12, y+6..15）。 */
const lantern = (p: Pen, x: number, y: number, phase = 0) => {
	glow(p, x + 8, y + 10, phase);
	blit(p, 96, 2250, 16, 16, x, y);
};

/** 赤いちょうちん（ときどき 1px ゆれる）。 */
const chochin = (p: Pen, x: number, y: number, phase = 0) => {
	const sway = Math.sin(p.t / 400 + phase) > 0.6 ? 1 : 0;
	blit(p, 2 * T + 3, 297 * T + 2, 10, 13, x + sway, y);
};

/** 煙突と 立ちのぼる煙（小さな煙のかたまりを 3つ、ずらして 薄れさせる）。 */
const chimney = (p: Pen, x: number, y: number) => {
	tile(p, 7, 84, x, y);
	const g = p.g;
	const alpha = g.globalAlpha;
	for (let k = 0; k < 3; k++) {
		const q = (p.t / 2400 + k / 3) % 1;
		g.globalAlpha = alpha * 0.8 * (1 - q);
		blit(
			p,
			4 * T + 4,
			289 * T + 4,
			8,
			10,
			x + 4 + Math.floor(q * 9),
			y - 5 - Math.floor(q * 8),
		);
	}
	g.globalAlpha = alpha;
};

/** 地面（草）と 道。 */
const ground = (p: Pen, stage: number) => {
	for (let y = 0; y < ROWS - 1; y++)
		for (let x = 0; x < COLS; x++) tile(p, 0, 4, x * T, y * T);
	const [rc, rr] = stage >= 5 ? [2, 47] : [5, 4];
	for (let x = 0; x < COLS; x++) tile(p, rc, rr, x * T, GY);
};

/** 左の崖と ダンジョンの口。 */
const cliff = (p: Pen) => {
	tile(p, 1, 16, 0, 0);
	tile(p, 2, 16, T, 0);
	tile(p, 1, 17, 0, T);
	tile(p, 2, 17, T, T);
	tile(p, 1, 18, 0, 2 * T);
	tile(p, 1, 19, 0, 3 * T);
	tile(p, 2, 23, T, 2 * T, 1, 2);
};

/** 屋台（1: 屋根なし、2..4: 日よけつき）。x = 4..6 マス。 */
const stall = (p: Pen, stage: number) => {
	const x = 4 * T;
	if (stage >= 2) {
		pole(p, x + 1, 2 * T, 2 * T);
		pole(p, x + 3 * T - 5, 2 * T, 2 * T);
		for (let i = 0; i < 3; i++) tile(p, 1, 366, x + i * T, 2 * T - 2);
	}
	tile(p, 1, 98, x, 3 * T);
	tile(p, 2, 98, x + T, 3 * T);
	tile(p, 3, 98, x + 2 * T, 3 * T);
	tile(p, 5, 139, x, 3 * T - 6);
	tile(p, 6, 139, x + T, 3 * T - 6);
	tile(p, 0, 123, x + 2 * T, 3 * T - 8);
	if (stage === 1) {
		pole(p, x + 3 * T + 6, 2 * T + 8, 24);
		tile(p, 3, 96, x + 3 * T, 2 * T - 4);
	} else {
		tile(p, 3, 96, x + T, 2 * T - 14);
		lantern(p, x + 3 * T - 3, 2 * T + 2);
	}
};

/** 小さな店（白い壁・赤い屋根。日よけの下に台）。x = 4..6 マス。 */
const smallShop = (p: Pen) => {
	const x = 4;
	house(p, x, 3, 59, 3, "half");
	tile(p, 7, 59, (x + 2) * T, GY - 2 * T, 1, 2);
	for (let i = 0; i < 2; i++) tile(p, 1, 366, (x + i) * T, GY - 2 * T + 2);
	tile(p, 1, 98, x * T, 3 * T);
	tile(p, 3, 98, (x + 1) * T, 3 * T);
	tile(p, 5, 139, x * T, 3 * T - 6);
	tile(p, 0, 123, (x + 1) * T, 3 * T - 8);
	tile(p, 3, 96, x * T + 8, GY - 2 * T - 12);
	lantern(p, (x + 3) * T - 2, GY - 2 * T);
};

/** 2階建ての大きな店。x = 3..6 マス。屋根の上は 帯の外へ続く。 */
const bigShop = (p: Pen) => {
	const x = 3;
	house(p, x, 4, 59, 3, "eave", 3);
	// 2階：窓と 窓の下の花、まんなかに 看板
	for (const [i, box] of [
		[0, 3],
		[1, 2],
		[3, 4],
	]) {
		win(p, (x + i) * T, GY - 3 * T);
		blit(p, box * T, 362 * T + 4, 16, 10, (x + i) * T, GY - 2 * T - 6);
	}
	tile(p, 3, 96, (x + 2) * T, GY - 3 * T - 1);
	// 1階：窓・扉・日よけの下の台
	win(p, x * T, GY - 2 * T + 1);
	tile(p, 7, 59, (x + 1) * T, GY - 2 * T, 1, 2);
	for (let i = 0; i < 2; i++) tile(p, 1, 366, (x + 2 + i) * T, GY - 2 * T + 2);
	tile(p, 1, 98, (x + 2) * T, 3 * T);
	tile(p, 3, 98, (x + 3) * T, 3 * T);
	tile(p, 5, 139, (x + 2) * T, 3 * T - 6);
	tile(p, 0, 123, (x + 3) * T, 3 * T - 8);
	chochin(p, x * T - 6, GY - 3 * T + 1, 0);
	chochin(p, (x + 4) * T - 4, GY - 3 * T + 1, 1.7);
	lantern(p, (x + 4) * T - 2, GY - 2 * T + 2, 2.1);
};

/** 小屋（板壁・わら屋根・煙突）。x = 8..9 マス。 */
const hut = (p: Pen, stage: number) => {
	house(p, 8, 2, 55, 6, "half");
	chimney(p, 8 * T + 2, GY - 2 * T - 26);
	tile(p, 7, 55, 9 * T, GY - 2 * T, 1, 2);
	win(p, 8 * T, GY - 2 * T);
	if (stage >= 6) tile(p, 3, 362, 8 * T, 3 * T + 3);
};

/** 倉庫（4..5: 板張りの物置、6..: 石造りの大きな倉庫）。x = 11..13 マス。 */
const store = (p: Pen, stage: number) => {
	if (stage <= 5) {
		house(p, 11, 2, 73, 1, "half");
		tile(p, 0, 92, 11 * T, GY - 2 * T, 2, 2);
		tile(p, 2, 95, 11 * T + 8, GY - 2 * T - 12);
	} else {
		house(p, 11, 3, 67, 4, "tall");
		tile(p, 0, 92, 12 * T, GY - 2 * T, 2, 2);
		tile(p, 2, 95, 11 * T, GY - 2 * T);
		tile(p, 4, 123, 11 * T, 3 * T);
	}
};

/**
 * 町を (0,0) から TOWN_W×TOWN_H に描く。stage は 0..7（はみ出しは丸める）。
 * t はミリ秒（煙・灯り・ちょうちんの ゆれ）。画像が まだなら 地面の色だけ塗る。
 */
export const drawTown = (
	ctx: CanvasRenderingContext2D,
	stage: number,
	t = 0,
): void => {
	const s = Math.max(0, Math.min(TOWN_STAGES - 1, Math.floor(stage) || 0));
	const img = getImage(BASE);
	if (!img) {
		ctx.fillStyle = GRASS_COLOR;
		ctx.fillRect(0, 0, TOWN_W, GY);
		ctx.fillStyle = s >= 5 ? STONE_COLOR : DIRT_COLOR;
		ctx.fillRect(0, GY, TOWN_W, TOWN_H - GY);
		return;
	}
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, TOWN_W, TOWN_H);
	ctx.clip();
	ctx.imageSmoothingEnabled = false;
	const p: Pen = { g: ctx, img, t };

	ground(p, s);
	cliff(p);
	// 奥の木（建物のうしろ）
	tile(p, 2, 6, 6 * T + 8, -10, 2, 2);
	tile(p, 0, 6, 9 * T + 8, -14, 2, 2);
	if (s >= 7) tile(p, 0, 292, -T / 2, -T / 2, 2, 2); // 崖の上の桜
	// ダンジョンへの立て札
	tile(p, 5, 37, 2 * T, 2 * T, 1, 2);

	// 店
	if (s === 0) {
		tile(p, 1, 11, 5 * T, 3 * T);
		tile(p, 0, 13, 6 * T, 3 * T);
	} else if (s <= 4) stall(p, s);
	else if (s <= 6) smallShop(p);
	else bigShop(p);
	if (s < 5) tile(p, 0, 10, 3 * T, 3 * T);
	else if (s < 7) tile(p, 3, 125, 3 * T, 3 * T);
	if (s >= 2) tile(p, 4, 123, 7 * T, 3 * T);

	// 小屋
	if (s < 3) tile(p, 3, 11, 8 * T, 3 * T);
	else hut(p, s);

	// 倉庫
	if (s < 4) {
		tile(p, 4, 11, 11 * T, 3 * T);
		tile(p, 0, 11, 12 * T, 3 * T);
	} else store(p, s);

	// 柵と花
	if (s >= 6) {
		tile(p, 0, 31, 10 * T, 3 * T - 5);
		tile(p, 7, 11, 10 * T, 3 * T + 2);
		tile(p, 5, 11, 7 * T, 3 * T + 3);
	}
	// 右はしの木（最後は 桜）
	tile(p, 0, s >= 7 ? 292 : 6, 14 * T, 2 * T - 2, 2, 2);
	if (s >= 6) {
		tile(p, 4, 31, 14 * T, 3 * T + 1);
		tile(p, 0, 31, 15 * T, 3 * T + 1);
	}
	ctx.restore();
};

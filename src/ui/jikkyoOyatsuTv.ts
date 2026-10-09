// 保守名人戦　おやつ実況の TV（碁会所「本因坊」の 壁の テレビ。ui/jikkyoWatch.ts の 板の 上の キャンバス）。
// 形は ui/jikkyoTvKit.ts（480x270 の 2倍の 下地に 240x135 の 座標。枠は 部屋の テレビ crtFrame）。
// - 場面（data/jikkyo/oyatsu.ts の OYATSU_SCENES）：札（まもなく・おわり）・対局室（礼と 振り駒）・長考（盤と 時計と 評価値）・
//   昼めし（記録係の お盆 → 布が 下から めくれる → 発表の 札）・昼食休憩（盤だけ）・3時（柱時計が 3つ 鳴る → おやつの 札）・
//   封じ手（夕方の 封筒）・終盤（秒読みと 評価値が かたむく）・投了（おじぎと「……ありません」）・感想戦。
// - 凝った 絵は 2つ：お盆の 布（山場 1）と 柱時計（山場 2）。ほかは 対局室・盤・札の 組みあわせ。
// - 盤は 塗りの 駒が 歩を 1つずつ 進める だけ（本物の 棋譜では ない）。形勢は 評価値の 数字だけ。
// - 動きは 名目の 時計（c.lt・c.t）、点滅だけ 実際の 時計（c.now）。動きを へらす 設定では 点滅・ゆれ・湯気を 止める
//   （布の めくれと 評価値は 読む 手がかりなので 止めない）。絵に 出す 文は OYATSU_ART と OYATSU_FOOD。

import {
	OYATSU_ART,
	OYATSU_FOOD,
	type OYATSU_SCENES,
	type OyatsuData,
	type OyatsuFood,
	type OyatsuSide,
} from "../data/jikkyo/oyatsu";
import {
	blit,
	clamp01,
	crtFrame,
	type G,
	hash,
	makeTv,
	num,
	numW,
	person,
	pulseGlow,
	type SceneFn,
	type TvCtx,
	text,
} from "./jikkyoTvKit";

type C = TvCtx<OyatsuData>;
type Scene = SceneFn<OyatsuData>;

const W = crtFrame.screen.w;
const H = crtFrame.screen.h;

const INK = {
	wall: "#d9c9a0",
	wood: "#6a4626",
	tatami: "#bdb46e",
	heri: "#3e4a2a",
	sumi: "#1a1a1a",
	ban: "#e3b562",
	koma: "#f2dfae",
	komaInk: "#3a2a10",
	zabuton: "#8a2a3a",
	skin: "#f2c8a0",
	sen: "#2a2a38",
	go: "#4a5a7c",
	cream: "#f0e8d0",
	paper: "#fffaf0",
	digit: "#ffe6a0",
	red: "#c83038",
	kiroku: "#5a7a5a",
	hair: "#2a2020",
} as const;

/** 同じ 色の 四角を まとめて 塗る（x, y, w, h の 並び）。 */
const R = (g: G, col: string, ...n: number[]) => {
	g.fillStyle = col;
	for (let i = 0; i + 3 < n.length; i += 4)
		g.fillRect(n[i], n[i + 1], n[i + 2], n[i + 3]);
};

/** 丸を 塗る。 */
const disc = (g: G, col: string, x: number, y: number, r: number) => {
	g.fillStyle = col;
	g.beginPath();
	g.arc(x, y, r, 0, Math.PI * 2);
	g.fill();
};

// ───────────────── 品の 絵（16 幅の 塗り。行は 空白で 区切る） ─────────────────

const PLATE = { p: "#f4f4f4", P: "#c8c8cc" };

const ICON: Readonly<
	Record<OyatsuFood, { art: string; ink: Readonly<Record<string, string>> }>
> = {
	ramen: {
		art: "....ccc...nn.... ..yyyyyyyyyyyy.. .rrrrrrrrrrrrrr. .RRRRRRRRRRRRRR. ..RRRwwRRRwwRR.. ...RRRRRRRRRR... ....RRRRRRRR.... ......dddd......",
		ink: {
			c: "#a8683a",
			n: "#f8f0f0",
			y: "#f0d070",
			r: "#e04a3a",
			R: "#c03028",
			w: "#f4e8e0",
			d: "#7a2018",
		},
	},
	yakisoba: {
		art: ".......gg....... .....bbbbbb..... ....bbnbbbbbb... ...bbbbbbnbbbb.. ..bbbbbbbbbbbbb. .pppppppppppppp. ..PPPPPPPPPPPP..",
		ink: { g: "#e04040", b: "#8a4a1a", n: "#3a7a2a", ...PLATE },
	},
	onigiri: {
		art: "...w........w... ..www......www.. .wwwww....wwwww. wwwwwww..wwwwwww wwkkkww..wwkkkww wwkkkww..wwkkkww pppppppppppppppp .PPPPPPPPPPPPPP.",
		ink: { w: "#fafaf4", k: "#1e2a1e", ...PLATE },
	},
	cake: {
		art: "......ss........ ......ssl....... ....cccccc...... ...cccccccccc... ..yyyyyyyyyyyy.. ..cccccccccccc.. ..yyyyyyyyyyyy.. .pppppppppppppp. ..PPPPPPPPPPPP..",
		ink: { s: "#e03040", l: "#3a8a3a", c: "#fffaf4", y: "#f0cc70", ...PLATE },
	},
	kakigori: {
		art: "......ww........ ....wwwwww...... ...wwrrwwwww.... ..wrrrrrrwwww... ..rrrrrrrrrrrr.. .gggggggggggggg. ..gggggggggggg.. .....gggggg..... ....GGGGGGGG....",
		ink: { w: "#ffffff", r: "#e04060", g: "#bfe4f4", G: "#8ac0d8" },
	},
	nikuman: {
		art: "......wwww...... ....wwwwwwww.... ...wwwwsswwww... ..wwwwwwwwwwww.. ..wwwwwwwwwwww.. ..WWWWWWWWWWWW.. .pppppppppppppp. ..PPPPPPPPPPPP..",
		ink: {
			w: "#fbf8f0",
			s: "#d8d0c0",
			W: "#e2dccc",
			p: "#e8d8b0",
			P: "#c8b890",
		},
	},
};
/** 品の 絵（bottom は 下の 端）。 */
const icon = (g: G, k: OyatsuFood, x: number, bottom: number, s: number) => {
	const rows = ICON[k].art.split(" ");
	blit(g, rows, x, bottom - rows.length * s, ICON[k].ink, s);
};

// ───────────────── 対局室 ─────────────────

/** 対局室（障子・床の間・畳）。 */
const room = (g: G) => {
	R(g, INK.wall, 0, 0, W, 58);
	R(g, "#f3eedc", 6, 16, 50, 42);
	g.fillStyle = "#c9b88e";
	for (let x = 16; x < 56; x += 10) g.fillRect(x, 16, 1, 42);
	for (let y = 23; y < 58; y += 7) g.fillRect(6, y, 50, 1);
	R(g, INK.wood, 0, 12, W, 2, 5, 15, 52, 1, 5, 15, 1, 43, 56, 15, 1, 43);
	// 床の間・掛け軸・花
	R(g, "#9a7848", 128, 16, 46, 42);
	R(g, "#c4b282", 130, 18, 42, 38);
	R(g, "#f4f0e4", 146, 20, 10, 30);
	R(g, INK.sumi, 150, 24, 2, 8, 149, 35, 4, 2, 150, 39, 2, 7);
	R(g, INK.wood, 145, 19, 12, 1, 145, 50, 12, 2);
	R(g, "#3a6a3a", 135, 45, 1, 6);
	R(g, "#e05a6a", 134, 43, 3, 2);
	R(g, "#6a6a7a", 133, 51, 5, 5);
	R(g, "#8a6036", 128, 56, 46, 2);
	// 畳
	R(g, INK.tatami, 0, 58, W, H - 58);
	g.fillStyle = "#aea463";
	for (let y = 61; y < H; y += 4) g.fillRect(0, y, W, 1);
	R(g, INK.heri, 0, 58, W, 1, 0, 84, W, 1, 60, 58, 1, 26, 120, 84, 1, H - 84);
};

/** 将棋盤（横から。上の 面に 駒の 点）。 */
const ban = (g: G, x: number, y: number) => {
	R(g, INK.ban, x, y, 26, 4);
	R(g, "#b07a32", x, y + 4, 26, 6);
	R(g, "#5a3a1a", x + 2, y + 10, 4, 3, x + 20, y + 10, 4, 3);
	g.fillStyle = INK.komaInk;
	for (let i = 0; i < 12; i++)
		if (hash(i, 7) < 0.55) g.fillRect(x + 1 + i * 2, y + 1 + (i % 2), 1, 1);
};

/** 正座の 人（羽織）。dir は 向き（1＝右・−1＝左）、bow は おじぎ 0〜1。x は 体の 左、y は 頭の 上。 */
const seated = (
	g: G,
	x: number,
	y: number,
	robe: string,
	hair: string,
	dir: 1 | -1,
	bow = 0,
) => {
	const b = Math.round(clamp01(bow) * 4);
	const lean = Math.round((dir * b) / 2);
	R(g, INK.zabuton, x - 3, y + 20, 20, 3);
	R(g, "#4a3a30", x - 1, y + 15, 16, 5);
	R(g, robe, x + 1 + lean, y + 6 + b, 12, 10 - b);
	R(g, "#f4f0e8", x + 6 + lean, y + 6 + b, 2, 3);
	const hx = x + 3 + dir * b;
	const hy = y + b;
	R(g, INK.skin, hx, hy + 2, 7, 5);
	R(g, hair, hx, hy, 7, 3, dir > 0 ? hx : hx + 5, hy, 2, 5);
	if (b < 2) R(g, INK.sumi, dir > 0 ? hx + 5 : hx + 1, hy + 4, 1, 1);
};

/** 2人と 盤（bow は 先手・後手の おじぎ）。 */
const pair = (g: G, bowSen = 0, bowGo = 0) => {
	ban(g, 77, 64);
	seated(g, 54, 48, INK.sen, "#1a1414", 1, bowSen);
	seated(g, 112, 48, INK.go, "#7a7a7a", -1, bowGo);
};

/** 中継の 札（左上）。 */
const liveTag = (g: G) => {
	R(g, INK.red, 3, 3, 22, 11);
	text(g, OYATSU_ART.chukei, 14, 4, 8, "#ffffff");
};

// ───────────────── 盤（上から）と 時計・評価値 ─────────────────

/** 上から 見た 盤（塗りの 駒が 歩を 1つずつ 進める。本物の 棋譜では ない）。 */
const boardView = (g: G, c: C) => {
	const x0 = 6;
	const y0 = 8;
	const cs = 7;
	R(g, "#24301e", 0, 0, 76, H);
	R(g, INK.ban, x0 - 2, y0 - 2, cs * 9 + 5, cs * 9 + 5);
	g.fillStyle = "#7a5224";
	for (let i = 0; i <= 9; i++) {
		g.fillRect(x0 + i * cs, y0, 1, cs * 9 + 1);
		g.fillRect(x0, y0 + i * cs, cs * 9 + 1, 1);
	}
	// 駒の 置き場（1＝後手、2＝先手）。はじめの 並び → 名目の 時計で 歩を 進める
	const cell: number[] = Array(81).fill(0);
	for (let f = 0; f < 9; f++) {
		cell[f] = cell[18 + f] = 1;
		cell[54 + f] = cell[72 + f] = 2;
	}
	cell[10] = cell[16] = 1;
	cell[64] = cell[70] = 2;
	let last = -1;
	for (let k = 0; k < Math.min(24, Math.floor(c.t / 3500)); k++) {
		const side = k % 2 ? 1 : 2;
		const f = Math.floor(hash(k, 5) * 9);
		const dr = side === 2 ? -1 : 1;
		for (let r = side === 2 ? 0 : 8; r >= 0 && r < 9; r -= dr) {
			if (cell[r * 9 + f] !== side) continue;
			const to = (r + dr) * 9 + f;
			if (r + dr >= 2 && r + dr <= 6 && cell[to] === 0) {
				cell[to] = side;
				cell[r * 9 + f] = 0;
				last = to;
			}
			break;
		}
	}
	cell.forEach((s, i) => {
		if (!s) return;
		const px = x0 + (i % 9) * cs + 1;
		const py = y0 + Math.floor(i / 9) * cs + 1;
		if (i === last) R(g, "#e05a3a", px - 1, py - 1, 7, 7);
		R(g, INK.koma, px, py, 5, 5);
		R(g, INK.komaInk, px + 2, s === 1 ? py + 3 : py + 1, 1, 1);
	});
};

/** 時計の 字（h:mm を 数字で）。 */
const hmm = (g: G, x: number, y: number, h: number, m: number, k: number) => {
	const a = String(h);
	num(g, a, x, y, k, INK.digit);
	const cx = x + numW(a, k) + k;
	R(g, INK.digit, cx, y + k, k, k, cx, y + 3 * k, k, k);
	num(g, String(m).padStart(2, "0"), cx + 2 * k, y, k, INK.digit);
};

/** 評価値の 札（先手の ％。左が 八段、右が 名人）。 */
const evBar = (g: G, ev: number) => {
	const [x, y, w, h] = [84, 76, 88, 11];
	const v = Math.max(1, Math.min(99, Math.round(ev)));
	const lw = Math.round((w * v) / 100);
	R(g, "#08080c", x - 1, y - 1, w + 2, h + 2);
	R(g, INK.sen, x, y, lw, h);
	R(g, "#f0ece0", x + lw, y, w - lw, h);
	R(g, "#e0b040", x + w / 2, y - 2, 1, h + 4);
	const o = { outline: "#000000" };
	text(g, OYATSU_ART.senShort, x + 2, y + 1, 8, "#ffffff", {
		...o,
		align: "left",
	});
	text(g, OYATSU_ART.goShort, x + w - 2, y + 1, 8, "#ffffff", {
		...o,
		align: "right",
	});
	text(g, OYATSU_ART.hyoka, x + w / 2, y - 13, 8, INK.cream);
	const b = String(100 - v);
	num(g, String(v), x, y - 8, 1, INK.cream);
	num(g, b, x + w - numW(b, 1), y - 8, 1, INK.cream);
};

/** 右の 札（名前・赤い 札・残り・評価値）。 */
const panel = (
	g: G,
	c: C,
	label: string,
	blinkMs: number,
	ev: number,
	clock: (x: number, y: number) => void,
) => {
	R(g, "#18202c", 76, 0, W - 76, H);
	text(g, OYATSU_ART.go, 128, 4, 8, INK.cream);
	R(g, INK.red, 104, 16, 48, 12);
	if (c.still || Math.floor(c.now / blinkMs) % 2 === 0)
		text(g, label, 128, 18, 8, "#ffffff");
	text(g, OYATSU_ART.nokori, 84, 40, 8, INK.cream, { align: "left" });
	clock(108, 36);
	evBar(g, ev);
};

// ───────────────── 札（昼めし・おやつの 発表） ─────────────────

const fuda = (
	g: G,
	c: C,
	head: readonly [string, string],
	item: OyatsuFood,
	same: boolean,
	since: number,
) => {
	R(g, "#2a2018", 0, 0, W, H);
	g.globalAlpha = c.still ? 1 : clamp01(since / 300);
	R(g, "#3a2a1a", 19, 5, 142, 84);
	R(g, INK.paper, 20, 6, 140, 82);
	R(g, head[1], 20, 6, 140, 13);
	text(g, head[0], 90, 8, 8, "#ffffff");
	text(g, OYATSU_ART.go, 90, 22, 8, "#3a2a1a");
	icon(g, item, 28, 66, 3);
	text(g, OYATSU_FOOD[item].name, 120, 38, 12, "#2a1a10");
	text(g, OYATSU_FOOD[item].shop, 120, 54, 8, "#6a4a2a");
	// 判（前局と 同じ＝赤、はじめての 品＝緑）
	const ink = same ? "#d0303a" : "#2a8a4a";
	R(g, ink, 52, 70, 76, 1, 52, 83, 76, 1, 52, 70, 1, 14, 127, 70, 1, 14);
	text(g, same ? OYATSU_ART.same : OYATSU_ART.fresh, 90, 73, 8, ink);
	g.globalAlpha = 1;
};

// ───────────────── 場面 ─────────────────

const card: Scene = (g, c) => {
	R(g, "#14261c", 0, 0, W, H);
	g.fillStyle = "#1c3226";
	for (let i = 0; i <= 9; i++) {
		g.fillRect(45 + i * 10, 6, 1, 90);
		g.fillRect(45, 6 + i * 10, 90, 1);
	}
	const o = { outline: "#0a140e" };
	text(g, OYATSU_ART.logo, W / 2, 24, 16, "#ffe6a8", o);
	text(g, OYATSU_ART.sub, W / 2, 46, 8, "#f0d8a0", o);
	g.globalAlpha = c.still ? 1 : clamp01(c.lt / 600);
	text(g, c.data.card ?? "", W / 2, 70, 8, "#d8e8d0", o);
	g.globalAlpha = 1;
};

const kaikyoku: Scene = (g, c) => {
	room(g);
	// 礼（1〜3秒）
	const bow =
		c.lt < 1000 ? 0 : c.lt < 1600 ? (c.lt - 1000) / 600 : c.lt < 3000 ? 1 : 0;
	pair(g, bow, bow);
	person(g, 152, 58, INK.kiroku, INK.hair);
	// 振り駒（5枚。と が 出た 駒は 赤い 点）
	if (c.lt >= 4500) {
		g.globalAlpha = c.still ? 1 : clamp01((c.lt - 4500) / 300);
		for (let i = 0; i < 5; i++) {
			const px = 74 + i * 7 + Math.floor(hash(i, 2) * 3);
			const py = 87 + Math.floor(hash(i, 3) * 4);
			R(g, INK.koma, px, py, 4, 4);
			R(g, i % 3 === 0 ? INK.red : INK.komaInk, px + 1, py + 1, 2, 1);
		}
		g.globalAlpha = 1;
	}
	liveTag(g);
};

const choko: Scene = (g, c) => {
	boardView(g, c);
	const [a, b] = c.data.ev ?? [50, 50];
	const p = clamp01(c.lt / Math.max(1, c.seg?.dur ?? 1));
	const wob = c.still ? 0 : Math.sin(c.t / 900) * 2;
	const rem = Math.max(0, 161 - Math.floor(c.t / 700));
	panel(g, c, OYATSU_ART.choko, 600, a + (b - a) * p + wob, (x, y) =>
		hmm(g, x, y, Math.floor(rem / 60), rem % 60, 3),
	);
};

const hiru: Scene = (g, c) => {
	const d = c.data;
	const item = d.item ?? "ramen";
	const pickAt = d.pickAt ?? 0;
	const showAt = d.showAt ?? 0;
	if (c.t >= showAt) {
		const head = [OYATSU_ART.lunch, "#b8402a"] as const;
		fuda(g, c, head, item, d.same ?? false, c.t - showAt);
		return;
	}
	if (c.t < pickAt) {
		// 記録係が 布を かけた お盆を 運んで くる
		room(g);
		pair(g);
		const x = Math.min(84, 8 + Math.floor(c.lt * 0.018));
		const y = 58 - (c.still ? 0 : Math.floor(c.lt / 250) % 2);
		person(g, x, y, INK.kiroku, INK.hair);
		R(g, "#5a2418", x - 3, y - 2, 12, 2);
		R(g, "#ece2cc", x - 1, y - 6, 8, 4);
		liveTag(g);
		return;
	}
	// 山場 1：お盆の 布が 下から めくれる（手がかりなので 動きを へらす 設定でも 進む）
	R(g, INK.wall, 0, 0, W, 50);
	R(g, INK.tatami, 0, 50, W, H - 50);
	R(g, INK.heri, 0, 50, W, 1);
	R(g, "#5a2418", 44, 80, 92, 6);
	R(g, "#7a3424", 44, 80, 92, 1);
	icon(g, item, 58, 80, 4);
	const top = 38;
	const rev = clamp01((c.t - pickAt) / 3400);
	const low = Math.round(80 - rev * 40);
	if (low > top) {
		R(g, "#ece2cc", 54, top, 72, low - top);
		g.fillStyle = "#d4c6a4";
		for (let x = 60; x < 124; x += 9) g.fillRect(x, top + 2, 1, low - top - 2);
		R(g, "#bfae84", 54, low - 1, 72, 1);
	}
	R(g, "#c8a060", 86, top - 4 - Math.round(rev * 6), 8, 5);
	// 湯気（布が 上がって から）
	if (!c.still && rev > 0.8 && item === "ramen")
		for (let i = 0; i < 3; i++)
			R(
				g,
				"rgba(255, 255, 255, 0.6)",
				74 + i * 12,
				36 - ((c.now / 160 + i * 3) % 8),
				1,
				3,
			);
};

const kyukei: Scene = (g) => {
	// 盤だけ 映る（座布団は 空）
	room(g);
	ban(g, 77, 64);
	R(g, INK.zabuton, 51, 68, 20, 3, 109, 68, 20, 3);
	R(g, INK.paper, 118, 2, 58, 12);
	text(g, OYATSU_ART.kyukei, 147, 4, 8, "#3a2a1a");
	liveTag(g);
};

/** 柱時計（山場 2）。3時の 前は 長針が 12へ、合図ごとに「ボーン」。 */
const hashira = (g: G, c: C, exact: number) => {
	R(g, INK.wall, 0, 0, W, H);
	R(g, INK.wood, 0, 8, W, 2);
	// 壁の はり紙「おやつ」
	R(g, INK.paper, 16, 26, 30, 40);
	R(g, "#c8b890", 16, 26, 30, 1);
	text(g, OYATSU_ART.snack, 31, 30, 8, "#b83a5a");
	icon(g, "cake", 23, 62, 1);
	// 箱と 文字盤
	const [cx, cy] = [90, 30];
	R(g, "#5a2e14", 68, 6, 44, 94);
	R(g, "#7a4422", 70, 8, 40, 90);
	disc(g, "#3a1e0c", cx, cy, 17);
	disc(g, "#f4ecd8", cx, cy, 15);
	/** 線（ox,oy から 角 a。0 が 上、時計まわり）。 */
	const hand = (ox: number, oy: number, a: number, len: number, w: number) => {
		for (let i = 0; i < len; i++)
			g.fillRect(
				Math.round(ox + Math.sin(a) * i),
				Math.round(oy - Math.cos(a) * i),
				w,
				w,
			);
	};
	g.fillStyle = "#3a2a1a";
	for (let i = 0; i < 12; i++) hand(cx, cy, (i / 12) * Math.PI * 2, 13, 1);
	disc(g, "#f4ecd8", cx, cy, 11);
	// 針（名目の 1秒＝1分。ちょうどで 3時）
	const before = Math.max(0, Math.min(59, (exact - c.t) / 1000));
	g.fillStyle = INK.sumi;
	hand(cx, cy, ((3 - before / 60) / 12) * Math.PI * 2, 8, 2);
	hand(cx, cy, (-before / 60) * Math.PI * 2, 12, 1);
	// 振り子
	R(g, "#2a1408", 78, 52, 24, 42);
	const sw = c.still ? 0 : Math.sin(c.t / 320) * 0.3;
	g.fillStyle = "#c89a40";
	hand(cx, 54, Math.PI - sw, 30, 1);
	const bx = Math.round(cx + Math.sin(sw) * 30);
	disc(g, "#c89a40", bx, Math.round(54 + Math.cos(sw) * 30), 4);
	// 合図：光と「ボーン」、3つの 点
	const glow = pulseGlow(c, 420);
	if (glow > 0) {
		R(g, `rgba(255, 236, 160, ${(0.5 * glow).toFixed(3)})`, 64, 2, 52, 56);
		g.globalAlpha = glow;
		text(g, OYATSU_ART.bon, 142, 24, 12, "#5a2e14", { outline: "#fff4c8" });
		g.globalAlpha = 1;
	}
	if (c.data.phase === "cue")
		for (let i = 0; i < 3; i++)
			R(g, i < c.pulses.length ? "#e0a020" : "#a89870", 128 + i * 12, 62, 6, 6);
};

const oyatsu: Scene = (g, c) => {
	const d = c.data;
	const exact = d.exact ?? Number.POSITIVE_INFINITY;
	const since = c.t - exact;
	if (since < 0 || !d.item) {
		hashira(g, c, exact);
		return;
	}
	const head = [OYATSU_ART.snack, "#d65a82"] as const;
	fuda(g, c, head, d.item, d.same ?? false, since);
	if (!c.still && since < 500)
		R(g, `rgba(255, 255, 255, ${(1 - since / 500).toFixed(3)})`, 0, 0, W, H);
};

const fuji: Scene = (g, c) => {
	room(g);
	pair(g, c.lt < 3000 ? 0.4 : 0, 0);
	person(g, 87, 44, "#3a3a3a", "#d0d0d0"); // 立会人
	R(g, "rgba(255, 140, 50, 0.2)", 0, 0, W, H);
	// 封筒と「封」
	if (c.lt < 2500) return;
	g.globalAlpha = c.still ? 1 : clamp01((c.lt - 2500) / 400);
	R(g, "#f4ecd8", 70, 70, 40, 18);
	g.fillStyle = "#c8b890";
	for (let i = 0; i < 10; i++) {
		g.fillRect(70 + i * 2, 70 + i, 2, 1);
		g.fillRect(108 - i * 2, 70 + i, 2, 1);
	}
	disc(g, INK.red, 90, 80, 6);
	text(g, OYATSU_ART.fu, 90, 76, 8, "#ffffff");
	g.globalAlpha = 1;
};

/** 終盤の 評価値（先手の ％）。窓の 前は ゆれ、窓で 勝つ 側へ（lean で なければ いったん 逆へ）。 */
const shubanEv = (c: C): number => {
	const d = c.data;
	const dir = d.winner === "go" ? -1 : 1;
	const at = d.pickAt ?? 0;
	if (c.t < at) return 50 + (c.still ? 0 : Math.sin(c.t / 650) * 8);
	const p = (c.t - at) / 1000;
	if (d.lean) return 50 + dir * Math.min(40, 16 * p);
	if (p < 1.4) return 50 - dir * Math.min(16, 14 * p);
	return 50 + dir * Math.min(40, -16 + (p - 1.4) * 30);
};

const shuban: Scene = (g, c) => {
	boardView(g, c);
	const s = 10 - (Math.floor(c.t / 1000) % 10);
	panel(g, c, OYATSU_ART.byoyomi, 300, shubanEv(c), (x, y) =>
		num(g, String(s), x, y - 2, 4, INK.digit),
	);
};

const other = (s: OyatsuSide): OyatsuSide => (s === "go" ? "sen" : "go");

const toryo: Scene = (g, c) => {
	room(g);
	const loser = other(c.data.side ?? "go");
	const down = clamp01((c.lt - 1200) / 600);
	const back = clamp01((c.lt - 2400) / 600) * 0.5;
	pair(g, loser === "sen" ? down : back, loser === "go" ? down : back);
	if (c.lt < 1400 || c.lt >= 5200) return;
	const x = loser === "sen" ? 61 : 119;
	R(g, INK.paper, x - 30, 30, 60, 12, x - 1, 42, 3, 3);
	text(g, OYATSU_ART.arimasen, x, 32, 8, "#2a1a10");
};

const kansou: Scene = (g, c) => {
	room(g);
	pair(g, 0.5, 0.5);
	// 盤を 指す 手（ゆっくり 行き来）
	const k = c.still ? 0 : Math.floor(c.lt / 700) % 3;
	R(g, INK.skin, 72 + k * 3, 62, 3, 2, 104 - k * 2, 62, 3, 2);
	// 記者（背中）
	for (let i = 0; i < 3; i++)
		person(g, 12 + i * 10, 64, ["#4a4a5a", "#6a5a4a", "#3a4a3a"][i], INK.hair);
};

const SCENES: Readonly<Record<(typeof OYATSU_SCENES)[number], Scene>> = {
	card,
	kaikyoku,
	choko,
	hiru,
	kyukei,
	oyatsu,
	fuji,
	shuban,
	toryo,
	kansou,
};

export const oyatsuTv = makeTv<OyatsuData>({
	screen: crtFrame.screen,
	frame: crtFrame.draw,
	scenes: SCENES,
	noCaption: ["card"],
});

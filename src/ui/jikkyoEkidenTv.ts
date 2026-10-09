// 保守駅伝の TV（ui/jikkyoWatch.ts の 板の 上の キャンバス）。保守村駅の 待合の 壁の テレビ。
// 形は ui/jikkyoTvKit.ts（480x270 の 2倍の 下地に 240x135 の 座標）。
// - 枠：白い タイルの 壁に 黒い ふちの 薄型テレビ。左の 壁に 時計、右に「待合」の 札、下に ベンチと 客の 頭。
// - 場面（data/jikkyo/ekiden.ts の EKIDEN_SCENES）：札・スタート（号砲で 走りだす）・道（沿道の 旗と 白バイ・給水）・
//   中継所（ふつうの 受けわたしは 横から。繰り上げは 道の 先を 見る 絵：時計・号砲・届けば 襷、届かなければ 白い 襷）・
//   山（上りで 2人を 抜く 山の神。復路は 下りの VTR）・ゴール（テープ・胴上げ）。
//   凝った 絵は 繰り上げ（山場）と 山の 2つ。背景は 駅前（往路の スタート・復路の ゴール）と 湖（その 逆）。
// - 走者は 塗りの 横向きの 人（runner）、待つ 人・係の 人は 正面の 人（front）。シャツと 襷は 学校の 色。
// - 場面の 進みは 名目の 時計（c.lt・c.t）、旗の ゆれ・足の コマ・点滅は 実際の 時計（c.now）。
//   動きを へらす 設定（c.still）では 旗・足・道の 流れ・紙ふぶき・光を 止める。札の 字は 字幕と 重ねない（noCaption）。

import {
	EKIDEN_ART,
	EKIDEN_CUE,
	EKIDEN_EXACT,
	EKIDEN_UNIS,
	type EkidenData,
	type EkidenUni,
	ekidenLeft,
	HOSHU_UNI,
	KURIAGE_AT,
	YAMA_AT,
} from "../data/jikkyo/ekiden";
import {
	bands,
	clamp01,
	type G,
	hash,
	makeTv,
	num,
	numW,
	person,
	pulseGlow,
	type SceneFn,
	type Screen,
	type TvCtx,
	text,
} from "./jikkyoTvKit";

type C = TvCtx<EkidenData>;
type Scene = SceneFn<EkidenData>;

const SCREEN: Screen = { x: 28, y: 6, w: 184, h: 104 };

const SKIN = "#f2c8a0";
const HAIR = "#1a1414";
const SHORTS = "#24242c";
const SHOE = "#f4f4f4";
const WHITE = "#ffffff";
const INK = "#1a2a5a";
const OFFICIAL = "#1c1c26";
const POLE = "#b8b8c0";
const RED = "#c83030";
const BODY = ["#c84a4a", "#4a6ab0", "#e0b040", "#5a8a5a", "#8a6aa0", "#d08a40"];

const uniOf = (i: number | undefined): EkidenUni =>
	EKIDEN_UNIS[(i ?? 0) % EKIDEN_UNIS.length] ?? HOSHU_UNI;

/** 足の コマ（still では そろえる）。 */
const stride = (c: C, i = 0, ms = 150): number =>
	c.still ? 1 : (Math.floor(c.now / ms) + i) % 2;

/** 四角を まとめて 塗る（x, y, w, h を 4つずつ）。 */
const fill = (g: G, ink: string, ...r: number[]): void => {
	g.fillStyle = ink;
	for (let i = 0; i + 3 < r.length; i += 4)
		g.fillRect(r[i], r[i + 1], r[i + 2], r[i + 3]);
};

/** 多角形を 塗る（x, y を 2つずつ）。 */
const poly = (g: G, ink: string, ...p: number[]): void => {
	g.fillStyle = ink;
	g.beginPath();
	g.moveTo(p[0], p[1]);
	for (let i = 2; i + 1 < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
	g.fill();
};

/** k 倍の 四角を まとめて 塗る 手（x,y が 左上）。 */
const pen =
	(g: G, x: number, y: number, k: number) =>
	(ink: string, ...r: number[]): void => {
		const x0 = Math.round(x);
		const y0 = Math.round(y);
		g.fillStyle = ink;
		for (let i = 0; i + 3 < r.length; i += 4)
			g.fillRect(x0 + r[i] * k, y0 + r[i + 1] * k, r[i + 2] * k, r[i + 3] * k);
	};

/** 横向きの 走者（右へ 走る。8x14 × k、x,y は 左上）。f：0 足を 開く・1 そろえる。up：両手を あげる。 */
const runner = (
	g: G,
	x: number,
	y: number,
	u: EkidenUni,
	f: number,
	k = 1,
	o: { sash?: string; up?: boolean } = {},
): void => {
	const R = pen(g, x, y, k);
	R(HAIR, 2, 0, 3, 2);
	R(SKIN, 2, 2, 3, 2, 5, 2, 1, 1);
	R(u.ink, 2, 4, 4, 5);
	R(o.sash ?? u.sash, 2, 4, 2, 1, 3, 5, 2, 1, 4, 6, 2, 2);
	R(SHORTS, 2, 9, 4, 2);
	if (o.up) R(SKIN, 1, 0, 1, 4, 6, 0, 1, 4);
	else if (f === 0) R(SKIN, 6, 5, 2, 1, 0, 6, 2, 1);
	else R(SKIN, 5, 6, 1, 2, 1, 6, 1, 2);
	if (f === 0) {
		R(SKIN, 5, 11, 1, 2, 2, 11, 1, 1, 1, 12, 1, 1);
		R(SHOE, 6, 13, 2, 1, 0, 13, 1, 1);
	} else {
		R(SKIN, 3, 11, 2, 2);
		R(SHOE, 3, 13, 3, 1);
	}
};

/** 正面の 人（6x12 × k。sash が あれば 襷、arm で 右手を あげる、f は 足の コマ）。 */
const front = (
	g: G,
	x: number,
	y: number,
	body: string,
	k = 1,
	o: { sash?: string; arm?: boolean; f?: number } = {},
): void => {
	const R = pen(g, x, y, k);
	R(HAIR, 1, 0, 4, 2);
	R(SKIN, 1, 2, 4, 3);
	R(body, 0, 5, 6, 5);
	if (o.sash)
		R(o.sash, 0, 5, 2, 1, 1, 6, 2, 1, 2, 7, 2, 1, 3, 8, 2, 1, 4, 9, 2, 1);
	if (o.arm) R(body, 6, 1, 1, 5);
	if (o.arm) R(SKIN, 6, 0, 1, 1);
	const f = o.f ?? 1;
	R("#2a2a36", 1, 10, 1, f === 0 ? 1 : 2, 4, 10, 1, f === 0 ? 2 : 1);
};

/** 沿道の 人の 列（小旗を ふる）。off は 道の 流れ（px）。 */
const crowd = (g: G, c: C, y: number, off: number, seed: number, gap = 9) => {
	const base = Math.floor(off / gap);
	const sub = Math.floor(off - base * gap);
	for (let i = -1; i <= Math.ceil(c.W / gap) + 1; i++) {
		const id = i + base;
		const x = i * gap - sub;
		const body = BODY[Math.floor(hash(id, seed) * BODY.length)];
		person(g, x, y + (id % 2), body, HAIR);
		if (hash(id, seed + 7) < 0.35) continue;
		// 小旗（白地に 青い 帯。ゆれは 実際の 時計）
		const w = c.still ? 0 : (Math.floor(c.now / 220) + id) % 2;
		fill(g, "#c8b890", x + 6, y - 4, 1, 7);
		fill(g, WHITE, x + 7, y - 5 + w, 4 - w, 3);
		fill(g, "#2a5aa0", x + 7, y - 4 + w, 4 - w, 1);
	}
};

/** 横の 道（白線と 中央の 点線。off で 流れる）。 */
const road = (g: G, c: C, y: number, h: number, off: number): void => {
	fill(g, "#5c5c64", 0, y, c.W, h);
	fill(g, "#e8e8e8", 0, y + 1, c.W, 1, 0, y + h - 2, c.W, 1);
	const s = Math.floor(off % 16);
	for (let x = -s; x < c.W; x += 16)
		fill(g, "#d8d8d0", x, y + Math.floor(h / 2), 8, 1);
};

/** 駅前（往路の スタート・復路の ゴール）。0〜y の 背景。 */
const station = (g: G, c: C, y: number): void => {
	bands(g, c.W, ["#78b4e6", "#92c4ec", "#b0d4f0", "#cce4f4"], 0, y);
	fill(g, "#a8acb4", 0, y - 26, 40, 26, c.W - 34, y - 32, 34, 32);
	for (let i = 0; i < 4; i++)
		fill(g, "#8a8e98", 6 + i * 9, y - 22, 4, 4, c.W - 30 + i * 8, y - 28, 4, 4);
	fill(g, "#5a5a62", 52, y - 42, 84, 4);
	fill(g, "#eeeeea", 54, y - 38, 80, 38);
	fill(g, "#2a5aa0", 52, y - 20, 84, 3);
	fill(g, WHITE, 72, y - 36, 44, 11);
	text(g, EKIDEN_ART.station, 94, y - 35, 8, INK);
	fill(g, "#6a8ab0", 60, y - 16, 68, 16);
	for (let x = 60; x < 128; x += 17) fill(g, "#9ab4d0", x, y - 16, 1, 16);
};

/** 湖と 山（往路の ゴール・復路の スタート）。 */
const lake = (g: G, c: C, y: number): void => {
	bands(g, c.W, ["#6aa6dc", "#86b8e4", "#a6cceb", "#c4ddf0"], 0, y);
	poly(g, "#6a86a4", 0, y - 10, 40, y - 34, 80, y - 14, 120, y - 40);
	poly(g, "#6a86a4", 0, y, 0, y - 10, 120, y - 40, c.W, y - 12, c.W, y);
	fill(g, "#e8eef4", 117, y - 40, 6, 3, 38, y - 34, 4, 2);
	fill(g, "#3a7ac0", 0, y - 10, c.W, 10);
	for (let i = 0; i < 6; i++)
		fill(g, "#a8d0f0", 10 + i * 30, y - 7 + (i % 2) * 3, 8, 1);
	for (let x = 0; x < c.W; x += 14) fill(g, "#2a5a34", x, y - 3, 10, 3);
};

/** 札（白い 布を 2本の 柱で はる）。 */
const banner = (
	g: G,
	s: string,
	x: number,
	y: number,
	w: number,
	ink = WHITE,
	bg = RED,
): void => {
	fill(g, POLE, x, y + 2, 2, 50, x + w - 2, y + 2, 2, 50);
	fill(g, bg, x, y, w, 11);
	text(g, s, x + w / 2, y + 1, 8, ink);
};

/** 号砲の 煙と「パーン」（ms は 号砲から）。 */
const gunSmoke = (g: G, x: number, y: number, ms: number): void => {
	if (ms < 0 || ms > 1100) return;
	const r = 2 + Math.floor(ms / 140);
	g.globalAlpha = 1 - ms / 1100;
	fill(g, "#f0f0f0", x - r, y - r, r * 2, r * 2);
	text(g, EKIDEN_ART.pan, x, y - 16, 8, "#e02030", { outline: WHITE });
	g.globalAlpha = 1;
};

// ───────────────── 札 ─────────────────

const drawCard: Scene = (g, c) => {
	bands(g, c.W, ["#0c1a3a", "#10224a", "#142a5a"], 0, c.H);
	// 襷の 帯（ななめ。字の 下を とおす）
	poly(g, HOSHU_UNI.ink, 0, 92, 0, 104, c.W, 62, c.W, 50);
	poly(g, HOSHU_UNI.sash, 0, 104, 0, 106, c.W, 64, c.W, 62);
	text(g, EKIDEN_ART.logo, c.W / 2, 14, 12, WHITE, { outline: "#0a1430" });
	g.globalAlpha = c.still ? 1 : clamp01(c.lt / 600);
	text(g, c.data.card ?? EKIDEN_ART.logo, c.W / 2, 40, 10, "#ffe890", {
		outline: "#0a1430",
	});
	g.globalAlpha = 1;
};

// ───────────────── スタート ─────────────────

const GUN = 1500;
const FIELD = [HOSHU_UNI, ...EKIDEN_UNIS];

const drawStart: Scene = (g, c) => {
	(c.data.down ? lake : station)(g, c, 64);
	crowd(g, c, 54, 0, 3);
	road(g, c, 66, 26, 0);
	fill(g, WHITE, 46, 66, 2, 26);
	banner(g, EKIDEN_ART.start, 30, 16, 122);
	// 走者（号砲で 右へ）と 号砲の 係
	const go = c.lt - GUN;
	FIELD.forEach((u, i) => {
		const x = 32 + (i % 2) * 5 + Math.max(0, go) * (0.026 + hash(i, 5) * 0.01);
		runner(g, x, 62 + i * 4, u, go > 0 ? stride(c, i) : 1);
	});
	front(g, 52, 80, OFFICIAL, 1, { arm: go < 1200 });
	gunSmoke(g, 59, 80, go);
	crowd(g, c, 96, 0, 4, 11);
};

// ───────────────── 道（1区・給水） ─────────────────

const drawRoad: Scene = (g, c) => {
	const off = c.still ? 0 : c.lt * 0.05;
	const L = uniOf(c.data.lead);
	const bob = (i: number) => (c.still ? 0 : (Math.floor(c.now / 150) + i) % 2);
	bands(g, c.W, ["#78b4e6", "#92c4ec", "#acd4f0"], 0, 24);
	fill(g, "#2a78c0", 0, 24, c.W, 18);
	for (let i = 0; i < 7; i++) {
		const wx = Math.round((((i * 29 - off * 0.2) % 196) + 196) % 196) - 6;
		fill(g, "#cfe8ff", wx, 28 + (i % 3) * 4, 6, 1);
	}
	crowd(g, c, 42, off * 0.7, 11);
	road(g, c, 54, 30, off);
	// 2番手（ちがう 学校）と 先頭（札）、前に 白バイ
	runner(g, 24, 62 - bob(1), uniOf((c.data.lead ?? 0) + 2), stride(c, 1));
	const lx = 74;
	runner(g, lx, 64 - bob(0), L, stride(c));
	text(g, L.name, lx + 4, 50, 8, WHITE, { outline: INK });
	fill(g, WHITE, 132, 66, 14, 5, 137, 56, 5, 3);
	fill(g, "#2a2a30", 132, 71, 4, 4, 143, 71, 4, 4);
	fill(g, "#3a5aa0", 137, 59, 5, 7);
	// 給水（並走して 2.5秒で ボトルを わたし、おくれて いく）
	if (c.data.phase === "kyusui") {
		const lt = c.lt;
		const bx =
			lt < 800 ? 20 + lt * 0.06 : lt < 4500 ? 68 : 68 - (lt - 4500) * 0.02;
		if (bx > -12) {
			runner(g, bx, 70 - bob(2), { ...L, sash: L.ink }, stride(c, 2));
			const got = lt >= 2500;
			fill(g, "#a8e0ff", got ? lx + 6 : bx + 7, got ? 69 : 75, 2, 3);
		}
	}
	crowd(g, c, 90, off * 1.4, 12, 11);
};

// ───────────────── 中継所 ─────────────────

/** ふつうの 受けわたし（横から。2.5秒で 襷が わたる）。 */
const drawRelay = (g: G, c: C): void => {
	const u = uniOf(c.data.lead);
	bands(g, c.W, ["#7ab6e6", "#96c6ec", "#b6d8f2"], 0, 56);
	for (let i = 0; i < 9; i++) {
		const hh = 12 + Math.floor(hash(i, 23) * 10);
		fill(
			g,
			["#d8c8a8", "#c8ccd4", "#e0d4c0"][i % 3],
			i * 22 - 4,
			56 - hh,
			18,
			hh,
		);
		fill(
			g,
			["#8a4a3a", "#4a5a7a", "#6a6a6a"][i % 3],
			i * 22 - 5,
			53 - hh,
			20,
			3,
		);
	}
	crowd(g, c, 46, 0, 21);
	road(g, c, 58, 30, 0);
	fill(g, WHITE, 112, 58, 2, 30);
	banner(g, c.data.label ?? "", 70, 6, 82, INK, WHITE);
	const HAND = 2500;
	const lt = c.lt;
	if (lt < HAND) {
		// 次の 走者は 手を あげて 待つ
		front(g, 116, 64, u.ink, 1, { arm: true });
		runner(g, -10 + (lt / HAND) * 112, 66, u, stride(c));
	} else {
		// 襷を うけた 走者は 右へ、走りおえた 走者は 一礼
		runner(g, 116 + (lt - HAND) * 0.035, 64, u, stride(c));
		front(g, 100, 67 + (lt > HAND + 900 ? 1 : 0), u.ink, 1);
	}
	front(g, 122, 76, OFFICIAL, 1);
	crowd(g, c, 94, 0, 22, 11);
};

/** 繰り上げの 絵：道の 消える 点・中継線の 高さ・道の 半分の 幅。 */
const VX = 86;
const VY = 30;
const LINE = 82;
const edge = (y: number): number => 4 + ((y - VY) / (LINE - VY)) * 64;

/** 繰り上げ（道の 先を 見る 絵）。時計・号砲・届けば 襷を わたし、届かなければ 白い 襷で 出る。 */
const drawKuriage = (g: G, c: C): void => {
	const exact = c.data.exact ?? EKIDEN_EXACT;
	const since = c.t - exact;
	const arrive = c.data.arrive ?? true;
	const H = c.H;
	bands(g, c.W, ["#8ab8e0", "#a6c8e8", "#c4daee"], 0, VY);
	for (let x = 0; x < c.W; x += 12)
		fill(g, "#3a6a44", x, VY - 6 - Math.floor(hash(x, 41) * 6), 10, 12);
	fill(g, "#c8bca0", 0, VY, c.W, H - VY);
	poly(g, "#5c5c64", VX - 4, VY, VX + 4, VY, VX + edge(H), H, VX - edge(H), H);
	for (let y = VY + 4; y < H; y += 8 + Math.floor((y - VY) / 8))
		fill(g, "#d8d8d0", VX, y, 1, 2 + Math.floor((y - VY) / 12));
	fill(g, WHITE, VX - edge(LINE), LINE, edge(LINE) * 2, 2);
	// 両わきの 沿道（旗）
	for (const side of [0, 1])
		for (let i = 0; i < 4; i++) {
			const y = 44 + i * 12;
			const w = edge(y);
			const x = side ? VX + w + 3 + (i % 2) * 6 : VX - w - 9 - (i % 2) * 6;
			person(g, x, y, BODY[i], HAIR);
			const wave = c.still ? 0 : (Math.floor(c.now / 200) + i + side) % 2;
			fill(g, WHITE, x + (side ? -4 : 6), y - 4 + wave, 4, 3);
		}
	fill(g, WHITE, 4, 4, 56, 11);
	text(g, c.data.label ?? "", 32, 5, 8, INK);
	// 時計（繰り上げまで M:SS。合図の 3拍は 赤）
	const s = ekidenLeft(c.t) ?? 0;
	const ink = s <= EKIDEN_CUE.pulses ? "#ff4040" : "#ffe060";
	const mm = String(Math.floor(s / 60));
	const ss = String(s % 60).padStart(2, "0");
	const x0 = 152 - Math.floor((numW(mm, 2) + 6 + numW(ss, 2)) / 2);
	const xc = x0 + numW(mm, 2) + 2;
	fill(g, "#101014", 124, 4, 56, 30);
	text(g, EKIDEN_ART.kuriage, 152, 6, 8, WHITE);
	num(g, mm, x0, 18, 2, ink);
	fill(g, ink, xc, 20, 2, 2, xc, 24, 2, 2);
	num(g, ss, xc + 4, 18, 2, ink);
	// 号砲の 係（合図の あいだ 手を あげる）
	const armUp = c.data.phase === "cue" || (since >= 0 && since < 1500);
	front(g, 142, 60, OFFICIAL, 2, { arm: armUp });
	if (armUp) fill(g, "#2a2a30", 154, 56, 2, 3);
	// 来る 保守大（届く 日は はじめから 道の 先に 見える。届かない 日は 号砲の あとに 来る）
	const T0 = arrive ? KURIAGE_AT : exact + 400;
	const T1 = arrive ? exact : exact + 4900;
	if (c.t >= T0) {
		const p = 0.12 + 0.88 * clamp01((c.t - T0) / (T1 - T0));
		const y = Math.round(VY + (LINE - VY) * p * p);
		const f = c.t >= T1 ? 1 : stride(c, 0, 170);
		if (y < 46) {
			fill(g, SKIN, VX - 1, y - 4, 2, 1);
			fill(g, HOSHU_UNI.ink, VX - 1, y - 3, 2, 2);
			fill(g, SHORTS, VX - 1 + f, y - 1, 1, 1);
		} else if (y < 64)
			front(g, VX - 3, y - 12, HOSHU_UNI.ink, 1, { sash: HOSHU_UNI.sash, f });
		else
			front(g, VX - 6, y - 24, HOSHU_UNI.ink, 2, { sash: HOSHU_UNI.sash, f });
	}
	// 待つ 次の 走者（号砲で 手前へ 走り出す。届けば 保守大の 襷、届かなければ 白い 襷）
	const out = Math.max(0, since) * 0.012;
	if (out < 40) {
		const ny = LINE - 22 + Math.round(out);
		const sash = since < 0 ? undefined : arrive ? HOSHU_UNI.sash : WHITE;
		const f = since < 0 ? 1 : stride(c, 1, 140);
		front(g, VX + 10, ny, HOSHU_UNI.ink, 2, { sash, arm: since < 0, f });
		if (!arrive && since >= 0 && since < 3000)
			text(g, EKIDEN_ART.shiro, VX + 16, ny - 11, 8, WHITE, { outline: HAIR });
	}
	gunSmoke(g, 155, 54, since);
	if (arrive && since >= 0 && since < 2600)
		text(g, EKIDEN_ART.tsunagi, VX, 40, 12, "#ffe060", { outline: HAIR });
	// 合図の 光と 点（3つ）
	const glow = pulseGlow(c);
	if (glow > 0)
		fill(g, `rgba(255, 255, 255, ${(glow * 0.25).toFixed(3)})`, 0, 0, c.W, H);
	if (c.data.phase === "cue")
		for (let i = 0; i < EKIDEN_CUE.pulses; i++)
			fill(
				g,
				i < c.pulses.length ? "#ffe060" : "#3a4a7a",
				VX - 14 + i * 12,
				92,
				6,
				6,
			);
};

const drawChukei: Scene = (g, c) =>
	c.data.phase === "normal" ? drawRelay(g, c) : drawKuriage(g, c);

// ───────────────── 山（上り・山の神、復路は 下りの VTR） ─────────────────

const drawYama: Scene = (g, c) => {
	const down = c.data.down ?? false;
	const W = uniOf(c.data.win);
	const kami = c.data.phase === "kami";
	/** 道の 下の ふち（往路は 右へ 上り、復路は 右へ 下る）。 */
	const slope = (x: number) =>
		Math.round(66 + (down ? 1 : -1) * (x / c.W - 0.5) * 56);
	bands(g, c.W, ["#86b4de", "#a2c6e6", "#c2dbee"], 0, 50);
	poly(g, "#8a9cb4", 0, 40, 50, 14, 110, 34, 150, 10, c.W, 30, c.W, 60, 0, 60);
	poly(g, "#3a6a40", 0, slope(0) - 26, c.W, slope(c.W) - 26, c.W, c.H, 0, c.H);
	for (let i = 0; i < 18; i++) {
		const tx = Math.floor(hash(i, 51) * c.W);
		const dy = hash(i, 52) < 0.5 ? -22 : 6 + Math.floor(hash(i, 53) * 16);
		fill(
			g,
			"#24502c",
			tx,
			slope(tx) + dy,
			2,
			4,
			tx - 2,
			slope(tx) + dy + 2,
			6,
			3,
		);
	}
	poly(
		g,
		"#5c5c64",
		0,
		slope(0) - 12,
		c.W,
		slope(c.W) - 12,
		c.W,
		slope(c.W),
		0,
		slope(0),
	);
	for (let x = 0; x < c.W; x += 8) fill(g, "#e8e8e8", x, slope(x), 1, 3);
	// 走者：優勝する 学校が 2人を 抜く（上りと 山の神を とおして 1本の 時計。66.7秒と 71.6秒で 抜く）
	const tt = c.t - YAMA_AT;
	const win = c.data.win ?? 0;
	[
		{ u: uniOf(win + 1), x: 70 + tt * 0.0025 },
		{ u: uniOf(win + 3), x: 100 + tt * 0.0018 },
	].forEach((r, i) => {
		runner(g, r.x, slope(r.x + 4) - 16, r.u, stride(c, i + 1, 190));
	});
	const wx = Math.round(20 + tt * 0.0055);
	const wy = slope(wx + 4) - 16;
	if (kami) {
		// 山の神の 光（ゆれと 光の 粒は still で 止める）
		const a = c.still ? 0.35 : 0.3 + 0.15 * Math.sin(c.now / 220);
		fill(g, `rgba(255, 224, 96, ${a.toFixed(3)})`, wx - 3, wy - 3, 14, 20);
		for (let i = 0; i < 4 && !c.still; i++) {
			const r = (c.now / 300 + i * 1.57) % 6.283;
			const px = Math.round(wx + 4 + Math.cos(r) * 10);
			fill(g, "#fff4b0", px, Math.round(wy + 7 + Math.sin(r) * 10), 1, 1);
		}
	}
	runner(g, wx, wy, W, stride(c, 0, kami ? 120 : 160));
	text(
		g,
		kami ? EKIDEN_ART.kami : W.name,
		wx + 4,
		wy - 12,
		8,
		kami ? "#ffe060" : WHITE,
		{
			outline: "#1a2a1a",
		},
	);
	// 霧
	const fx = c.still ? 0 : Math.floor(c.now / 90) % (c.W + 60);
	fill(
		g,
		"rgba(255, 255, 255, 0.18)",
		fx - 60,
		44,
		70,
		6,
		((fx + 100) % (c.W + 60)) - 60,
		30,
		50,
		5,
	);
	// 復路は 去年の 下りの VTR
	if (down) {
		fill(g, "#c82828", 4, 4, 24, 11);
		text(g, EKIDEN_ART.vtr, 16, 5, 8, WHITE);
	}
};

// ───────────────── ゴール（テープ・胴上げ） ─────────────────

const TAPE = 2500;
const CONFETTI = ["#ffe060", "#ff6a8a", "#6ad0ff", WHITE];

const drawGoal: Scene = (g, c) => {
	const W = uniOf(c.data.win);
	(c.data.down ? station : lake)(g, c, 60);
	crowd(g, c, 50, 0, 31);
	road(g, c, 62, 28, 0);
	banner(g, EKIDEN_ART.goal, 124, 12, 48);
	if (c.data.phase !== "yusho") {
		// テープ（x 128）を 2.5秒で 切る。あとは 両手を あげて ゆっくり 止まる
		const lt = c.lt;
		const cut = lt >= TAPE;
		const fall = Math.min(16, Math.floor((lt - TAPE) / 60));
		const x = cut ? 120 + Math.min(1000, lt - TAPE) * 0.02 : (lt / TAPE) * 130;
		if (cut) fill(g, "#ffe060", 129, 64 + fall, 1, 10, 127, 80, 1, 10);
		else fill(g, "#ffe060", 128, 62, 1, 28);
		runner(g, x - 10, 66, W, lt < TAPE + 1000 ? stride(c) : 1, 1, { up: cut });
		if (cut) text(g, W.name, Math.round(x) - 6, 52, 8, WHITE, { outline: INK });
	} else {
		// 胴上げ（輪の まん中で 監督が 宙に 上がる）と 優勝の 札・紙ふぶき
		for (let i = 0; i < 6; i++)
			front(g, 104 + i * 11, 74 + (i % 2) * 2, W.ink, 1, { arm: true });
		const up = c.still ? 1 : Math.abs(Math.sin((c.lt / 900) * Math.PI));
		const hy = 56 - Math.round(up * 18);
		fill(g, SKIN, 128, hy + 4, 2, 2, 140, hy + 4, 2, 2);
		front(g, 132, hy, "#f0f0f0", 1);
		fill(g, RED, 14, 26, 76, 24);
		fill(g, "#ffe890", 14, 26, 76, 2);
		text(g, c.data.label ?? "", 52, 28, 8, WHITE);
		text(g, W.name, 52, 38, 8, "#ffe890");
		for (let i = 0; i < 28; i++) {
			const v = c.still ? 0 : c.now * 0.02 * (0.6 + hash(i, 63));
			const fy = Math.floor((hash(i, 62) * 90 + v) % 90);
			fill(g, CONFETTI[i % 4], Math.floor(hash(i, 61) * c.W), fy, 2, 1);
		}
	}
	crowd(g, c, 96, 0, 32, 11);
};

// ───────────────── 枠（待合の 壁の テレビ） ─────────────────

const drawFrame: Scene = (g, c) => {
	const { x, y, w, h } = SCREEN;
	const r = x + w + 4;
	// 白い タイルの 壁
	fill(g, "#dcdcd4", 0, 0, 240, y - 4, 0, 0, x - 4, 135, r, 0, 240 - r, 135);
	fill(g, "#dcdcd4", 0, y + h + 4, 240, 135 - (y + h + 4));
	for (let ty = 0; ty < 135; ty += 10)
		fill(g, "#c6c6bc", 0, ty, x - 4, 1, r, ty, 240 - r, 1);
	// ふち（黒）と 電源の 灯（本番は 赤）
	fill(g, "#141418", x - 4, y - 4, w + 8, 4, x - 4, y + h, w + 8, 5);
	fill(g, "#141418", x - 4, y, 4, h, x + w, y, 4, h);
	fill(g, c.live ? "#ff5040" : "#606060", x + w - 6, y + h + 2, 2, 1);
	fill(g, "rgba(255, 255, 255, 0.05)", x, y, w, 2);
	// 左の 壁の 時計・右の 札
	fill(g, WHITE, 6, 20, 13, 13);
	fill(g, "#2a2a30", 6, 20, 13, 1, 6, 32, 13, 1, 6, 20, 1, 13, 18, 20, 1, 13);
	fill(g, "#2a2a30", 12, 22, 1, 5, 12, 26, 4, 1);
	fill(g, "#2a5aa0", 216, 20, 20, 12);
	text(g, EKIDEN_ART.machiai, 226, 22, 8, WHITE);
	// ベンチと 待つ 客（頭と 肩）
	fill(g, "#3a5a8a", 0, 124, 240, 11);
	fill(g, "#5a7aaa", 0, 124, 240, 1);
	for (const [hx, hair, coat] of [
		[40, "#2a2020", "#4a4a5a"],
		[118, "#5a3a2a", "#6a3a3a"],
		[196, "#1a1a1a", "#3a4a3a"],
	] as const) {
		fill(g, hair, hx - 4, 114, 8, 1, hx - 5, 115, 10, 9);
		fill(g, coat, hx - 8, 124, 16, 1, hx - 10, 125, 20, 10);
	}
};

export const ekidenTv = makeTv<EkidenData>({
	screen: SCREEN,
	frame: drawFrame,
	scenes: {
		card: drawCard,
		start: drawStart,
		road: drawRoad,
		chukei: drawChukei,
		yama: drawYama,
		goal: drawGoal,
	},
	noCaption: ["card"],
});

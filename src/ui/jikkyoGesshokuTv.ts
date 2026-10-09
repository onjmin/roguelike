// 皆既月食　観察部の TV（ui/jikkyoWatch.ts の 板の 上の キャンバス）。テレビは ない：保守中央公園の 北の ベンチから
// 見上げた 夜空（skyFrame。画面 ぜんぶが 空）。形は ui/jikkyoTvKit.ts（480x270 の 2倍の 下地に 240x135 の 座標）。
// - 下に 木の 影（左）・街灯（右）・噴水の 影（まんなか）、左下で キリコの スマホが 光る（洪水で 明るく）。その 上に 月。
// - 月の 形は 名目の 時計（c.t）で かわる（data/jikkyo/gesshoku.ts の GESSHOKU_ECLIPSE と gesshokuCover）：
//   地球の 影（大きな 円）が 左から かかり、欠けた 割合が 時間に 比例して ふえる。皆既の あいだは 赤銅色で、
//   影の 縁に 近い がわが 少し 明るい（はじめは 右、おわりは 左）。戻るのも 左から。月が 暗いほど 星が ふえ、空も 暗い。
//   月は 夜の あいだに 少しずつ 右上へ。
// - 場面は どれも 同じ 空。雲（kumo）は 区切りの あいだに 月の 前を 右から 左へ 横切る。山場（cue）は 合図ごとに
//   月の まわりが 光って 3つの 点が ともり、ちょうどで 赤い 輪が ひろがる。
// - 再放送（前の 月食の 過去ログ）は 左上に「過去ログ」の 札。字幕は 地面の 上に ふちどりの 字。
// - 動きを へらす 設定（still）：星の またたき・噴水の しぶき・合図の 光と 輪を 止める（月と 雲の ゆっくりした 動きは 残す）。

import {
	GESSHOKU_ART,
	GESSHOKU_ECLIPSE,
	GESSHOKU_EXACT,
	GESSHOKU_SCENES,
	gesshokuCover,
} from "../data/jikkyo/gesshoku";
import {
	bands,
	clamp01,
	type G,
	hash,
	makeTv,
	pulseGlow,
	type SceneFn,
	skyFrame,
	type TvCtx,
	text,
} from "./jikkyoTvKit";

const SW = skyFrame.screen.w;
const SH = skyFrame.screen.h;
/** 番組の 長さ（月の 動きの 目安）。 */
const LEN = 150000;
/** 地面の 高さ。 */
const GROUND = 114;

// ───────────────── 月と 地球の 影 ─────────────────

/** 月の 半径・地球の 影の 半径・影の 中心の ずれ（月の 少し 下を 通る）。 */
const R = 13;
const U = 34;
const DY = 5;

/** 月の 円板の 行ごとの 半幅（y = −R〜R）。 */
const HW: readonly number[] = Array.from({ length: 2 * R + 1 }, (_, i) => {
	const y = i - R;
	return Math.floor(Math.sqrt(Math.max(0, R * R + R * 0.6 - y * y)));
});

/** 海（月の 暗い 模様。月の 中心からの x・y・半径）。 */
const MARIA: readonly (readonly [number, number, number])[] = [
	[-4, -5, 4],
	[3, -3, 3],
	[-6, 2, 3],
	[2, 4, 4],
	[6, -7, 2],
];
const isMare = (x: number, y: number): boolean =>
	MARIA.some(([ax, ay, ar]) => (x - ax) ** 2 + (y - ay) ** 2 <= ar * ar);

/** 影の 中心が 月の 中心から dx の とき、影に 入る 月の 割合。 */
const coverOf = (dx: number): number => {
	let n = 0;
	let k = 0;
	for (let y = -R; y <= R; y++) {
		const w = HW[y + R];
		for (let x = -w; x <= w; x++) {
			k++;
			if ((x - dx) ** 2 + (y - DY) ** 2 <= U * U) n++;
		}
	}
	return n / k;
};

/** 左から 影が かかる 道の 表（dx → 割合。0.25 刻み）。 */
const TABLE: readonly (readonly [number, number])[] = (() => {
	const out: [number, number][] = [];
	for (let dx = -(U + R + 2); dx <= 0; dx += 0.25) out.push([dx, coverOf(dx)]);
	return out;
})();
/** 影が ふれる 直前・皆既に なる 所の dx（左がわ。負）。 */
const CONTACT = TABLE.filter(([, c]) => c === 0).at(-1)?.[0] ?? -(U + R);
const TOTAL = TABLE.find(([, c]) => c >= 1)?.[0] ?? -(U - R);

/** 割合 f に なる 左がわの dx。 */
const dxFor = (f: number): number => {
	if (f <= 0) return CONTACT;
	for (const [dx, c] of TABLE) if (c >= f) return dx;
	return TOTAL;
};

/** 名目の 時刻 → 影の 中心の dx（月の 中心から。左が 負）。 */
const dxAt = (t: number): number => {
	const E = GESSHOKU_ECLIPSE;
	if (t < E.u1) return CONTACT - (E.u1 - t) * 0.0004;
	if (t < E.u2) return dxFor(gesshokuCover(t));
	if (t <= E.u3) return TOTAL - (2 * TOTAL * (t - E.u2)) / (E.u3 - E.u2);
	if (t < E.u4) return -dxFor(gesshokuCover(t));
	return -CONTACT + (t - E.u4) * 0.0004;
};

/** 月の 1点の 色（影の 中は 皆既ほど 赤く、皆既は 影の 縁に 近いほど 明るい）。 */
const moonInk = (
	x: number,
	y: number,
	dx: number,
	cover: number,
): string | null => {
	const mare = isMare(x, y);
	const d2 = (x - dx) ** 2 + (y - DY) ** 2;
	if (d2 > U * U) return mare ? "#d6ceb2" : "#f4efd8";
	const s = Math.sqrt(d2) / U;
	if (cover < 1) {
		const edge = s > 0.85;
		if (cover < 0.6) return edge ? "#4a3634" : mare ? "#2c2226" : "#34282a";
		if (cover < 0.9) return edge ? "#663a2e" : mare ? "#3a2420" : "#442a24";
		return edge ? "#8a4430" : mare ? "#4e2a20" : "#5a3024";
	}
	if (s > 0.78) return mare ? "#a24c2e" : "#c0603a";
	if (s > 0.6) return mare ? "#823822" : "#9a4228";
	return mare ? "#682a1c" : "#7a3220";
};

/** 月（行ごとに 同じ 色の 並びを まとめて 塗る）。 */
const drawMoon = (
	g: G,
	mx: number,
	my: number,
	dx: number,
	cover: number,
): void => {
	for (let y = -R; y <= R; y++) {
		const w = HW[y + R];
		let run: string | null = null;
		let x0 = -w;
		for (let x = -w; x <= w + 1; x++) {
			const ink = x <= w ? moonInk(x, y, dx, cover) : null;
			if (ink === run) continue;
			if (run) {
				g.fillStyle = run;
				g.fillRect(mx + x0, my + y, x - x0, 1);
			}
			run = ink;
			x0 = x;
		}
	}
};

/** 丸（塗り）。 */
const disc = (g: G, x: number, y: number, r: number): void => {
	g.beginPath();
	g.arc(x, y, r, 0, Math.PI * 2);
	g.fill();
};

// ───────────────── 空・星・雲 ─────────────────

const hex = (s: string): [number, number, number] => [
	Number.parseInt(s.slice(1, 3), 16),
	Number.parseInt(s.slice(3, 5), 16),
	Number.parseInt(s.slice(5, 7), 16),
];
const mix = (a: string, b: string, t: number): string => {
	const p = hex(a);
	const q = hex(b);
	const c = p.map((v, i) => Math.round(v + (q[i] - v) * t));
	return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
};
/** 月が 明るい 夜空と、皆既の 暗い 夜空（上から 下）。 */
const SKY_LIT = ["#101c3c", "#15244a", "#1c2e58", "#243864", "#2c4270"];
const SKY_DARK = ["#03050c", "#050916", "#080e20", "#0c142a", "#121c36"];

const drawSky = (g: G, c: TvCtx, lit: number): void => {
	bands(
		g,
		SW,
		SKY_DARK.map((d, i) => mix(d, SKY_LIT[i], lit)),
		0,
		GROUND,
	);
	// 星（月が 暗いほど 多く 見える）
	for (let i = 0; i < 48; i++) {
		if (hash(i, 13) > 0.22 + 0.78 * (1 - lit)) continue;
		const x = Math.floor(hash(i, 11) * SW);
		const y = Math.floor(hash(i, 12) * 96);
		let a = 0.45 + 0.5 * hash(i, 14);
		if (!c.still) a *= 0.65 + 0.35 * Math.sin(c.now / 600 + i * 2.1);
		g.fillStyle = `rgba(230, 236, 255, ${a.toFixed(3)})`;
		g.fillRect(x, y, hash(i, 15) > 0.85 ? 2 : 1, 1);
	}
};

/** 雲（右から 左へ。p は 0〜1 の 進み。月明かりで 上の 縁が 明るい）。 */
const drawCloud = (g: G, cx: number, cy: number, lit: number): void => {
	const parts: readonly (readonly [number, number, number])[] = [
		[-16, 3, 8],
		[-6, -3, 11],
		[7, -1, 10],
		[18, 3, 7],
	];
	g.fillStyle = mix("#1a2034", "#3e4a68", lit);
	for (const [x, y, r] of parts) disc(g, cx + x, cy + y - 1, r);
	g.fillStyle = "#161c2c";
	for (const [x, y, r] of parts) disc(g, cx + x, cy + y + 1, r);
	g.fillRect(cx - 24, cy + 3, 48, 8);
};

// ───────────────── 公園の 影と スマホ ─────────────────

const INK = "#04060b";

const drawPark = (g: G, c: TvCtx, lit: number): void => {
	// 地面
	g.fillStyle = "#06080e";
	g.fillRect(0, GROUND, SW, SH - GROUND);
	// 白い 花の 木（左）。花は 月明かりで ほのかに 白い
	g.fillStyle = INK;
	disc(g, 20, 78, 22);
	disc(g, 42, 90, 15);
	disc(g, 4, 94, 14);
	g.fillRect(18, 92, 6, GROUND - 92);
	g.fillStyle = `rgba(200, 210, 235, ${(0.08 + 0.22 * lit).toFixed(3)})`;
	for (let i = 0; i < 18; i++) {
		const a = hash(i, 41) * Math.PI * 2;
		const r = hash(i, 42) * 18;
		g.fillRect(
			Math.round(20 + Math.cos(a) * r),
			Math.round(76 + Math.sin(a) * r * 0.8),
			1,
			1,
		);
	}
	// 街灯（右）と 光だまり
	g.fillStyle = "rgba(255, 216, 140, 0.08)";
	disc(g, 215, 64, 16);
	g.fillRect(198, GROUND, 34, 4);
	g.fillStyle = "rgba(255, 216, 140, 0.16)";
	disc(g, 215, 63, 8);
	g.fillStyle = INK;
	g.fillRect(214, 62, 2, GROUND - 62);
	g.fillRect(208, 57, 14, 4);
	g.fillStyle = "#ffe6a8";
	g.fillRect(210, 61, 10, 2);
	// 噴水（下の まんなか）と しぶき
	g.fillStyle = INK;
	g.fillRect(92, 104, 56, 3);
	g.fillRect(96, 107, 48, GROUND + 2 - 107);
	g.fillRect(117, 90, 6, 14);
	g.fillRect(110, 88, 20, 3);
	g.fillStyle = `rgba(160, 190, 230, ${(0.35 + 0.35 * lit).toFixed(3)})`;
	for (let i = 0; i < 10; i++) {
		const p = c.still ? hash(i, 51) : (c.now / 900 + hash(i, 51)) % 1;
		const side = i % 2 ? 1 : -1;
		g.fillRect(
			120 + side * Math.round(4 + p * 12),
			Math.round(87 - 6 * Math.sin(p * Math.PI) + 16 * p),
			1,
			1,
		);
	}
	// キリコの スマホ（左下。洪水で 明るく）
	g.fillStyle = "#1a1c24";
	g.fillRect(8, 112, 16, SH - 112);
	g.fillStyle = c.v.flood ? "#eef4ff" : "#a8c4ec";
	g.fillRect(10, 114, 12, SH - 114);
	g.fillStyle = "#5a6a8a";
	for (let i = 0; i < 5; i++)
		g.fillRect(11, 116 + i * 4, 3 + Math.floor(hash(i, 61) * 7), 1);
};

// ───────────────── 場面 ─────────────────

/** 夜空の 場面（雲・合図は 場面ごと）。 */
const sky =
	(o: { cloud?: boolean; cue?: boolean } = {}): SceneFn =>
	(g, c) => {
		const cover = gesshokuCover(c.t);
		const lit = 1 - cover;
		const p = clamp01(c.t / LEN);
		const mx = Math.round(132 + p * 26);
		const my = Math.round(40 - p * 8);
		drawSky(g, c, lit);
		// 月の まわりの 光（明るい ときは 白く、皆既は ほのかに 赤く）
		g.fillStyle =
			cover < 1
				? `rgba(255, 246, 216, ${(0.1 * lit).toFixed(3)})`
				: "rgba(200, 90, 60, 0.08)";
		disc(g, mx, my, R + 6);
		g.fillStyle =
			cover < 1
				? `rgba(255, 246, 216, ${(0.14 * lit).toFixed(3)})`
				: "rgba(200, 90, 60, 0.1)";
		disc(g, mx, my, R + 3);
		drawMoon(g, mx, my, dxAt(c.t), cover);
		if (o.cloud) {
			const dur = c.seg?.dur ?? 10000;
			// 区切りの あいだ ずっと 月に かかり、まんなかで すっかり かくす
			const cx = Math.round(mx + 36 - clamp01(c.lt / dur) * 72);
			drawCloud(g, cx, my + 2, lit);
		}
		if (o.cue) {
			// 合図ごとに 月の まわりが 光る・3つの 点・ちょうどで 赤い 輪
			const a = pulseGlow(c, 320);
			if (a > 0) {
				g.strokeStyle = `rgba(255, 236, 200, ${a.toFixed(3)})`;
				g.lineWidth = 1;
				g.beginPath();
				g.arc(mx, my, R + 4, 0, Math.PI * 2);
				g.stroke();
			}
			const since = c.t - GESSHOKU_EXACT;
			for (let i = 0; i < 3; i++) {
				g.fillStyle = i < c.pulses.length || since >= 0 ? "#ffe0a0" : "#3a4466";
				g.fillRect(mx - 10 + i * 8, my + R + 7, 4, 4);
			}
			if (since >= 0 && since < 2000 && !c.still) {
				g.strokeStyle = `rgba(230, 110, 70, ${(1 - since / 2000).toFixed(3)})`;
				g.lineWidth = 1;
				g.beginPath();
				g.arc(mx, my, R + 3 + since * 0.01, 0, Math.PI * 2);
				g.stroke();
			}
		}
		drawPark(g, c, lit);
		if (!c.live)
			text(g, GESSHOKU_ART.kakolog, 6, 4, 8, "#c8d4ec", {
				align: "left",
				outline: "#05070c",
			});
	};

export const gesshokuTv = makeTv({
	screen: skyFrame.screen,
	frame: skyFrame.draw,
	scenes: Object.fromEntries(
		GESSHOKU_SCENES.map((k) => [
			k,
			sky({ cloud: k === "kumo", cue: k === "cue" }),
		]),
	),
	fallback: "matsu",
	// 字幕は 地面の 上に ふちどりの 字（黒帯は 置かない）
	caption: (g, c, s) =>
		text(g, s, c.W / 2, c.H - 12, 8, "#e6ecf8", { outline: INK }),
});

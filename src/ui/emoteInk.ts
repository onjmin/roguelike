// 立ち絵に 添える 感情の 記号（手書き風。歩く 絵の ドット絵の 記号は engine/emote.ts）。
// 作者「立ち絵の 方にも 感情記号を。手書き風に」。
// - 絵は コードで 描く SVG（64×64）。点を 少し ゆらして なめらかに つなぎ、線は 筆のように 太さを むらに する。
// - 色の 面の 右下に 墨を ずらして 敷き（右下ほど 線が 太く 見える）、ふちを 墨で なぞる。
// - いちばん 外に 紙色の ふち（feMorphology）を 付け、暗い 絵の 上でも 明るい 絵の 上でも 読める。
// - ゆらぎの ちがう 2枚（v0・v1）を 入れて、CSS で 交互に 出す（線が ふるえる。動きを へらす 設定では v0 だけ）。
// 置き場所と 動き（ぽんと 出て おさまる・記号ごとの ゆれ）は style.css の .portrait-emote。

import type { Emote } from "../engine/emote";

type P = readonly [number, number];

/** 部品。blob は 色の 面（墨の ふちと 影つき）、ink は 墨だけの 面、light は 白い つや。 */
type Part = {
	kind: "blob" | "ink" | "light";
	pts: readonly P[];
	color?: string;
	/** 部品に 付ける class（「…」の 点を 1つずつ 出す など）。 */
	cls?: string;
};

const INK = "#2b1d1a";
const PAPER = "#fffaf0";
const LIGHT = "#ffffff";

/** 記号ごとの class（動きを 分ける。style.css の .ink-*）。 */
export const INK_CLASS: Record<Emote, string> = {
	"!": "ink-bang",
	"?": "ink-what",
	"♪": "ink-note",
	"…": "ink-dots",
	z: "ink-zzz",
	"♥": "ink-heart",
	汗: "ink-sweat",
	怒: "ink-anger",
	花: "ink-flower",
};

/** 種から 決まる 乱数（毎回 同じ 絵に なるように）。 */
const rand = (seed: number) => () => {
	seed = (seed + 0x6d2b79f5) | 0;
	let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
	t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
	return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
type Rand = () => number;

const f = (n: number) => n.toFixed(1);

/** 点を なめらかに つなぐ（Catmull-Rom を 3次ベジェに）。 */
const smooth = (pts: readonly P[], closed: boolean): string => {
	const n = pts.length;
	const at = (i: number) =>
		closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
	let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
	const last = closed ? n : n - 1;
	for (let i = 0; i < last; i++) {
		const p0 = at(i - 1);
		const p1 = at(i);
		const p2 = at(i + 1);
		const p3 = at(i + 2);
		d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
	}
	return closed ? `${d}Z` : d;
};

/** 折れ線の 1辺を step ごとに 区切る（まっすぐな ところを ゆらせるように）。 */
const densify = (pts: readonly P[], step: number): P[] => {
	const out: P[] = [];
	for (let i = 0; i < pts.length - 1; i++) {
		const [ax, ay] = pts[i];
		const [bx, by] = pts[i + 1];
		const k = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
		for (let j = 0; j < k; j++)
			out.push([ax + ((bx - ax) * j) / k, ay + ((by - ay) * j) / k]);
	}
	out.push(pts[pts.length - 1]);
	return out;
};

/**
 * 筆の 1画（折れ線 pts を 太さ w の 面に する）。head・tail は はじめ・おわりの 太さの 割合（筆の 入り・抜き）。
 * 太さは 点ごとに 少し むらに する。
 */
const ribbon = (
	pts: readonly P[],
	w: number,
	r: Rand,
	head = 0.4,
	tail = 0.4,
): P[] => {
	const n = pts.length;
	const left: P[] = [];
	const right: P[] = [];
	for (let i = 0; i < n; i++) {
		const a = pts[Math.max(0, i - 1)];
		const b = pts[Math.min(n - 1, i + 1)];
		const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
		const nx = -(b[1] - a[1]) / len;
		const ny = (b[0] - a[0]) / len;
		const t = n > 1 ? i / (n - 1) : 0.5;
		// 入り → 中ほどで いちばん 太く → 抜き
		const ends =
			t < 0.5
				? head + (1 - head) * Math.sin(t * Math.PI)
				: tail + (1 - tail) * Math.sin(t * Math.PI);
		const half = (w * ends * (0.85 + 0.3 * r())) / 2;
		left.push([pts[i][0] + nx * half, pts[i][1] + ny * half]);
		right.push([pts[i][0] - nx * half, pts[i][1] - ny * half]);
	}
	return [...left, ...right.reverse()];
};

/** だ円（中心 cx,cy・半径 rx,ry・deg 度 かたむける）を n 点で。 */
const ellipse = (
	cx: number,
	cy: number,
	rx: number,
	ry: number,
	deg = 0,
	n = 12,
): P[] => {
	const c = Math.cos((deg * Math.PI) / 180);
	const s = Math.sin((deg * Math.PI) / 180);
	return Array.from({ length: n }, (_, i) => {
		const a = (i / n) * Math.PI * 2;
		const x = Math.cos(a) * rx;
		const y = Math.sin(a) * ry;
		return [cx + x * c - y * s, cy + x * s + y * c] as const;
	});
};

/** 点を (cx,cy) の まわりに deg 度 まわす。 */
const rot = (pts: readonly P[], deg: number, cx = 32, cy = 32): P[] => {
	const c = Math.cos((deg * Math.PI) / 180);
	const s = Math.sin((deg * Math.PI) / 180);
	return pts.map(([x, y]) => [
		cx + (x - cx) * c - (y - cy) * s,
		cy + (x - cx) * s + (y - cy) * c,
	]);
};

/** 部品を まとめて まわす。 */
const rotParts = (parts: Part[], deg: number): Part[] =>
	parts.map((p) => ({ ...p, pts: rot(p.pts, deg) }));

/** 八分音符（玉の 中心 x,y・大きさ s）。 */
const note = (
	x: number,
	y: number,
	s: number,
	r: Rand,
	color: string,
): Part[] => {
	const at = (dx: number, dy: number): P => [x + dx * s, y + dy * s];
	return [
		{
			kind: "blob",
			color,
			pts: ribbon(
				densify(
					[
						at(6, -1),
						at(6.5, -16),
						at(7, -31),
						at(13, -27),
						at(19, -21),
						at(18, -13),
					],
					4 * s,
				),
				4 * s,
				r,
				0.9,
				0.35,
			),
		},
		{ kind: "blob", color, pts: ellipse(x, y, 8 * s, 6 * s, -22) },
	];
};

/** 花（中心 x,y・半径 R）。花びら 5枚の ふちを 1つの 面で。 */
const flower = (x: number, y: number, R: number, turn: number): Part[] => [
	{
		kind: "blob",
		color: "#ff9cc8",
		pts: Array.from({ length: 40 }, (_, i) => {
			const a = (i / 40) * Math.PI * 2 + turn;
			const k = R * (0.55 + 0.45 * Math.abs(Math.cos(2.5 * (a - turn))) ** 0.7);
			return [x + Math.cos(a) * k, y + Math.sin(a) * k] as const;
		}),
	},
	{
		kind: "blob",
		color: "#ffd84a",
		pts: ellipse(x, y, R * 0.3, R * 0.3, 0, 9),
	},
];

/** Z の 1字（左上 x,y・大きさ s）。 */
const zed = (x: number, y: number, s: number, r: Rand): Part => ({
	kind: "blob",
	color: "#a8dcff",
	pts: ribbon(
		densify(
			[
				[x, y],
				[x + s, y + s * 0.05],
				[x + s * 0.05, y + s],
				[x + s, y + s],
			],
			s / 3,
		),
		s * 0.28,
		r,
		0.8,
		0.7,
	),
});

/** 記号ごとの 部品（r は 太さの むらに 使う）。 */
const SHAPES: Record<Emote, (r: Rand) => Part[]> = {
	// 太い くさびと 点、横に ピコンの 線 3本
	"!": (r) =>
		rotParts(
			[
				{
					kind: "blob",
					color: "#ff5a3c",
					pts: [
						[24, 5],
						[32, 3.5],
						[41, 5.5],
						[38.5, 17],
						[34, 38],
						[30.5, 38.5],
						[26, 18],
					],
				},
				{
					kind: "blob",
					color: "#ff5a3c",
					pts: ellipse(31.5, 50.5, 5.4, 5, 10, 9),
				},
				{
					kind: "ink",
					pts: ribbon(
						densify(
							[
								[15, 9],
								[8, 4],
							],
							3,
						),
						2.8,
						r,
					),
				},
				{
					kind: "ink",
					pts: ribbon(
						densify(
							[
								[13, 20],
								[5, 19],
							],
							3,
						),
						2.8,
						r,
					),
				},
				{
					kind: "ink",
					pts: ribbon(
						densify(
							[
								[15, 31],
								[8, 35],
							],
							3,
						),
						2.8,
						r,
					),
				},
			],
			10,
		),
	// 筆で ぐるっと 書いた かぎと 点
	"?": (r) =>
		rotParts(
			[
				{
					kind: "blob",
					color: "#ffd23c",
					pts: ribbon(
						[
							[18, 19],
							[20, 11],
							[27, 6],
							[36, 5.5],
							[44, 10],
							[46, 18],
							[41, 25.5],
							[34, 30],
							[31.5, 35.5],
							[31.5, 41],
						],
						9,
						r,
						0.65,
						0.85,
					),
				},
				{
					kind: "blob",
					color: "#ffd23c",
					pts: ellipse(31.5, 52, 5.2, 4.8, 0, 9),
				},
			],
			-8,
		),
	// 大きい 音符と 小さい 音符
	"♪": (r) => [
		...note(18, 50, 1, r, "#4fb0ff"),
		...note(45, 26, 0.62, r, "#4fb0ff"),
	],
	// 墨の 点 3つ（1つずつ 出る）
	"…": () => [
		{ kind: "ink", pts: ellipse(13, 42, 4.6, 4.2, 0, 8), cls: "d0" },
		{ kind: "ink", pts: ellipse(32, 41, 4.6, 4.2, 20, 8), cls: "d1" },
		{ kind: "ink", pts: ellipse(51, 40, 4.6, 4.2, 40, 8), cls: "d2" },
	],
	// 大きい Z と 小さい z
	z: (r) => rotParts([zed(10, 30, 22, r), zed(40, 8, 13, r)], -8),
	// ハートと つや
	"♥": () => [
		{
			kind: "blob",
			color: "#ff5c8a",
			pts: Array.from({ length: 26 }, (_, i) => {
				const t = (i / 26) * Math.PI * 2;
				return [
					32 + 1.55 * 16 * Math.sin(t) ** 3,
					31 -
						1.55 *
							(13 * Math.cos(t) -
								5 * Math.cos(2 * t) -
								2 * Math.cos(3 * t) -
								Math.cos(4 * t)),
				] as const;
			}),
		},
		{ kind: "light", pts: ellipse(20, 20, 4.5, 2.6, -40, 8) },
	],
	// しずくと つや
	汗: () =>
		rotParts(
			[
				{
					kind: "blob",
					color: "#6cc0ff",
					pts: [
						...Array.from({ length: 13 }, (_, i) => {
							const a = ((-38 + (i / 12) * 256) * Math.PI) / 180;
							return [32 + Math.cos(a) * 14, 41 + Math.sin(a) * 14] as const;
						}),
						[32, 5] as const,
					],
				},
				{ kind: "light", pts: ellipse(25.5, 40, 2.8, 6, 18, 8) },
			],
			18,
		),
	// 青すじ（角を 真ん中へ 向けた 4つの かぎ）
	怒: (r) => {
		const piece = ribbon(
			densify(
				[
					[36, 4],
					[41.5, 13],
					[42, 22],
					[51, 22.5],
					[60, 28],
				],
				3,
			),
			8.5,
			r,
			0.45,
			0.45,
		);
		return [0, 90, 180, 270].map((deg) => ({
			kind: "blob" as const,
			color: "#ff3b3b",
			pts: rot(piece, deg),
		}));
	},
	// 大きい 花と 小さい 花
	花: () => [...flower(27, 37, 21, 0.3), ...flower(51, 13, 10.5, 1.1)],
};

/** 1枚（種 seed で ゆらす）。部品ごとに 墨の 影 → 色の 面と 墨の ふち（影と 面は べつに ゆらして ずらす）。 */
const variant = (e: Emote, seed: number, cls: string): string => {
	const r = rand(seed);
	const parts = SHAPES[e](rand(seed * 7 + 3));
	const jit = (pts: readonly P[], a: number): P[] =>
		pts.map(([x, y]) => [x + (r() - 0.5) * 2 * a, y + (r() - 0.5) * 2 * a]);
	const body = parts.map((p) => {
		let s: string;
		if (p.kind === "blob") {
			const shadow = jit(p.pts, 0.9).map(
				([x, y]) => [x + 1.7, y + 1.9] as const,
			);
			s =
				`<path d="${smooth(shadow, true)}" fill="${INK}"/>` +
				`<path d="${smooth(jit(p.pts, 0.8), true)}" fill="${p.color}" stroke="${INK}" stroke-width="${f(2 + r() * 0.7)}" stroke-linejoin="round"/>`;
		} else {
			s = `<path d="${smooth(jit(p.pts, p.kind === "ink" ? 0.6 : 0.4), true)}" fill="${p.kind === "ink" ? INK : LIGHT}"/>`;
		}
		return p.cls ? `<g class="${p.cls}">${s}</g>` : s;
	});
	return `<g class="${cls}" filter="url(#ink-halo)">${body.join("")}</g>`;
};

/** 記号の SVG（2枚の ゆらぎ入り）を 作る。 */
export const buildInkSvg = (e: Emote): string => {
	const base = [...e].reduce((a, c) => a * 31 + (c.codePointAt(0) ?? 0), 7);
	return (
		`<svg class="ink-mark" viewBox="-4 -4 72 72" aria-hidden="true">` +
		`<defs><filter id="ink-halo" x="-25%" y="-25%" width="150%" height="150%">` +
		`<feMorphology in="SourceAlpha" operator="dilate" radius="2.3" result="d"/>` +
		`<feFlood flood-color="${PAPER}"/><feComposite in2="d" operator="in" result="h"/>` +
		`<feMerge><feMergeNode in="h"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` +
		variant(e, base, "v0") +
		variant(e, base + 101, "v1") +
		`</svg>`
	);
};

const cache = new Map<Emote, string>();

/** 記号の SVG（1度 作ったら 使いまわす）。 */
export const inkEmoteSvg = (e: Emote): string => {
	let s = cache.get(e);
	if (!s) {
		s = buildInkSvg(e);
		cache.set(e, s);
	}
	return s;
};

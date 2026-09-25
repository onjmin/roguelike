// 装備（武器・盾）の透過素材の「下描き」を、ドットで描く。
//
// ゲームはこれを直接使わない。scripts/make-equip.mjs がこれで public/sprites/equip/<種類>.png を
// 書き出し、ゲームはその PNG を キリコの歩行グラに重ねる（src/ui/equip.ts）。
// PNG は作者が描き直して差し替えてよい（書き出し直すと上書きされるので、描き直した種類は
// make-equip.mjs の対象から外す）。
//
// 描き方：
// - 武器は「にぎり → つば → 刃（柄）→ 先」を、にぎる手から ある向きへ1ドットずつ並べて描く。
//   向き（まっすぐ上・ななめ・横）を変えても同じ武器に見え、振る動きも作れる。
// - 盾は左腕に つけて持つ。正面・横・うら の3つの見え方を、形と色から組み立てる。
// - にぎる手の位置は、向き（4方向）と足踏みのコマ（2つ）ごとに決めてある（腕のふりに合わせて動く）。
// - キリコの向きで、体の前に出る（over）か うしろに隠れる（under）かが変わる。
//   正面：両手とも前。うしろ向き：両手とも体の向こう。横向き：手前の手は前、奥の手はうしろ。

import type { SpriteDir } from "../core/geom";

// ───────────────── 武器の見た目 ─────────────────

type WeaponLook = {
	/** 刃（柄）の長さ（にぎりから先まで。つばは含まない）。 */
	len: number;
	/** にぎり（柄）の長さ。 */
	grip: number;
	gripColor: string;
	/** つば（無ければ null）。刃に直角に3ドット。 */
	guard: string | null;
	/** 刃の芯・ふち（光）・影。 */
	core: string;
	edge: string;
	shade: string;
	/** 先の色（無ければ刃の芯と同じ）。 */
	tip?: string;
	/** 先を太くする（こん棒・バット）。 */
	head?: number;
	/** マイクスタンドのマイク。 */
	mic?: boolean;
	/** 刃に光る点（星鉄）。 */
	spark?: string;
	/** 竜断ち：つばの宝石。 */
	gem?: string;
};

const WEAPONS: Record<string, WeaponLook> = {
	club: {
		len: 6,
		grip: 2,
		gripColor: "#5a3a1c",
		guard: null,
		core: "#9a6a38",
		edge: "#c8955a",
		shade: "#6b4523",
		head: 2,
	},
	copper: {
		len: 6,
		grip: 2,
		gripColor: "#4a2c18",
		guard: "#8a5a2a",
		core: "#d0803e",
		edge: "#f4b27a",
		shade: "#9a5424",
		tip: "#f4b27a",
	},
	bat: {
		len: 7,
		grip: 2,
		gripColor: "#222228",
		guard: null,
		core: "#b8c0cc",
		edge: "#f2f6fa",
		shade: "#7d8594",
		head: 1,
	},
	wyrmbane: {
		len: 7,
		grip: 2,
		gripColor: "#3a2418",
		guard: "#c8a040",
		core: "#9fc0d8",
		edge: "#e8f6ff",
		shade: "#5d7c94",
		tip: "#e8f6ff",
		gem: "#e0303a",
	},
	steel: {
		len: 7,
		grip: 2,
		gripColor: "#2c2c34",
		guard: "#d8b048",
		core: "#c4ccd6",
		edge: "#ffffff",
		shade: "#808a98",
		tip: "#ffffff",
	},
	starsword: {
		len: 8,
		grip: 2,
		gripColor: "#20183a",
		guard: "#b0a0f0",
		core: "#6a5cd8",
		edge: "#c8c0ff",
		shade: "#3a2e8a",
		tip: "#ffffff",
		spark: "#fff6a0",
	},
	mic: {
		len: 9,
		grip: 1,
		gripColor: "#303038",
		guard: null,
		core: "#9aa2ae",
		edge: "#dde2ea",
		shade: "#5c6470",
		mic: true,
	},
};

// ───────────────── 盾の見た目 ─────────────────

type ShieldLook = {
	/** 形：丸い / 上が平らで下がとがる。 */
	shape: "round" | "heater";
	rim: string;
	face: string;
	/** 面の光（左上）。 */
	light: string;
	/** しるし（中央）。 */
	mark: string;
	/** しるしの形。 */
	markShape: "boss" | "cross" | "scale" | "shine" | "flame" | "star" | "stitch";
	back: string;
};

const SHIELDS: Record<string, ShieldLook> = {
	leather: {
		shape: "round",
		rim: "#5a3a1c",
		face: "#a0703c",
		light: "#c8955a",
		mark: "#e8d0a0",
		markShape: "stitch",
		back: "#4a3020",
	},
	bronze: {
		shape: "round",
		rim: "#7a4a1a",
		face: "#c88a3a",
		light: "#f0c070",
		mark: "#ffe0a0",
		markShape: "boss",
		back: "#5a3a1a",
	},
	scale: {
		shape: "heater",
		rim: "#2a5a30",
		face: "#4c9a50",
		light: "#8ad08a",
		mark: "#2a6a34",
		markShape: "scale",
		back: "#24402a",
	},
	mirror: {
		shape: "round",
		rim: "#8890a0",
		face: "#e4ecf4",
		light: "#ffffff",
		mark: "#a8c8f0",
		markShape: "shine",
		back: "#586070",
	},
	steelsh: {
		shape: "heater",
		rim: "#505864",
		face: "#a4acb8",
		light: "#dde2ea",
		mark: "#6a7280",
		markShape: "cross",
		back: "#3c424c",
	},
	fireward: {
		shape: "heater",
		rim: "#6a1a14",
		face: "#c8342a",
		light: "#f07050",
		mark: "#ffc040",
		markShape: "flame",
		back: "#4a1a14",
	},
	starshield: {
		shape: "heater",
		rim: "#20184a",
		face: "#4a3ca8",
		light: "#8a7ce8",
		mark: "#fff6a0",
		markShape: "star",
		back: "#1c163a",
	},
};

// ───────────────── 手の位置 ─────────────────

type Hold = {
	/** にぎる手のドット（16×16 のマスの中）。 */
	x: number;
	y: number;
	/** 体の前（over）か うしろ（under）か。 */
	layer: "over" | "under";
};

/**
 * 向き・コマごとの手の位置。キリコの歩行グラ（public/sprites/kiriko.png）を拡大して、
 * 腕の先のドットを読み取ったもの。足踏みで腕が上下するので、コマで位置がかわる。
 * weapon は右手、shield は左手。
 */
const HANDS: Record<
	SpriteDir,
	[{ weapon: Hold; shield: Hold }, { weapon: Hold; shield: Hold }]
> = {
	// 正面：右手は見て左、左手は見て右。両方とも体の前
	down: [
		{
			weapon: { x: 3, y: 11, layer: "over" },
			shield: { x: 12, y: 9, layer: "over" },
		},
		{
			weapon: { x: 2, y: 9, layer: "over" },
			shield: { x: 11, y: 11, layer: "over" },
		},
	],
	// うしろ向き：右手は見て右、左手は見て左。どちらも体の向こう
	up: [
		{
			weapon: { x: 13, y: 8, layer: "under" },
			shield: { x: 3, y: 11, layer: "under" },
		},
		{
			weapon: { x: 12, y: 11, layer: "under" },
			shield: { x: 2, y: 9, layer: "under" },
		},
	],
	// 右向き：右手が手前（前）、左手は奥（うしろ）。盾は体の前に構えるので、横から見て前のふちに
	right: [
		{
			weapon: { x: 9, y: 11, layer: "over" },
			shield: { x: 13, y: 10, layer: "under" },
		},
		{
			weapon: { x: 8, y: 11, layer: "over" },
			shield: { x: 13, y: 11, layer: "under" },
		},
	],
	// 左向き：左手が手前（前）、右手は奥（うしろ）
	left: [
		{
			weapon: { x: 13, y: 10, layer: "under" },
			shield: { x: 2, y: 10, layer: "over" },
		},
		{
			weapon: { x: 13, y: 11, layer: "under" },
			shield: { x: 2, y: 11, layer: "over" },
		},
	],
};

/** 振るときの、にぎる手の位置（体の前）。 */
const SWING_HOLD: Record<SpriteDir, Hold> = {
	down: { x: 3, y: 12, layer: "over" },
	up: { x: 13, y: 9, layer: "under" },
	right: { x: 11, y: 11, layer: "over" },
	left: { x: 4, y: 11, layer: "over" },
};

/** 8方向のベクトル（0=上 から時計回り）。 */
const V: readonly [number, number][] = [
	[0, -1],
	[1, -1],
	[1, 0],
	[1, 1],
	[0, 1],
	[-1, 1],
	[-1, 0],
	[-1, -1],
];

/** 向きごとの「前」（8方向の番号）。 */
const FORWARD: Record<SpriteDir, number> = {
	up: 0,
	right: 2,
	down: 4,
	left: 6,
};

/**
 * 武器を持つ角度（8方向の番号）。ふだんは刃を上へ（横向きは前へ ななめ）。
 * 攻撃中は 振りかぶる → ななめ → 前へ の3つの形で振る。
 */
const weaponAngle = (dir: SpriteDir, swing: number): number => {
	const fwd = FORWARD[dir];
	if (swing < 0) {
		// 右向きは手前の手で 前へ ななめに。左向きは奥の手なので まっすぐ立てて、肩の上に先だけ見せる
		if (dir === "right") return 1;
		return 0;
	}
	// 正面・うしろ向きは、刃を 体の外側から 前へ振りおろす
	if (dir === "down") return swing < 0.34 ? 7 : swing < 0.67 ? 6 : 5;
	if (dir === "up") return swing < 0.34 ? 1 : swing < 0.67 ? 1 : 0;
	// 横向き：振りかぶって（上）→ ななめ前 → 前
	const up = 0;
	const diag = dir === "right" ? 1 : 7;
	return swing < 0.34 ? up : swing < 0.67 ? diag : fwd;
};

// ───────────────── ドットを置く ─────────────────

export type Put = (x: number, y: number, c: string) => void;

const drawWeapon = (
	put: Put,
	w: WeaponLook,
	hx: number,
	hy: number,
	a: number,
): void => {
	const [vx, vy] = V[a];
	const diag = vx !== 0 && vy !== 0;
	// つばの向き（刃に直角）
	const px = -vy;
	const py = vx;
	// 刃の「光の側」（左上から光が当たる）と「影の側」のとなり。
	// ななめの刃は 直角のとなり（ななめ）に置くと 市松模様になるので、横か縦のとなりに置いて
	// 2ドット幅の帯にする
	let lx: number;
	let ly: number;
	if (diag) {
		const a1: [number, number] = [-vx, 0];
		const a2: [number, number] = [0, -vy];
		[lx, ly] = a1[0] + a1[1] <= a2[0] + a2[1] ? a1 : a2;
	} else {
		const side = px + py < 0 || (px + py === 0 && px < 0) ? 1 : -1;
		lx = px * side;
		ly = py * side;
	}
	// 影は光の反対（ななめは もう一方のとなり）
	const sx = diag ? (lx === 0 ? vx : 0) : -lx;
	const sy = diag ? (ly === 0 ? vy : 0) : -ly;
	// ななめは1ドットで √2 進むので、すこし短く
	const len = diag ? Math.max(3, Math.round(w.len * 0.75)) : w.len;
	const grip = w.grip;
	// にぎり（手より少しうしろから）
	for (let i = -1; i < grip; i++) put(hx + vx * i, hy + vy * i, w.gripColor);
	let cx = hx + vx * grip;
	let cy = hy + vy * grip;
	// つば（刃に直角に3ドット）
	if (w.guard) {
		put(cx, cy, w.gem ?? w.guard);
		put(cx + px, cy + py, w.guard);
		put(cx - px, cy - py, w.guard);
		cx += vx;
		cy += vy;
	}
	// 刃（柄）
	for (let i = 0; i < len; i++) {
		const x = cx + vx * i;
		const y = cy + vy * i;
		const last = i === len - 1;
		if (w.mic) {
			put(x, y, i % 3 === 0 ? w.edge : w.core);
			continue;
		}
		// 太い先（こん棒・バット）
		const thick = w.head !== undefined && i >= len - (w.head + 2);
		put(x, y, last && w.tip ? w.tip : w.core);
		if (!last || thick) {
			put(x + lx, y + ly, w.edge);
			if (thick) put(x + sx, y + sy, w.shade);
		}
		if (w.spark && i === Math.floor(len / 2)) put(x, y, w.spark);
	}
	// マイクスタンドの先：マイク（黒い玉）
	if (w.mic) {
		const mx = cx + vx * len;
		const my = cy + vy * len;
		for (const [dx, dy] of [
			[0, 0],
			[1, 0],
			[0, 1],
			[1, 1],
		])
			put(mx + dx - (vx < 0 ? 1 : 0), my + dy - (vy < 0 ? 1 : 0), "#1c1c22");
		put(mx - (vx < 0 ? 1 : 0), my - (vy < 0 ? 1 : 0), "#8a8a96");
	}
};

/** 盾（正面）の形。1 = 面、2 = ふち、0 = なし。7×8。 */
const SHAPES: Record<ShieldLook["shape"], string[]> = {
	round: [
		"0022200",
		"0211120",
		"2111112",
		"2111112",
		"2111112",
		"0211120",
		"0022200",
		"0000000",
	],
	heater: [
		"2222222",
		"2111112",
		"2111112",
		"2111112",
		"0211120",
		"0211120",
		"0021200",
		"0002000",
	],
};

const MARKS: Record<ShieldLook["markShape"], [number, number][]> = {
	boss: [[3, 3]],
	cross: [
		[3, 2],
		[2, 3],
		[3, 3],
		[4, 3],
		[3, 4],
	],
	scale: [
		[2, 2],
		[4, 2],
		[3, 3],
		[2, 4],
		[4, 4],
	],
	shine: [
		[4, 2],
		[3, 3],
	],
	flame: [
		[3, 2],
		[2, 3],
		[3, 3],
		[4, 4],
		[3, 4],
	],
	star: [
		[3, 2],
		[2, 3],
		[3, 3],
		[4, 3],
		[3, 4],
	],
	stitch: [
		[1, 3],
		[5, 3],
		[3, 1],
		[3, 5],
	],
};

type ShieldView = "front" | "side" | "back";

const drawShield = (
	put: Put,
	s: ShieldLook,
	hx: number,
	hy: number,
	view: ShieldView,
	flip: boolean,
): void => {
	const shape = SHAPES[s.shape];
	if (view === "side") {
		// 横から：ふちの線と、面の うすい1列
		for (let y = 0; y < 7; y++) {
			if (s.shape === "heater" && y === 6) {
				put(hx, hy - 3 + y, s.rim);
				continue;
			}
			const top = y === 0 || y === 6;
			put(hx, hy - 3 + y, top ? s.rim : s.face);
			put(hx + (flip ? -1 : 1), hy - 3 + y, s.rim);
		}
		return;
	}
	// 正面・うら：手を中心に 7×8
	const ox = hx - 3;
	const oy = hy - 3;
	for (let y = 0; y < 8; y++)
		for (let x = 0; x < 7; x++) {
			const c = shape[y][flip ? 6 - x : x];
			if (c === "0") continue;
			if (c === "2") {
				put(ox + x, oy + y, s.rim);
				continue;
			}
			if (view === "back") {
				put(ox + x, oy + y, s.back);
				continue;
			}
			// 左上に光
			const lit = x + y <= 3;
			put(ox + x, oy + y, lit ? s.light : s.face);
		}
	if (view === "back") {
		// うらの取っ手
		put(hx - 1, hy, "#2a1a10");
		put(hx, hy, "#2a1a10");
		put(hx + 1, hy, "#2a1a10");
		return;
	}
	for (const [mx, my] of MARKS[s.markShape])
		put(ox + (flip ? 6 - mx : mx), oy + my, s.mark);
};

// ───────────────── まとめて描く ─────────────────

export type EquipLook = { weapon: string | null; shield: string | null };

/**
 * 装備の layer の側を、キリコのマスを (0,0)〜(15,15) とする座標で put に描く
 * （マスの外へ はみ出してよい）。swing は攻撃の進み（0〜1。攻撃していなければ −1）。
 */
export const paintEquip = (
	put: Put,
	look: EquipLook,
	dir: SpriteDir,
	frame: number,
	layer: "over" | "under",
	swing = -1,
): void => {
	if (!look.weapon && !look.shield) return;
	const hands = HANDS[dir][frame % 2];
	// 攻撃中は、武器の手を ふる向きへ1ドット寄せる
	const w = look.weapon ? WEAPONS[look.weapon] : undefined;
	if (w) {
		let hold = hands.weapon;
		// 振るときは、にぎる手を体の前へ出す（顔の前を刃が横切らないように）
		if (swing >= 0) hold = SWING_HOLD[dir];
		if (hold.layer === layer) {
			drawWeapon(put, w, hold.x, hold.y, weaponAngle(dir, swing));
			// 体の前で持つときは、にぎりの上に手を描く（にぎっているように見せる。
			// うしろ側は キリコの絵の手が上に重なる）
			if (layer === "over") {
				put(hold.x, hold.y, "#dcccc5");
				put(hold.x, hold.y + 1, "#926855");
			}
		}
	}
	const s = look.shield ? SHIELDS[look.shield] : undefined;
	if (s && hands.shield.layer === layer) {
		const view: ShieldView =
			dir === "down" ? "front" : dir === "up" ? "back" : "side";
		drawShield(put, s, hands.shield.x, hands.shield.y, view, dir === "left");
	}
};

/** 見た目の決まっている装備か（プレビュー・検査用）。 */
export const WEAPON_KINDS = Object.keys(WEAPONS);
export const SHIELD_KINDS = Object.keys(SHIELDS);

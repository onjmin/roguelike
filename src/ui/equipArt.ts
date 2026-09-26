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
// - 盾（板）は左手で かかげて持つ。正面・横・うら の3つの見え方を、ドットの型と色から組み立てる。
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

// ───────────────── 盾（板）の見た目 ─────────────────
//
// 盾は「板」（2ch の板＝掲示板の木の板）。縦長の板を 看板のように かかげて持つ。
// 形は7種とも同じ（上の角だけ丸い長方形・四隅に釘・上のほうに小さな名札）で、色味だけ変える。

type ShieldLook = {
	/** ふち（1ドットの輪郭）。釘が目立つよう、釘より明るくする。 */
	rim: string;
	/** 板の面。 */
	face: string;
	/** 縦の木目（鉄板は筋）。 */
	grain: string;
	/** 四隅の釘（鉄板は明るいリベット）。 */
	nail: string;
	/** 名札。 */
	plate: string;
	/** うら。 */
	back: string;
	/** うらの横木（取っ手）。 */
	batten: string;
	/** 左上の光る点（銀・金の板だけ）。 */
	glint?: string;
};

const SHIELDS: Record<string, ShieldLook> = {
	// ダイエット板：うすくて白っぽい木
	leather: {
		rim: "#8a6a40",
		face: "#e2cc9c",
		grain: "#c4a870",
		nail: "#2e1c10",
		plate: "#fffaf0",
		back: "#c8ac7c",
		batten: "#7a5c38",
	},
	// 雑談板：ふつうの木の板
	bronze: {
		rim: "#7a4e24",
		face: "#c8955a",
		grain: "#a8742e",
		nail: "#1e100a",
		plate: "#f4e6c0",
		back: "#a0703c",
		batten: "#5a3a1c",
	},
	// スルー板：うすい灰緑
	scale: {
		rim: "#5a6c5c",
		face: "#a8bca4",
		grain: "#8ca488",
		nail: "#1c2620",
		plate: "#f4e6c0",
		back: "#8aa088",
		batten: "#46564a",
	},
	// 永久保存板：銀
	mirror: {
		rim: "#6c7484",
		face: "#cdd4de",
		grain: "#a8b2c0",
		nail: "#22262e",
		plate: "#f4e6c0",
		back: "#9aa2b0",
		batten: "#5c6474",
		glint: "#ffffff",
	},
	// 鉄板：灰の鉄板に 明るいリベット
	steelsh: {
		rim: "#2e3238",
		face: "#848c96",
		grain: "#6c747e",
		nail: "#dde2ea",
		plate: "#f4e6c0",
		back: "#6a727c",
		batten: "#2e3238",
	},
	// 火消し板：赤茶
	fireward: {
		rim: "#642414",
		face: "#a8482c",
		grain: "#88361e",
		nail: "#1a0804",
		plate: "#f4e6c0",
		back: "#8a3a22",
		batten: "#4a1a10",
	},
	// ネ申板：金
	starshield: {
		rim: "#8a6010",
		face: "#e8b834",
		grain: "#c8901c",
		nail: "#2e1c02",
		plate: "#fff8e0",
		back: "#c89a28",
		batten: "#6a4a10",
		glint: "#ffffff",
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
		// 右向きは手前の手で 前へ ななめに。左向きは奥の手なので、背中の うしろへ ななめに 立てて
		// 刃が 体から はみ出して 見えるように（まっすぐ 立てると 頭と 体に かくれて 消える）
		if (dir === "right") return 1;
		if (dir === "left") return 1;
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
	// ななめは1ドットで √2 進むので、刃も にぎりも 1/√2 にして、まっすぐのときと同じ長さに見せる
	const len = diag ? Math.max(3, Math.round(w.len / Math.SQRT2)) : w.len;
	const grip = diag ? Math.max(1, Math.round(w.grip / Math.SQRT2)) : w.grip;
	// にぎり（まっすぐのときは 手より1ドットうしろから。ななめは手から）
	for (let i = diag ? 0 : -1; i < grip; i++)
		put(hx + vx * i, hy + vy * i, w.gripColor);
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

type ShieldView = "front" | "side" | "back";

/**
 * 板の形（見え方ごと）。rows の1文字が1ドット：
 * . なし / o ふち（名札の下の影にも使う）/ w 面 / g 木目 / n 釘 /
 * * 光る点（銀・金だけ。ほかは面）/ p 名札 / b うら / k うらの横木。
 * (hx, hy) は にぎる手が来るドット。板は顔にかからないよう、手から体の外側へ のばす。
 */
const BOARDS: Record<ShieldView, { rows: string[]; hx: number; hy: number }> = {
	// 正面：6×8。手は左から2列目（体の側）、板は体の外（見て右）へ
	front: {
		rows: [
			".oooo.",
			"onwwno",
			"owppwo",
			"o*oogo",
			"owgwgo",
			"owgwwo",
			"onwwno",
			"oooooo",
		],
		hx: 1,
		hy: 3,
	},
	// 横：5×8。面を ななめに見て、少し細く（右向きの形。左向きは左右を返す）。手は体の側から2列目
	side: {
		rows: [
			".ooo.",
			"onwno",
			"owpwo",
			"o*owo",
			"owgwo",
			"owgwo",
			"onwno",
			"ooooo",
		],
		hx: 1,
		hy: 3,
	},
	// うら：6×8。手は横木をにぎる。板は体の外（見て左）へ
	back: {
		rows: [
			".oooo.",
			"onbbno",
			"obbbbo",
			"okkkko",
			"obbbbo",
			"obbbbo",
			"onbbno",
			"oooooo",
		],
		hx: 4,
		hy: 3,
	},
};

const boardColor = (s: ShieldLook, c: string): string | null => {
	switch (c) {
		case "o":
			return s.rim;
		case "w":
			return s.face;
		case "g":
			return s.grain;
		case "n":
			return s.nail;
		case "*":
			return s.glint ?? s.face;
		case "p":
			return s.plate;
		case "b":
			return s.back;
		case "k":
			return s.batten;
		default:
			return null;
	}
};

const drawShield = (
	put: Put,
	s: ShieldLook,
	hx: number,
	hy: number,
	view: ShieldView,
	flip: boolean,
): void => {
	const b = BOARDS[view];
	const w = b.rows[0].length;
	const ox = hx - (flip ? w - 1 - b.hx : b.hx);
	const oy = hy - b.hy;
	for (let y = 0; y < b.rows.length; y++)
		for (let x = 0; x < w; x++) {
			const c = boardColor(s, b.rows[y][flip ? w - 1 - x : x]);
			if (c) put(ox + x, oy + y, c);
		}
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

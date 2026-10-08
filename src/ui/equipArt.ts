// 装備（武器・盾）の透過素材の「下描き」を、ドットで描く。
//
// ゲームはこれを直接使わない。scripts/make-equip.mjs がこれで public/sprites/equip/<種類>.png を
// 書き出し、ゲームはその PNG を キリコの歩行グラに重ねる（src/ui/equip.ts）。
// PNG は作者が描き直して差し替えてよい（書き出し直すと上書きされるので、描き直した種類は
// make-equip.mjs の対象から外す）。
//
// 描き方：
// - 武器は「まっすぐ上を向いた絵」と「右ななめ上を向いた絵」の2枚をドットで描き、90度ずつ回して
//   8方向にする（回してもドットが崩れない）。まわりに暗いふちを自動でつけて、床の上でも形が立つようにする。
// - 振るときは、刃の先が通った跡に 白い弧（振りの跡）を残す。
// - 盾（板）は左手で かかげて持つ。正面・横・うら の3つの見え方を、ドットの型と色から組み立てる。
//   板ごとに 面のまん中の 3×3 に しるし（星・水・十字の帯など）を入れて見分ける。
// - にぎる手の位置は、向き（4方向）と足踏みのコマ（2つ）ごとに決めてある（腕のふりに合わせて動く）。
// - キリコの向きで、体の前に出る（over）か うしろに隠れる（under）かが変わる。
//   正面：両手とも前。うしろ向き：両手とも体の向こう。横向き：手前の手は前、奥の手はうしろ。

import type { SpriteDir } from "../core/geom";

// ───────────────── 武器の見た目 ─────────────────

/** 1枚の絵。rows の1文字が1ドット（'.' は透明、ほかは pal の色）。(ax, ay) は にぎる手のドット。 */
type WeaponPic = { rows: string[]; ax: number; ay: number };

type WeaponLook = {
	pal: Record<string, string>;
	/** まわりのふち。 */
	ink: string;
	/** ふちをつけない文字（刃のまわりに浮かぶ光）。 */
	glow?: string;
	/** まっすぐ上を向いた絵。 */
	up: WeaponPic;
	/**
	 * 右ななめ上を向いた絵。ななめの1ドットは √2 ぶん進むので、手から先・手から下のドット数は
	 * まっすぐの絵の 1/√2（四捨五入）にする（10 → 7、8 → 6、2 → 1）。そうしないと振ると伸び縮みして見える。
	 */
	diag: WeaponPic;
	/** 振りの跡の色（外・内）。 */
	trail: [string, string];
};

// 文字の意味（だいたい共通）：t 刃の先 / h 刃の光の側 / c 芯 / s 刃の影の側 / q つば / Q つばの光 /
// g にぎり / G にぎりの光 / p 柄頭 / e 宝石 / + 浮かぶ光
const WEAPONS: Record<string, WeaponLook> = {
	// ぬるぽ棒：先の太い 木の こん棒。こぶ（k）つき
	club: {
		pal: {
			h: "#e6b47a",
			c: "#b07a40",
			s: "#74481f",
			k: "#4e2e12",
			g: "#5e3c1e",
			G: "#9c7048",
		},
		ink: "#24140a",
		up: {
			rows: [
				".h.",
				"hcs",
				"hks",
				"hcs",
				"hcs",
				".cs",
				".c.",
				".c.",
				".g.",
				".G.",
				".g.",
			],
			ax: 1,
			ay: 8,
		},
		diag: {
			rows: [
				".......hc",
				"......hcs",
				".....hks.",
				"....hcs..",
				"....cs...",
				"...c.....",
				"..g......",
				".G.......",
			],
			ax: 2,
			ay: 6,
		},
		trail: ["#fff4dc", "#d8b888"],
	},
	// 名無しの剣：ありふれた 鉄の剣。茶色の にぎりに 真鍮の つば
	copper: {
		pal: {
			t: "#ffffff",
			h: "#e4e8ee",
			s: "#8a929e",
			q: "#9a6e2e",
			Q: "#d8b060",
			g: "#5a3a20",
			G: "#8a6038",
			p: "#b08840",
		},
		ink: "#1a1c24",
		up: {
			rows: [
				".t..",
				".hs.",
				".hs.",
				".hs.",
				".hs.",
				".hs.",
				".hs.",
				"qQQq",
				".gG.",
				".gG.",
				".pp.",
			],
			ax: 1,
			ay: 8,
		},
		diag: {
			rows: [
				".........t",
				"........hs",
				".......hs.",
				"......hs..",
				"....qhs...",
				"....QQ....",
				"...g..q...",
				"..p.......",
			],
			ax: 3,
			ay: 6,
		},
		trail: ["#ffffff", "#c8d0dc"],
	},
	// ガッのバット：銀の 金属バット。青い帯・黒い テープ・こぶ（グリップエンド）
	bat: {
		pal: {
			h: "#ffffff",
			c: "#c8d0dc",
			s: "#808a9a",
			b: "#3a6ad0",
			g: "#1e1e24",
			G: "#4a4a56",
			p: "#2a2a30",
		},
		ink: "#10141c",
		up: {
			rows: [
				".h.",
				"hcs",
				"hcs",
				"hcs",
				"bbb",
				"hcs",
				".c.",
				".c.",
				".c.",
				".g.",
				".G.",
				".g.",
				"ppp",
			],
			ax: 1,
			ay: 9,
		},
		diag: {
			rows: [
				"........hc",
				".......hcs",
				"......bbb.",
				".....hcs..",
				".....cs...",
				"....c.....",
				"...g......",
				".pG.......",
				".pp.......",
			],
			ax: 3,
			ay: 6,
		},
		trail: ["#ffffff", "#b8ccf0"],
	},
	// ワイ断ちの剣：竜（ワイバーン）を断つ 幅広の剣。翼の形の 金の つばに 赤い 宝石
	wyrmbane: {
		pal: {
			t: "#ffffff",
			h: "#e8f6ff",
			c: "#a8c4d8",
			s: "#5a7890",
			q: "#a07820",
			Q: "#e8c860",
			e: "#e0303a",
			g: "#5a1a1a",
			G: "#8a3030",
			p: "#e8c860",
		},
		ink: "#141018",
		up: {
			rows: [
				"...t...",
				"..hcs..",
				"..hcs..",
				"..hcs..",
				"..hcs..",
				"..hcs..",
				"..hcs..",
				"..hcs..",
				"qQQeQQq",
				"q..g..q",
				"...g...",
				"...G...",
				"...p...",
			],
			ax: 3,
			ay: 10,
		},
		diag: {
			rows: [
				"........t...",
				".......hcs..",
				"......hcs...",
				".....hcs....",
				"..q.hcs.....",
				"...QQ.......",
				"...ge.......",
				"..g..Q......",
				".p....q.....",
			],
			ax: 2,
			ay: 7,
		},
		trail: ["#ffffff", "#ffb0b0"],
	},
	// コテハンの剣：名無しより一段上の 長剣。先の反った 金の つば・青い にぎり
	steel: {
		pal: {
			t: "#ffffff",
			h: "#f4f8fc",
			s: "#8a94a4",
			q: "#b07c10",
			Q: "#ffd860",
			g: "#2a3a78",
			G: "#5070c0",
			p: "#ffd860",
		},
		ink: "#141824",
		up: {
			rows: [
				"..t...",
				"..hs..",
				"..hs..",
				"..hs..",
				"..hs..",
				"..hs..",
				"..hs..",
				"..hs..",
				"Q.hs.Q",
				"qQQQQq",
				"..gG..",
				"..gG..",
				"..pp..",
			],
			ax: 2,
			ay: 10,
		},
		diag: {
			rows: [
				".........t.",
				"........hs.",
				".......hs..",
				"......hs...",
				".....hs....",
				"..Qqhs.....",
				"...QQ......",
				"..g.Qq.....",
				".p...Q.....",
			],
			ax: 2,
			ay: 7,
		},
		trail: ["#ffffff", "#c8d8ff"],
	},
	// 降臨の剣：空から 降臨した 剣。光る 刃・星の 宝石・まわりに 浮かぶ 光
	starsword: {
		pal: {
			t: "#ffffff",
			h: "#f4f0ff",
			s: "#8a78f0",
			"*": "#fff6a0",
			q: "#b08ae0",
			Q: "#e8dcff",
			e: "#ffe040",
			g: "#2a2050",
			G: "#5a48a0",
			p: "#ffe040",
			"+": "#fff6a0",
		},
		ink: "#140e30",
		glow: "+",
		up: {
			rows: [
				"..t...",
				"..hs.+",
				"+.hs..",
				"..h*..",
				"..hs..",
				"..hs..",
				"..hs.+",
				"..hs..",
				"Q.hs.Q",
				"qQeeQq",
				"..gG..",
				"..gG..",
				"..pp..",
			],
			ax: 2,
			ay: 10,
		},
		diag: {
			rows: [
				".....+...t.",
				"........hs.",
				".......h*..",
				"......hs..+",
				"..+..hs....",
				"..Qqhs.....",
				"...Qe......",
				"..g.Qq.....",
				".p...Q.....",
			],
			ax: 2,
			ay: 7,
		},
		trail: ["#fff6c0", "#c0b0ff"],
	},
	// ネ申マイク：スタンドごと 振る マイク。黒い 網の 頭・銀の 帯・三脚の 足
	mic: {
		pal: {
			M: "#b4bcc8",
			m: "#5a6272",
			w: "#ffffff",
			r: "#c8ccd4",
			h: "#d4dae4",
			k: "#2e2e36",
		},
		ink: "#0e0e14",
		up: {
			rows: [
				".M.",
				"wmM",
				"MmM",
				"MmM",
				".M.",
				".r.",
				".h.",
				".h.",
				".h.",
				".h.",
				".h.",
				".h.",
				".k.",
				"k.k",
			],
			ax: 1,
			ay: 10,
		},
		diag: {
			rows: [
				".........wM.",
				"........MmM.",
				"........mM..",
				".......r....",
				"......h.....",
				".....h......",
				"....h.......",
				"...h........",
				"..h.........",
				".k.k........",
			],
			ax: 3,
			ay: 7,
		},
		trail: ["#ffffff", "#b8b8c8"],
	},
};

// ───────────────── 盾（板）の見た目 ─────────────────
//
// 盾は「板」（2ch の板＝掲示板の木の板）。縦長の板を 看板のように かかげて持つ。
// 形は7種とも同じ（角の丸い長方形・四隅に釘・上に名札・まん中に しるし）で、色と しるしを変える。

type ShieldLook = {
	/** ふち（板の輪郭）。 */
	rim: string;
	/** 面の 光の側（左）・面・影の側（右と下）。 */
	light: string;
	face: string;
	shade: string;
	/** 縦の木目（鉄板は筋）。 */
	grain: string;
	/** 四隅の釘（鉄板は明るいリベット）。 */
	nail: string;
	/** 名札と、名札の字。 */
	plate: string;
	text: string;
	/** うら・うらの横木（取っ手）。 */
	back: string;
	batten: string;
	/**
	 * 面のまん中の しるし（3×3）。'.' 面 / g 木目 / E しるし / e しるしの光 / * 光る点。
	 * 無ければ木目。
	 */
	mark?: [string, string, string];
	emblem?: string;
	emblem2?: string;
	/** 光る点（銀・金・鉄の板）。 */
	glint?: string;
};

const GRAIN: [string, string, string] = ["g.g", "g.g", "..g"];

const SHIELDS: Record<string, ShieldLook> = {
	// ダイエット板：うすくて白っぽい木。しるしは 巻き尺の 目盛り
	leather: {
		rim: "#6a4c2a",
		light: "#f8ecc8",
		face: "#e2cc9c",
		shade: "#bc9e6c",
		grain: "#c8ae7a",
		nail: "#3a2414",
		plate: "#fffaf0",
		text: "#9a8a70",
		back: "#c8ac7c",
		batten: "#7a5c38",
		mark: ["EEE", "E.e", "E.."],
		emblem: "#e8a040",
		emblem2: "#5a3a1c",
	},
	// 雑談板：ふつうの木の板
	bronze: {
		rim: "#56341a",
		light: "#e6b47a",
		face: "#c8955a",
		shade: "#9a6834",
		grain: "#a8742e",
		nail: "#1e100a",
		plate: "#f4e6c0",
		text: "#7a5a38",
		back: "#a0703c",
		batten: "#5a3a1c",
	},
	// スルー板：うすい灰緑。しるしは ✕（スルー）
	scale: {
		rim: "#36463a",
		light: "#d4e6d0",
		face: "#a8bca4",
		shade: "#7a9276",
		grain: "#8ca488",
		nail: "#1c2620",
		plate: "#f4f0e0",
		text: "#6a7a6a",
		back: "#8aa088",
		batten: "#46564a",
		mark: ["E.E", ".E.", "E.E"],
		emblem: "#4a5e4c",
	},
	// 永久保存板：銀。面を ななめに 光が 走る
	mirror: {
		rim: "#4e5666",
		light: "#ffffff",
		face: "#cdd4de",
		shade: "#98a2b2",
		grain: "#b4bcc8",
		nail: "#22262e",
		plate: "#f4e6c0",
		text: "#8a7a5a",
		back: "#9aa2b0",
		batten: "#5c6474",
		mark: ["*..", ".*.", "..*"],
		glint: "#ffffff",
	},
	// 鉄板：灰の鉄板。十字の帯に 明るいリベット
	steelsh: {
		rim: "#22262c",
		light: "#b4bcc6",
		face: "#848c96",
		shade: "#5c646e",
		grain: "#6c747e",
		nail: "#e8ecf2",
		plate: "#d8dce2",
		text: "#4a525c",
		back: "#6a727c",
		batten: "#2e3238",
		mark: [".E.", "E*E", ".E."],
		emblem: "#5c646e",
		glint: "#f4f8fc",
	},
	// 火消し板：赤茶。しるしは 水の しずく
	fireward: {
		rim: "#4a140a",
		light: "#d8704e",
		face: "#a8482c",
		shade: "#7a2c18",
		grain: "#8c3820",
		nail: "#1a0804",
		plate: "#f4e6c0",
		text: "#8a3a22",
		back: "#8a3a22",
		batten: "#4a1a10",
		mark: [".E.", "EeE", ".E."],
		emblem: "#6ac4ff",
		emblem2: "#e8f8ff",
	},
	// ネ申板：金。しるしは 星
	starshield: {
		rim: "#6a4808",
		light: "#fff0a0",
		face: "#e8b834",
		shade: "#b08018",
		grain: "#c8901c",
		nail: "#3a2402",
		plate: "#fff8e0",
		text: "#a07818",
		back: "#c89a28",
		batten: "#6a4a10",
		mark: [".e.", "EEE", "E.E"],
		emblem: "#fff4c0",
		emblem2: "#ffffff",
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
 * 向き・コマごとの手の位置。キリコの歩行グラ（KIRIKO_WALK）を拡大して、
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
	// 左向き：歩行グラが右向きを左右に返した絵なので、持ち方も右向きを左右に返す（x → 15 − x）。
	// 武器は手前の手で前へ、盾は奥の手で体の前のふちに
	left: [
		{
			weapon: { x: 6, y: 11, layer: "over" },
			shield: { x: 2, y: 10, layer: "under" },
		},
		{
			weapon: { x: 7, y: 11, layer: "over" },
			shield: { x: 2, y: 11, layer: "under" },
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

/** 向きごとの「前」（8方向の番号。0=上 から時計回り）。 */
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
		// 横向きは手前の手で 前へ ななめに（左向きは右向きを左右に返す）
		if (dir === "right") return 1;
		if (dir === "left") return 7;
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

/** 向き a（8方向の番号）の武器の絵のドットを、にぎる手からの相対位置で返す。 */
const weaponCells = (
	w: WeaponLook,
	a: number,
): { dx: number; dy: number; ch: string }[] => {
	const pic = a % 2 ? w.diag : w.up;
	const turns = Math.floor(a / 2);
	const out: { dx: number; dy: number; ch: string }[] = [];
	pic.rows.forEach((row, y) => {
		for (let x = 0; x < row.length; x++) {
			const ch = row[x];
			if (ch === ".") continue;
			let dx = x - pic.ax;
			let dy = y - pic.ay;
			// 右へ90度ずつ回す
			for (let i = 0; i < turns; i++) [dx, dy] = [-dy, dx];
			out.push({ dx, dy, ch });
		}
	});
	return out;
};

const drawWeapon = (
	put: Put,
	w: WeaponLook,
	hx: number,
	hy: number,
	a: number,
): void => {
	const cells = weaponCells(w, a);
	const solid = new Set(
		cells.filter((c) => c.ch !== w.glow).map((c) => `${c.dx},${c.dy}`),
	);
	// ふち：絵のドットの上下左右で、空いている所
	const ink = new Set<string>();
	for (const k of solid) {
		const [x, y] = k.split(",").map(Number);
		for (const [ox, oy] of [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
		]) {
			const n = `${x + ox},${y + oy}`;
			if (!solid.has(n)) ink.add(n);
		}
	}
	for (const k of ink) {
		const [x, y] = k.split(",").map(Number);
		put(hx + x, hy + y, w.ink);
	}
	for (const c of cells) put(hx + c.dx, hy + c.dy, w.pal[c.ch]);
};

/**
 * 振りの跡：刃の先が 向き a0 から a1 へ通った弧を、白く残す（外の1列と、内の1列）。
 * 刃のドットや ふちには 重ねない（武器の前に描くので、あとから上書きされる）。
 */
const drawTrail = (
	put: Put,
	w: WeaponLook,
	hx: number,
	hy: number,
	a0: number,
	a1: number,
): void => {
	if (a0 === a1) return;
	// 遠回りしないよう、差を −4〜4 に
	let d = a1 - a0;
	if (d > 4) d -= 8;
	if (d < -4) d += 8;
	const r = w.up.ay;
	const seen = new Set<string>();
	const steps = 24;
	// 弧の終わり（いまの刃）の手前で止める
	for (let i = 0; i <= steps * 0.85; i++) {
		const t = ((a0 + (d * i) / steps) * Math.PI) / 4;
		for (const [rr, col] of [
			[r, w.trail[0]],
			[r - 1, w.trail[1]],
			[r - 2, w.trail[1]],
		] as [number, string][]) {
			// 跡は 先のほうだけ（根もとは細く消える）
			if (rr === r - 2 && i < steps * 0.4) continue;
			const x = Math.round(Math.sin(t) * rr);
			const y = Math.round(-Math.cos(t) * rr);
			const k = `${x},${y}`;
			if (seen.has(k)) continue;
			seen.add(k);
			put(hx + x, hy + y, col);
		}
	}
};

type ShieldView = "front" | "side" | "back";

/**
 * 板の形（見え方ごと）。rows の1文字が1ドット：
 * . なし / o ふち / l 面の光 / w 面 / d 面の影 / n 釘 / p 名札 / P 名札の字 /
 * 1〜9 しるし（左上から 1,2,3 / 4,5,6 / 7,8,9）/ b うら / k うらの横木。
 * (hx, hy) は にぎる手が来るドット。板は顔にかからないよう、手から体の外側へ のばす。
 */
const BOARDS: Record<ShieldView, { rows: string[]; hx: number; hy: number }> = {
	// 正面：7×9。手は左から2列目（体の側）、板は体の外（見て右）へ
	front: {
		rows: [
			".ooooo.",
			"onlwwno",
			"olpPpdo",
			"olwwwdo",
			"ol123do",
			"ol456do",
			"ol789do",
			"ondddno",
			".ooooo.",
		],
		hx: 1,
		hy: 3,
	},
	// 横：5×9。面を ななめに見て、細く（右向きの形。左向きは左右を返す）。手は体の側から2列目
	side: {
		rows: [
			".ooo.",
			"onlno",
			"olPdo",
			"olwdo",
			"ol2do",
			"ol5do",
			"ol8do",
			"ondno",
			".ooo.",
		],
		hx: 1,
		hy: 3,
	},
	// うら：7×9。手は横木をにぎる。板は体の外（見て左）へ
	back: {
		rows: [
			".ooooo.",
			"onbbbno",
			"obbbbbo",
			"okkkkko",
			"obbbbbo",
			"obbbbbo",
			"okkkkko",
			"onbbbno",
			".ooooo.",
		],
		hx: 5,
		hy: 3,
	},
};

const boardColor = (s: ShieldLook, c: string): string | null => {
	if (c >= "1" && c <= "9") {
		const i = Number(c) - 1;
		const m = (s.mark ?? GRAIN)[Math.floor(i / 3)][i % 3];
		if (m === "g") return s.grain;
		if (m === "E") return s.emblem ?? s.grain;
		if (m === "e") return s.emblem2 ?? s.emblem ?? s.grain;
		if (m === "*") return s.glint ?? s.face;
		return s.face;
	}
	switch (c) {
		case "o":
			return s.rim;
		case "l":
			return s.light;
		case "w":
			return s.face;
		case "d":
			return s.shade;
		case "n":
			return s.nail;
		case "p":
			return s.plate;
		case "P":
			return s.text;
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
	// 盾を先に、武器をその上に（同じ側に重なるとき、武器が前）
	const s = look.shield ? SHIELDS[look.shield] : undefined;
	if (s && hands.shield.layer === layer) {
		const view: ShieldView =
			dir === "down" ? "front" : dir === "up" ? "back" : "side";
		drawShield(put, s, hands.shield.x, hands.shield.y, view, dir === "left");
	}
	const w = look.weapon ? WEAPONS[look.weapon] : undefined;
	if (w) {
		let hold = hands.weapon;
		// 振るときは、にぎる手を体の前へ出す（顔の前を刃が横切らないように）
		if (swing >= 0) hold = SWING_HOLD[dir];
		if (hold.layer === layer) {
			const a = weaponAngle(dir, swing);
			// 振りの跡（1つ前の形の向きから いまの向きへ）
			if (swing >= 0.34)
				drawTrail(put, w, hold.x, hold.y, weaponAngle(dir, swing - 0.33), a);
			drawWeapon(put, w, hold.x, hold.y, a);
			// 体の前で持つときは、にぎりの上に手を描く（にぎっているように見せる。
			// うしろ側は キリコの絵の手が上に重なる）
			if (layer === "over") {
				put(hold.x, hold.y, "#dcccc5");
				put(hold.x, hold.y + 1, "#926855");
			}
		}
	}
};

/** 見た目の決まっている装備か（プレビュー・検査用）。 */
export const WEAPON_KINDS = Object.keys(WEAPONS);
export const SHIELD_KINDS = Object.keys(SHIELDS);

// ブラマイ（ブランチマイニング）の 決まり：ホシュクラの ブラマイ場の 縦穴から 入る 横から 見た 地下（ui/sabaMine.ts の 板）。
// 十字で 掘る（掘れたら そこへ 進む）・A で 足もとに 松明・松明の 光（2マス）の 外を 歩くと 匠が うしろに 湧く・
// 足もとを 掘る（直下掘り）と 下が 空いていれば 落ちる（溶岩なら おしまい・ダイヤも 沈む）・つるはしは 48回。
// 見えて いない 溶岩の となりを 掘りぬくと 溶岩が あふれる：次の 1手で その マスから 出なければ のまれる
// （見ずに 掘り進む 人ほど あぶない。松明で 先を 照らせば 見える）。板は あふれた ところで 少し 止まり、
// 長押しの くりかえしも 押しなおすまで 止める（gateAct。のまれるのは 見てから 押した 手だけ）。
// 見える マス：掘った 空気の となり・松明の 光の 中・キリコの まわり 8マス（洞窟は つながって ひと目で）。
// ダイヤの 数だけ 記録する（kiriko-roguelike/saba の mine.best）。冒険の 乱数・強さ・道具には ふれない
// （板は Math.random、試験は seeded を 渡す）。DOM・保存・絵は ここに 書かない（試験が Node で 読む）。

export const MINE = {
	/** 横の マス（画面は VIEW_W マス。キリコに ついて 横に 動く）。 */
	W: 40,
	/** 縦の マス（0〜6 を 掘る。7 は 岩盤）。 */
	H: 8,
	VIEW_W: 15,
	/** つるはしの 回数（掘れた 数）。 */
	PICK: 48,
	/** はじめの 松明。 */
	TORCHES: 4,
	/** 石炭 1つで ふえる 松明。 */
	COAL_TORCH: 2,
	/** 松明の 光の 半径（たて・よこ・ななめの 大きい方）。 */
	LIGHT: 2,
	/** 暗い ところで この 手数 つづくと 匠が 湧く。 */
	DARK_LIMIT: 8,
	/** 匠が 湧いてから 爆ぜるまでの 手数。 */
	FUSE: 3,
	/** 匠から この マス数（たて＋よこ）はなれると あきらめる。 */
	ESCAPE: 3,
	/** 鉱石を 掘る 手数（石は 1）。 */
	ORE_HITS: 2,
	/** 溶岩だまりが 2段（段5〜6）に なる 割合。 */
	DEEP_POOL: 0.6,
} as const;

export const CELL = {
	AIR: 0,
	STONE: 1,
	COAL: 2,
	DIA: 3,
	LAVA: 4,
	BEDROCK: 5,
} as const;
export type CellKind = (typeof CELL)[keyof typeof CELL];

export type MineDir = "up" | "down" | "left" | "right";
export type MineAct = MineDir | "torch" | "quit";
export type MineEnd = "broke" | "quit" | "takumi" | "lava";
export type MineEvent =
	| "move"
	| "hit"
	| "breakStone"
	| "breakOre"
	| "coal"
	| "dia"
	| "lavaSeen"
	| "bedrock"
	| "edge"
	| "torch"
	| "noTorch"
	| "torchHere"
	| "fall"
	| "spill"
	| "spillSafe"
	| "lavaDeath"
	| "takumiSpawn"
	| "takumiGone"
	| "takumiBoom"
	| "broke"
	| "worn"
	| "quit";

export type MineState = {
	g: Uint8Array;
	/** 中身が 見えた マス。 */
	seen: Uint8Array;
	/** 掘りかけ（ひび）。 */
	hits: Uint8Array;
	torch: Uint8Array;
	torchList: [number, number][];
	x: number;
	y: number;
	dir: MineDir;
	pick: number;
	torches: number;
	dia: number;
	coal: number;
	/** 暗い ところに いた 手数。 */
	dark: number;
	takumi: { x: number; y: number; fuse: number } | null;
	/** 溶岩が あふれて くる マス（次の 1手で 出なければ のまれる）。 */
	spill: { x: number; y: number } | null;
	over: MineEnd | null;
	/** 手数（動いた・掘った・松明）。 */
	steps: number;
};

export type Rand = () => number;

/** 試験用の 決まった 乱数（mulberry32）。 */
export const seeded =
	(seed: number): Rand =>
	() => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};

const key = (x: number, y: number): number => y * MINE.W + x;
const inside = (x: number, y: number): boolean =>
	x >= 0 && x < MINE.W && y >= 0 && y < MINE.H;
export const DV: Record<MineDir, readonly [number, number]> = {
	up: [0, -1],
	down: [0, 1],
	left: [-1, 0],
	right: [1, 0],
};

/** はじめの 状態（縦穴 x=1, y=0〜2 に キリコ。上に 松明 1本）。 */
const start = (g: Uint8Array): MineState => {
	const n = MINE.W * MINE.H;
	const st: MineState = {
		g,
		seen: new Uint8Array(n),
		hits: new Uint8Array(n),
		torch: new Uint8Array(n),
		torchList: [],
		x: 1,
		y: 2,
		dir: "right",
		pick: MINE.PICK,
		torches: MINE.TORCHES,
		dia: 0,
		coal: 0,
		dark: 0,
		takumi: null,
		spill: null,
		over: null,
		steps: 0,
	};
	st.torch[key(1, 1)] = 1;
	st.torchList.push([1, 1]);
	reveal(st);
	return st;
};

/**
 * 地下を 作る。洞窟 3つ（3〜5マス × 床まで。35% で 床が 溶岩）・溶岩だまり 3つ（いちばん 下の 段。2〜4マス。
 * DEEP_POOL の 割合で その 上の 段5 も 溶岩）・石炭 9本（段0〜4。2〜4マス）・ダイヤ 6本（段4〜6。1〜3マス）。
 * x≦3（縦穴の まわり）には 何も 置かない。
 */
export const mineNew = (rand: Rand): MineState => {
	const { W, H } = MINE;
	const g = new Uint8Array(W * H).fill(CELL.STONE);
	for (let x = 0; x < W; x++) g[key(x, H - 1)] = CELL.BEDROCK;
	const ri = (a: number, b: number): number =>
		a + Math.floor(rand() * (b - a + 1));
	const safe = (x: number): boolean => x <= 3;
	const vein = (
		kind: CellKind,
		x0: number,
		y0: number,
		n: number,
		ymin: number,
		ymax: number,
	): void => {
		let x = x0;
		let y = y0;
		for (let i = 0; i < n; i++) {
			if (
				inside(x, y) &&
				y >= ymin &&
				y <= ymax &&
				!safe(x) &&
				g[key(x, y)] === CELL.STONE
			)
				g[key(x, y)] = kind;
			const d = ri(0, 3);
			x += d === 0 ? 1 : d === 1 ? -1 : 0;
			y += d === 2 ? 1 : d === 3 ? -1 : 0;
		}
	};
	for (let i = 0; i < 3; i++) {
		const cx = ri(8 + i * 10, 14 + i * 10);
		const w = ri(3, 5);
		const top = ri(3, 4);
		for (let x = cx; x < cx + w && x < W; x++)
			for (let y = top; y <= 5; y++) g[key(x, y)] = CELL.AIR;
		if (rand() < 0.35)
			for (let x = cx; x < cx + w && x < W; x++) g[key(x, 6)] = CELL.LAVA;
	}
	for (let i = 0; i < 3; i++) {
		const x0 = ri(6, W - 4);
		const w = ri(2, 4);
		const deep = rand() < MINE.DEEP_POOL;
		for (let x = x0; x < x0 + w; x++)
			for (const y of deep ? [5, 6] : [6])
				if (g[key(x, y)] === CELL.STONE) g[key(x, y)] = CELL.LAVA;
	}
	for (let i = 0; i < 9; i++)
		vein(CELL.COAL, ri(4, W - 1), ri(0, 4), ri(2, 4), 0, 4);
	for (let i = 0; i < 6; i++)
		vein(CELL.DIA, ri(5, W - 1), ri(4, 6), ri(1, 3), 4, 6);
	for (let y = 0; y <= 2; y++) g[key(1, y)] = CELL.AIR;
	return start(g);
};

/**
 * 字の 絵から 地下を 作る（試験用。行は H 本・W 字まで、足りない 所は 石）。
 * "." 空気・"#" 石・"c" 石炭・"d" ダイヤ・"L" 溶岩・"=" 岩盤。縦穴と 松明は mineNew と 同じ。
 */
export const mineFrom = (rows: readonly string[]): MineState => {
	const g = new Uint8Array(MINE.W * MINE.H).fill(CELL.STONE);
	const K: Record<string, CellKind> = {
		".": CELL.AIR,
		"#": CELL.STONE,
		c: CELL.COAL,
		d: CELL.DIA,
		L: CELL.LAVA,
		"=": CELL.BEDROCK,
	};
	rows.forEach((r, y) => {
		[...r].forEach((ch, x) => {
			if (inside(x, y)) g[key(x, y)] = K[ch] ?? CELL.STONE;
		});
	});
	for (let x = 0; x < MINE.W; x++) g[key(x, MINE.H - 1)] = CELL.BEDROCK;
	for (let y = 0; y <= 2; y++) g[key(1, y)] = CELL.AIR;
	return start(g);
};

export const cellAt = (st: MineState, x: number, y: number): CellKind =>
	st.g[key(x, y)] as CellKind;
export const seenAt = (st: MineState, x: number, y: number): boolean =>
	inside(x, y) && st.seen[key(x, y)] === 1;
export const hitsAt = (st: MineState, x: number, y: number): number =>
	st.hits[key(x, y)] ?? 0;
export const torchAt = (st: MineState, x: number, y: number): boolean =>
	st.torch[key(x, y)] === 1;

/** 松明の 光の 中か。 */
export const lit = (st: MineState, x: number, y: number): boolean => {
	for (const [tx, ty] of st.torchList)
		if (Math.abs(tx - x) <= MINE.LIGHT && Math.abs(ty - y) <= MINE.LIGHT)
			return true;
	return false;
};

/** 見える マスを ふやす。 */
export const reveal = (st: MineState): void => {
	const q: number[] = [];
	const see = (x: number, y: number): void => {
		if (!inside(x, y)) return;
		const k = key(x, y);
		if (st.seen[k]) return;
		st.seen[k] = 1;
		if (st.g[k] === CELL.AIR) q.push(k);
	};
	for (const [tx, ty] of st.torchList)
		for (let y = ty - MINE.LIGHT; y <= ty + MINE.LIGHT; y++)
			for (let x = tx - MINE.LIGHT; x <= tx + MINE.LIGHT; x++) see(x, y);
	for (let dy = -1; dy <= 1; dy++)
		for (let dx = -1; dx <= 1; dx++) see(st.x + dx, st.y + dy);
	for (let k = 0; k < MINE.W * MINE.H; k++)
		if (st.g[k] === CELL.AIR && st.seen[k]) q.push(k);
	for (let k = q.pop(); k !== undefined; k = q.pop()) {
		const x = k % MINE.W;
		const y = (k - x) / MINE.W;
		see(x + 1, y);
		see(x - 1, y);
		see(x, y + 1);
		see(x, y - 1);
	}
};

/** 匠の 出る マス：キリコの 上下左右の 暗い 空気（向きの 反対＝うしろを 先に）。ななめには 出ない。 */
export const takumiSpot = (st: MineState): [number, number] | null => {
	const [bx, by] = DV[st.dir];
	const cand: [number, number][] = [
		[-bx, -by],
		[0, -1],
		[-1, 0],
		[1, 0],
		[0, 1],
	];
	for (const [dx, dy] of cand) {
		const x = st.x + dx;
		const y = st.y + dy;
		if (!inside(x, y)) continue;
		if (st.g[key(x, y)] === CELL.AIR && !lit(st, x, y)) return [x, y];
	}
	return null;
};

/** 見えて いない 溶岩が 上下左右に あるか（掘りぬいた マスに あふれて くる）。 */
const hiddenLavaNext = (st: MineState, x: number, y: number): boolean => {
	for (const [dx, dy] of Object.values(DV)) {
		const nx = x + dx;
		const ny = y + dy;
		if (!inside(nx, ny)) continue;
		const k = key(nx, ny);
		if (st.g[k] === CELL.LAVA && !st.seen[k]) return true;
	}
	return false;
};

/** 1手。起きた ことを 返す（板の 音と 一言）。終わった あとは 何も しない。 */
export const mineAct = (st: MineState, act: MineAct): MineEvent[] => {
	const ev: MineEvent[] = [];
	if (st.over) return ev;
	if (act === "quit") {
		st.over = "quit";
		return ["quit"];
	}
	// 前の 手で 溶岩が あふれた：この 1手（どの キーでも）で その マスを 出たか
	const spill = st.spill;
	st.spill = null;
	let acted = false;
	if (act === "torch") {
		const k = key(st.x, st.y);
		if (st.torch[k]) ev.push("torchHere");
		else if (st.torches <= 0) ev.push("noTorch");
		else {
			st.torch[k] = 1;
			st.torchList.push([st.x, st.y]);
			st.torches--;
			ev.push("torch");
			acted = true;
		}
	} else {
		st.dir = act;
		const [dx, dy] = DV[act];
		const nx = st.x + dx;
		const ny = st.y + dy;
		if (!inside(nx, ny)) ev.push("edge");
		else {
			const k = key(nx, ny);
			const c = st.g[k];
			if (c === CELL.AIR) {
				st.x = nx;
				st.y = ny;
				ev.push("move");
				acted = true;
			} else if (c === CELL.BEDROCK) ev.push("bedrock");
			else if (c === CELL.LAVA) {
				st.seen[k] = 1;
				ev.push("lavaSeen");
			} else {
				const need = c === CELL.STONE ? 1 : MINE.ORE_HITS;
				st.hits[k]++;
				acted = true;
				if (st.hits[k] < need) ev.push("hit");
				else {
					st.g[k] = CELL.AIR;
					st.hits[k] = 0;
					st.seen[k] = 1;
					st.pick--;
					ev.push(c === CELL.STONE ? "breakStone" : "breakOre");
					if (c === CELL.COAL) {
						st.coal++;
						st.torches += MINE.COAL_TORCH;
						ev.push("coal");
					}
					if (c === CELL.DIA) {
						st.dia++;
						ev.push("dia");
					}
					st.x = nx;
					st.y = ny;
					// 直下掘り：足もとを 掘ったら、下が 空いて いる かぎり 落ちる（溶岩なら おしまい）
					if (act === "down") {
						let fell = false;
						while (inside(st.x, st.y + 1)) {
							const b = st.g[key(st.x, st.y + 1)];
							if (b === CELL.LAVA) {
								st.y++;
								st.over = "lava";
								st.dia = 0;
								ev.push("lavaDeath");
								break;
							}
							if (b !== CELL.AIR) break;
							st.y++;
							fell = true;
						}
						if (fell) ev.push("fall");
					}
					// 見えて いない 溶岩の となりを 掘りぬいた（落ちた ときは 落ちた 先の 話）
					if (
						!st.over &&
						st.x === nx &&
						st.y === ny &&
						hiddenLavaNext(st, nx, ny)
					) {
						st.spill = { x: nx, y: ny };
						ev.push("spill");
					}
					if (st.pick === 8) ev.push("worn");
				}
			}
		}
	}
	if (spill) {
		if (st.x === spill.x && st.y === spill.y) {
			st.over = "lava";
			st.dia = 0;
			st.spill = null;
			ev.push("lavaDeath");
		} else {
			st.g[key(spill.x, spill.y)] = CELL.LAVA;
			st.seen[key(spill.x, spill.y)] = 1;
			ev.push("spillSafe");
		}
	}
	reveal(st);
	if (st.over || !acted) return ev;
	st.steps++;
	if (st.takumi) {
		const t = st.takumi;
		if (Math.abs(st.x - t.x) + Math.abs(st.y - t.y) >= MINE.ESCAPE) {
			st.takumi = null;
			st.dark = 0;
			ev.push("takumiGone");
		} else if (--t.fuse <= 0) {
			st.over = "takumi";
			ev.push("takumiBoom");
			return ev;
		}
	} else {
		st.dark = lit(st, st.x, st.y) ? 0 : st.dark + 1;
		if (st.dark >= MINE.DARK_LIMIT) {
			const spot = takumiSpot(st);
			if (spot) {
				st.takumi = { x: spot[0], y: spot[1], fuse: MINE.FUSE };
				ev.push("takumiSpawn");
			}
		}
	}
	if (st.pick <= 0) {
		st.over = "broke";
		ev.push("broke");
	}
	return ev;
};

// ───────────────── 板の 入力の 門（ui/sabaMine.ts。時刻は ms） ─────────────────

export const MINE_INPUT = {
	/** 長押しの くりかえしの 間（下は くりかえさない：直下掘りは 1回ずつ）。 */
	REPEAT_MS: 140,
	/** 溶岩が あふれた あと、押しても 動かない 間（見てから 決める。手前に 押した 分は 捨てる）。 */
	SPILL_MS: 350,
} as const;

export type MineGate = {
	/** 十字が 最後に 通った 時刻。 */
	last: number;
	/** 溶岩が あふれた 時刻。 */
	spillAt: number;
	/** あふれた あと、押しなおすまで 長押しの くりかえしを 止める。 */
	holdStop: boolean;
};

export const mineGate = (): MineGate => ({
	last: Number.NEGATIVE_INFINITY,
	spillAt: Number.NEGATIVE_INFINITY,
	holdStop: false,
});

/** 溶岩が あふれた（板が 出来事の spill を 見た とき）。 */
export const gateSpill = (g: MineGate, now: number): void => {
	g.spillAt = now;
	g.holdStop = true;
};

/**
 * 押した キー（タップは repeat なし）を 1手に するか。やめる（quit）は いつでも 通す。
 * あふれた あと SPILL_MS は 何も 通さず、長押しの くりかえしは 押しなおすまで 通さない
 * （押しっぱなしで のまれない。決まりの「次の 1手」は 見てから 押した 手に なる）。
 */
export const gateAct = (
	g: MineGate,
	act: MineAct,
	now: number,
	repeat: boolean,
): boolean => {
	if (act === "quit") return true;
	if (now - g.spillAt < MINE_INPUT.SPILL_MS) return false;
	if (act === "torch") return !repeat;
	if (repeat) {
		if (act === "down" || g.holdStop) return false;
		if (now - g.last < MINE_INPUT.REPEAT_MS) return false;
	} else g.holdStop = false;
	g.last = now;
	return true;
};

/** 板の 一言に する 出来事（強い 順）。 */
export const MINE_NOTE_ORDER: readonly MineEvent[] = [
	"lavaDeath",
	"takumiBoom",
	"broke",
	"spill",
	"spillSafe",
	"takumiSpawn",
	"takumiGone",
	"dia",
	"coal",
	"fall",
	"lavaSeen",
	"bedrock",
	"edge",
	"noTorch",
	"torchHere",
	"torch",
	"worn",
];

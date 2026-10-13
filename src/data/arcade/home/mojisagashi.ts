// キリコの 家の 遊べる 家具「文字さがしの 冊子」の キリコさがし（板は ui/arcade/home/mojisagashi.ts）。
// 9×7 の 文字の 盤に 名前が 1つ かくれて いる（縦・横・ななめ、逆向きも）。はじめの 文字と おわりの 文字を えらぶ。
// まっすぐ 並んで 名前に なって いれば 見つけた（置いた 所で なくても 名前に なって いれば よい）。次の 盤へ。
// ほかの マスは 名前の 文字を 多めに まぜて まぎらわしく する。90秒。スコア：見つけた 名前の 文字数×100 の 合計。
// DOM に 触らない（試験できる）。

import type { Rnd } from "../logic";

export const MS = {
	w: 9,
	h: 7,
	time: 90,
	/** 見つけた あと 光らせる 秒。 */
	flash: 0.9,
	/** ほかの マスに 名前の 文字を まぜる 割合。 */
	decoy: 0.4,
	/** 1文字の 点。 */
	perChar: 100,
} as const;

/** さがす 名前（1マス 1文字。小さい 字も 1マス）。 */
export const MS_WORDS: readonly (readonly string[])[] = [
	["ロ", "ゼ"],
	["ゼ", "ロ"],
	["シ", "ヨ"],
	["リ", "ノ"],
	["キ", "リ", "コ"],
	["ヤ", "キ", "ウ"],
	["イ", "ッ", "チ"],
	["プ", "ユ", "ユ"],
	["ナ", "ナ", "シ"],
	["フ", "ェ", "リ", "ス"],
];

/** まぜる ほかの 文字。 */
const FILL =
	"アイウエオカキクコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン".split(
		"",
	);

const DIRS: readonly (readonly [number, number])[] = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
	[1, 1],
	[-1, -1],
	[1, -1],
	[-1, 1],
];

export const MOJI_TEXT = {
	note: "はじめと　おわりの　文字で　A／タップ",
	find: "さがす　名前",
	found: "見つけた！",
	miss: "ちがう",
	pick: "おわりの　文字を　えらぶ",
	timeUp: "TIME UP",
} as const;

export type MsState = {
	t: number;
	cells: string[];
	/** 今 さがす 名前（MS_WORDS の 番号）。 */
	word: number;
	/** 次に 出す 名前の 順（はじめは 短い 名前から）。 */
	queue: number[];
	cx: number;
	cy: number;
	/** えらんだ はじめの マス（-1 なし）。 */
	anchor: number;
	/** 見つけた 線の マス（光らせる あいだ）。 */
	hit: number[];
	flash: number;
	found: number;
	points: number;
	over: boolean;
};

export type MsEvent =
	| "move"
	| "anchor"
	| "unanchor"
	| "found"
	| "miss"
	| "time";

const at = (x: number, y: number): number => y * MS.w + x;

const shuffle = <T>(xs: T[], rnd: Rnd): T[] => {
	for (let i = xs.length - 1; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1)) % (i + 1);
		[xs[i], xs[j]] = [xs[j] as T, xs[i] as T];
	}
	return xs;
};

/** 名前の 順（長さごとに まぜて 短い 順。一巡 したら また）。 */
const order = (rnd: Rnd): number[] => {
	const ids = shuffle(
		MS_WORDS.map((_, i) => i),
		rnd,
	);
	return ids.sort(
		(a, b) => (MS_WORDS[a]?.length ?? 0) - (MS_WORDS[b]?.length ?? 0),
	);
};

/** 名前を 1つ 置いた 盤を 作る。 */
export const msGrid = (word: readonly string[], rnd: Rnd): string[] => {
	const cells = Array.from({ length: MS.w * MS.h }, () => "");
	const n = word.length;
	for (let tries = 0; tries < 200; tries++) {
		const [dx, dy] = DIRS[Math.floor(rnd() * DIRS.length) % DIRS.length] ?? [
			1, 0,
		];
		const x0 = Math.floor(rnd() * MS.w);
		const y0 = Math.floor(rnd() * MS.h);
		const x1 = x0 + dx * (n - 1);
		const y1 = y0 + dy * (n - 1);
		if (x1 < 0 || y1 < 0 || x1 >= MS.w || y1 >= MS.h) continue;
		for (let i = 0; i < n; i++)
			cells[at(x0 + dx * i, y0 + dy * i)] = word[i] ?? "";
		break;
	}
	for (let i = 0; i < cells.length; i++) {
		if (cells[i]) continue;
		cells[i] =
			rnd() < MS.decoy
				? (word[Math.floor(rnd() * n) % n] ?? "ア")
				: (FILL[Math.floor(rnd() * FILL.length) % FILL.length] ?? "ア");
	}
	return cells;
};

const nextWord = (s: MsState, rnd: Rnd): void => {
	if (s.queue.length === 0) s.queue = order(rnd);
	s.word = s.queue.shift() ?? 0;
	s.cells = msGrid(MS_WORDS[s.word] ?? [], rnd);
	s.anchor = -1;
};

export const msStart = (rnd: Rnd): MsState => {
	const s: MsState = {
		t: 0,
		cells: [],
		word: 0,
		queue: order(rnd),
		cx: Math.floor(MS.w / 2),
		cy: Math.floor(MS.h / 2),
		anchor: -1,
		hit: [],
		flash: 0,
		found: 0,
		points: 0,
		over: false,
	};
	nextWord(s, rnd);
	return s;
};

export const msScore = (s: MsState): number => s.points;
export const msTimeLeft = (s: MsState): number =>
	Math.max(0, Math.ceil(MS.time - s.t));
export const msWord = (s: MsState): readonly string[] => MS_WORDS[s.word] ?? [];

/** 2つの マスを むすぶ まっすぐな 線（でなければ null）。 */
export const msLine = (a: number, b: number): number[] | null => {
	const ax = a % MS.w;
	const ay = Math.floor(a / MS.w);
	const bx = b % MS.w;
	const by = Math.floor(b / MS.w);
	const dx = Math.sign(bx - ax);
	const dy = Math.sign(by - ay);
	const lx = Math.abs(bx - ax);
	const ly = Math.abs(by - ay);
	if (lx !== 0 && ly !== 0 && lx !== ly) return null;
	const n = Math.max(lx, ly) + 1;
	return Array.from({ length: n }, (_, i) => at(ax + dx * i, ay + dy * i));
};

/** カーソルを 動かす（はしで 止まる）。 */
export const msMove = (s: MsState, dx: number, dy: number): MsEvent[] => {
	if (s.over || s.flash > 0) return [];
	s.cx = Math.max(0, Math.min(MS.w - 1, s.cx + dx));
	s.cy = Math.max(0, Math.min(MS.h - 1, s.cy + dy));
	return ["move"];
};

/** マスを えらぶ（1回目＝はじめ、2回目＝おわり。同じ マスで とりけし）。 */
export const msPick = (s: MsState, x: number, y: number): MsEvent[] => {
	if (s.over || s.flash > 0) return [];
	if (x < 0 || y < 0 || x >= MS.w || y >= MS.h) return [];
	s.cx = x;
	s.cy = y;
	const i = at(x, y);
	if (s.anchor < 0) {
		s.anchor = i;
		return ["anchor"];
	}
	if (s.anchor === i) {
		s.anchor = -1;
		return ["unanchor"];
	}
	const line = msLine(s.anchor, i);
	const word = msWord(s);
	s.anchor = -1;
	if (
		line &&
		line.length === word.length &&
		line.every((c, k) => s.cells[c] === word[k])
	) {
		s.hit = line;
		s.flash = MS.flash;
		s.found++;
		s.points += word.length * MS.perChar;

		return ["found"];
	}
	return ["miss"];
};

export const msStep = (s: MsState, dt: number, rnd: Rnd): MsEvent[] => {
	if (s.over) return [];
	s.t += dt;
	if (s.flash > 0) {
		s.flash -= dt;
		if (s.flash <= 0) {
			s.flash = 0;
			s.hit = [];
			nextWord(s, rnd);
		}
	}
	if (s.t >= MS.time) {
		s.over = true;
		return ["time"];
	}
	return [];
};

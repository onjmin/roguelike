// 畳の 敷きかた（部屋の 床の 畳を 1枚ずつ 並べる）。
// 畳の 床は 1マスの 絵を くり返すと ふちが 四角く ならび、畳に 見えない（作者の 指示）。
// 横の 1畳（左右 2マス）・縦の 1畳（上下 2マス）・半畳で 敷き、4枚の 角が 1点に 集まる 所（四つ目地・
// 不祝儀敷き）は 作らない。かべぎわの 列は 縦、なかは 横から ためす（部屋の まわりを 縦の 畳が かこむ 形に なる）。
// 部屋の 地図（字の 行と パレット）を 受けとり、畳の マスを 畳の 部品の 字に 置きかえる（家具・人の 下の 畳も）。

import type { TileDef } from "../../engine/defs";
import { ri, riCell } from "./rpgenArt";
import { base } from "./tiles";

type Piece = "hl" | "hr" | "vt" | "vb" | "half";

/** 畳の 1マスの 絵（部屋の 床の 字の いちばん 下の 絵）→ 敷く 部品。 */
const SETS: readonly (readonly [string, Record<Piece, string>])[] = [
	// RPGEN の 畳（緑の ふち。畳1A・1B・2A・2B・3）
	[
		ri("flTatami"),
		{
			hl: riCell("tatamiH", 0, 0),
			hr: riCell("tatamiH", 1, 0),
			vt: riCell("tatamiV", 0, 0),
			vb: riCell("tatamiV", 0, 1),
			half: ri("tatamiHalf"),
		},
	],
	// Base.png の 青い 畳（434〜436 行）
	[
		base(0, 436),
		{
			hl: base(0, 434),
			hr: base(1, 434),
			vt: base(2, 434),
			vb: base(2, 435),
			half: base(0, 436),
		},
	],
	// Base.png の 古い 畳（茶色。434〜436 行）
	[
		base(1, 436),
		{
			hl: base(0, 435),
			hr: base(1, 435),
			vt: base(3, 434),
			vb: base(3, 435),
			half: base(1, 436),
		},
	],
];

/** ためす 回数の 上限（こえたら 角の 決まりを ゆるめて 敷く）。 */
const STEPS = 50_000;

/**
 * 畳の マス（region[y][x]）に 畳を 敷く。かえすのは マスごとの 部品（畳で ない マスは null）。
 */
export const layTatami = (
	region: readonly (readonly boolean[])[],
): (Piece | null)[][] => {
	const h = region.length;
	const w = Math.max(0, ...region.map((r) => r.length));
	const inside = (x: number, y: number) => !!region[y]?.[x];
	const run = (strict: boolean): (Piece | null)[][] | null => {
		const id: number[][] = region.map((r) => r.map(() => 0));
		const piece: (Piece | null)[][] = region.map((r) => r.map(() => null));
		let next = 0;
		let steps = 0;
		const free = (x: number, y: number) => inside(x, y) && id[y][x] === 0;
		// (x, y) の 左上の 角に 4枚が 集まるか（左上・上・左が みんな 畳で、べつべつの 畳）
		const cross = (x: number, y: number) => {
			if (!inside(x - 1, y - 1) || !inside(x, y - 1) || !inside(x - 1, y))
				return false;
			const a = id[y - 1][x - 1];
			const b = id[y - 1][x];
			const c = id[y][x - 1];
			return a !== b && b !== c && a !== c;
		};
		const edge = (x: number, _y: number) =>
			!inside(x - 1, _y) || !inside(x + 1, _y);
		const go = (i: number): boolean => {
			if (++steps > STEPS) return false;
			while (i < w * h && !free(i % w, Math.floor(i / w))) i++;
			if (i >= w * h) return true;
			const x = i % w;
			const y = Math.floor(i / w);
			if (strict && cross(x, y)) return false;
			const order: ("H" | "V" | "1")[] = edge(x, y)
				? ["V", "H", "1"]
				: ["H", "V", "1"];
			for (const s of order) {
				const cells: [number, number, Piece][] =
					s === "H"
						? [
								[x, y, "hl"],
								[x + 1, y, "hr"],
							]
						: s === "V"
							? [
									[x, y, "vt"],
									[x, y + 1, "vb"],
								]
							: [[x, y, "half"]];
				if (!cells.every(([cx, cy]) => free(cx, cy))) continue;
				next++;
				for (const [cx, cy, p] of cells) {
					id[cy][cx] = next;
					piece[cy][cx] = p;
				}
				if (go(i + 1)) return true;
				for (const [cx, cy] of cells) {
					id[cy][cx] = 0;
					piece[cy][cx] = null;
				}
				if (steps > STEPS) return false;
			}
			return false;
		};
		return go(0) ? piece : null;
	};
	return (
		run(true) ??
		run(false) ??
		region.map((r) => r.map((v) => (v ? "half" : null)))
	);
};

/** 畳を 敷く ための 字（私用領域。ほかの パレットの 字と かぶらない）。 */
const CHAR0 = 0xe000;

/**
 * 部屋の 地図の 畳の マスを 敷いた 畳の 部品に 置きかえる（家具・人の 下の 畳も。通れる・台は そのまま）。
 * 畳の ない 部屋は そのまま かえす。
 */
export const layRoomTatami = (
	rows: readonly string[],
	tiles: Record<string, TileDef>,
): { rows: string[]; tiles: Record<string, TileDef> } => {
	const grid = rows.map((r) => [...r]);
	// 畳の 絵が 何枚目に あるか（部屋の 床の 上に 敷いた 小上がりの 畳は 2枚目）
	const layerOf = (ch: string) =>
		(tiles[ch]?.layers ?? []).findIndex((l) => SETS.some(([src]) => src === l));
	const setOf = (ch: string) => {
		const i = layerOf(ch);
		return i < 0 ? -1 : SETS.findIndex(([src]) => src === tiles[ch].layers[i]);
	};
	const out = { ...tiles };
	const made = new Map<string, string>();
	let changed = false;
	SETS.forEach(([, parts], s) => {
		const region = grid.map((r) => r.map((ch) => setOf(ch) === s));
		if (!region.some((r) => r.some(Boolean))) return;
		const laid = layTatami(region);
		grid.forEach((r, y) => {
			r.forEach((ch, x) => {
				const p = laid[y][x];
				if (!p) return;
				const key = `${ch}|${p}`;
				let nch = made.get(key);
				if (!nch) {
					nch = String.fromCodePoint(CHAR0 + made.size);
					made.set(key, nch);
					const t = tiles[ch];
					const i = layerOf(ch);
					out[nch] = {
						...t,
						layers: t.layers.map((l, k) => (k === i ? parts[p] : l)),
					};
				}
				r[x] = nch;
				changed = true;
			});
		});
	});
	return changed
		? { rows: grid.map((r) => r.join("")), tiles: out }
		: { rows: [...rows], tiles };
};

/** 床の 一覧の 絵（畳なら 横の 1畳を 2段。畳で なければ null）。 */
export const tatamiSample = (floor: string): string[][] | null => {
	const set = SETS.find(([src]) => src === floor)?.[1];
	return set
		? [
				[set.hl, set.hr],
				[set.vt, set.half],
			]
		: null;
};

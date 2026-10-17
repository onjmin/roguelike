// まだ 生き返って いない 所（data/town/revival.ts）の すたれた 姿（村の 地図の decor）。
// 2026-10-18 作者「蜘蛛の巣をはっているとか、ボロボロになっているとか、半壊しているとかで無人感を演出した方がいい」。
// 建物ごとに 所の id で 2〜3 種を えらぶ（町じゅう 同じ すたれ方に しない）：
//   蜘蛛の巣（扉と 角）・雑草（壁の 足もと）・ごみ（扉の 前）・さび（壁の すじと はがれ）・壁の ひび・やぶれた 垂れ幕、
//   いくつかの 所は 半壊（屋根の へりの 穴と 落ちかけた 看板。看板は ui/village/signboards.ts）。
// 停電で 閉まった 通りは すたれない（一時の 休み）。持ち帰った 板の 通りは 生き返りの 知らせ（villageReturn.ts の
// reviveScript）で cleanUp を 呼ぶと きらきら しながら 消える。それまでは 持ち帰った あとも すたれた まま。
// 絵は 1ソース画素ずつ 塗る（ドット絵の 地図に そろえる）。

import { DUNGEON_IDS } from "../../core/data/dungeons";
import type { DungeonId } from "../../core/types";
import { isRevived, REVIVE_AREAS } from "../../data/town/revival";
import {
	type Facility,
	facilitiesAt,
	facilityBlock,
	facilityDoor,
} from "../../data/village/facilities";
import {
	layoutStage,
	unlitCells,
	VILLAGE_W,
	type VillageView,
} from "../../data/village/map";
import { CORE_SIGNS } from "../../data/village/signs";
import type { MapDef } from "../../engine/defs";
import { loadTown } from "../../engine/save";
import { TILE } from "../../engine/types";

type Cell = readonly [number, number];

type Kind = "cobweb" | "weeds" | "litter" | "rust" | "cracks" | "banner";

/** すたれた 建物（マスの 四角と 扉）。 */
type Site = {
	area: string;
	place: string;
	x: number;
	y: number;
	w: number;
	h: number;
	door: Cell | null;
	kinds: readonly Kind[];
	ruin: boolean;
};

const KINDS: readonly Kind[] = [
	"cobweb",
	"weeds",
	"litter",
	"rust",
	"cracks",
	"banner",
];

/** 所の id から 決まる 数（FNV-1a）。 */
const hashOf = (s: string): number => {
	let h = 2166136261;
	for (const ch of s) {
		h ^= ch.codePointAt(0) ?? 0;
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
};

/** 所の id で 決まる 乱数（同じ 所は いつも 同じ）。 */
const rngOf = (s: string) => {
	let x = hashOf(s) || 1;
	return () => {
		x ^= x << 13;
		x ^= x >>> 17;
		x ^= x << 5;
		return (x >>> 0) / 4294967296;
	};
};

/** 半壊の 所か（4つに 1つ くらい）。 */
export const isRuined = (place: string): boolean => hashOf(place) % 4 === 0;

/** その 所の すたれ方（半壊なら 1種 へらして 合わせて 2〜3）。 */
const kindsOf = (place: string): Kind[] => {
	const r = rngOf(`${place}:kinds`);
	const pool = [...KINDS];
	for (let i = pool.length - 1; i > 0; i--) {
		const j = Math.floor(r() * (i + 1));
		[pool[i], pool[j]] = [pool[j] as Kind, pool[i] as Kind];
	}
	const n = 2 + (hashOf(place) % 2) - (isRuined(place) ? 1 : 0);
	return pool.slice(0, Math.max(1, n));
};

/** 生き返りの 知らせで 片づけはじめた 通り（REVIVE_AREAS の id → 始めた 時刻 ms）。 */
const cleaning = new Map<string, number>();
/** 片づけの 長さ（ms）。 */
const CLEAN_MS = 1400;

/** 通りの すたれを 片づける（きらきら しながら 消える）。 */
export const cleanUp = (area: string): void => {
	cleaning.set(area, performance.now());
};

/** 施設の 四角。 */
const facilitySite = (f: Facility, area: string): Site => {
	const rows = facilityBlock(f);
	return {
		area,
		place: f.id,
		x: f.at[0],
		y: f.at[1],
		w: Math.max(...rows.map((r) => [...r].length)),
		h: rows.length,
		door: facilityDoor(f),
		kinds: kindsOf(f.id),
		ruin: isRuined(f.id),
	};
};

/** マスの 集まりを つながりごとの 四角に。 */
const blobs = (cells: Set<number>): [number, number, number, number][] => {
	const seen = new Set<number>();
	const out: [number, number, number, number][] = [];
	for (const c of cells) {
		if (seen.has(c)) continue;
		let [x0, y0, x1, y1] = [Infinity, Infinity, -1, -1];
		const stack = [c];
		seen.add(c);
		while (stack.length) {
			const i = stack.pop() as number;
			const x = i % VILLAGE_W;
			const y = Math.floor(i / VILLAGE_W);
			x0 = Math.min(x0, x);
			y0 = Math.min(y0, y);
			x1 = Math.max(x1, x);
			y1 = Math.max(y1, y);
			for (const n of [i - 1, i + 1, i - VILLAGE_W, i + VILLAGE_W])
				if (cells.has(n) && !seen.has(n)) {
					seen.add(n);
					stack.push(n);
				}
		}
		out.push([x0, y0, x1 - x0 + 1, y1 - y0 + 1]);
	}
	return out;
};

/**
 * すたれた 建物（まだ 板を 持ち帰って いない 通りと、持ち帰ったが まだ 知らせて いない 通り）。
 * 停電は 見ない（view.cleared で きめる）。
 */
const sitesOf = (v: VillageView): Site[] => {
	const stage = layoutStage(v);
	const told = new Set(loadTown().revived);
	const out: Site[] = [];
	for (const a of REVIVE_AREAS) {
		const shut = !isRevived(a.places[0] ?? "", v.cleared);
		if (!shut && told.has(a.id)) continue;
		const fs = facilitiesAt(stage).filter((f) => a.places.includes(f.id));
		// 時計の 柱・ポストなど 建物で ない 物は すたれさせない
		out.push(
			...fs
				.map((f) => facilitySite(f, a.id))
				.filter((x) => x.w >= 2 && x.h >= 2),
		);
		// 町の まんなかの 建物：その 通りだけ 閉まって いる 町の 暗い マスから 施設の マスを ぬいた 残り
		const others = DUNGEON_IDS.filter((d) => d !== a.dungeon) as DungeonId[];
		const cells = unlitCells(v, others);
		for (const f of fs)
			facilityBlock(f).forEach((line, dy) => {
				[...line].forEach((_, dx) => {
					cells.delete((f.at[1] + dy) * VILLAGE_W + f.at[0] + dx);
				});
			});
		for (const [x, y, w, h] of blobs(cells)) {
			// 看板の ある 建物は 看板の id（半壊の 看板と 屋根を そろえる）
			const sign = CORE_SIGNS.find(
				(c) =>
					stage >= c.from &&
					(c.until === undefined || stage < c.until) &&
					c.at[0] >= x &&
					c.at[0] <= x + w &&
					c.at[1] >= y &&
					c.at[1] <= y + h,
			);
			const place = sign?.id ?? `${a.id}@${x},${y}`;
			out.push({
				area: a.id,
				place,
				x,
				y,
				w,
				h,
				door: [x + Math.floor(w / 2), y + h - 1],
				kinds: kindsOf(place),
				ruin: isRuined(place),
			});
		}
	}
	return out;
};

// ───────────────── 描く ─────────────────

type G = CanvasRenderingContext2D;

const dot = (g: G, x: number, y: number, c: string): void => {
	g.fillStyle = c;
	g.fillRect(Math.round(x), Math.round(y), 1, 1);
};

/** 1画素の 線（ブレゼンハム）。 */
const line = (
	g: G,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	c: string,
): void => {
	g.fillStyle = c;
	let [x, y] = [Math.round(x0), Math.round(y0)];
	const [tx, ty] = [Math.round(x1), Math.round(y1)];
	const dx = Math.abs(tx - x);
	const dy = -Math.abs(ty - y);
	const sx = x < tx ? 1 : -1;
	const sy = y < ty ? 1 : -1;
	let err = dx + dy;
	for (;;) {
		g.fillRect(x, y, 1, 1);
		if (x === tx && y === ty) break;
		const e2 = 2 * err;
		if (e2 >= dy) {
			err += dy;
			x += sx;
		}
		if (e2 <= dx) {
			err += dx;
			y += sy;
		}
	}
};

const WEB = "rgba(240, 240, 248, 0.92)";

/** 角の 蜘蛛の巣（角が (x, y)、dir は 右へ 1・左へ -1）。 */
const cobweb = (g: G, x: number, y: number, dir: 1 | -1, r = 11): void => {
	const angles = [0, 0.4, 0.85, 1.25, Math.PI / 2];
	const pt = (a: number, d: number) =>
		[x + Math.cos(a) * d * dir, y + Math.sin(a) * d] as const;
	for (const a of angles) {
		const [ex, ey] = pt(a, r);
		line(g, x, y, ex, ey, WEB);
	}
	for (const d of [r * 0.35, r * 0.7, r]) {
		for (let i = 0; i < angles.length - 1; i++) {
			const [ax, ay] = pt(angles[i] as number, d);
			const [bx, by] = pt(angles[i + 1] as number, d * 0.92);
			line(g, ax, ay, bx, by, WEB);
		}
	}
};

const GREEN = ["#3f6b22", "#5e8f2e", "#86b347"];

/** 地面から のびる 雑草（根もとが (x, y)）。 */
const weeds = (g: G, x: number, y: number, r: () => number): void => {
	const n = 3 + Math.floor(r() * 3);
	for (let i = 0; i < n; i++) {
		const bx = x + i - Math.floor(n / 2);
		const tall = 2 + Math.floor(r() * 4);
		const lean = r() < 0.5 ? -1 : 1;
		for (let k = 0; k < tall; k++)
			dot(
				g,
				bx + (k > tall / 2 ? lean : 0),
				y - k,
				GREEN[Math.min(2, Math.floor((k / tall) * 3))] as string,
			);
	}
	if (r() < 0.4) dot(g, x, y - 4, "#e8d24a");
};

/** 扉の 前の ごみ（くしゃくしゃの 紙・空き缶・つぶれた 段ボール）。 */
const litter = (g: G, x: number, y: number, r: () => number): void => {
	const pick = Math.floor(r() * 3);
	if (pick === 0) {
		g.fillStyle = "#e8e4d8";
		g.fillRect(x, y, 3, 2);
		dot(g, x + 1, y, "#9c968a");
		dot(g, x + 2, y + 1, "#b8b2a4");
	} else if (pick === 1) {
		g.fillStyle = "#b8392c";
		g.fillRect(x, y, 3, 2);
		dot(g, x + 2, y, "#dcdcdc");
		dot(g, x + 2, y + 1, "#dcdcdc");
	} else {
		g.fillStyle = "#a0784a";
		g.fillRect(x, y, 6, 3);
		g.fillStyle = "#7a5634";
		g.fillRect(x, y + 1, 6, 1);
		dot(g, x + 5, y, "#c49a64");
	}
};

/** さびの すじと 塗りの はがれ（壁の 帯：上が y、高さ h）。 */
const rust = (
	g: G,
	x: number,
	w: number,
	y: number,
	h: number,
	r: () => number,
): void => {
	const n = 2 + Math.floor((w / TILE) * 1.2);
	for (let i = 0; i < n; i++) {
		const sx = x + 2 + Math.floor(r() * (w - 4));
		const len = 4 + Math.floor(r() * Math.min(9, h - 2));
		g.fillStyle = "rgba(150, 78, 36, 0.7)";
		g.fillRect(sx, y + 1, 2, 2);
		g.fillStyle = "rgba(118, 58, 28, 0.55)";
		g.fillRect(sx, y + 3, 1, len);
	}
	for (let i = 0; i < Math.ceil(w / TILE); i++) {
		const px = x + 2 + Math.floor(r() * (w - 6));
		const py = y + 2 + Math.floor(r() * Math.max(1, h - 6));
		g.fillStyle = "rgba(0, 0, 0, 0.28)";
		g.fillRect(px - 1, py - 1, 5, 4);
		g.fillStyle = "rgba(235, 228, 214, 0.55)";
		g.fillRect(px, py, 3, 2);
	}
};

/** 壁の ひび（上の 点から 下へ ぎざぎざ）。 */
const cracks = (
	g: G,
	x: number,
	w: number,
	y: number,
	h: number,
	r: () => number,
): void => {
	const n = 1 + Math.floor(w / (TILE * 3));
	for (let i = 0; i < n; i++) {
		let cx = x + 3 + Math.floor(r() * (w - 6));
		let cy = y + 1 + Math.floor(r() * Math.max(1, h / 3));
		const steps = 4 + Math.floor(r() * 4);
		for (let k = 0; k < steps && cy < y + h - 1; k++) {
			const nx = cx + (r() < 0.5 ? -1 : 1) * (1 + Math.floor(r() * 2));
			const ny = cy + 1 + Math.floor(r() * 2);
			line(g, cx, cy, nx, ny, "rgba(20, 16, 14, 0.75)");
			dot(g, cx + 1, cy, "rgba(255, 255, 255, 0.3)");
			// 枝わかれ
			if (r() < 0.25)
				line(
					g,
					nx,
					ny,
					nx + (nx > cx ? 2 : -2),
					ny + 1,
					"rgba(20, 16, 14, 0.6)",
				);
			[cx, cy] = [nx, ny];
		}
	}
};

const CLOTH = ["#9a4e46", "#4a6890", "#8a7a3e", "#6a4a7a"];

/** 軒から 垂れる やぶれた 幕（左上が (x, y)）。 */
const banner = (g: G, x: number, y: number, r: () => number): void => {
	const c = CLOTH[Math.floor(r() * CLOTH.length)] as string;
	const w = 7;
	g.save();
	g.globalAlpha = 0.85;
	for (let i = 0; i < w; i++) {
		// 片がわが はずれて 斜めに 垂れる・すそは ぎざぎざ
		const top = Math.floor(i * 0.6);
		const len = 7 + Math.floor(i * 0.4) + ((i * 7) % 3) - (i % 2 ? 2 : 0);
		g.fillStyle = c;
		g.fillRect(x + i, y + top, 1, len);
		g.fillStyle = "rgba(0, 0, 0, 0.3)";
		g.fillRect(x + i, y + top + len - 1, 1, 1);
	}
	g.fillStyle = "rgba(255, 255, 255, 0.18)";
	g.fillRect(x + 2, y + 2, 1, 5);
	g.restore();
	// とめ紐（はずれて いない 角）
	dot(g, x, y - 1, "#2a2420");
};

/** 半壊の 屋根の へり（上の はしに 穴。cx は 穴の まんなか）。 */
const roofHole = (g: G, cx: number, y: number, r: () => number): void => {
	const w = 9 + Math.floor(r() * 5);
	for (let i = 0; i < w; i++) {
		const d = Math.round(
			3 + Math.sin((i / (w - 1)) * Math.PI) * 5 + (r() < 0.4 ? 1 : 0),
		);
		const x = cx - Math.floor(w / 2) + i;
		g.fillStyle = "#16110d";
		g.fillRect(x, y, 1, d);
		// 折れた 板の はし
		dot(g, x, y + d, i % 3 === 0 ? "#6b5640" : "#3a2e24");
	}
	// 折れて つき出た 垂木
	line(g, cx - 2, y + 2, cx + 1, y + 7, "#7a6248");
};

/** 片づけの きらきら（a は 残りの 濃さ 1→0）。 */
const sparkle = (g: G, s: Site, ox: number, oy: number, a: number): void => {
	const r = rngOf(`${s.place}:sparkle`);
	g.save();
	g.globalAlpha = Math.sin(a * Math.PI);
	for (let i = 0; i < 2 + s.w; i++) {
		const x = Math.round(s.x * TILE + r() * s.w * TILE - ox);
		const y = Math.round(s.y * TILE + r() * s.h * TILE - oy - (1 - a) * 6);
		dot(g, x, y, "#fffbe0");
		dot(g, x - 1, y, "rgba(255, 251, 224, 0.6)");
		dot(g, x + 1, y, "rgba(255, 251, 224, 0.6)");
		dot(g, x, y - 1, "rgba(255, 251, 224, 0.6)");
		dot(g, x, y + 1, "rgba(255, 251, 224, 0.6)");
	}
	g.restore();
};

/** 1つの 建物の 壁と 地面の すたれ（人より 奥。地図の ソース画素で、ox・oy を ひいて 描く）。 */
const drawSite = (g: G, s: Site, ox: number, oy: number): void => {
	const r = rngOf(`${s.place}:draw`);
	const X = s.x * TILE - ox;
	const Y = s.y * TILE - oy;
	const W = s.w * TILE;
	const H = s.h * TILE;
	// 扉の 行（壁の いちばん 下の 段）と その 上の 段が 壁
	const wallTop = Y + Math.max(0, s.h - 2) * TILE;
	const bottom = Y + H;
	const door = s.door && [s.door[0] * TILE - ox, s.door[1] * TILE - oy];
	for (const k of s.kinds) {
		if (k === "cobweb") {
			const rowTop = bottom - TILE;
			cobweb(g, X, rowTop, 1);
			if (door) cobweb(g, door[0] + TILE - 1, door[1], -1, 7);
			else cobweb(g, X + W - 1, rowTop, -1);
		} else if (k === "weeds") {
			weeds(g, X + 2, bottom - 1, r);
			weeds(g, X + W - 3, bottom - 1, r);
			if (W > TILE * 3)
				weeds(g, X + Math.floor(W * (0.25 + r() * 0.5)), bottom - 1, r);
			weeds(g, X + Math.floor(W / 2) + 4, bottom + 3, r);
		} else if (k === "litter") {
			const fx = door ? door[0] : X + W / 2;
			litter(g, fx - 4 + Math.floor(r() * 4), bottom + 2, r);
			litter(g, fx + 8 + Math.floor(r() * 6), bottom + 6, r);
			if (r() < 0.6) litter(g, fx - 10, bottom + 8, r);
		} else if (k === "rust") {
			rust(g, X, W, wallTop, bottom - wallTop, r);
		} else if (k === "cracks") {
			cracks(g, X, W, wallTop, bottom - wallTop, r);
		} else if (k === "banner") {
			const left = r() < 0.5;
			banner(g, left ? X + 3 : X + W - 11, bottom - TILE + 1, r);
		}
	}
	// 半壊の 崩れた かけら
	if (s.ruin)
		for (let i = 0; i < 4; i++)
			dot(
				g,
				X + 3 + Math.floor(r() * (W - 6)),
				bottom + 1 + Math.floor(r() * 4),
				"#6b5a48",
			);
};

/** 半壊の 屋根の 穴（人より 手前の 屋根に そろえて 上に 描く）。 */
const drawRoof = (g: G, s: Site, ox: number, oy: number): void => {
	if (!s.ruin) return;
	const r = rngOf(`${s.place}:roof`);
	const W = s.w * TILE;
	roofHole(
		g,
		s.x * TILE - ox + Math.floor(W * (0.3 + r() * 0.4)),
		s.y * TILE - oy,
		r,
	);
};

/**
 * 村の 地図：すたれた 建物の 飾り。ground は 壁と 地面の 物（MapDef.ground。人より 奥）、
 * decor は 屋根の 穴と 片づけの きらきら（MapDef.decor。人より 手前）。すたれた 所が なければ 無い。
 */
export const decayLayers = (
	v: VillageView,
): { ground: MapDef["ground"]; decor: MapDef["decor"] } => {
	const sites = sitesOf(v);
	if (!sites.length) return { ground: undefined, decor: undefined };
	const shut = new Set(
		REVIVE_AREAS.filter((a) => !v.cleared.includes(a.dungeon)).map((a) => a.id),
	);
	/** 見えて いる 建物ごとに 濃さ（片づけ中は 1→0）を 添えて 呼ぶ。 */
	const each = (
		g: G,
		ox: number,
		oy: number,
		f: (s: Site, a: number) => void,
	): void => {
		const vw = g.canvas.width;
		const vh = g.canvas.height;
		const now = performance.now();
		for (const s of sites) {
			const X = s.x * TILE - ox;
			const Y = s.y * TILE - oy;
			if (X > vw || Y > vh || X + s.w * TILE < 0 || Y + (s.h + 1) * TILE < 0)
				continue;
			let a = 1;
			const from = shut.has(s.area) ? undefined : cleaning.get(s.area);
			if (from !== undefined) {
				a = 1 - (now - from) / CLEAN_MS;
				if (a <= 0) continue;
			}
			g.save();
			g.globalAlpha = a;
			f(s, a);
			g.restore();
		}
	};
	return {
		ground: (g, ox, oy) => each(g, ox, oy, (s) => drawSite(g, s, ox, oy)),
		decor: (g, ox, oy) =>
			each(g, ox, oy, (s, a) => {
				drawRoof(g, s, ox, oy);
				if (a < 1) {
					g.globalAlpha = 1;
					sparkle(g, s, ox, oy, a);
				}
			}),
	};
};

/** 半壊の 看板か（まだ 板を 持ち帰って いない 所。停電では かたむかない）。 */
export const signRuined =
	(v: VillageView) =>
	(place: string): boolean =>
		isRuined(place) && !isRevived(place, v.cleared);

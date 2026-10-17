// 地図の 上に 生える きのこ（村の 地図。人の 下・地形の 上に 描く。ui/village/village.ts の render）。
// - 場面の きのこ：きのこ板の 持ち帰りの 語りで「商店街の シャッターに 生えた」「港の 船の 上まで 森に なった」を
//   本当に 生やす（data/story/quotes.ts の StoryPage.shrooms）。行進が 袋に つめて 帰ると 消える。
// - 置いていった きのこ：きのこ板が 開く ときの 来客が「きのこを 1本 置いて」帰る（data/story/story.ts の
//   UNLOCK_VISIT）。その 場に 1本 残り、村を 出るまで 消えない。
// - 町の きのこ：きのこ板を 持ち帰って 商店街が 生き返った あとは、店の 扉の わきに 少し 残る
//   （data/town/town.ts の 商店街の ひとこと「きのこ、生えてる〜。……商店街に〜」）。
// 絵は engine/headProp.ts の drawShroom（頭の きのこと 同じ）。

import { REVIVE_AREAS } from "../../data/town/revival";
import {
	type Facility,
	facilitiesAt,
	facilityDoor,
} from "../../data/village/facilities";
import { layoutStage, type VillageView } from "../../data/village/map";
import { drawShroom } from "../../engine/headProp";
import { loadTown } from "../../engine/save";
import { TILE } from "../../engine/types";

type Cell = readonly [number, number];

/** 1本（x は 絵の 左・y は 柄の 下はし。地図の 画素。at から 伸びる）。 */
type Shroom = { x: number; y: number; big: boolean; at: number };

/** 伸びる 長さ・消える 長さ（ms）。 */
const GROW_MS = 260;
const GONE_MS = 300;

/** 見た目だけの ゆらぎ（毎回 同じ 生えかた）。 */
const rng = (seed: number) => {
	let a = seed >>> 0 || 1;
	return (): number => {
		a ^= a << 13;
		a ^= a >>> 17;
		a ^= a << 5;
		return (a >>> 0) / 4294967296;
	};
};

let view: VillageView | null = null;
/** 歩ける マスか（港の 森は 海の 上には 生やさない）。 */
let land: (x: number, y: number) => boolean = () => true;
let town: Shroom[] = [];
let scene: Shroom[] = [];
/** 置いていった きのこ（来客が 置いて 帰った 1本。村を 出るまで 残る）。 */
let left: Shroom[] = [];
/** 置いていった きのこの マス（村の 場面の 旗。"x,y"）。 */
export const SHROOM_LEFT = "shroomLeft";
/** 場面の きのこが 消えはじめた 時刻。 */
let goneAt: number | null = null;

const streetDoors = (v: VillageView): Cell[] => {
	const street = REVIVE_AREAS.find((a) => a.id === "street");
	if (!street) return [];
	return facilitiesAt(layoutStage(v))
		.filter((f: Facility) => street.places.includes(f.id))
		.map(facilityDoor)
		.filter((d): d is Cell => !!d);
};

/** マスの 中に n 本（下はしを そろえて 少し ずらす）。delay は 生えはじめる まで の ms。 */
const inCell = (
	c: Cell,
	n: number,
	r: () => number,
	at: number,
	spread: number,
): Shroom[] =>
	Array.from({ length: n }, () => ({
		x: c[0] * TILE + Math.floor(r() * (TILE - 6)),
		y: c[1] * TILE + TILE - Math.floor(r() * 5),
		big: r() < 0.35,
		at: at + r() * spread,
	}));

/** 村の 地図を 組みなおした（村の 外の 地図なら null）。町の きのこを 決めなおす。 */
export const setShroomTown = (
	v: VillageView | null,
	walkable: (x: number, y: number) => boolean = () => true,
	leftAt?: unknown,
): void => {
	view = v;
	land = walkable;
	town = [];
	left = [];
	const at = typeof leftAt === "string" ? leftAt.split(",").map(Number) : [];
	if (v && at.length === 2) dropShroom([at[0], at[1]], 0);
	if (!v?.cleared.includes("kinoko")) return;
	if (!loadTown().revived.includes("street")) return;
	const r = rng(0x5b00);
	// 扉の わきに 1本ずつ（店の 数の 半分ほど）
	for (const [i, d] of streetDoors(v).entries()) {
		if (i % 2) continue;
		const side = r() < 0.5 ? -1 : 1;
		town.push(...inCell([d[0] + side, d[1]], 1, r, 0, 0));
	}
};

/**
 * 場面の きのこを 生やす。street は 商店街の 店の 扉の まわり（シャッター）、port は at の まわり（港の 船着き場）。
 * 前に 生やした ぶんは 残る。
 */
export const sproutShrooms = (where: "street" | "port", at: Cell): void => {
	const now = performance.now();
	goneAt = null;
	if (where === "street") {
		if (!view) return;
		const r = rng(0x5e7);
		for (const d of streetDoors(view))
			for (const dx of [-1, 0, 1])
				scene.push(...inCell([d[0] + dx, d[1]], 2, r, now, 900));
		return;
	}
	const r = rng(0x9a7);
	for (let dy = -6; dy <= 4; dy++)
		for (let dx = -6; dx <= 6; dx++) {
			if (Math.abs(dx) + Math.abs(dy) > 7 || r() < 0.15) continue;
			if (!land(at[0] + dx, at[1] + dy)) continue;
			const far = Math.abs(dx) + Math.abs(dy);
			scene.push(
				...inCell(
					[at[0] + dx, at[1] + dy],
					2 + (r() < 0.5 ? 1 : 0),
					r,
					now + far * 120,
					300,
				),
			);
		}
};

/** その マスに きのこを 1本 置く（地図の 旗 SHROOM_LEFT と いっしょに。at は 生えはじめる 時刻）。 */
export const dropShroom = (c: Cell, at = performance.now()): void => {
	left = [{ x: c[0] * TILE + 5, y: c[1] * TILE + TILE - 3, big: true, at }];
};

/** 場面の きのこを 摘みとる（ちぢんで 消える）。 */
export const clearShrooms = (): void => {
	if (scene.length) goneAt = performance.now();
};

/** 場面が おわった（すぐ 消す）。 */
export const endShrooms = (): void => {
	scene = [];
	goneAt = null;
};

/** 地図の きのこを 描く（人の 前に。ox, oy は カメラ）。 */
export const drawShrooms = (
	g: CanvasRenderingContext2D,
	ox: number,
	oy: number,
): void => {
	const now = performance.now();
	let shrink = 1;
	if (goneAt !== null) {
		shrink = 1 - (now - goneAt) / GONE_MS;
		if (shrink <= 0) endShrooms();
	}
	const vw = g.canvas.width;
	const vh = g.canvas.height;
	const one = (s: Shroom, k: number) => {
		const x = Math.round(s.x - ox);
		const y = Math.round(s.y - oy);
		if (x < -8 || y < -2 || x > vw || y > vh + 8) return;
		drawShroom(g, x, y, s.big, k);
	};
	for (const s of town) one(s, 1);
	for (const s of left) one(s, Math.min(1, (now - s.at) / GROW_MS));
	for (const s of scene) {
		const grow = Math.min(1, (now - s.at) / GROW_MS);
		if (grow <= 0) continue;
		one(s, Math.min(grow, shrink));
	}
};

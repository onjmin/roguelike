// 住人の 歩き方（data/people/mobs.ts の MobDef.gait）。棒立ちを やめて、性格ごとに 広場で 動く
// （2026-10-18 作者「キャラの性格に応じたランダム移動」）。
//
// - look：その場で きょろきょろ（向きだけ かえる。にぃちぇ・おんすちゃん・プロト）。
// - pace：持ち場の まわり 2マスを うろうろ（ぷゆゆ・ヤヤポジ・ムッジェ）。
// - stroll：広場を のんびり 歩きまわって、ところどころで 立ちどまる（おんちゃん・レン）。
// - run：広場を せかせか 走りまわる（朝コンロ・ミャウミャウ・アル）。
// gait の ない 子は 持ち場に 立ちっぱなし（店番・見張り・すわっている 子）。
// 動かすのは ui/village/village.ts の roam（キリコの 家に 招いた 人と 同じ 仕組み：行き先へ 歩いて、向いて、
// しばらく いる）。行き先は 持ち場から gaitRange の 中の 空いた マス（data/village/map.ts の roamCells）で、
// ときどき 持ち場へ もどる。キリコや 人が 道に 立てば そこで 止まる。

import type { RoamStep } from "../../engine/defs";
import type { Emote } from "../../engine/emote";
import type { Dir } from "../../engine/types";
import type { MobGait, MobId } from "../people/mobs";
import type { Cell } from "./map";

type GaitDef = {
	/** 持ち場から 歩く 範囲（マス。たて・よこの 大きい方）。 */
	range: number;
	/** 1歩の 遅さ（村の 1歩の 何倍）。 */
	walk: number;
	/** 着いてから いる 長さ（ms）。 */
	wait: readonly [number, number];
	/** いる あいだ ときどき 向きを かえる 割合。 */
	look: number;
	/** 持ち場へ もどる 割合。 */
	home: number;
};

const GAITS: Record<MobGait, GaitDef> = {
	look: { range: 0, walk: 1.6, wait: [1800, 4500], look: 0, home: 0.5 },
	pace: { range: 2, walk: 1.6, wait: [1200, 3600], look: 0, home: 0.25 },
	stroll: { range: 5, walk: 2.2, wait: [3500, 8000], look: 0.4, home: 0.25 },
	run: { range: 5, walk: 1.0, wait: [900, 2600], look: 0, home: 0.2 },
};

/** 持ち場から 歩く 範囲（gait の ない 子は 0）。 */
export const gaitRange = (gait: MobGait | undefined): number =>
	gait ? GAITS[gait].range : 0;

/** 持ち場を 離れて 歩く 子か（村の 道さがし・押しのけの wander に 使う）。 */
export const gaitMoves = (gait: MobGait | undefined): boolean =>
	gaitRange(gait) > 0;

/** 立ちどまった ときに 頭に 出す 記号（目立ちたがりの レンは 鼻歌）。 */
const HUM: Partial<Record<MobId, Emote>> = { ren: "♪" };
const HUM_P = 0.4;

const DIRS: readonly Dir[] = ["up", "right", "down", "left"];

/**
 * その 子の roam（1つ 終わるたびに 次の ことを 決める）。cells は 歩いて よい マス（持ち場は 無くても よい）。
 * rng は 試験で 差しかえる。
 */
export const mobRoam = (
	id: MobId,
	gait: MobGait,
	home: Cell,
	dir: Dir,
	cells: readonly Cell[],
	rng: () => number = Math.random,
): ((at: { x: number; y: number }) => RoamStep) => {
	const g = GAITS[gait];
	const between = ([a, b]: readonly [number, number]) =>
		Math.round(a + rng() * (b - a));
	const pick = <T>(xs: readonly T[]): T =>
		xs[Math.floor(rng() * xs.length) % xs.length];
	const hum = HUM[id];
	return (at) => {
		const wait = between(g.wait);
		const emote = hum && rng() < HUM_P ? hum : undefined;
		// きょろきょろ：半分は いつもの 向き、半分は ほかを 見る
		if (!g.range)
			return { face: rng() < g.home ? dir : pick(DIRS), wait, emote };
		const atHome = at.x === home[0] && at.y === home[1];
		const goHome = !atHome && rng() < g.home;
		const to = goHome || !cells.length ? home : pick(cells);
		return {
			to,
			// 持ち場に 着いたら いつもの 向き
			face: to[0] === home[0] && to[1] === home[1] ? dir : undefined,
			wait,
			walk: g.walk,
			look: rng() < g.look,
			emote,
		};
	};
};

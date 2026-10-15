// ぷゆゆ列車（2026-10-15 作者：「線路は 不定期で ぷゆゆ列車が 走っていると いいかも」）。村の 地図の decor。
// 住宅街（RAIL_FROM）から、新市街の 線路（data/village/map.ts の RAIL_X）を トロッコ 4両に 1匹ずつ ぷゆゆが
// 乗って 走りぬける。TRAIN_SLOT ごとに 走るか・いつ 来るか・北行きか 南行きかを くじで 決める（いつ 来るかは
// わからない）。人や 車とは ぶつからない（絵だけ。キリコが 線路に 立って いても 上を とおる）。
// 乗った ぷゆゆと 車は トロッコに 乗った キリコと 同じ 重ね方（ui/village/village.ts の ride。車が 足を かくす）。

import { PUYU_WALK } from "../../data/people/cast";
import { RAIL_FROM, RAIL_X, RAIL_Y1 } from "../../data/village/map";
import { TROLLEY_CART } from "../../data/village/trolley";
import { drawRefInCell, loadImage } from "../../engine/assets";
import type { MapDef } from "../../engine/defs";
import { drawWalk, stepFrame } from "../../engine/sprite";
import { TILE } from "../../engine/types";
import { hash } from "./cinemaDecor";

/** くじの 区切り（ミリ秒）。1区切りに 1本まで。 */
const TRAIN_SLOT = 45000;
/** 1区切りで 走る 割合。 */
const TRAIN_CHANCE = 0.5;
/** 両数。 */
const CARS = 4;
/** 速さ（マス／ミリ秒）。 */
const SPEED = 0.0055;
/** 乗った ぷゆゆを 持ちあげる 高さ（キリコより 背が 低いので、車から 顔が 出るように 高め）。 */
const SEAT = 7;

/** 遊ぶ たびの くじの 種（村の 時計は 毎回 0 から なので、種が 同じだと 毎回 同じ 時刻に 来る）。 */
const SEED = Math.floor(Math.random() * 1e6) * 3;

/** 区切り n の 列車（走らなければ null）。start は 区切りの 中で 来る 時刻、south は 南行き。 */
const trainOf = (n: number): { start: number; south: boolean } | null => {
	if (hash(n, SEED, 31) >= TRAIN_CHANCE) return null;
	// 走りぬけるのに かかる 時間の ぶんは 区切りの 中に おさめる（となりの 区切りの 列車と 重ならない）
	const run = (RAIL_Y1 + 2 * CARS + 4) / SPEED;
	return {
		start: n * TRAIN_SLOT + hash(n, SEED + 1, 31) * (TRAIN_SLOT - run),
		south: hash(n, SEED + 2, 31) < 0.5,
	};
};

/** その 段の 線路の ぷゆゆ列車（線路が なければ 無い）。 */
export const puyuTrainDecor = (stage: number): MapDef["decor"] => {
	if (stage < RAIL_FROM) return undefined;
	// 2列の 線路の まんなかを 走る
	const x = ((RAIL_X[0] + RAIL_X[1] + 1) / 2) * TILE - TILE / 2;
	// 絵は 描く ときに はじめて 読む（試験で 地図を 組む ときは 読まない）
	let asked = false;
	return (g, ox, oy, t) => {
		if (!asked) {
			asked = true;
			void loadImage(PUYU_WALK);
			void loadImage(TROLLEY_CART);
		}
		const train = trainOf(Math.floor(t / TRAIN_SLOT));
		if (!train || t < train.start) return;
		// 先頭の 行（マス）。北の はしの 外から 南の はしの 外まで（北行きは 逆）
		const go = (t - train.start) * SPEED;
		const from = -1;
		const to = RAIL_Y1 + CARS + 2;
		if (go > to - from + CARS) return;
		const frame = stepFrame(t, true);
		const dir = train.south ? "down" : "up";
		// 画面の 奥（北）から 描く：南行きは うしろの 車から、北行きは 先頭から
		const order = Array.from({ length: CARS }, (_, i) =>
			train.south ? CARS - 1 - i : i,
		);
		for (const i of order) {
			const head = train.south ? from + go : to - go;
			const y = head + (train.south ? -i : i);
			const px = Math.round(x - ox);
			const py = Math.round(y * TILE - oy);
			if (py < -TILE * 2 || py > g.canvas.height) continue;
			drawWalk(g, PUYU_WALK, dir, frame, px, py - SEAT);
			drawRefInCell(g, TROLLEY_CART, px, py);
		}
	};
};

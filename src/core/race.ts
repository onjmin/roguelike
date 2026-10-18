// 競争（加入前の 張り合い。STORY.md §4.9 の ライバル）。いまは 束音ロゼだけ：
// ロゼの 挑戦（engine/heroes.ts）を 受けて キリコが ボカロ作り避難所へ 潜ると、ロゼも 壁を 抜けて 先に 潜る。
// - 1階：キリコの となりに ロゼが 立ち、キリコが 動くと 壁を 抜けて 階段まで まっすぐ 走る（1ターンに DASH マス。
//   追いつけない）。階段に 着くと 先に 降りて いなく なる。
// - 2階から 底の 手前までは 出さない（村の スレにも 流さない）。
// - いちばん底では 先に 着いた ロゼが 原音設定の となりに 立ちつくして いる（体重 0 で 持ち上がらない）。
//   着くと 掛け合い、ぶつかると 話す。キリコが 拾うと ロゼは 壁の 向こうへ 帰る。
// 乱数は 引かない（ロゼの 立つ 所・走る 道は 決まった 順）。

import type { FolkTalk } from "./data/dungeons";
import { DIRS8, type Pos, step } from "./geom";
import { isFloor, roomAt, T_ROOM, T_WALL } from "./mapgen";
import type { Run } from "./run";
import type { DungeonId, Floor, FloorFolk } from "./types";

export type RaceId = "roze";

export const isRaceId = (x: unknown): x is RaceId => x === "roze";

/** 1階の ロゼが 1ターンに 進む マス（キリコの 倍。壁も 抜けるので 追いつけない）。 */
export const DASH = 2;

type RaceSpec = {
	/** 競争の 板。 */
	dungeon: DungeonId;
	/** 窓の 名前・立ち絵（data/people/cast.ts の id）・歩く 絵（cast.ts の WALK と 同じ）。 */
	name: string;
	voice: string;
	sprite: string;
	/** 1階で 走りだす ときの 掛け合い・走って いる ときに ぶつかった 話・階段を 降りた ようす（ログの 1行）。 */
	start: FolkTalk;
	running: readonly FolkTalk[];
	down: string;
	/** 底に 着いた ときの 掛け合い・ぶつかった ときの 話・キリコが 拾った ときの 掛け合い。 */
	arrive: FolkTalk;
	stuck: readonly FolkTalk[];
	carried: FolkTalk;
	/** 拾った あと、帰って いく ようす（ログの 1行）。 */
	leave: string;
};

export const RACE: Record<RaceId, RaceSpec> = {
	roze: {
		dungeon: "vocalo",
		name: "ロゼ",
		voice: "roze",
		sprite: "sa:mHhx69",
		start: [
			"よーい、どんアル！\n壁は近道アル！",
			{ kiriko: "フライングンゴ！" },
		],
		running: [["0キロは速いアル！\nお先アル！"]],
		down: "ロゼは壁をすり抜けて、先に階段を降りていった",
		// 嘘に 本気の 数字（3.2KB と 0キロ）→ ぶつかると 大声の ツッコミ → 村で 決着（data/story/story.ts）
		arrive: [
			"……おそいアル。\nわたしが先に着いたアル",
			{ kiriko: "取ったほうが勝ちって\n言ったンゴ" },
			"原音設定は3.2KBアル。わたしは\n0キロアル。……着いたほうの勝ちアル",
		],
		stuck: [
			[
				"見てないで、はやく持つアル",
				{ kiriko: "設定ファイルに負けてるンゴ！" },
				"……3.2KBは、重いアル",
			],
			["着いたのは、わたしが先アル。\n……持つのは、キリコが先アル"],
		],
		carried: [
			"取ったのはキリコ、着いたのは\nわたしアル。勝ち負けは村アル",
			{ kiriko: "それ、うやむやにする\n気まんまんンゴ！" },
		],
		leave: "ロゼは壁をすり抜けて、先に帰っていった",
	},
};

/** この 冒険の 競争（板が ちがえば null）。 */
export const raceOf = (r: Run): RaceId | null =>
	r.s.race && RACE[r.s.race].dungeon === r.s.dungeon ? r.s.race : null;

const folkOf = (
	id: RaceId,
	x: number,
	y: number,
	talks: readonly FolkTalk[],
): FloorFolk => {
	const spec = RACE[id];
	return {
		x,
		y,
		name: spec.name,
		sprite: spec.sprite,
		talks,
		voice: spec.voice,
		said: 0,
	};
};

/**
 * ロゼを 立たせる（core/floor.ts の buildFloor。品を 置いて 置物を 置いた あと）。
 * 1階：キリコの となりの 床（通れる。走りだすと 壁も 抜ける）。
 * 底：原音設定の となりで、まわりが ぜんぶ 同じ 部屋の 床の マス（通路を ふさがない）。無ければ 立たない。
 */
export const placeRival = (r: Run, f: Floor, start: Pos): void => {
	const id = raceOf(r);
	if (!id || r.s.returning) return;
	const l = f.layout;
	const taken = (x: number, y: number) =>
		(f.stairs.x === x && f.stairs.y === y) ||
		f.items.some((i) => i.x === x && i.y === y) ||
		(start.x === x && start.y === y);
	if (f.depth === 1 && f.depth < r.dungeon.floors) {
		const spot = DIRS8.map((d) => step(start, d)).find(
			(t) => isFloor(l, t.x, t.y) && !taken(t.x, t.y),
		);
		if (spot)
			f.folk = [
				...(f.folk ?? []),
				folkOf(id, spot.x, spot.y, RACE[id].running),
			];
		return;
	}
	if (f.depth !== r.dungeon.floors) return;
	const goal = f.items.find((x) => x.item.kind === r.dungeon.goal);
	if (!goal) return;
	const room = roomAt(l, goal.x, goal.y);
	const spot = DIRS8.map((d) => step(goal, d)).find(
		(t) =>
			isFloor(l, t.x, t.y) &&
			roomAt(l, t.x, t.y) === room &&
			!taken(t.x, t.y) &&
			DIRS8.every((d) => {
				const q = step(t, d);
				return isFloor(l, q.x, q.y) && roomAt(l, q.x, q.y) === room;
			}),
	);
	if (!spot) return;
	const i = spot.y * l.w + spot.x;
	l.tiles[i] = T_WALL;
	f.statues = [...(f.statues ?? []), i];
	f.folk = [...(f.folk ?? []), folkOf(id, spot.x, spot.y, RACE[id].stuck)];
};

/** この 階の ロゼ（いなければ undefined）。 */
export const rivalOn = (r: Run): FloorFolk | undefined => {
	const id = raceOf(r);
	return id ? r.f.folk?.find((x) => x.name === RACE[id].name) : undefined;
};

/**
 * 毎ターン（敵の 番の あと。Run の turn）：1階の ロゼが 階段へ まっすぐ 走る（壁も 抜ける）。
 * はじめの 1歩で 掛け合い（冒険の 始まりの 出来事は 画面に 出ないので、キリコが 動いて から）。
 * キリコの マスには 止まらない。階段に 着くと 先に 降りて いなく なる。
 */
export const tickRace = (r: Run): void => {
	const id = raceOf(r);
	if (!id || r.s.returning || r.s.depth !== 1 || r.dungeon.floors === 1) return;
	const fo = rivalOn(r);
	if (!fo) return;
	const spec = RACE[id];
	if (fo.said === 0) {
		fo.said = 1;
		r.emitTalk(spec.name, spec.start, spec.voice);
	}
	const goal = r.f.stairs;
	const at = (p: Pos) => p.x === goal.x && p.y === goal.y;
	for (let n = 0; n < DASH || (fo.x === r.p.x && fo.y === r.p.y); n++) {
		if (at(fo)) break;
		fo.x += Math.sign(goal.x - fo.x);
		fo.y += Math.sign(goal.y - fo.y);
	}
	if (!at(fo)) return;
	r.f.folk = (r.f.folk ?? []).filter((x) => x !== fo);
	r.msg(spec.down);
};

/** 底に 着いた（Run.enterFloor）：先に 着いて いた ロゼとの 掛け合い。 */
export const raceArrive = (r: Run): void => {
	const id = raceOf(r);
	if (!id || r.s.returning || r.s.depth !== r.dungeon.floors) return;
	const spec = RACE[id];
	r.msg(`${spec.name}が先に着いていた`);
	r.emitTalk(spec.name, spec.arrive, spec.voice);
};

/** 品を 拾った（Run.onAcquire）：ロゼは 運ぶのを まかせて 壁の 向こうへ 帰る。 */
export const raceCarried = (r: Run): void => {
	const id = raceOf(r);
	const fo = rivalOn(r);
	if (!id || !fo) return;
	const spec = RACE[id];
	r.emitTalk(spec.name, spec.carried, spec.voice);
	const l = r.f.layout;
	const i = fo.y * l.w + fo.x;
	l.tiles[i] = T_ROOM;
	r.f.statues = (r.f.statues ?? []).filter((x) => x !== i);
	r.f.folk = (r.f.folk ?? []).filter((x) => x !== fo);
	r.msg(spec.leave);
};

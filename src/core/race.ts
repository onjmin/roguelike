// 競争（加入前の 張り合い。STORY.md §4.9 の ライバル）。いまは 束音ロゼだけ：
// ロゼの 挑戦（engine/heroes.ts）を 受けて キリコが ボカロ作り避難所へ 潜ると、ロゼも 壁を 抜けて 先に 潜る。
// - 潜って いる あいだ、村の スレに ロゼの 進み具合が 流れる（data/story/liveRes.ts の raceResLine。rivalDepth）。
// - いちばん底では 先に 着いた ロゼが 原音設定の となりに 立ちつくして いる（体重 0 で 持ち上がらない）。
//   着くと 掛け合い、ぶつかると 話す。キリコが 拾うと ロゼは 壁の 向こうへ 帰る。
// 乱数は 引かない（ロゼの 立つ 所は 原音設定の となりの 決まった 順）。

import type { FolkTalk } from "./data/dungeons";
import { DIRS8, type Pos, step } from "./geom";
import { isFloor, roomAt, T_ROOM, T_WALL } from "./mapgen";
import type { Run } from "./run";
import type { DungeonId, Floor, FloorFolk } from "./types";

export type RaceId = "roze";

export const isRaceId = (x: unknown): x is RaceId => x === "roze";

type RaceSpec = {
	/** 競争の 板。 */
	dungeon: DungeonId;
	/** 窓の 名前・立ち絵（data/people/cast.ts の id）・歩く 絵（cast.ts の WALK と 同じ）。 */
	name: string;
	voice: string;
	sprite: string;
	/** キリコが 1階 進む あいだに 進む 階（壁を 抜けるので 速い）。 */
	pace: number;
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
		pace: 2,
		// 嘘に 本気の 数字（3.2KB と 0キロ）→ ぶつかると 大声の ツッコミ → 村で 決着（data/story/story.ts）
		arrive: [
			"……おそいアル。\nわたしが先に着いたアル",
			{ kiriko: "なんで持って帰らないンゴ？" },
			"原音設定は3.2KBアル。\nわたしは0キロアル。……持てないアル",
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
			"……運ぶのは、まかせるアル。\n勝ち負けは村で決めるアル",
			{ kiriko: "それ、うやむやにする\n気まんまんンゴ！" },
		],
		leave: "ロゼは壁をすり抜けて、先に帰っていった",
	},
};

/** この 冒険の 競争（板が ちがえば null）。 */
export const raceOf = (r: Run): RaceId | null =>
	r.s.race && RACE[r.s.race].dungeon === r.s.dungeon ? r.s.race : null;

/** キリコが depth 階に いる ときの ロゼの 階（底で 止まる）。 */
export const rivalDepth = (id: RaceId, depth: number, floors: number): number =>
	Math.min(floors, 1 + depth * RACE[id].pace);

/** ロゼが 底に 着いた ときの キリコの 階（村の スレの 勝利宣言が 何階 つづいたか を 数える）。 */
export const rivalArrival = (id: RaceId, floors: number): number => {
	let d = 0;
	while (rivalDepth(id, d, floors) < floors) d++;
	return d;
};

/**
 * 底に ロゼを 立たせる（core/floor.ts の buildFloor。品を 置いて 置物を 置いた あと）。
 * 原音設定の となりで、まわりが ぜんぶ 同じ 部屋の 床の マス（通路を ふさがない）。無ければ 立たない。
 */
export const placeRival = (r: Run, f: Floor, start: Pos): void => {
	const id = raceOf(r);
	if (!id || r.s.returning || f.depth !== r.dungeon.floors) return;
	const goal = f.items.find((x) => x.item.kind === r.dungeon.goal);
	if (!goal) return;
	const l = f.layout;
	const room = roomAt(l, goal.x, goal.y);
	const taken = (x: number, y: number) =>
		(f.stairs.x === x && f.stairs.y === y) ||
		f.items.some((i) => i.x === x && i.y === y) ||
		(start.x === x && start.y === y);
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
	const spec = RACE[id];
	const i = spot.y * l.w + spot.x;
	l.tiles[i] = T_WALL;
	f.statues = [...(f.statues ?? []), i];
	f.folk = [
		...(f.folk ?? []),
		{
			x: spot.x,
			y: spot.y,
			name: spec.name,
			sprite: spec.sprite,
			talks: spec.stuck,
			voice: spec.voice,
			said: 0,
		},
	];
};

const rivalOn = (r: Run): FloorFolk | undefined => {
	const id = raceOf(r);
	return id ? r.f.folk?.find((x) => x.name === RACE[id].name) : undefined;
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

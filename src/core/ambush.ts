// 待ちぶせ（ダンジョンの 中の 手合わせ。STORY.md §4.9 の ライバル）。いまは 解音ゼロの 3機だけ：
// ゼロの 挑戦（engine/heroes.ts）を 受けて キリコが 潜ると、本編の 7階ぶんの 強さに 届く 最初の 階（風呂板・お祭りなら 8階。
// 板ごとの 階は ambushFloorsOf で 全体マップの 札にも 出す）の 階段の 部屋で 3機が 待つ。浅い 板（パン板・きのこ板・離島・ボカロ）には 来ない。
// - 3機は たがいに 再起動しあう（史実：メイン機と サブ機は web会議で メンテナンスしあう）。1機 止めても、
//   ほかが 動いて いれば REBOOT_TURNS で 起きなおす（HP 半分・経験値なし）。
// - 戦いの あいだ SHUFFLE_EVERY ターンごとに 2機が 入れ替わる。
// - 3機 そろって 止まると 勝ち（RunState.ambushWon）。帰っても 倒れても 勝ちは 残る。
// 乱数は 待ちぶせの ある 冒険でだけ 引く（ほかの 冒険の 乱数の 順は かわらない）。

import { type Dungeon, dungeonById, type FolkTalk } from "./data/dungeons";
import { MONSTERS } from "./data/monsters";
import { freeRoomTiles, spawnMonster } from "./floor";
import { DIRS8, type Pos, step } from "./geom";
import { monsterName } from "./monster";
import type { Run } from "./run";
import { DEEP, type DungeonId, type Floor, type Monster } from "./types";

export type AmbushId = "zero";

export const isAmbushId = (x: unknown): x is AmbushId => x === "zero";

type AmbushSpec = {
	/** 機体（data/monsters.ts。boss: true）。はじめの 1つが ゲージに 出る。 */
	units: readonly string[];
	/** 窓の 名前と 立ち絵（data/people/cast.ts の id）。 */
	name: string;
	voice: string;
	/** 見つけた ときの 掛け合い・3機 止めた ときの 掛け合い。 */
	intro: FolkTalk;
	won: FolkTalk;
};

export const AMBUSH: Record<AmbushId, AmbushSpec> = {
	zero: {
		units: ["zero_main", "zero_proto", "zero_ren"],
		name: "ゼロ",
		voice: "zero",
		intro: [
			"お待ちしてました、キリコさん！\nここで数えて3時間です",
			{ kiriko: "1機、寝てるンゴ" },
			"スリープモードです。\n……3機で、勝負です！",
		],
		won: [
			"……3機とも、停止しました。\n負けは1つです",
			"3機なので、\n1機あたり0.33敗です",
			{ kiriko: "割るなンゴ！" },
		],
	},
};

/** 待ちぶせの 階：本編の この 階ぶんの 強さに 届く 最初の 階（板ごとに 深さが ちがう。名所の 階と いちばん底は とばす）。 */
export const AMBUSH_LEVEL = 7;
/** 止まった 機体が 起きなおすまでの ターン。 */
export const REBOOT_TURNS = 6;
/** 2機が 入れ替わる 間（ターン）。 */
export const SHUFFLE_EVERY = 5;

/** 階に 残す 待ちぶせの ようす（Floor.ambush）。 */
export type FloorAmbush = {
	id: AmbushId;
	/** 起きなおす 機体と その ターン（Floor.turns）。 */
	reboot: { kind: string; at: number }[];
	/** 起きなおした 機体（たおしても 経験値なし）。 */
	again: number[];
	/** 次に 入れ替わる ターン（見つけてから）。 */
	shuffleAt?: number;
	/** 起きなおした 回数（天丼：1回目・2回目と 言って、3回目は アップデートで 起きない）。 */
	reboots?: number;
	/** 入れ替わった（はじめの 1回だけ キリコが つっこむ）。 */
	shuffled?: true;
};

/** 起きなおす ときの ひとこと（回数ごと。最後の 1つで 起きなく なる）。{name} は 機体。 */
export const REBOOT_LINES: readonly string[] = [
	"{name}「再起動、1回目です！」",
	"{name}「2回目。……想定内です」",
	"{name}「アップデート中です。残り4時間」",
];

/** その 板で 待ちぶせる 階（強さが AMBUSH_LEVEL に 届かない 浅い 板は null）。 */
export const ambushFloorOf = (dg: Dungeon): number | null => {
	const l = dg.level;
	for (let d = 1; d < dg.floors; d++)
		if (
			l[Math.max(1, Math.min(l.length - 1, d))] >= AMBUSH_LEVEL &&
			!dg.rests?.some((x) => x.depth === d)
		)
			return d;
	return null;
};

/** 板ごとの 待ちぶせの 階（全体マップの 札。おんMu は 底の 深さで かわるので 幅）。 */
export const ambushFloorsOf = (id: DungeonId): number[] => {
	const dg = dungeonById(id);
	const rf = dg.randomFloors;
	const all = rf
		? Array.from({ length: rf.max - rf.min + 1 }, (_, i) =>
				ambushFloorOf({
					...dg,
					floors: rf.min + i,
					level: rf.level(rf.min + i),
				}),
			)
		: [ambushFloorOf(dg)];
	return [...new Set(all.filter((x): x is number => x !== null))].sort(
		(a, b) => a - b,
	);
};

/** この 冒険で 待ちぶせる 階（無ければ null）。 */
export const ambushDepth = (r: Run): number | null =>
	!r.s.ambush || r.s.ambushWon ? null : ambushFloorOf(r.dungeon);

export const isAmbushUnit = (f: Floor, m: Monster): boolean =>
	!!f.ambush && AMBUSH[f.ambush.id].units.includes(m.kind);

/** 生きている 機体（ゲージに 出す 順）。 */
export const ambushLead = (f: Floor): Monster | null => {
	if (!f.ambush) return null;
	const units = AMBUSH[f.ambush.id].units;
	let best: Monster | null = null;
	for (const m of f.monsters)
		if (m.hp > 0 && units.includes(m.kind))
			if (!best || units.indexOf(m.kind) < units.indexOf(best.kind)) best = m;
	return best;
};

/**
 * 階段の 部屋に 3機を 置く（core/floor.ts の buildFloor。r.s.floor が この 階の あいだに 呼ぶ）。
 * 見られるまで 眠って 動かない（run.ts の checkBossSeen で そろって 起きる）。
 */
export const placeAmbush = (
	r: Run,
	f: Floor,
	room: number,
	start: Pos,
): void => {
	const id = r.s.ambush;
	if (!id) return;
	const away = (t: Pos) =>
		Math.max(Math.abs(t.x - start.x), Math.abs(t.y - start.y)) > 2;
	const inRoom = freeRoomTiles(r, f, room).filter(away);
	const spots =
		inRoom.length >= 3 ? inRoom : freeRoomTiles(r, f, null).filter(away);
	f.ambush = { id, reboot: [], again: [] };
	for (const kind of AMBUSH[id].units) {
		if (!spots.length) break;
		const at = spots.splice(r.rng.int(spots.length), 1)[0];
		const m = spawnMonster(r, kind, at, { sleep: DEEP, single: true });
		if (m && f.boss === undefined) f.boss = m.uid;
	}
};

/** 見つけた：掛け合いの あと 3機とも 起きる。 */
export const wakeAmbush = (r: Run): void => {
	const f = r.f;
	if (!f.ambush) return;
	const spec = AMBUSH[f.ambush.id];
	// 先に 3機とも 目を さます（掛け合いの 窓より 前に Z が 消える。寝たまま 話さない）
	for (const m of f.monsters)
		if (isAmbushUnit(f, m)) {
			m.status.sleep = 0;
			m.status.dormant = false;
			m.nextAt = Math.max(m.nextAt, r.p.nextAt + 2);
		}
	r.emitTalk(spec.name, spec.intro, spec.voice);
	f.ambush.shuffleAt = f.turns + SHUFFLE_EVERY;
	r.msg(`${spec.name}の3機が待ちぶせていた！`, "warn");
	// 戦いの 音を 録る（勝った あとで ゼロに 聞かせる：data/people/heroQuests.ts の offer）
	r.msg("蓄音機が、ひとりでに回りだした");
};

/**
 * 機体が 止まった（killMonster の あと）。ほかが 動いて いれば 再起動を 待つ。3機 そろって 止まれば 勝ち。
 */
export const ambushDown = (r: Run, m: Monster): void => {
	const f = r.f;
	const a = f.ambush;
	if (!a) return;
	const spec = AMBUSH[a.id];
	if (ambushLead(f)) {
		a.reboot.push({ kind: m.kind, at: f.turns + REBOOT_TURNS });
		r.msg("のこりの機体が、再起動をはじめた……", "warn");
		return;
	}
	a.reboot = [];
	r.s.ambushWon = true;
	delete f.boss;
	r.emit({ t: "bossDown" });
	r.msg(`${spec.name}の3機がそろって止まった！`, "good");
	r.emitTalk(spec.name, spec.won, spec.voice);
};

/** 毎ターン（敵の 番の あと）：再起動と 入れ替わり。 */
export const tickAmbush = (r: Run): void => {
	const f = r.f;
	const a = f.ambush;
	if (!a || !f.bossSeen || r.s.ambushWon) return;
	// 再起動（動いて いる 機体の となりに。空きが なければ 次の ターン）
	for (const job of [...a.reboot]) {
		if (job.at > f.turns) continue;
		const lead = ambushLead(f);
		if (!lead) break;
		const at = DIRS8.map((d) => step(lead, d)).find((q) => r.isFree(q.x, q.y));
		if (!at) continue;
		a.reboots = (a.reboots ?? 0) + 1;
		const say = REBOOT_LINES[Math.min(a.reboots, REBOOT_LINES.length) - 1];
		const name = MONSTERS[job.kind]?.name ?? "";
		// 3回目は アップデートが はじまって 起きない（そのまま 止まった まま）
		if (a.reboots >= REBOOT_LINES.length) {
			a.reboot = a.reboot.filter((x) => x !== job);
			r.msg(say.replaceAll("{name}", name));
			continue;
		}
		const m = spawnMonster(r, job.kind, at, { awake: true, single: true });
		if (!m) continue;
		a.reboot = a.reboot.filter((x) => x !== job);
		m.hp = Math.ceil(m.maxHp / 2);
		m.nextAt = Math.max(m.nextAt, r.p.nextAt + 2);
		a.again.push(m.uid);
		r.emit({ t: "appear", id: m.uid, pos: { x: m.x, y: m.y }, from: lead });
		r.msg(`${monsterName(r, m)}が再起動した！`, "warn");
		r.msg(say.replaceAll("{name}", name));
		if (a.reboots === 1) r.msg("キリコ「ゾンビかンゴ！」");
	}
	// 入れ替わり
	if (a.shuffleAt === undefined || f.turns < a.shuffleAt) return;
	a.shuffleAt = f.turns + SHUFFLE_EVERY;
	const live = f.monsters.filter((m) => m.hp > 0 && isAmbushUnit(f, m));
	if (live.length < 2) return;
	const x = live.splice(r.rng.int(live.length), 1)[0];
	const y = live[r.rng.int(live.length)];
	const px = { x: x.x, y: x.y };
	const py = { x: y.x, y: y.y };
	x.x = py.x;
	x.y = py.y;
	y.x = px.x;
	y.y = px.y;
	r.emit({ t: "warp", id: x.uid, from: px, to: py });
	r.emit({ t: "warp", id: y.uid, from: py, to: px });
	r.msg(`${monsterName(r, x)}と${monsterName(r, y)}が入れ替わった`);
	if (!a.shuffled) {
		a.shuffled = true;
		r.msg("キリコ「どっちがどっちンゴ！」");
	}
};

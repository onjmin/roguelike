// 名所の 階・底の 集落の 手づくりの 地図（core/data/places.ts・core/floor.ts の buildPlaceFloor）の 試験
// （pnpm test で いっしょに 動く）。字が 表に あること・床が 1つに つながる こと（ワープで 閉じこめられない）・
// 人と 話せて 階段・品・源泉に 歩いて 行ける こと・敵や 罠が 無い こと を 見る。

import { BOARD_DECOR } from "../core/data/decor";
import { DUNGEON_IDS, dungeonById, type FolkTalk } from "../core/data/dungeons";
import type { PlaceMap } from "../core/data/places";
import { blocks, buildFloor } from "../core/floor";
import { DIRS8, type Pos, step } from "../core/geom";
import { idx, isFloor } from "../core/mapgen";
import { Run } from "../core/run";
import type { DungeonId, Floor, GameEvent } from "../core/types";
import { REST_SKITS, restSkitsAt } from "../data/story/restSkits";
import {
	forgetRestSkits,
	restBeside,
	restPath,
	takeRestSkit,
} from "../ui/dungeon/restSkit";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}

/** 窓の 1枚の 文（返事は キリコ・ロゼ・ゼロの 3機 ぶん 全部）。 */
const textsOf = (x: FolkTalk[number]): string[] =>
	typeof x === "string"
		? [x]
		: [
				x.kiriko,
				...(x.roze === undefined ? [] : [x.roze]),
				...(x.zero === undefined
					? []
					: typeof x.zero === "string"
						? [x.zero]
						: x.zero),
			];
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};

const CASES: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => CASES.push({ name, run });

type Place = {
	dungeon: DungeonId;
	depth: number;
	name: string;
	map: PlaceMap;
	folk: number;
	gifts: number;
	spring: boolean;
};

const PLACES: Place[] = DUNGEON_IDS.flatMap((id) => {
	const d = dungeonById(id);
	const out: Place[] = (d.rests ?? []).map((r) => ({
		dungeon: id,
		depth: r.depth,
		name: r.name,
		map: r.map,
		folk: r.folk?.length ?? 0,
		gifts: r.gifts?.length ?? 0,
		spring: r.map.rows.some((row) => row.includes("S")),
	}));
	if (d.settlement)
		out.push({
			dungeon: id,
			depth: d.floors,
			name: d.settlement.name,
			map: d.settlement.map,
			folk: d.settlement.folk.length,
			gifts: 0,
			spring: false,
		});
	return out;
});

test("board decor: hung on the wall, 2 tiles wide, or 2 tiles tall (never a 1-tile thing on the floor), and only by the north wall", () => {
	// 1マスの 物が 床に あると 道具と まちがえる（core/data/decor.ts）
	for (const id of DUNGEON_IDS) {
		const set = BOARD_DECOR[id];
		for (const k of set.kinds) {
			if (k.hang || k.w === 2) continue;
			const tall = Math.max(
				...k.art.map((a) => {
					const h = Number(a.ref.split("#")[1]?.split(",")[3] ?? 16);
					return h * (a.scale ?? 1);
				}),
			);
			if (tall < 32)
				throw new Fail(
					`${id}: ${k.art[0].ref} stands on the floor at ${tall}px`,
				);
		}
		for (let n = 0; n < 6; n++) {
			const f = Run.create(`decor-${id}-${n}`, id).f;
			const l = f.layout;
			for (const d of f.decor ?? [])
				for (let dx = 0; dx < (d.w ?? 1); dx++)
					if (!isFloor(l, d.x + dx, d.y) || isFloor(l, d.x + dx, d.y - 1))
						throw new Fail(
							`${id}: decor at ${d.x + dx},${d.y} is not by a north wall`,
						);
		}
	}
});

const build = (
	p: Place,
	objective = dungeonById(p.dungeon).objective,
): Floor => {
	const r = Run.create(`place-test:${p.name}`, p.dungeon, [], objective);
	return buildFloor(r, p.depth, false);
};

/** 着いた 所から 歩いて 行ける マス（8方向。角は 両どなりが 床の ときだけ）。 */
const reach = (f: Floor, from: Pos): Set<number> => {
	const l = f.layout;
	const seen = new Set([idx(l, from.x, from.y)]);
	const todo = [from];
	while (todo.length) {
		const p = todo.pop() as Pos;
		for (const d of DIRS8) {
			const q = step(p, d);
			if (!isFloor(l, q.x, q.y) || seen.has(idx(l, q.x, q.y))) continue;
			if (q.x !== p.x && q.y !== p.y)
				if (!isFloor(l, q.x, p.y) || !isFloor(l, p.x, q.y)) continue;
			seen.add(idx(l, q.x, q.y));
			todo.push(q);
		}
	}
	return seen;
};

test("every special floor uses only known letters, and each block of a big prop is a filled rectangle", () => {
	ok(PLACES.length >= 7, `only ${PLACES.length} special floors`);
	for (const p of PLACES) {
		const known = new Set([
			..."#. @>*Sgo123456789",
			...Object.keys(p.map.legend),
		]);
		for (const row of p.map.rows)
			for (const ch of row) ok(known.has(ch), `${p.name}: unknown "${ch}"`);
		ok(
			p.map.rows.every((row) => row.length === p.map.rows[0].length),
			`${p.name}: rows of different lengths`,
		);
		for (const [ch, prop] of Object.entries(p.map.legend)) {
			if (!prop.big) continue;
			const cells: Pos[] = [];
			p.map.rows.forEach((row, y) => {
				for (let x = 0; x < row.length; x++)
					if (row[x] === ch) cells.push({ x, y });
			});
			const area = blocks(cells).reduce((n, g) => n + g.w * g.h, 0);
			ok(area === cells.length, `${p.name}: "${ch}" is not a rectangle`);
		}
	}
});

test("special floors are one connected room with the stairs, folk, goods and spring in walking reach", () => {
	for (const p of PLACES) {
		const f = build(p);
		const l = f.layout;
		const start = { x: f.stairs.x, y: f.stairs.y };
		ok(isFloor(l, start.x, start.y), `${p.name}: stairs on a wall`);
		const got = reach(f, start);
		for (let i = 0; i < l.w * l.h; i++)
			if (l.tiles[i])
				ok(
					got.has(i),
					`${p.name}: floor cut off at ${i % l.w},${Math.floor(i / l.w)}`,
				);
		for (const it of f.items)
			ok(got.has(idx(l, it.x, it.y)), `${p.name}: item out of reach`);
		for (const t of f.traps)
			ok(got.has(idx(l, t.x, t.y)), `${p.name}: spring out of reach`);
		for (const fo of f.folk ?? [])
			ok(
				DIRS8.some((d) => {
					const q = step(fo, d);
					return got.has(idx(l, q.x, q.y));
				}),
				`${p.name}: nobody can talk to ${fo.name}`,
			);
	}
});

test("special floors place every folk, gift, spring and goal, and nothing hostile", () => {
	for (const p of PLACES) {
		const f = build(p);
		const d = dungeonById(p.dungeon);
		ok(f.rest === p.name, `${p.name}: rest name ${f.rest}`);
		ok(
			(f.folk ?? []).length === p.folk,
			`${p.name}: folk ${(f.folk ?? []).length}/${p.folk}`,
		);
		ok(f.monsters.length === 0, `${p.name}: monsters`);
		ok(
			f.traps.every((t) => t.kind === "spring"),
			`${p.name}: a trap that is not a spring`,
		);
		ok(f.traps.length > 0 === p.spring, `${p.name}: spring`);
		ok(
			f.seen.every((v, i) => v || !f.layout.tiles[i]),
			`${p.name}: the map is not revealed`,
		);
		const goal = p.depth === d.floors && d.objective === "fetch" ? 1 : 0;
		ok(f.items.length === p.gifts + goal, `${p.name}: ${f.items.length} items`);
		if (goal)
			ok(
				f.items.some((it) => it.item.kind === d.goal),
				`${p.name}: no goal`,
			);
	}
	// 期間限定の 目的で どの 集落も 持ち帰り（fetch）に なりうる
	for (const p of PLACES.filter(
		(x) => x.depth === dungeonById(x.dungeon).floors,
	)) {
		const f = build(p, "fetch");
		const goal = dungeonById(p.dungeon).goal;
		ok(
			f.items.some((it) => it.item.kind === goal),
			`${p.name}: no goal when fetch`,
		);
	}
	// 源泉の ある 名所（静かな 石室 4つ）
	ok(PLACES.filter((p) => p.spring).length >= 4, "springs missing");
});

// ボスの 大部屋（BossSpec.arena）：住む・立てこもる ボスだけ（STORY.md §4.9 の ライバル）
const ARENAS = DUNGEON_IDS.flatMap((id) => {
	const a = dungeonById(id).boss?.arena;
	return a ? [{ id, a }] : [];
});

test("boss arenas: known letters, one room in reach, the boss stands on B, and nothing else hostile", () => {
	ok(
		ARENAS.some((x) => x.id === "main"),
		"the bath hall is missing",
	);
	for (const { id, a } of ARENAS) {
		const known = new Set([..."#. @>gB", ...Object.keys(a.map.legend)]);
		for (const row of a.map.rows)
			for (const ch of row) ok(known.has(ch), `${a.name}: unknown "${ch}"`);
		ok(
			a.map.rows.every((row) => row.length === a.map.rows[0].length),
			`${a.name}: rows of different lengths`,
		);
		const d = dungeonById(id);
		const r = Run.create(`arena-test:${a.name}`, id, [], "boss");
		const f = buildFloor(r, d.floors, false);
		ok(f.arena === a.name && !f.rest, `${a.name}: not an arena`);
		const l = f.layout;
		const got = reach(f, r.p);
		for (let i = 0; i < l.w * l.h; i++)
			if (l.tiles[i])
				ok(
					got.has(i),
					`${a.name}: floor cut off at ${i % l.w},${Math.floor(i / l.w)}`,
				);
		ok(f.monsters.length === 1, `${a.name}: ${f.monsters.length} monsters`);
		const b = f.monsters[0];
		ok(b.uid === f.boss && b.kind === d.boss?.monster, `${a.name}: no boss`);
		const row = a.map.rows[b.y];
		ok(row[b.x] === "B", `${a.name}: boss is not on B`);
		ok(f.traps.length === 0, `${a.name}: traps`);
		ok(
			f.seen.every((v, i) => v || !l.tiles[i]),
			`${a.name}: the map is not revealed`,
		);
		// ほかの 目的（期間限定の 持ち帰り）では ふつうの 階
		const q = Run.create(`arena-test:${a.name}`, id, [], "fetch");
		ok(!buildFloor(q, d.floors, false).arena, `${a.name}: arena on fetch`);
	}
});

test("boss arenas: the talk fits the window and comes before the fight starts", () => {
	for (const { id, a } of ARENAS) {
		// 本気の 場面は 脅しを 具体的に 言う ぶん 長め（STORY.md「笑いの 理論から 見た 201」）
		ok(a.talk.length >= 1 && a.talk.length <= 6, `${a.name}: windows`);
		ok(typeof a.talk[0] === "string", `${a.name}: opens with キリコ`);
		for (const text of a.talk.flatMap(textsOf)) {
			const lines = text.split("\n");
			ok(lines.length <= 2, `${a.name}: 3 lines ${text}`);
			for (const ln of lines)
				ok([...ln].length <= 22, `${a.name}: long line ${ln}`);
		}
		const r = Run.create(`arena-test:${a.name}`, id, [], "boss");
		r.enterFloor(dungeonById(id).floors, false);
		const talk = r.ev.findIndex((e) => e.t === "talk");
		const boss = r.ev.findIndex((e) => e.t === "boss");
		ok(talk >= 0 && boss > talk, `${a.name}: talk ${talk} boss ${boss}`);
		ok(r.f.bossSeen && r.boss?.status.sleep === 0, `${a.name}: boss asleep`);
		// ロゼ・ゼロで 潜ると キリコの 返事は 出さない
		const z = Run.create(`arena-test:${a.name}`, id, [], "boss", true, "zero");
		z.enterFloor(dungeonById(id).floors, false);
		const zt = z.ev.find((e) => e.t === "talk");
		ok(
			zt?.t === "talk" &&
				zt.talk.length === a.talk.length &&
				zt.talk.every((x) => typeof x === "string" || x.voice === "zero"),
			`${a.name}: ゼロ does not answer in its own voice`,
		);
	}
});

// 本気の 相手の 掛け合い（BossSpec.talk。大部屋の ない ボスも 窓で 話す。STORY.md §0「シリアスは 本気の 相手の 一言」）
const TALK_BOSSES = DUNGEON_IDS.flatMap((id) => {
	const b = dungeonById(id).boss;
	return b?.talk ? [{ id, b, talk: b.talk }] : [];
});
test("boss talks: every boss opens with a straight talk that fits the window, hushes the song, and comes before the fight", () => {
	// 本筋の ボスの 板は 全部（大部屋の 番頭は arena.talk）。寄り道の 板の ボスは 目的が boss で ない ので なくてよい
	for (const id of DUNGEON_IDS) {
		const d = dungeonById(id);
		if (d.boss && d.objective === "boss")
			ok(d.boss.talk || d.boss.arena, `${id}: boss without a talk`);
	}
	ok(TALK_BOSSES.length >= 3, "few boss talks");
	for (const { id, b, talk } of TALK_BOSSES) {
		ok(talk.length >= 3 && talk.length <= 10, `${id}: windows ${talk.length}`);
		ok(typeof talk[0] === "string", `${id}: opens with キリコ`);
		// 最後は 相手の 脅しか キリコの 返事（笑いで 落とさない：！の 連打・草・ンゴの ボケ なし）
		for (const text of talk.flatMap(textsOf)) {
			const lines = text.split("\n");
			ok(lines.length <= 2, `${id}: 3 lines ${text}`);
			for (const ln of lines)
				ok([...ln].length <= 22, `${id}: long line ${ln}`);
			ok(!text.includes("！"), `${id}: shouting in a straight talk ${text}`);
		}
		// 本気の 掛け合いは ロゼ・ゼロでも 切れない（どの 返事にも 2人の ぶん）
		for (const x of [...talk, ...(b.arena?.talk ?? [])])
			if (typeof x !== "string")
				ok(x.roze && x.zero, `${id}: no reply for ロゼ・ゼロ ${x.kiriko}`);
		if (b.arena) continue;
		// 大部屋の ない ボス：ふつうの 階で 見つけた ときに 窓 → 戦い（ボスを 起こして となりに 置き、1手 待つ）
		const r = Run.create(`talk-test:${id}`, id, [], "boss");
		r.enterFloor(dungeonById(id).floors, false);
		const all: GameEvent[] = [...r.ev];
		for (let i = 0; i < 20 && !all.some((e) => e.t === "talk"); i++) {
			const m = r.boss;
			if (!m || r.s.end) break;
			m.status.sleep = 0;
			m.status.dormant = false;
			m.x = r.p.x + 1;
			m.y = r.p.y;
			all.push(...r.act({ c: "wait" }));
		}
		const te = all.find((e) => e.t === "talk");
		ok(te?.t === "talk" && te.hush, `${id}: talk without hush`);
		const ti = all.findIndex((e) => e.t === "talk");
		const bi = all.findIndex((e) => e.t === "boss");
		ok(ti >= 0 && bi > ti, `${id}: talk ${ti} boss ${bi}`);
		ok(r.f.bossSeen, `${id}: boss not seen`);
	}
});

// 敵の いない 階の 寸劇（data/story/restSkits.ts・ui/dungeon/restSkit.ts）
test("as ロゼ・ゼロ: the hero is not on the floor twice, talks cut before a missing reply, and only {hero} becomes the hero's name", () => {
	// 本人は 立たない（パン板の 集落の ロゼ・ゼロ 3機）
	for (const p of PLACES) {
		const spec = dungeonById(p.dungeon);
		const folk = [
			...(spec.rests?.find((x) => x.name === p.name)?.folk ?? []),
			...(spec.settlement?.name === p.name ? spec.settlement.folk : []),
		];
		for (const hero of ["roze", "zero"] as const) {
			const r = Run.create(
				`self-test:${p.name}`,
				p.dungeon,
				[],
				spec.objective,
				true,
				hero,
			);
			const f = buildFloor(r, p.depth, false);
			const names = (f.folk ?? []).map((x) => x.name);
			ok(
				names.length === folk.filter((x) => x.self !== hero).length,
				`${p.name}: ${hero} folk ${names.join("・")}`,
			);
			for (const fo of folk.filter((x) => x.self === hero))
				ok(!names.includes(fo.name), `${p.name}: ${fo.name} twice as ${hero}`);
		}
	}
	ok(
		dungeonById("shallow").settlement?.folk.some((x) => x.self === "zero"),
		"no ゼロ in パン板",
	);
	// 返事が ない 窓は 返事の 前で 切れる・{hero} だけ 名前に
	const r = Run.create("talk-cut", "shallow", [], "boss", true, "roze");
	r.ev = [];
	r.emitTalk("パン王", ["{hero}、キリコ", { kiriko: "ンゴ" }, "落ち"]);
	const t = r.ev.find((e) => e.t === "talk");
	ok(
		t?.t === "talk" && t.talk.length === 1 && t.talk[0] === "ロゼ、キリコ",
		`cut ${JSON.stringify(t)}`,
	);
	// ゼロは いまの 機体の 返事と 立ち絵
	const z = Run.create("talk-zero", "shallow", [], "boss", true, "zero");
	z.s.body = 1;
	z.ev = [];
	z.emitTalk("x", ["a", { kiriko: "ンゴ", zero: ["1", "2", "3"] }]);
	const zt = z.ev.find((e) => e.t === "talk");
	ok(
		zt?.t === "talk" &&
			typeof zt.talk[1] === "object" &&
			zt.talk[1].reply === "2" &&
			zt.talk[1].voice === "proto",
		`zero body ${JSON.stringify(zt)}`,
	);
	// きのこ板：ゼロで 潜ると 先回りの プロトは 出ない
	const k = dungeonById("kinoko").boss;
	for (const l of [
		...(k?.asHero?.zero?.intro ?? []),
		...(k?.asHero?.zero?.lines ?? []),
		k?.asHero?.zero?.supplyLine ?? "",
	])
		ok(!l.includes("プロト"), `kinoko as ゼロ: ${l}`);
	// 名前の 差し替えの 残り：「キリコ」を 主人公の 意味で 使う 文は {hero} に
	for (const id of DUNGEON_IDS) {
		const b = dungeonById(id).boss;
		for (const l of [...(b?.lines ?? []), ...(b?.intro ?? [])])
			ok(!/キリコ[をがはに]/.test(l), `${id}: キリコ for the hero ${l}`);
	}
});

test("rest skits: 2+ per place with folk, people and cells exist, every walk has a path and gets home, windows fit, each once", () => {
	const keys = new Set<string>();
	for (const sk of REST_SKITS) {
		ok(!keys.has(sk.key), `${sk.key}: twice`);
		keys.add(sk.key);
		const p = PLACES.find((x) => x.name === sk.place);
		ok(p, `${sk.key}: no place ${sk.place}`);
		if (!p) continue;
		const r = Run.create(
			`rest-skit-test:${p.name}`,
			p.dungeon,
			[],
			dungeonById(p.dungeon).objective,
		);
		const f = buildFloor(r, p.depth, false);
		const l = f.layout;
		const hero: Pos = { x: r.p.x, y: r.p.y };
		const home = (who: number | "kiriko"): Pos | undefined =>
			who === "kiriko" ? hero : f.folk?.[who];
		const pos = new Map<number | "kiriko", Pos>();
		const at = (who: number | "kiriko"): Pos | undefined =>
			pos.get(who) ?? home(who);
		let windows = 0;
		for (const st of sk.steps) {
			if (typeof st.who === "number")
				ok(f.folk?.[st.who], `${sk.key}: no folk ${st.who}`);
			if (typeof st.look === "number")
				ok(f.folk?.[st.look], `${sk.key}: look at no folk ${st.look}`);
			else if (st.look)
				ok(
					st.look[0] >= 0 &&
						st.look[0] < l.w &&
						st.look[1] >= 0 &&
						st.look[1] < l.h,
					`${sk.key}: look outside ${st.look}`,
				);
			for (const w of st.go ?? []) {
				const from = at(w.who);
				const h = home(w.who);
				ok(from && h, `${sk.key}: walk of nobody ${w.who}`);
				if (!from || !h) continue;
				const to =
					w.to === "home"
						? h
						: w.to === "kiriko"
							? restBeside(f, at("kiriko") ?? hero, [])
							: { x: w.to[0], y: w.to[1] };
				ok(to, `${sk.key}: ${w.who} has nowhere beside キリコ`);
				if (!to) continue;
				ok(
					restPath(f, from, to, []),
					`${sk.key}: ${w.who} has no path ${from.x},${from.y} → ${to.x},${to.y}`,
				);
				pos.set(w.who, to);
			}
			if (st.text !== undefined) {
				windows++;
				const text = st.text.replaceAll("{hero}", "キリコ");
				const lines = text.split("\n");
				ok(lines.length <= 2, `${sk.key}: 3 lines ${text}`);
				for (const line of lines)
					ok([...line].length <= 22, `${sk.key}: long line ${line}`);
			}
		}
		ok(windows >= 3 && windows <= 12, `${sk.key}: ${windows} windows`);
		// おわりに みんな 元の 所へ もどれる（ui/dungeon/play.ts の sceneHome）
		for (const [who, q] of pos) {
			const h = home(who);
			ok(h && restPath(f, q, h, []), `${sk.key}: ${who} cannot get home`);
		}
	}
	for (const p of PLACES)
		if (p.folk > 0)
			ok(restSkitsAt(p.name).length >= 2, `${p.name}: fewer than 2 skits`);
	// ロゼと ゼロの 導入は パン王国の 城下町の 1本目（はじめて 会う 所）
	ok(
		restSkitsAt("パン王国の城下町")[0]?.key === "castle_rivals",
		"the rivals' introduction is not the first castle skit",
	);
	// 見た ものは 二度 出ない
	forgetRestSkits();
	const a = takeRestSkit("露天の源泉")?.key;
	const b = takeRestSkit("露天の源泉")?.key;
	ok(a && b && a !== b, `the spring skits repeat: ${a} ${b}`);
	ok(takeRestSkit("露天の源泉") === null, "a third spring skit");
	ok(takeRestSkit("ない所") === null, "a skit for an unknown place");
	forgetRestSkits();
});

export const runPlaceTests = (): TestResult[] =>
	CASES.map((c) => {
		try {
			c.run();
			return { id: "place", name: c.name, ok: true };
		} catch (e) {
			return {
				id: "place",
				name: c.name,
				ok: false,
				reason: e instanceof Error ? e.message : String(e),
			};
		}
	});

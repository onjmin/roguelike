// 同行者（筋で 決まる ゲスト。core/guest.ts・data/people/companions.ts）の 試験（pnpm test）。
// いちばん 大事なのは「重ならない」（作者の 指示）：ボットで 長く 遊ばせて、どの ターンでも 同行者・キリコ・敵が
// 同じ マスに いない こと、同行者が 壁に いない ことを 見る。

import { spawnMonster } from "../core/floor";
import { DIRS8, dist, step } from "../core/geom";
import { GUESTS, guestHere } from "../core/guest";
import { isFloor } from "../core/mapgen";
import { Run } from "../core/run";
import { serializeRun } from "../core/serial";
import type { Command, DungeonId, GuestId } from "../core/types";
import { GUEST_PLAN, guestFor } from "../data/people/companions";
import { botCommand } from "./bot";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};
const CASES: { name: string; run: () => void | Promise<void> }[] = [];
const test = (name: string, run: () => void | Promise<void>) =>
	CASES.push({ name, run });

const width = (s: string) =>
	[...s].reduce((n, c) => n + (/[\x20-\x7e｡-ﾟ]/.test(c) ? 0.5 : 1), 0);

const make = (seed: string, d: DungeonId, g: GuestId | null): Run =>
	Run.create(seed, d, [], "fetch", true, false, "kiriko", g);

/** いまの 階で 重なって いないか（同行者・キリコ・敵）。 */
const noOverlap = (r: Run, where: string): void => {
	const cells = new Map<string, string>();
	const put = (x: number, y: number, who: string) => {
		const k = `${x},${y}`;
		ok(!cells.has(k), `${where}: ${who} on ${cells.get(k)} at ${k}`);
		cells.set(k, who);
	};
	if (!r.playerInWall()) put(r.p.x, r.p.y, "player");
	for (const m of r.f.monsters) if (m.hp > 0) put(m.x, m.y, `m${m.uid}`);
	const g = guestHere(r);
	if (g) {
		ok(isFloor(r.f.layout, g.x, g.y), `${where}: guest in a wall`);
		put(g.x, g.y, "guest");
	}
};

const PAIRS: [DungeonId, GuestId][] = [
	["deep", "zero"],
	["tropical", "feris"],
	["ato", "shobon"],
];

test("重ならない：ボットで 遊ばせて どの ターンも 同行者・キリコ・敵が 同じ マスに いない", () => {
	for (const [d, g] of PAIRS)
		for (const seed of ["g1", "g2", "g3", "g4"]) {
			const r = make(`guest-${seed}`, d, g);
			noOverlap(r, `${d}/${seed} start`);
			for (let i = 0; i < 2500 && !r.s.end; i++) {
				r.act(botCommand(r));
				noOverlap(r, `${d}/${seed} turn ${r.s.turn}`);
			}
		}
});

test("ついてくる：階に 着くと キリコの そばに 立ち、ひとこと。たいてい キリコの 近くに いる", () => {
	for (const [d, g] of PAIRS) {
		const r = make("guest-near", d, g);
		const gs = guestHere(r);
		ok(gs && dist(gs, r.p) <= 3, `${d}: not beside Kiriko on arrival`);
		ok(
			r.s.log.some((l) => l === `${GUESTS[g].name}「${GUESTS[g].first}」`),
			`${d}: no first line`,
		);
		let near = 0;
		let n = 0;
		for (let i = 0; i < 1500 && !r.s.end; i++) {
			r.act(botCommand(r));
			const h = guestHere(r);
			if (!h) continue;
			n++;
			if (dist(h, r.p) <= 3) near++;
		}
		ok(!n || near / n > 0.7, `${d}: near only ${near}/${n}`);
	}
});

test("同じに 始まる：同じ シード・同じ 手で 同じ 終わり（リプレイ）。同行者の いない 冒険は guest を 書かない", () => {
	const a = make("guest-replay", "deep", "zero");
	const cmds: Command[] = [];
	for (let i = 0; i < 800 && !a.s.end; i++) {
		const c = botCommand(a);
		cmds.push(c);
		a.act(c);
	}
	const b = make("guest-replay", "deep", "zero");
	for (const c of cmds) b.act(c);
	ok(serializeRun(a.s) === serializeRun(b.s), "the replay drifted");
	const plain = make("guest-replay", "deep", null);
	ok(plain.s.guest === undefined, "a run without a guest wrote guest");
});

test("入れかわる：キリコが 同行者の マスへ 歩くと 入れかわる", () => {
	const r = make("guest-swap", "deep", "zero");
	r.f.monsters = [];
	const g = guestHere(r);
	ok(g, "no guest");
	if (!g) return;
	const d = DIRS8.find((x) => {
		const t = step(r.p, x);
		return t.x === g.x && t.y === g.y;
	});
	ok(d !== undefined, "guest is not next to Kiriko");
	if (d === undefined) return;
	const from = { x: r.p.x, y: r.p.y };
	const to = { x: g.x, y: g.y };
	r.act({ c: "move", dir: d });
	const h = guestHere(r);
	ok(r.p.x === to.x && r.p.y === to.y, "Kiriko did not step in");
	ok(h && dist(h, r.p) === 1, "the guest is not beside Kiriko after the swap");
	ok(h && !(h.x === to.x && h.y === to.y), "overlap after the swap");
	ok(from, "");
});

test("なぐられる・帰る：キリコの となりに いない 敵は 同行者を なぐる。たおれると 村へ 帰り、冒険は つづく", () => {
	const r = make("guest-hit", "deep", "zero");
	r.f.monsters = [];
	const g = guestHere(r);
	ok(g, "no guest");
	if (!g) return;
	g.hp = 1;
	// 同行者の となりで、キリコから 2マス 以上 はなれた 床に 敵を 置く
	const spot = DIRS8.map((d) => step(g, d)).find(
		(q) => r.isFree(q.x, q.y) && dist(q, r.p) >= 2,
	);
	ok(spot, "no spot beside the guest");
	if (!spot) return;
	const m = spawnMonster(r, "tousuko", spot, { single: true });
	ok(m, "no monster");
	if (!m) return;
	m.status.sleep = 0;
	for (let i = 0; i < 30 && !r.s.guest?.down; i++) {
		// キリコは その場で 待つ（同行者が 先に なぐって たおすことも あるので、敵が 消えたら 置きなおす）
		if (!r.f.monsters.some((x) => x.hp > 0)) {
			const q = DIRS8.map((d) => step(g, d)).find(
				(c) => r.isFree(c.x, c.y) && dist(c, r.p) >= 2,
			);
			if (!q) break;
			const n = spawnMonster(r, "tousuko", q, { single: true });
			if (n) n.status.sleep = 0;
		}
		g.hp = 1;
		r.act({ c: "wait" });
	}
	ok(r.s.guest?.down, "the guest never went down");
	ok(!r.s.end, "the run ended with the guest");
	ok(
		r.s.log.some((l) => l === `${GUESTS.zero.name}は　村へ　帰っていった`),
		"no going-home line",
	);
	ok(guestHere(r) === null, "a downed guest is still on the floor");
});

test("だれが ついてくるか：板と 筋で 1人。持ち帰った あと・主人公と 同じ 人・村に まだ いない 人は 来ない", () => {
	ok(
		guestFor("deep", ["shallow", "main"], 7, "kiriko")?.who === "zero",
		"deep",
	);
	ok(guestFor("deep", ["deep"], 7, "kiriko") === null, "deep after the climax");
	ok(guestFor("deep", [], 7, "zero") === null, "zero as the hero");
	ok(guestFor("tropical", [], 7, "kiriko")?.who === "feris", "tropical");
	ok(guestFor("tropical", [], 1, "kiriko") === null, "feris not moved in");
	ok(guestFor("ato", [], 7, "kiriko") === null, "原住民 before the lighthouse");
	ok(guestFor("ato", ["opunu"], 7, "kiriko")?.who === "shobon", "ato");
	ok(guestFor("main", [], 7, "kiriko") === null, "no guest for 風呂板");
});

test("文：同行者の ひとことは ログに 収まる（名前つきで 全角 24字まで）。村の 文は 22字×2行", () => {
	for (const [id, g] of Object.entries(GUESTS))
		for (const l of [g.first, g.down, ...g.talk])
			ok(width(`${g.name}「${l}」`) <= 24, `${id}: ${l}`);
	for (const [d, p] of Object.entries(GUEST_PLAN)) {
		if (!p) continue;
		for (const t of [p.join, p.line])
			for (const l of t.split("\n")) ok(width(l) <= 22, `${d}: ${l}`);
	}
});

export const runGuestTests = async (): Promise<TestResult[]> => {
	const out: TestResult[] = [];
	for (const c of CASES) {
		try {
			await c.run();
			out.push({ id: "guest", name: c.name, ok: true });
		} catch (e) {
			out.push({
				id: "guest",
				name: c.name,
				ok: false,
				reason: e instanceof Fail ? e.message : String(e),
			});
		}
	}
	return out;
};
